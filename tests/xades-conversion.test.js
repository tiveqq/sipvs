/**
 * XAdES-BES to XAdES-T Conversion Tests
 */

const xadesBesValidator = require('../lib/xades-bes-validator');
const xadesTExtension = require('../lib/xades-t-extension');

// Sample XAdES-BES XML for testing
const SAMPLE_XADES_BES = `<?xml version="1.0" encoding="UTF-8"?>
<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
  <ds:SignedInfo>
    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    <ds:Reference URI="#data">
      <ds:Transforms>
        <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
      </ds:Transforms>
      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <ds:DigestValue>abc123def456</ds:DigestValue>
    </ds:Reference>
  </ds:SignedInfo>
  <ds:SignatureValue>SGVsbG8gV29ybGQgU2lnbmF0dXJl</ds:SignatureValue>
  <ds:KeyInfo>
    <ds:X509Data>
      <ds:X509Certificate>MIICpDCCAYwCCQC33wnvT5ZezjANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls</ds:X509Certificate>
    </ds:X509Data>
  </ds:KeyInfo>
  <ds:Object>
    <xades:QualifyingProperties>
      <xades:SignedProperties>
        <xades:SignedSignatureProperties>
          <xades:SigningTime>2024-01-15T10:30:00Z</xades:SigningTime>
          <xades:SigningCertificate>
            <xades:Cert>
              <xades:CertDigest>
                <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                <ds:DigestValue>abc123</ds:DigestValue>
              </xades:CertDigest>
              <xades:IssuerSerial>
                <ds:X509IssuerName>CN=Test</ds:X509IssuerName>
                <ds:X509SerialNumber>1</ds:X509SerialNumber>
              </xades:IssuerSerial>
            </xades:Cert>
          </xades:SigningCertificate>
        </xades:SignedSignatureProperties>
        <xades:SignedDataObjectProperties/>
      </xades:SignedProperties>
    </xades:QualifyingProperties>
  </ds:Object>
</ds:Signature>`;

describe('XAdES-BES Validator', () => {
  test('should load XML with whitespace preservation', () => {
    const doc = xadesBesValidator.loadXMLWithPreservation(SAMPLE_XADES_BES);
    expect(doc).toBeDefined();
    expect(doc.documentElement).toBeDefined();
  });

  test('should find elements by path', () => {
    const doc = xadesBesValidator.loadXMLWithPreservation(SAMPLE_XADES_BES);
    const signature = xadesBesValidator.findElement(doc, 'ds:Signature');
    expect(signature).toBeDefined();
    expect(signature.localName).toBe('Signature');
  });

  test('should validate valid XAdES-BES structure', () => {
    const doc = xadesBesValidator.loadXMLWithPreservation(SAMPLE_XADES_BES);
    const validation = xadesBesValidator.validateXAdESBES(doc);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  test('should detect missing required elements', () => {
    const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:SignedInfo/>
    </ds:Signature>`;
    
    const doc = xadesBesValidator.loadXMLWithPreservation(invalidXml);
    const validation = xadesBesValidator.validateXAdESBES(doc);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('should serialize XML preserving structure', () => {
    const doc = xadesBesValidator.loadXMLWithPreservation(SAMPLE_XADES_BES);
    const serialized = xadesBesValidator.serializeXML(doc);
    expect(serialized).toContain('ds:Signature');
    expect(serialized).toContain('ds:SignatureValue');
  });
});

describe('XAdES-T Extension', () => {
  test('should canonicalize SignatureValue element', () => {
    const doc = xadesBesValidator.loadXMLWithPreservation(SAMPLE_XADES_BES);
    const sigValueElem = xadesBesValidator.findElement(doc, 'ds:Signature/ds:SignatureValue');
    const canonicalized = xadesTExtension.canonicalizeSignatureValue(sigValueElem);
    expect(canonicalized).toBeInstanceOf(Buffer);
    expect(canonicalized.length).toBeGreaterThan(0);
  });

  test('should compute SHA-256 digest', () => {
    const testData = Buffer.from('test data');
    const digest = xadesTExtension.computeDigest(testData);
    expect(digest).toBeInstanceOf(Buffer);
    expect(digest.length).toBe(32); // SHA-256 produces 32 bytes
  });

  test('should create RFC 3161 TimeStampReq', () => {
    const digest = Buffer.from('a'.repeat(32)); // 32 bytes for SHA-256
    const tsReq = xadesTExtension.createTimeStampReq(digest);
    expect(tsReq).toBeInstanceOf(Buffer);
    expect(tsReq.length).toBeGreaterThan(0);
  });

  test('should extend XAdES-BES to XAdES-T', () => {
    const doc = xadesBesValidator.loadXMLWithPreservation(SAMPLE_XADES_BES);
    const timestampToken = 'base64encodedtimestamptoken';
    const extended = xadesTExtension.extendToXAdEST(doc, timestampToken);
    
    const serialized = xadesBesValidator.serializeXML(extended);
    expect(serialized).toContain('xades:SignatureTimeStamp');
    expect(serialized).toContain('xades:EncapsulatedTimeStamp');
    expect(serialized).toContain(timestampToken);
  });
});

describe('XAdES Namespace Handling', () => {
  test('should have correct namespace URIs', () => {
    expect(xadesBesValidator.NAMESPACES.ds).toBe('http://www.w3.org/2000/09/xmldsig#');
    expect(xadesBesValidator.NAMESPACES.xades).toBe('http://uri.etsi.org/01903/v1.3.2#');
    expect(xadesBesValidator.NAMESPACES.xzep).toBe('http://www.ditec.sk/ep/signature_formats/xades_zep/v1.0');
  });
});

