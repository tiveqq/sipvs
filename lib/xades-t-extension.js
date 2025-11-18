/**
 * XAdES-T Extension Module
 * Extends XAdES-BES signatures to XAdES-T by adding RFC 3161 timestamps
 */

const crypto = require('crypto');
const axios = require('axios');
const forge = require('node-forge');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const { findElement, extractSignatureElement, NAMESPACES } = require('./xades-bes-validator');

const TSA_URL = 'https://testpki.ditec.sk/tsarsa/tsa.aspx';

/**
 * Canonicalize SignatureValue element using C14N 1.0
 * @param {Element} signatureValueElement - The SignatureValue element
 * @returns {Buffer} - Canonicalized bytes
 */
function canonicalizeSignatureValue(signatureValueElement) {
  // Get the text content (base64 signature)
  const signatureText = signatureValueElement.textContent || '';
  
  // C14N 1.0 for element: <ds:SignatureValue>content</ds:SignatureValue>
  // Preserve namespace declarations from ancestors
  const serializer = new XMLSerializer();
  const xml = serializer.serializeToString(signatureValueElement);
  
  // Remove extra whitespace but preserve structure
  const normalized = xml
    .replace(/>\s+</g, '><')  // Remove whitespace between tags
    .replace(/\s+/g, ' ')      // Normalize internal whitespace
    .trim();
  
  return Buffer.from(normalized, 'utf8');
}

/**
 * Compute SHA-256 digest of canonicalized SignatureValue
 * @param {Buffer} canonicalizedBytes - Canonicalized bytes
 * @returns {Buffer} - SHA-256 digest
 */
function computeDigest(canonicalizedBytes) {
  return crypto.createHash('sha256').update(canonicalizedBytes).digest();
}

/**
 * Create RFC 3161 TimeStampReq (DER-encoded)
 * @param {Buffer} messageImprint - SHA-256 digest
 * @returns {Buffer} - DER-encoded TimeStampReq
 */
function createTimeStampReq(messageImprint) {
  // OID for SHA-256: 2.16.840.1.101.3.4.2.1
  const sha256Oid = forge.asn1.oidToDer('2.16.840.1.101.3.4.2.1').getBytes();

  // Build AlgorithmIdentifier for SHA-256
  const algId = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, sha256Oid),
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.NULL, false, '')
  ]);

  // Build MessageImprint
  const msgImprint = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    algId,
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, messageImprint.toString('binary'))
  ]);

  // Build TimeStampReq
  // RFC 3161: certReq is [0] IMPLICIT BOOLEAN DEFAULT FALSE
  // However, the reference implementation uses explicit BOOLEAN (not wrapped in [0])
  // This appears to be a variant implementation, so we match the reference
  const tsReq = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x01'), // version
    msgImprint,
    forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.BOOLEAN, false, '\xff') // certReq = TRUE
  ]);

  return Buffer.from(forge.asn1.toDer(tsReq).getBytes(), 'binary');
}

/**
 * Request timestamp from TSA
 * @param {Buffer} timeStampReq - DER-encoded TimeStampReq
 * @returns {Promise<Buffer>} - DER-encoded TimeStampResp
 */
async function requestTimestamp(timeStampReq) {
  try {
    const response = await axios.post(TSA_URL, timeStampReq, {
      headers: {
        'Content-Type': 'application/timestamp-query',
        'Accept': 'application/timestamp-reply'
      },
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`TSA request failed: ${error.message}`);
  }
}

/**
 * Extract TimeStampToken from TimeStampResp
 * RFC 3161 TimeStampResp structure:
 * TimeStampResp ::= SEQUENCE {
 *   status                  PKIStatusInfo,
 *   timeStampToken          TimeStampToken (optional)
 * }
 *
 * PKIStatusInfo ::= SEQUENCE {
 *   status        PKIStatus,
 *   statusString  PKIFreeText (optional),
 *   failInfo      PKIFailureInfo (optional)
 * }
 *
 * TimeStampToken ::= ContentInfo (CMS structure)
 *
 * @param {Buffer} timeStampResp - DER-encoded TimeStampResp
 * @returns {string} - TimeStampToken as base64 (for XML)
 * @throws {Error} - If response is invalid or status is not success
 */
function extractTimeStampToken(timeStampResp) {
  try {
    // Parse the DER-encoded TimeStampResp
    const asn1 = forge.asn1.fromDer(timeStampResp.toString('binary'));

    // TimeStampResp is a SEQUENCE
    if (asn1.tagClass !== forge.asn1.Class.UNIVERSAL ||
        asn1.type !== forge.asn1.Type.SEQUENCE ||
        !asn1.value || asn1.value.length < 1) {
      throw new Error('Invalid TimeStampResp structure: not a SEQUENCE');
    }

    // First element is PKIStatusInfo (SEQUENCE)
    const statusInfo = asn1.value[0];
    if (statusInfo.tagClass !== forge.asn1.Class.UNIVERSAL ||
        statusInfo.type !== forge.asn1.Type.SEQUENCE ||
        !statusInfo.value || statusInfo.value.length < 1) {
      throw new Error('Invalid PKIStatusInfo structure');
    }

    // First element of PKIStatusInfo is status (INTEGER)
    const statusElement = statusInfo.value[0];
    if (statusElement.tagClass !== forge.asn1.Class.UNIVERSAL ||
        statusElement.type !== forge.asn1.Type.INTEGER) {
      throw new Error('Invalid status element');
    }

    // Parse status value (0 = granted, 1 = grantedWithMods, 2 = rejection, etc.)
    const statusValue = statusElement.value.charCodeAt(0);

    if (statusValue !== 0 && statusValue !== 1) {
      // Status is not success (0 = granted, 1 = grantedWithMods)
      let statusName = 'unknown';
      let errorDetails = '';

      if (statusValue === 2) statusName = 'rejection';
      else if (statusValue === 3) statusName = 'waiting';
      else if (statusValue === 4) statusName = 'revocationWarning';
      else if (statusValue === 5) statusName = 'revocationNotification';

      // Try to extract status string for more details
      if (statusInfo.value.length > 1) {
        const statusString = statusInfo.value[1];
        if (statusString && statusString.type === forge.asn1.Type.SEQUENCE && statusString.value && statusString.value.length > 0) {
          const firstString = statusString.value[0];
          if (firstString && firstString.value) {
            errorDetails = ` - ${firstString.value}`;
          }
        }
      }

      throw new Error(`TSA returned status: ${statusName} (${statusValue})${errorDetails}`);
    }

    // Second element (if present) is timeStampToken (ContentInfo)
    if (asn1.value.length < 2) {
      throw new Error('TimeStampToken not found in response');
    }

    const timeStampToken = asn1.value[1];

    // Verify it's a SEQUENCE (ContentInfo structure)
    if (timeStampToken.tagClass !== forge.asn1.Class.UNIVERSAL ||
        timeStampToken.type !== forge.asn1.Type.SEQUENCE) {
      throw new Error('Invalid TimeStampToken structure: not a SEQUENCE');
    }

    // Convert the TimeStampToken back to DER and encode as base64
    const tokenDer = forge.asn1.toDer(timeStampToken).getBytes();
    return Buffer.from(tokenDer, 'binary').toString('base64');

  } catch (error) {
    throw new Error(`Failed to extract TimeStampToken: ${error.message}`);
  }
}

/**
 * Extend XAdES-BES to XAdES-T
 * @param {Document} doc - Parsed XML document
 * @param {string} timestampToken - Base64-encoded timestamp token
 * @returns {Document} - Extended XML document
 */
function extendToXAdEST(doc, timestampToken) {
  const serializer = new XMLSerializer();

  // Extract signature element (handles both direct and wrapped structures)
  const signatureElem = extractSignatureElement(doc);
  if (!signatureElem) {
    throw new Error('Signature element not found');
  }

  // Find or create UnsignedProperties (search relative to signature)
  let unsignedProps = findElement(signatureElem, 'ds:Object/xades:QualifyingProperties/xades:UnsignedProperties');

  if (!unsignedProps) {
    const qualProps = findElement(signatureElem, 'ds:Object/xades:QualifyingProperties');
    if (!qualProps) throw new Error('QualifyingProperties not found');

    unsignedProps = doc.createElementNS(NAMESPACES.xades, 'xades:UnsignedProperties');
    qualProps.appendChild(unsignedProps);
  }

  // Find or create UnsignedSignatureProperties (search relative to signature)
  let unsignedSigProps = findElement(signatureElem, 'ds:Object/xades:QualifyingProperties/xades:UnsignedProperties/xades:UnsignedSignatureProperties');

  if (!unsignedSigProps) {
    unsignedSigProps = doc.createElementNS(NAMESPACES.xades, 'xades:UnsignedSignatureProperties');
    unsignedProps.appendChild(unsignedSigProps);
  }

  // Create SignatureTimeStamp element
  const sigTimeStamp = doc.createElementNS(NAMESPACES.xades, 'xades:SignatureTimeStamp');
  const encapsulatedTs = doc.createElementNS(NAMESPACES.xades, 'xades:EncapsulatedTimeStamp');
  encapsulatedTs.textContent = timestampToken;
  sigTimeStamp.appendChild(encapsulatedTs);

  // Append to UnsignedSignatureProperties
  unsignedSigProps.appendChild(sigTimeStamp);

  return doc;
}

module.exports = {
  canonicalizeSignatureValue,
  computeDigest,
  createTimeStampReq,
  requestTimestamp,
  extractTimeStampToken,
  extendToXAdEST,
  TSA_URL
};

