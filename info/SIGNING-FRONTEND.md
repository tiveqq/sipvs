# Frontend Implementation for eIDAS Signing

This document contains the complete frontend implementation for Slovak eIDAS digital signing integration.

## Overview

The frontend implementation consists of:
1. Adding D.Bridge JS library scripts to HTML
2. Adding "Podpísať" (Sign) button to the form
3. Implementing signing logic in JavaScript
4. Handling D.Signer communication
5. Downloading signed ASiC-E files

## Implementation Steps

### Step 1: Add D.Bridge JS Libraries to HTML

Edit `public/index.html` and add the D.Bridge JS scripts in the `<head>` section:

```html
<!-- Add these scripts BEFORE the closing </head> tag -->

<!-- D.Bridge JS v1.0 Libraries for Slovak eIDAS Signing -->
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/config.js"></script>
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/dCommon.min.js"></script>
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/dSigXadesBp.min.js"></script>
```

**Location**: Add after line 8 (after the existing `<link>` tag for styles.css)

### Step 2: Add "Podpísať" Button to Form

Edit `public/index.html` and add the signing button in the form actions section:

```html
<!-- Find the form actions section (around line 357-362) -->
<!-- Replace the existing button section with this: -->

<div class="form-actions">
  <button type="submit" class="btn-primary">Save XML</button>
  <button type="button" id="validateXmlBtn" class="btn-secondary" disabled>
    Validate XML against XSD
  </button>
  <button type="button" id="transformXmlBtn" class="btn-secondary" disabled>
    Transform XML to HTML
  </button>
  <!-- NEW: Signing button -->
  <button type="button" id="signXmlBtn" class="btn-success" disabled>
    🔐 Podpísať (Sign)
  </button>
  <button type="button" id="loadSampleBtn" class="btn-info">
    Load Sample Data
  </button>
</div>
```

### Step 3: Add CSS Styling for Sign Button

Edit `public/styles.css` and add styling for the success button:

```css
/* Add this to the button styles section */

.btn-success {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 12px 24px;
  font-size: 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-success:hover:not(:disabled) {
  background-color: #218838;
}

.btn-success:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}
```

### Step 4: Implement Signing Logic in JavaScript

Edit `public/script.js` and add the signing functionality:

#### 4.1: Add Event Listener for Sign Button

```javascript
// Add this in the DOMContentLoaded event listener, after the existing button listeners

document.getElementById('signXmlBtn').addEventListener('click', handleSignXml);
```

#### 4.2: Implement handleSignXml Function

```javascript
/**
 * Handle XML signing with Slovak eIDAS
 * Uses D.Bridge JS to communicate with D.Signer
 */
async function handleSignXml() {
  const signBtn = document.getElementById('signXmlBtn');
  const statusDiv = document.getElementById('status');
  
  if (!currentXmlFilename) {
    showStatus('Please save the XML file first before signing.', 'error');
    return;
  }
  
  try {
    // Disable button and show loading state
    signBtn.disabled = true;
    signBtn.textContent = '🔄 Preparing...';
    showStatus('Preparing document for signing...', 'info');
    
    // Step 1: Prepare signing payload from backend
    const prepareResponse = await fetch('/api/prepare-signing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: currentXmlFilename
      })
    });
    
    if (!prepareResponse.ok) {
      const error = await prepareResponse.json();
      throw new Error(error.error || 'Failed to prepare signing payload');
    }
    
    const { payload } = await prepareResponse.json();
    
    // Step 2: Initialize D.Bridge JS and sign
    signBtn.textContent = '🔄 Connecting to D.Signer...';
    showStatus('Connecting to D.Signer... Please wait.', 'info');
    
    await signWithDBridge(payload);
    
    // Success
    showStatus('Document signed successfully! ASiC-E file downloaded.', 'success');
    signBtn.textContent = '✅ Signed!';
    
    // Reset button after 3 seconds
    setTimeout(() => {
      signBtn.textContent = '🔐 Podpísať (Sign)';
      signBtn.disabled = false;
    }, 3000);
    
  } catch (error) {
    console.error('Signing error:', error);
    showStatus(`Signing failed: ${error.message}`, 'error');
    signBtn.textContent = '🔐 Podpísať (Sign)';
    signBtn.disabled = false;
  }
}
```

#### 4.3: Implement D.Bridge JS Signing Function

```javascript
/**
 * Sign document using D.Bridge JS API
 * @param {Object} payload - Signing payload from backend
 */
function signWithDBridge(payload) {
  return new Promise((resolve, reject) => {
    // Check if D.Bridge JS is loaded
    if (typeof ditec === 'undefined' || !ditec.dSigXadesBpJs) {
      reject(new Error('D.Bridge JS library not loaded. Please refresh the page.'));
      return;
    }
    
    // Callback helper for D.Bridge JS v1.x API
    function Callback(fn) {
      this.callback = fn;
    }
    
    // Step 1: Deploy D.Bridge
    ditec.dSigXadesBpJs.deploy(null, new Callback(function() {
      
      // Step 2: Initialize signing session
      ditec.dSigXadesBpJs.initialize(new Callback(function() {
        
        // Step 3: Add XML object to be signed
        ditec.dSigXadesBpJs.addXmlObject(
          payload.identifier,                    // objectId
          payload.description,                   // objectDescription
          payload.xmlBase64,                     // content (Base64)
          payload.formatIdentifier,              // formatIdentifier
          new Callback(function() {
            
            // Step 4: Execute signing operation
            const signatureId = 'signature-' + Date.now();
            const digestAlgorithm = 'http://www.w3.org/2001/04/xmlenc#sha256';
            const signingCertificate = ''; // Empty = use default certificate
            
            ditec.dSigXadesBpJs.sign(
              signatureId,
              digestAlgorithm,
              signingCertificate,
              new Callback(function() {
                
                // Step 5: Retrieve signed ASiC-E container
                ditec.dSigXadesBpJs.getSignatureWithASiCEnvelopeBase64(
                  new Callback(function(asiceBase64) {
                    
                    // Step 6: Download the signed file
                    try {
                      downloadAsiceFile(asiceBase64, payload.filename);
                      resolve();
                    } catch (error) {
                      reject(error);
                    }
                  })
                );
              })
            );
          })
        );
      }));
    }));
  });
}
```

#### 4.4: Implement Download Function

```javascript
/**
 * Download ASiC-E file from Base64 data
 * @param {string} base64Data - Base64-encoded ASiC-E container
 * @param {string} originalFilename - Original XML filename
 */
function downloadAsiceFile(base64Data, originalFilename) {
  try {
    // Decode Base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create Blob with correct MIME type
    const blob = new Blob([bytes], {
      type: 'application/vnd.etsi.asic-e+zip'
    });
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = originalFilename.replace('.xml', '');
    const filename = `${baseFilename}-signed-${timestamp}.asice`;
    
    // Create download link and trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log(`Downloaded signed file: ${filename}`);
    
  } catch (error) {
    throw new Error(`Failed to download signed file: ${error.message}`);
  }
}
```

#### 4.5: Update Button State Management

Find the existing `handleFormSubmit` function and update it to enable the sign button after successful save:

```javascript
// In handleFormSubmit function, after successful save:
// Find this section (around line 50-60):

if (data.success) {
  currentXmlFilename = data.filename;
  showStatus(`XML saved successfully: ${data.filename}`, 'success');
  
  // Enable validation, transformation, and signing buttons
  document.getElementById('validateXmlBtn').disabled = false;
  document.getElementById('transformXmlBtn').disabled = false;
  document.getElementById('signXmlBtn').disabled = false;  // ADD THIS LINE
  
  // ... rest of the code
}
```

### Step 5: Error Handling and User Feedback

Add comprehensive error handling for common D.Signer issues:

```javascript
/**
 * Check if D.Signer is installed and running
 * @returns {Promise<boolean>}
 */
async function checkDSignerAvailability() {
  try {
    // Try to connect to D.Launcher
    const response = await fetch('http://localhost:37200/status', {
      method: 'GET',
      mode: 'no-cors'
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Show user-friendly error messages for D.Signer issues
 */
function handleDSignerError(error) {
  const errorMessage = error.message.toLowerCase();
  
  if (errorMessage.includes('d.signer') || errorMessage.includes('connection')) {
    return `
      D.Signer is not installed or not running.
      
      Please:
      1. Install D.Suite from: https://www.slovensko.sk/sk/na-stiahnutie
      2. Verify installation at: https://epodpis.ditec.sk/install-check
      3. Ensure D.Launcher service is running
      4. Try again
    `;
  }
  
  if (errorMessage.includes('certificate') || errorMessage.includes('password')) {
    return `
      Certificate error occurred.
      
      Please check:
      1. Certificate is valid and not expired
      2. Correct password entered (default: "test")
      3. Certificate file is accessible
    `;
  }
  
  if (errorMessage.includes('cancelled') || errorMessage.includes('user')) {
    return 'Signing operation was cancelled by user.';
  }
  
  return error.message;
}
```

## Complete Frontend Changes Summary

### Files to Modify:

1. **`public/index.html`**:
   - Add D.Bridge JS script tags (3 scripts)
   - Add "Podpísať" button to form actions

2. **`public/styles.css`**:
   - Add `.btn-success` styling

3. **`public/script.js`**:
   - Add `handleSignXml()` function
   - Add `signWithDBridge()` function
   - Add `downloadAsiceFile()` function
   - Add `checkDSignerAvailability()` function (optional)
   - Add `handleDSignerError()` function (optional)
   - Update `handleFormSubmit()` to enable sign button
   - Add event listener for sign button

## Testing the Frontend

### 1. Visual Test

```bash
# Start server
npm start

# Open browser
open http://localhost:3000
```

**Check**:
- ✅ "Podpísať" button appears in form actions
- ✅ Button is disabled initially
- ✅ Button has green color and lock icon

### 2. Functional Test

**Steps**:
1. Fill out the form with sample data
2. Click "Save XML"
3. Verify "Podpísať" button becomes enabled
4. Click "Podpísať" button
5. D.Signer window should appear
6. Enter password: `test`
7. Confirm signing
8. Verify `.asice` file downloads

### 3. Error Handling Test

**Test D.Signer not installed**:
1. Stop D.Launcher service
2. Try to sign
3. Verify error message appears

**Test cancelled signing**:
1. Click "Podpísať"
2. Click "Cancel" in D.Signer window
3. Verify appropriate message appears

## Browser Compatibility

**Supported Browsers**:
- ✅ Chrome/Chromium 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**Requirements**:
- JavaScript enabled
- Cookies enabled (for D.Bridge communication)
- Pop-ups allowed (for D.Signer window)

## Security Notes

1. **D.Bridge Communication**: All communication with D.Signer happens locally (localhost:37200)
2. **No Private Key Transmission**: Private key never leaves the user's computer
3. **HTTPS Recommended**: For production, serve the application over HTTPS
4. **CSP Headers**: Configure Content Security Policy to allow slovensko.sk scripts

## Next Steps

After implementing the frontend:

1. ✅ Test signing workflow end-to-end
2. ✅ Verify `.asice` file structure
3. ✅ Validate signature using official validator
4. ➡️ Create testing documentation (see `SIGNING-TESTING.md`)

---

**File**: SIGNING-FRONTEND.md  
**Version**: 1.0  
**Last Updated**: 2025-10-07

