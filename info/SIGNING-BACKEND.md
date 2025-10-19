# Backend Implementation for eIDAS Signing

This document contains the complete backend implementation for Slovak eIDAS digital signing integration.

## Overview

The backend provides three new endpoints:
1. `/api/prepare-signing` - Prepares XML data for signing
2. `/api/certificate/:filename` - Serves certificate files securely
3. `/api/verify-signature` - Verifies ASiC-E signatures (optional)

## Implementation

### Step 1: Add Required Dependencies

No new dependencies required! We use existing packages:
- `fs-extra` - File system operations
- `path` - Path manipulation
- `crypto` - SHA-256 hashing (built-in Node.js)

### Step 2: Add Helper Functions

Add these functions to `server.js` before the route definitions:

```javascript
/**
 * Create XMLDataContainer structure for Slovak eIDAS signing
 * Wraps XML content with embedded XSD and XSLT references
 * 
 * @param {string} xmlContent - Original XML content
 * @param {string} xsdContent - XSD schema content
 * @param {string} xslContent - XSLT stylesheet content
 * @param {string} identifier - Unique identifier for the document
 * @returns {string} XMLDataContainer XML string
 */
function createXMLDataContainer(xmlContent, xsdContent, xslContent, identifier) {
  const crypto = require('crypto');
  
  // Calculate SHA-256 digests for XSD and XSLT
  const xsdDigest = crypto.createHash('sha256').update(xsdContent).digest('base64');
  const xslDigest = crypto.createHash('sha256').update(xslContent).digest('base64');
  
  // Extract the root element from original XML
  // Remove XML declaration if present
  const xmlWithoutDeclaration = xmlContent.replace(/<\?xml[^?]*\?>\s*/g, '');
  
  // Build XMLDataContainer
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<xdc:XMLDataContainer xmlns:xdc="http://data.gov.sk/def/container/xmldatacontainer+xml/1.1">
  <xdc:XMLData ContentType="application/xml; charset=UTF-8" Identifier="${identifier}" Version="1.0">
    <xdc:XMLContent>${xmlWithoutDeclaration}</xdc:XMLContent>
  </xdc:XMLData>
  <xdc:UsedSchemasReferenced>
    <xdc:UsedXSDReference SchemaFileIdentifier="student-registration.xsd">
      <xdc:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <xdc:DigestValue>${xsdDigest}</xdc:DigestValue>
      <xdc:TransformAlgorithm Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    </xdc:UsedXSDReference>
  </xdc:UsedSchemasReferenced>
  <xdc:UsedPresentationSchemasReferenced>
    <xdc:UsedXSLTReference PresentationSchemaFileIdentifier="student-registration.xsl">
      <xdc:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <xdc:DigestValue>${xslDigest}</xdc:DigestValue>
      <xdc:TransformAlgorithm Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    </xdc:UsedXSLTReference>
  </xdc:UsedPresentationSchemasReferenced>
</xdc:XMLDataContainer>`;
  
  return container;
}

/**
 * Escape XML special characters
 * Already exists in server.js, but included here for reference
 */
function escapeXML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

### Step 3: Add Certificate Serving Endpoint

Add this endpoint to `server.js`:

```javascript
/**
 * Serve certificate files securely
 * GET /api/certificate/:filename
 * 
 * Security measures:
 * - Whitelist of allowed files
 * - No directory traversal
 * - Proper content types
 * 
 * Note: In production, consider:
 * - Authentication/authorization
 * - Rate limiting
 * - HTTPS only
 */
app.get('/api/certificate/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Whitelist allowed certificate files
    // Only public certificates and CRL URL, NOT the private key (.pfx)
    const allowedFiles = [
      'FIITPodpisovatel.cer',  // Public certificate
      'dtccert.cer',            // Issuing authority certificate
      'crl.txt'                 // CRL URL
    ];
    
    // Security: Prevent access to private key
    if (filename === 'FIITPodpisovatel.pfx' || filename === 'FIITPodpisovatel.txt') {
      return res.status(403).json({
        success: false,
        error: 'Access to private key files is not allowed'
      });
    }
    
    // Security: Check whitelist
    if (!allowedFiles.includes(filename)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - file not in whitelist'
      });
    }
    
    const filepath = path.join('certificate', filename);
    
    // Check if file exists
    if (!await fs.pathExists(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'Certificate file not found'
      });
    }
    
    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.cer') {
      contentType = 'application/x-x509-ca-cert';
    } else if (ext === '.txt') {
      contentType = 'text/plain; charset=utf-8';
    }
    
    // Read and send file
    const fileContent = await fs.readFile(filepath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(fileContent);
    
  } catch (error) {
    console.error('Certificate serving error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to serve certificate: ${error.message}`
    });
  }
});
```

### Step 4: Add Signing Preparation Endpoint

Add this endpoint to `server.js`:

```javascript
/**
 * Prepare signing payload
 * POST /api/prepare-signing
 * 
 * Request body:
 * {
 *   "filename": "student-registration-2024-10-07.xml"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "payload": {
 *     "xmlBase64": "...",           // Base64-encoded XMLDataContainer
 *     "xsdBase64": "...",           // Base64-encoded XSD schema
 *     "xslBase64": "...",           // Base64-encoded XSLT stylesheet
 *     "filename": "...",            // Original filename
 *     "identifier": "...",          // Document identifier
 *     "description": "..."          // Document description
 *   }
 * }
 */
app.post('/api/prepare-signing', async (req, res) => {
  try {
    const { filename } = req.body;
    
    // Validate input
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }
    
    // Security: Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename'
      });
    }
    
    // Define file paths
    const xmlPath = path.join('data', filename);
    const xsdPath = path.join('schemas', 'student-registration.xsd');
    const xslPath = path.join('stylesheets', 'student-registration.xsl');
    
    // Check if XML file exists
    if (!await fs.pathExists(xmlPath)) {
      return res.status(404).json({
        success: false,
        error: 'XML file not found. Please save the form first.'
      });
    }
    
    // Check if schema files exist
    if (!await fs.pathExists(xsdPath)) {
      return res.status(404).json({
        success: false,
        error: 'XSD schema file not found'
      });
    }
    
    if (!await fs.pathExists(xslPath)) {
      return res.status(404).json({
        success: false,
        error: 'XSLT stylesheet file not found'
      });
    }
    
    // Read all files
    const xmlContent = await fs.readFile(xmlPath, 'utf8');
    const xsdContent = await fs.readFile(xsdPath, 'utf8');
    const xslContent = await fs.readFile(xslPath, 'utf8');
    
    // Generate unique identifier
    const timestamp = Date.now();
    const identifier = `student-registration-${timestamp}`;
    
    // Create XMLDataContainer structure
    const xmlDataContainer = createXMLDataContainer(
      xmlContent,
      xsdContent,
      xslContent,
      identifier
    );
    
    // Encode as Base64
    const xmlBase64 = Buffer.from(xmlDataContainer, 'utf8').toString('base64');
    const xsdBase64 = Buffer.from(xsdContent, 'utf8').toString('base64');
    const xslBase64 = Buffer.from(xslContent, 'utf8').toString('base64');
    
    // Return signing payload
    res.json({
      success: true,
      payload: {
        xmlBase64: xmlBase64,
        xsdBase64: xsdBase64,
        xslBase64: xslBase64,
        filename: filename,
        identifier: identifier,
        description: 'Student Registration Form - University Enrollment',
        formatIdentifier: 'http://data.gov.sk/def/container/xmldatacontainer+xml/1.1'
      }
    });
    
  } catch (error) {
    console.error('Signing preparation error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to prepare signing payload: ${error.message}`
    });
  }
});
```

### Step 5: Add Signature Verification Endpoint (Optional)

This endpoint is optional but useful for testing:

```javascript
/**
 * Verify ASiC-E signature (optional endpoint for testing)
 * POST /api/verify-signature
 * 
 * Note: This is a placeholder. Full verification requires:
 * - Extracting ASiC-E container (unzip)
 * - Parsing XAdES signature
 * - Validating certificate chain
 * - Checking CRL
 * - Verifying digest values
 * 
 * For production, use official Slovak eIDAS validation services
 */
app.post('/api/verify-signature', async (req, res) => {
  try {
    // This is a placeholder implementation
    // Full signature verification is complex and should use
    // official validation libraries or services
    
    res.json({
      success: true,
      message: 'Signature verification not implemented in this version',
      recommendation: 'Use official validator at https://www.slovensko.sk/sk/sluzby/sluzba-detail/_overenie-podpisu'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Verification failed: ${error.message}`
    });
  }
});
```

## Complete Backend Changes Summary

Add to `server.js` in this order:

1. **Helper Functions** (after existing helper functions, around line 380):
   - `createXMLDataContainer()`

2. **New Endpoints** (after existing endpoints, around line 950):
   - `GET /api/certificate/:filename`
   - `POST /api/prepare-signing`
   - `POST /api/verify-signature` (optional)

## Testing Backend Endpoints

### Test Certificate Serving

```bash
# Test public certificate (should work)
curl http://localhost:3000/api/certificate/FIITPodpisovatel.cer

# Test CRL URL (should work)
curl http://localhost:3000/api/certificate/crl.txt

# Test private key (should be blocked)
curl http://localhost:3000/api/certificate/FIITPodpisovatel.pfx
# Expected: 403 Forbidden
```

### Test Signing Preparation

```bash
# First, save an XML file through the form, then:
curl -X POST http://localhost:3000/api/prepare-signing \
  -H "Content-Type: application/json" \
  -d '{"filename": "student-registration-2024-10-07T12-00-00-000Z.xml"}'

# Expected response:
# {
#   "success": true,
#   "payload": {
#     "xmlBase64": "...",
#     "xsdBase64": "...",
#     "xslBase64": "...",
#     "filename": "...",
#     "identifier": "...",
#     "description": "...",
#     "formatIdentifier": "..."
#   }
# }
```

## Security Considerations

### 1. Private Key Protection

✅ **Implemented**:
- Private key (`.pfx`) file is explicitly blocked from HTTP access
- Password file (`.txt`) is also blocked
- Only public certificates and CRL URL are served

⚠️ **Important**: The private key should NEVER be transmitted over the network. D.Signer accesses it directly from the local filesystem.

### 2. Input Validation

✅ **Implemented**:
- Filename validation (no directory traversal)
- Whitelist for certificate files
- File existence checks
- Content type validation

### 3. Production Recommendations

For production deployment:

1. **Use HTTPS**: All endpoints should be served over HTTPS
2. **Add Authentication**: Protect certificate endpoints with authentication
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Logging**: Add audit logging for signing operations
5. **CORS**: Configure CORS properly for your domain
6. **CSP**: Implement Content Security Policy headers

## Error Handling

All endpoints return consistent error responses:

```javascript
{
  "success": false,
  "error": "Error message here"
}
```

Common error codes:
- `400` - Bad Request (invalid input)
- `403` - Forbidden (access denied)
- `404` - Not Found (file not found)
- `500` - Internal Server Error (server error)

## Next Steps

After implementing the backend:

1. ✅ Test all endpoints with curl/Postman
2. ✅ Verify certificate files are accessible
3. ✅ Test signing preparation with real XML files
4. ➡️ Proceed to frontend implementation (see `SIGNING-FRONTEND.md`)

---

**File**: SIGNING-BACKEND.md  
**Version**: 1.0  
**Last Updated**: 2025-10-07

