# Slovak eIDAS Digital Signing Integration - Technical Documentation

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Component Descriptions](#component-descriptions)
4. [Data Flow](#data-flow)
5. [Standards Compliance](#standards-compliance)
6. [Implementation Guide](#implementation-guide)
7. [Security Considerations](#security-considerations)
8. [Testing and Verification](#testing-and-verification)
9. [Troubleshooting](#troubleshooting)

---

## Executive Summary

This document describes the integration of Slovak eIDAS-compliant electronic signing functionality into the XML Form Processing System for student registration. The implementation enables users to digitally sign their student registration forms using D.Signer/XAdES components, producing ASiC-E containers with XAdES-BES signatures that comply with Slovak eIDAS and KEP (Kvalifikovaný Elektronický Podpis) standards.

### Key Features
- ✅ Browser-based signing using D.Bridge JS v1.x API
- ✅ XAdES-BES qualified electronic signatures
- ✅ ASiC-E container format with embedded schemas and stylesheets
- ✅ Certificate-based authentication using provided FIIT credentials
- ✅ CRL (Certificate Revocation List) validation support
- ✅ Downloadable `.asice` files for archival and verification

### Technology Stack
- **Frontend**: D.Bridge JS v1.0, vanilla JavaScript
- **Backend**: Node.js, Express
- **Signing Component**: D.Signer/XAdES (locally installed)
- **Standards**: XMLDSig, XAdES-BES, ASiC-E, Slovak eIDAS/KEP

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Browser                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Student Registration Form (HTML/JS)                     │  │
│  │  - Form data collection                                  │  │
│  │  - XML generation                                        │  │
│  │  - "Podpísať" button                                     │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                         │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │  D.Bridge JS v1.0 Library                                │  │
│  │  - config.js, dCommon.min.js, dSigXadesBp.min.js        │  │
│  │  - Browser-to-KEP communication layer                    │  │
│  └────────────────────┬─────────────────────────────────────┘  │
└────────────────────────┼─────────────────────────────────────────┘
                         │ WebSocket/HTTP
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│              D.Launcher (Local Service)                          │
│  - Listens on localhost:37200                                    │
│  - Routes signing requests to D.Signer                           │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────────┐
│              D.Signer/XAdES Component                            │
│  - Performs cryptographic signing operations                     │
│  - Creates XAdES-BES signatures                                  │
│  - Packages results in ASiC-E containers                         │
│  - Uses certificate: FIITPodpisovatel.pfx                        │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Signed ASiC-E File  │
              │  (.asice container)  │
              └──────────────────────┘
```

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Node.js/Express Server                        │
│                   (http://localhost:3000)                       │
│                                                                 │
│  Existing Endpoints:                                            │
│  ├─ POST /api/save-xml          - Save form data as XML        │
│  ├─ POST /api/validate-xml      - Validate XML against XSD     │
│  ├─ POST /api/transform-xml     - Transform XML to HTML        │
│  └─ GET  /api/xml-files         - List saved XML files         │
│                                                                 │
│  New Signing Endpoints:                                         │
│  ├─ POST /api/prepare-signing   - Prepare signing payload      │
│  ├─ GET  /api/certificate/:name - Serve certificate files      │
│  └─ POST /api/verify-signature  - Verify ASiC-E signature      │
│                                                                 │
│  Static File Serving:                                           │
│  ├─ /public/*                   - Frontend assets              │
│  ├─ /certificate/*              - Certificate files (secured)  │
│  └─ /schemas/*                  - XSD schema files             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Descriptions

### 1. D.Signer/XAdES Component

**Purpose**: Local desktop application that performs cryptographic signing operations.

**Key Features**:
- Creates qualified electronic signatures (QES)
- Supports XAdES-BES, XAdES-EPES, XAdES-T profiles
- Generates ASiC-E containers
- Integrates with Slovak eIDAS infrastructure
- Validates certificates and CRLs

**Installation**:
- Download from: https://www.slovensko.sk/sk/na-stiahnutie
- Verify installation: https://epodpis.ditec.sk/install-check
- Required for all signing operations

### 2. D.Bridge JS v1.x API

**Purpose**: JavaScript library that enables browser-to-D.Signer communication.

**Core Files**:
```html
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/config.js"></script>
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/dCommon.min.js"></script>
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/dSigXadesBp.min.js"></script>
```

**Primary API Object**: `ditec.dSigXadesBpJs`

**Key Methods**:
- `deploy()` - Initialize D.Bridge connection
- `initialize()` - Prepare signing session
- `addXmlObject()` - Add XML document to be signed
- `addPdfObject()` - Add PDF document (optional)
- `sign()` - Execute signing operation
- `getSignatureWithASiCEnvelopeBase64()` - Retrieve signed ASiC-E container

### 3. ASiC-E Container Format

**Structure** (ZIP-based archive):
```
signed.asice/
├── META-INF/
│   ├── manifest.xml              # Container manifest
│   ├── signatures.xml            # XAdES signature(s)
│   └── ASiCManifest.xml         # ASiC manifest
├── student-registration.xml      # Signed XML document
├── student-registration.xsd      # XSD schema
├── student-registration.xsl      # XSLT stylesheet
└── student-registration.pdf      # PDF visualization (optional)
```

**MIME Type**: `application/vnd.etsi.asic-e+zip`

**Standards**:
- ETSI TS 102 918 (ASiC)
- ETSI EN 319 162-1 (ASiC Baseline Profile)

### 4. XAdES-BES Signature Profile

**XAdES-BES** (XML Advanced Electronic Signatures - Basic Electronic Signature)

**Components**:
- `<ds:Signature>` - XMLDSig signature structure
- `<ds:SignedInfo>` - Signed data references and algorithms
- `<ds:SignatureValue>` - Cryptographic signature value
- `<ds:KeyInfo>` - Signer's certificate information
- `<xades:QualifyingProperties>` - XAdES-specific properties
  - `<xades:SignedProperties>` - Signed qualifying properties
    - `<xades:SigningTime>` - Signature timestamp
    - `<xades:SigningCertificate>` - Certificate digest
    - `<xades:SignaturePolicyIdentifier>` - Policy reference

**Algorithms**:
- Signature: RSA-SHA256 (`http://www.w3.org/2001/04/xmldsig-more#rsa-sha256`)
- Digest: SHA-256 (`http://www.w3.org/2001/04/xmlenc#sha256`)
- Canonicalization: Exclusive XML C14N (`http://www.w3.org/2001/10/xml-exc-c14n#`)

---

## Data Flow

### Complete Signing Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: User Fills Form                                         │
│ - User enters student registration data                         │
│ - Form validates input fields                                   │
│ - User clicks "Save XML" button                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: XML Generation                                          │
│ - Frontend collects form data                                   │
│ - POST /api/save-xml with form data                            │
│ - Backend generates XML conforming to XSD schema                │
│ - XML saved to data/ directory                                  │
│ - Filename returned to frontend                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: User Initiates Signing                                  │
│ - User clicks "Podpísať" (Sign) button                          │
│ - Frontend validates that XML file exists                       │
│ - "Podpísať" button enabled only after successful save          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Prepare Signing Payload                                 │
│ - Frontend calls POST /api/prepare-signing                      │
│ - Backend reads:                                                │
│   • XML file (data/student-registration-*.xml)                  │
│   • XSD schema (schemas/student-registration.xsd)               │
│   • XSLT stylesheet (stylesheets/student-registration.xsl)      │
│ - Backend encodes files as Base64                               │
│ - Returns signing payload to frontend                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: D.Bridge JS Initialization                              │
│ - Frontend loads D.Bridge JS libraries                          │
│ - Calls ditec.dSigXadesBpJs.deploy()                           │
│ - Calls ditec.dSigXadesBpJs.initialize()                       │
│ - Establishes connection to D.Launcher (localhost:37200)        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: Add Documents to Signing Session                        │
│ - Calls ditec.dSigXadesBpJs.addXmlObject()                     │
│   • objectId: "student-registration-xml"                        │
│   • objectDescription: "Student Registration Form"             │
│   • content: Base64-encoded XML                                 │
│   • formatIdentifier: XMLDataContainer format URI               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 7: Execute Signing Operation                               │
│ - Calls ditec.dSigXadesBpJs.sign()                             │
│   • signatureId: "signature-" + timestamp                       │
│   • digestAlgorithm: SHA-256                                    │
│ - D.Signer prompts user for certificate password                │
│ - User enters password: "test"                                  │
│ - D.Signer validates certificate against CRL                    │
│ - D.Signer creates XAdES-BES signature                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 8: Package in ASiC-E Container                             │
│ - D.Signer creates ZIP-based ASiC-E container                   │
│ - Includes signed XML, XAdES signature, manifests               │
│ - Encodes container as Base64                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 9: Retrieve and Download                                   │
│ - Calls getSignatureWithASiCEnvelopeBase64()                    │
│ - Receives Base64-encoded .asice file                           │
│ - Frontend decodes Base64 to binary                             │
│ - Creates Blob and triggers download                            │
│ - Filename: student-registration-signed-[timestamp].asice       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Standards Compliance

### 1. XMLDSig (XML Digital Signature)

**Standard**: W3C Recommendation

**Key Elements**:
- `<ds:Signature>` - Root signature element
- `<ds:SignedInfo>` - Information that is signed
- `<ds:SignatureMethod>` - RSA-SHA256
- `<ds:DigestMethod>` - SHA-256
- `<ds:SignatureValue>` - Signature bytes
- `<ds:KeyInfo>` - Certificate information

### 2. XAdES-BES Profile

**Standard**: ETSI EN 319 132-1

**Required Elements**:
- `<xades:SigningTime>` - Signature timestamp
- `<xades:SigningCertificate>` - Certificate digest
- `<xades:SignaturePolicyIdentifier>` - Policy reference

### 3. ASiC-E Container

**Standard**: ETSI EN 319 162-1

**Structure**: ZIP-based with META-INF/ directory

### 4. Slovak eIDAS/KEP

**Requirements**:
- ✅ Qualified certificate
- ✅ XAdES ZEP BP profile
- ✅ XMLDataContainer format
- ✅ CRL validation

---

## Implementation Guide

### Backend Implementation

See `SIGNING-BACKEND.md` for complete backend code including:
- Certificate serving endpoint
- Signing preparation endpoint
- XMLDataContainer creation
- Helper functions

### Frontend Implementation

See `SIGNING-FRONTEND.md` for complete frontend code including:
- D.Bridge JS integration
- Signing UI components
- Event handlers
- Download functionality

### Complete Code Files

The implementation consists of:

1. **Backend Changes** (`server.js`):
   - `/api/certificate/:filename` - Serve certificates
   - `/api/prepare-signing` - Prepare signing payload
   - `createXMLDataContainer()` - Helper function

2. **Frontend Changes**:
   - `public/index.html` - Add "Podpísať" button and D.Bridge JS scripts
   - `public/script.js` - Add signing logic
   - `public/signing.js` - New file with D.Bridge JS integration

3. **Documentation**:
   - `SIGNING-INTEGRATION.md` - This file (architecture and overview)
   - `SIGNING-BACKEND.md` - Backend implementation details
   - `SIGNING-FRONTEND.md` - Frontend implementation details
   - `SIGNING-TESTING.md` - Testing procedures

---

## Security Considerations

### 1. Certificate Security

**Private Key Protection**:
- ✅ Private key (`.pfx`) never transmitted over network
- ✅ Password stored locally, not in code
- ✅ D.Signer handles all cryptographic operations locally

**Certificate Validation**:
- ✅ CRL checking enabled
- ✅ Certificate chain validation
- ✅ Expiration date verification

### 2. Data Integrity

**XML Integrity**:
- ✅ SHA-256 digest of XML content
- ✅ Signature covers all referenced data
- ✅ XSD and XSLT schemas included in signature

**Container Integrity**:
- ✅ ASiC-E manifest includes all files
- ✅ Signature covers manifest
- ✅ Tamper-evident container

### 3. Communication Security

**D.Bridge Communication**:
- ✅ Localhost-only communication (127.0.0.1:37200)
- ✅ No external network access required
- ✅ CORS restrictions enforced

**HTTPS Considerations**:
- ⚠️ Production deployment should use HTTPS
- ⚠️ Certificate files should be served over HTTPS
- ⚠️ Consider implementing authentication for certificate access

### 4. Input Validation

**XML Validation**:
- ✅ Validate against XSD before signing
- ✅ Sanitize user input
- ✅ Prevent XML injection attacks

**Filename Validation**:
- ✅ Whitelist allowed certificate files
- ✅ Prevent path traversal attacks
- ✅ Validate file extensions

---

## Testing and Verification

### Prerequisites

1. **D.Suite Installed**: Verify at https://epodpis.ditec.sk/install-check
2. **D.Launcher Running**: Check system tray/menu bar
3. **Certificate Files**: Ensure all files in `/certificate` directory
4. **Server Running**: `npm start` on http://localhost:3000

### Test Procedure

#### 1. Basic Functionality Test

```bash
# Start server
npm start

# Open browser
open http://localhost:3000
```

**Steps**:
1. Fill out student registration form
2. Click "Save XML"
3. Verify XML file created in `data/` directory
4. Click "Podpísať" button
5. D.Signer window should appear
6. Enter password: `test`
7. Confirm signing operation
8. Verify `.asice` file downloads

#### 2. Signature Verification

**Using Online Validator**:
```
https://www.slovensko.sk/sk/sluzby/sluzba-detail/_overenie-podpisu
```

**Steps**:
1. Upload downloaded `.asice` file
2. Verify signature status: "Platný podpis"
3. Check signer information
4. Verify timestamp

**Using Command Line** (if available):
```bash
# Extract ASiC-E container
unzip student-registration-signed-*.asice -d extracted/

# View signature
cat extracted/META-INF/signatures.xml

# Verify structure
ls -R extracted/
```

#### 3. Integration Test

Complete workflow test:
```javascript
// Run automated test
npm test -- --testNamePattern="signing workflow"
```

### Expected Results

✅ **Successful Signing**:
- D.Signer window appears
- Password prompt shown
- Signing completes without errors
- `.asice` file downloads
- File size > 10KB

✅ **Valid Signature**:
- Signature validates successfully
- Certificate chain valid
- CRL check passes
- Timestamp present

❌ **Common Issues**:
- D.Signer not installed → Install from slovensko.sk
- D.Launcher not running → Start service
- Wrong password → Use "test"
- Certificate expired → Use valid certificate

---

## Troubleshooting

### Issue 1: D.Signer Not Found

**Symptoms**:
- Error: "D.Signer nie je nainštalovaný"
- Connection timeout to localhost:37200

**Solutions**:
1. Install D.Suite from https://www.slovensko.sk/sk/na-stiahnutie
2. Verify installation at https://epodpis.ditec.sk/install-check
3. Restart D.Launcher service
4. Check firewall settings (allow localhost:37200)

### Issue 2: Certificate Password Error

**Symptoms**:
- Error: "Nesprávne heslo"
- Signing operation fails

**Solutions**:
1. Verify password in `certificate/FIITPodpisovatel.txt`
2. Ensure correct certificate file selected
3. Check certificate not expired
4. Try re-importing certificate

### Issue 3: Invalid Signature

**Symptoms**:
- Signature validation fails
- Error: "Podpis nie je platný"

**Solutions**:
1. Verify CRL accessible: Check `certificate/crl.txt`
2. Ensure system time correct
3. Check certificate chain complete
4. Verify XML not modified after signing

### Issue 4: ASiC-E Download Fails

**Symptoms**:
- No download triggered
- Empty file downloaded
- Browser console errors

**Solutions**:
1. Check browser console for JavaScript errors
2. Verify Base64 decoding successful
3. Check Blob creation
4. Try different browser
5. Disable browser extensions

### Issue 5: CORS Errors

**Symptoms**:
- Error: "CORS policy blocked"
- D.Bridge JS fails to load

**Solutions**:
1. Ensure D.Bridge JS loaded from slovensko.sk CDN
2. Check browser security settings
3. Verify localhost:3000 allowed
4. Try incognito/private mode

---

## Appendix

### A. Certificate Files

Located in `/certificate` directory:

| File | Description | Usage |
|------|-------------|-------|
| `FIITPodpisovatel.cer` | User certificate (public key) | Certificate information |
| `FIITPodpisovatel.pfx` | Private key container | Signing operation |
| `FIITPodpisovatel.txt` | Password file | Contains: "test" |
| `dtccert.cer` | Issuing authority certificate | Certificate chain |
| `crl.txt` | CRL URL | Revocation checking |

### B. API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/save-xml` | POST | Save form data as XML |
| `/api/validate-xml` | POST | Validate XML against XSD |
| `/api/transform-xml` | POST | Transform XML to HTML |
| `/api/xml-files` | GET | List saved XML files |
| `/api/prepare-signing` | POST | Prepare signing payload |
| `/api/certificate/:name` | GET | Serve certificate files |

### C. D.Bridge JS API Reference

**Initialization**:
```javascript
ditec.dSigXadesBpJs.deploy(null, callback)
ditec.dSigXadesBpJs.initialize(callback)
```

**Adding Documents**:
```javascript
ditec.dSigXadesBpJs.addXmlObject(id, description, content, formatId, callback)
ditec.dSigXadesBpJs.addPdfObject(id, description, content, callback)
```

**Signing**:
```javascript
ditec.dSigXadesBpJs.sign(signatureId, digestAlgorithm, signingCertificate, callback)
```

**Retrieving Result**:
```javascript
ditec.dSigXadesBpJs.getSignatureWithASiCEnvelopeBase64(callback)
```

### D. Useful Links

- **D.Suite Download**: https://www.slovensko.sk/sk/na-stiahnutie
- **Installation Check**: https://epodpis.ditec.sk/install-check
- **Test Page**: https://qes.ditec.sk/upvs/zep/dbridge_js/v1.0/test/dsignerbp.html
- **Signature Verification**: https://www.slovensko.sk/sk/sluzby/sluzba-detail/_overenie-podpisu
- **Integrator Documentation**: https://www.slovensko.sk/sk/na-stiahnutie/informacie-pre-integratorov-ap

---

**Document Version**: 1.0
**Last Updated**: 2025-10-07
**Author**: XML Form Processing System Team
