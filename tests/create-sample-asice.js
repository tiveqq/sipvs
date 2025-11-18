/**
 * Create sample ASiC-E container for testing
 * This script generates a valid ASiC-E container with XAdES-BES signature
 */

const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

// Sample XAdES-BES signature
const SAMPLE_SIGNATURE = `<?xml version="1.0" encoding="UTF-8"?>
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

// Sample payload file
const SAMPLE_PAYLOAD = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <title>Sample Document</title>
  <content>This is a sample document for testing ASiC-E containers.</content>
</document>`;

async function createSampleAsice() {
  try {
    const zip = new AdmZip();
    
    // Add mimetype FIRST, uncompressed (STORE method)
    const mimetypeContent = 'application/vnd.etsi.asic-e+zip';
    zip.addFile('mimetype', Buffer.from(mimetypeContent), '', 0); // 0 = STORE
    
    // Add sample payload file
    zip.addFile('document.xml', Buffer.from(SAMPLE_PAYLOAD, 'utf8'));
    
    // Create manifest
    const signatureDigest = crypto.createHash('sha256').update(SAMPLE_SIGNATURE).digest('base64');
    const payloadDigest = crypto.createHash('sha256').update(SAMPLE_PAYLOAD).digest('base64');
    
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:Manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:media-type="application/vnd.etsi.asic-e+zip" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="application/xml" manifest:full-path="document.xml">
    <DigestValue>${payloadDigest}</DigestValue>
  </manifest:file-entry>
  <manifest:file-entry manifest:media-type="application/xml" manifest:full-path="META-INF/signatures.xml">
    <DigestValue>${signatureDigest}</DigestValue>
  </manifest:file-entry>
</manifest:Manifest>`;
    
    // Add manifest
    zip.addFile('META-INF/manifest.xml', Buffer.from(manifest, 'utf8'));
    
    // Add signature
    zip.addFile('META-INF/signatures.xml', Buffer.from(SAMPLE_SIGNATURE, 'utf8'));
    
    // Save to sample directory
    const sampleDir = path.join(__dirname, '..', 'sample');
    await fs.ensureDir(sampleDir);
    
    const outputPath = path.join(sampleDir, 'sample-xades-bes.asice');
    await fs.writeFile(outputPath, zip.toBuffer());
    
    console.log('✅ Sample ASiC-E container created:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('❌ Failed to create sample ASiC-E container:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  createSampleAsice().catch(console.error);
}

module.exports = { createSampleAsice, SAMPLE_SIGNATURE, SAMPLE_PAYLOAD };

