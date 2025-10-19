# Testing Guide for Slovak eIDAS Digital Signing

This document provides comprehensive testing procedures for the Slovak eIDAS digital signing integration.

## Prerequisites

### 1. D.Suite Installation

**Required**: D.Suite must be installed and running on your local machine.

**Installation Steps**:
```bash
# Download D.Suite from official Slovak government website
# URL: https://www.slovensko.sk/sk/na-stiahnutie

# For macOS:
# 1. Download D.Suite installer (.dmg or .pkg)
# 2. Open installer and follow instructions
# 3. Grant necessary permissions when prompted

# For Windows:
# 1. Download D.Suite installer (.exe or .msi)
# 2. Run installer as Administrator
# 3. Follow installation wizard

# For Linux:
# 1. Download D.Suite package (.deb or .rpm)
# 2. Install using package manager
# 3. Start D.Launcher service
```

**Verify Installation**:
```bash
# Open browser and visit:
https://epodpis.ditec.sk/install-check

# Expected result:
# ✅ "D.Signer je nainštalovaný a funkčný"
# ✅ Version information displayed
# ✅ Connection to localhost:37200 successful
```

### 2. Certificate Files

Ensure all certificate files are present in the `/certificate` directory:

```bash
ls -la certificate/

# Expected files:
# - FIITPodpisovatel.cer    (Public certificate)
# - FIITPodpisovatel.pfx    (Private key - password: "test")
# - FIITPodpisovatel.txt    (Password file)
# - dtccert.cer             (Issuing authority certificate)
# - crl.txt                 (CRL URL)
```

### 3. Server Running

```bash
# Start the server
npm start

# Expected output:
# Server running on http://localhost:3000
```

## Test Suite

### Test 1: Basic Functionality Test

**Objective**: Verify complete signing workflow from form submission to ASiC-E download.

**Steps**:

1. **Open Application**:
   ```bash
   open http://localhost:3000
   ```

2. **Fill Form**:
   - Enter student information in all required fields
   - Use sample data or click "Load Sample Data" button

3. **Save XML**:
   - Click "Save XML" button
   - Verify success message appears
   - Verify "Podpísať (Sign)" button becomes enabled

4. **Initiate Signing**:
   - Click "🔐 Podpísať (Sign)" button
   - Verify button text changes to "🔄 Preparing..."
   - Verify status message: "Preparing document for signing..."

5. **D.Signer Interaction**:
   - D.Signer window should appear
   - Verify document information is displayed
   - Enter password: `test`
   - Click "Podpísať" (Sign) button in D.Signer

6. **Download Verification**:
   - Verify status message: "✅ Document signed successfully!"
   - Verify `.asice` file downloads automatically
   - Verify filename format: `student-registration-*-signed-*.asice`
   - Verify file size > 10KB

**Expected Results**:
- ✅ All steps complete without errors
- ✅ ASiC-E file downloads successfully
- ✅ Button returns to normal state after 3 seconds

**Common Issues**:
- ❌ D.Signer doesn't appear → Check D.Launcher is running
- ❌ Password rejected → Verify using "test" as password
- ❌ No download → Check browser download settings

---

### Test 2: Backend Endpoints Test

**Objective**: Verify backend endpoints are working correctly.

**Test 2.1: Certificate Serving**

```bash
# Test public certificate (should work)
curl -v http://localhost:3000/api/certificate/FIITPodpisovatel.cer

# Expected:
# HTTP/1.1 200 OK
# Content-Type: application/x-x509-ca-cert
# [Binary certificate data]

# Test CRL URL (should work)
curl http://localhost:3000/api/certificate/crl.txt

# Expected:
# HTTP/1.1 200 OK
# Content-Type: text/plain
# https://testpki.ditec.sk/CertGen2/Data/pavlik/DITEC%20Test%20CA/Crls/DITEC%20Test%20CA.crl

# Test private key (should be blocked)
curl http://localhost:3000/api/certificate/FIITPodpisovatel.pfx

# Expected:
# HTTP/1.1 403 Forbidden
# {"success":false,"error":"Access to private key files is not allowed"}

# Test non-whitelisted file (should be blocked)
curl http://localhost:3000/api/certificate/../../server.js

# Expected:
# HTTP/1.1 403 Forbidden
# {"success":false,"error":"Access denied - file not in whitelist"}
```

**Test 2.2: Signing Preparation**

```bash
# First, save an XML file through the web interface, then:

# Test with valid filename
curl -X POST http://localhost:3000/api/prepare-signing \
  -H "Content-Type: application/json" \
  -d '{"filename": "student-registration-2024-10-07T12-00-00-000Z.xml"}'

# Expected:
# {
#   "success": true,
#   "payload": {
#     "xmlBase64": "...",
#     "xsdBase64": "...",
#     "xslBase64": "...",
#     "filename": "...",
#     "identifier": "student-registration-...",
#     "description": "Student Registration Form - University Enrollment",
#     "formatIdentifier": "http://data.gov.sk/def/container/xmldatacontainer+xml/1.1"
#   }
# }

# Test with missing filename
curl -X POST http://localhost:3000/api/prepare-signing \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected:
# HTTP/1.1 400 Bad Request
# {"success":false,"error":"Filename is required"}

# Test with directory traversal attempt
curl -X POST http://localhost:3000/api/prepare-signing \
  -H "Content-Type: application/json" \
  -d '{"filename": "../../../etc/passwd"}'

# Expected:
# HTTP/1.1 400 Bad Request
# {"success":false,"error":"Invalid filename"}
```

---

### Test 3: ASiC-E Container Validation

**Objective**: Verify the signed ASiC-E container is valid and conforms to standards.

**Test 3.1: Structure Verification**

```bash
# Extract the ASiC-E container
unzip student-registration-*-signed-*.asice -d extracted/

# Verify structure
ls -R extracted/

# Expected structure:
# extracted/
# ├── META-INF/
# │   ├── manifest.xml
# │   ├── signatures.xml
# │   └── ASiCManifest.xml (optional)
# ├── student-registration-*.xml
# ├── student-registration.xsd (optional)
# └── student-registration.xsl (optional)

# Verify mimetype file (if present)
cat extracted/mimetype

# Expected:
# application/vnd.etsi.asic-e+zip
```

**Test 3.2: Signature Verification**

```bash
# View the XAdES signature
cat extracted/META-INF/signatures.xml | head -50

# Expected elements:
# - <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
# - <ds:SignedInfo>
# - <ds:SignatureValue>
# - <ds:KeyInfo>
# - <xades:QualifyingProperties>
# - <xades:SignedProperties>
# - <xades:SigningTime>
# - <xades:SigningCertificate>
```

**Test 3.3: Online Validation**

```bash
# Open official Slovak signature validator
open https://www.slovensko.sk/sk/sluzby/sluzba-detail/_overenie-podpisu

# Steps:
# 1. Upload the .asice file
# 2. Click "Overiť podpis" (Verify Signature)
# 3. Wait for validation results

# Expected results:
# ✅ Podpis je platný (Signature is valid)
# ✅ Signer information displayed
# ✅ Signing time displayed
# ✅ Certificate chain valid
# ✅ No warnings or errors
```

---

### Test 4: Error Handling Tests

**Test 4.1: D.Signer Not Installed**

**Steps**:
1. Stop D.Launcher service
2. Try to sign a document
3. Verify error message appears

**Expected**:
```
❌ Signing failed: D.Signer is not installed or not running.

Please:
1. Install D.Suite from: https://www.slovensko.sk/sk/na-stiahnutie
2. Verify installation at: https://epodpis.ditec.sk/install-check
3. Ensure D.Launcher service is running
4. Refresh this page and try again
```

**Test 4.2: User Cancels Signing**

**Steps**:
1. Click "Podpísať" button
2. When D.Signer window appears, click "Cancel"

**Expected**:
```
❌ Signing failed: Signing operation was cancelled by user.
```

**Test 4.3: Wrong Password**

**Steps**:
1. Click "Podpísať" button
2. Enter wrong password in D.Signer
3. Verify error message

**Expected**:
```
❌ Signing failed: Certificate error occurred.

Please check:
1. Certificate is valid and not expired
2. Correct password entered (default: "test")
3. Certificate file is accessible
```

**Test 4.4: XML File Not Saved**

**Steps**:
1. Open fresh page
2. Try to click "Podpísať" button (should be disabled)
3. Verify button is disabled

**Expected**:
- Button is disabled (grayed out)
- Cannot click button

---

### Test 5: Browser Compatibility Tests

**Objective**: Verify signing works across different browsers.

**Browsers to Test**:
- ✅ Chrome/Chromium 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**Test Steps** (for each browser):
1. Open http://localhost:3000
2. Complete signing workflow
3. Verify ASiC-E file downloads
4. Verify no console errors

**Known Issues**:
- Safari may require pop-up permission for D.Signer window
- Firefox may show security warning for localhost:37200 connection

---

### Test 6: Integration Test

**Objective**: Test complete workflow including validation and transformation.

**Steps**:

1. **Fill and Save**:
   - Fill form with sample data
   - Click "Save XML"
   - Verify success

2. **Validate**:
   - Click "Validate XML against XSD"
   - Verify validation passes

3. **Transform**:
   - Click "Transform XML to HTML"
   - Verify HTML preview appears

4. **Sign**:
   - Click "Podpísať (Sign)"
   - Complete signing process
   - Verify ASiC-E download

5. **Verify Signed File**:
   - Extract ASiC-E container
   - Verify all files present
   - Validate signature online

**Expected Results**:
- ✅ All operations complete successfully
- ✅ No errors in browser console
- ✅ Valid ASiC-E container produced

---

## Automated Testing

### Unit Tests

```bash
# Run existing test suite
npm test

# Expected: All tests pass including new signing endpoints
```

### Manual Test Checklist

Use this checklist for comprehensive manual testing:

- [ ] D.Suite installed and verified
- [ ] Certificate files present
- [ ] Server starts without errors
- [ ] Form loads correctly
- [ ] "Podpísať" button appears
- [ ] Button is disabled initially
- [ ] Button enables after saving XML
- [ ] Clicking button shows "Preparing..." state
- [ ] D.Signer window appears
- [ ] Password "test" works
- [ ] Signing completes successfully
- [ ] ASiC-E file downloads
- [ ] File has correct naming format
- [ ] File size > 10KB
- [ ] ASiC-E structure is correct
- [ ] Signature validates online
- [ ] Error handling works for D.Signer not installed
- [ ] Error handling works for cancelled signing
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge

---

## Troubleshooting

### Issue: D.Bridge JS Not Loading

**Symptoms**:
- Console error: "ditec is not defined"
- Signing fails immediately

**Solutions**:
1. Check internet connection (D.Bridge JS loads from slovensko.sk CDN)
2. Check browser console for CORS errors
3. Verify scripts are loaded in correct order
4. Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: ASiC-E File Corrupted

**Symptoms**:
- Cannot open .asice file
- Validation fails
- File size is very small

**Solutions**:
1. Check browser console for Base64 decoding errors
2. Verify D.Signer completed signing successfully
3. Try signing again with fresh XML file
4. Check disk space

### Issue: Certificate Expired

**Symptoms**:
- D.Signer shows certificate error
- Validation fails

**Solutions**:
1. Check certificate expiration date
2. Obtain new certificate from DITEC
3. Update certificate files in `/certificate` directory

---

## Performance Benchmarks

**Expected Performance**:
- Form save: < 500ms
- Signing preparation: < 1s
- D.Signer interaction: 5-15s (depends on user)
- ASiC-E download: < 1s
- Total workflow: 10-30s

**Monitoring**:
```bash
# Check server logs
tail -f server.log

# Monitor network requests in browser DevTools
# Expected requests:
# 1. POST /api/save-xml
# 2. POST /api/prepare-signing
# 3. Connection to localhost:37200 (D.Launcher)
```

---

## Conclusion

After completing all tests:

1. ✅ Verify all test cases pass
2. ✅ Document any issues found
3. ✅ Confirm signature validates successfully
4. ✅ Verify compliance with Slovak eIDAS standards

**Success Criteria**:
- All 6 test suites pass
- ASiC-E validates on official validator
- No console errors
- Works in all supported browsers

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-07  
**Testing Status**: Ready for Testing

