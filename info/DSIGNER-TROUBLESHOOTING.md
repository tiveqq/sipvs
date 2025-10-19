# D.Signer Troubleshooting Guide

## Issue: D.Signer Window Doesn't Appear After Clicking "Run"

### Problem Description

When clicking the "🔐 Podpísať (Sign)" button:
1. D.Launcher 2 appears and asks "Do you want to run this application?"
2. You select "D.Signer Java" and click "Run"
3. Nothing happens - D.Signer window doesn't appear
4. Web application shows "Connecting to D.Signer... Please wait"
5. No error message is displayed

### Root Cause

The issue was caused by an **incorrect Callback constructor** in the D.Bridge JS integration code. The code was using `this.callback` but D.Bridge JS v1.x expects `this.onSuccess` and `this.onError`.

This caused all D.Bridge JS callbacks to fail silently after the initial deployment step.

---

## ✅ Fix Applied

### What Was Fixed

1. **Corrected Callback Constructor**:
   ```javascript
   // BEFORE (incorrect):
   function Callback(fn) {
       this.callback = fn;
   }
   
   // AFTER (correct):
   function Callback(onSuccess, onError) {
       this.onSuccess = onSuccess;
       this.onError = onError || function(error) {
           console.error('[D.Bridge JS - ERROR]', error);
           reject(new Error(`D.Bridge JS error: ${error}`));
       };
   }
   ```

2. **Added Error Handling**:
   - Each D.Bridge JS step now has proper error callbacks
   - Errors are caught and displayed to the user
   - Specific error messages for each step

3. **Added Debug Logging**:
   - Console logs track each step of the signing process
   - Easy to identify where the process fails
   - Can be toggled with `DEBUG` flag

4. **Added Timeout Detection**:
   - 60-second timeout for signing operations
   - Prevents indefinite "waiting" state
   - Clear error message if timeout occurs

5. **Added Progress Tracking**:
   - Shows "Step X/5" messages to user
   - User knows what's happening at each stage
   - Better user experience

---

## 🔍 Diagnostic Steps

### Step 1: Check Browser Console

Open browser console (F12 → Console tab) and look for debug messages:

**Expected output when signing works**:
```
[D.Bridge JS - START] Beginning signing process
[D.Bridge JS - PAYLOAD] {identifier: "...", description: "...", ...}
[D.Bridge JS - STEP 1] Deploying D.Bridge...
[D.Bridge JS - STEP 1] D.Bridge deployed successfully
[D.Bridge JS - STEP 2] Initializing signing session...
[D.Bridge JS - STEP 2] Signing session initialized
[D.Bridge JS - STEP 3] Adding XML object to signing queue...
[D.Bridge JS - STEP 3] XML object added successfully
[D.Bridge JS - STEP 4] Executing signing operation...
[D.Bridge JS - STEP 4] Document signed successfully
[D.Bridge JS - STEP 5] Retrieving signed ASiC-E container...
[D.Bridge JS - STEP 5] ASiC-E container retrieved
[D.Bridge JS - SUCCESS] Signing process completed
```

**If you see errors**:
```
[D.Bridge JS - ERROR] Failed to initialize: [error message]
```

This tells you exactly which step failed and why.

### Step 2: Verify D.Suite Installation

```bash
# Open installation check page
open https://epodpis.ditec.sk/install-check
```

**Expected result**:
- ✅ "D.Signer je nainštalovaný a funkčný"
- ✅ Version information displayed
- ✅ Connection to localhost:37200 successful

**If check fails**:
1. Reinstall D.Suite from https://www.slovensko.sk/sk/na-stiahnutie
2. Restart your computer
3. Try again

### Step 3: Check D.Launcher Service

**macOS**:
```bash
# Check if D.Launcher is running
ps aux | grep -i launcher

# Expected output should show D.Launcher process
```

**Windows**:
```powershell
# Check if D.Launcher service is running
Get-Process | Where-Object {$_.ProcessName -like "*Launcher*"}
```

**If D.Launcher is not running**:
1. Open D.Suite application
2. Ensure "Start D.Launcher on system startup" is enabled
3. Manually start D.Launcher
4. Try signing again

### Step 4: Test D.Bridge JS Connection

Open browser console and run:

```javascript
// Test if D.Bridge JS is loaded
console.log(typeof ditec);
// Expected: "object"

console.log(typeof ditec.dSigXadesBpJs);
// Expected: "object"

// Test basic connection
function Callback(onSuccess, onError) {
    this.onSuccess = onSuccess;
    this.onError = onError || function(e) { console.error("Error:", e); };
}

ditec.dSigXadesBpJs.deploy(null, new Callback(
    function() { console.log("✅ D.Bridge deployed successfully!"); },
    function(e) { console.error("❌ Deploy failed:", e); }
));
```

**Expected result**: "✅ D.Bridge deployed successfully!"

**If deploy fails**: D.Launcher is not running or not accessible

### Step 5: Check Network Connection

D.Bridge JS connects to `localhost:37200`. Verify this port is accessible:

```bash
# macOS/Linux
curl http://localhost:37200

# Windows PowerShell
Invoke-WebRequest -Uri http://localhost:37200
```

**Expected**: Some response (even an error is OK - it means the port is listening)

**If connection refused**: D.Launcher is not running

---

## 🐛 Common Issues and Solutions

### Issue 1: "D.Bridge JS library not loaded"

**Cause**: D.Bridge JS scripts failed to load from slovensko.sk CDN

**Solutions**:
1. Check internet connection
2. Check if slovensko.sk is accessible
3. Check browser console for CORS errors
4. Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
5. Clear browser cache

### Issue 2: "Failed to deploy D.Bridge"

**Cause**: D.Launcher is not running or not accessible

**Solutions**:
1. Start D.Launcher manually
2. Check if localhost:37200 is accessible
3. Restart D.Suite
4. Reinstall D.Suite if necessary

### Issue 3: "Failed to initialize D.Signer"

**Cause**: D.Signer application is not installed or not working

**Solutions**:
1. Verify D.Signer is installed (check installation at epodpis.ditec.sk)
2. Try running D.Signer manually
3. Check D.Signer logs for errors
4. Reinstall D.Suite

### Issue 4: "Signing operation failed"

**Cause**: User cancelled signing or entered wrong password

**Solutions**:
1. Try again and don't cancel
2. Use correct password (default: "test")
3. Check certificate is valid and not expired
4. Verify certificate file is accessible

### Issue 5: "Signing operation timed out"

**Cause**: D.Signer didn't respond within 60 seconds

**Solutions**:
1. Check if D.Signer window appeared but was hidden
2. Close D.Signer and try again
3. Restart D.Launcher
4. Check system resources (CPU, memory)
5. Try with a smaller XML file

### Issue 6: D.Signer Window Appears But Is Empty

**Cause**: Invalid payload or encoding issue

**Solutions**:
1. Check browser console for payload errors
2. Verify XML file is valid
3. Check Base64 encoding is correct
4. Try with a different XML file

---

## 🔧 Advanced Debugging

### Enable Verbose Logging

The fix includes a `DEBUG` flag in `public/script.js`. To enable/disable:

```javascript
// In signWithDBridge function (line ~690)
const DEBUG = true;  // Set to false to disable debug logging
```

### Monitor Network Traffic

1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "localhost:37200"
4. Click "Sign" button
5. Watch for requests to D.Launcher

**Expected requests**:
- POST to localhost:37200 (D.Bridge deployment)
- WebSocket connection (D.Signer communication)

### Check D.Signer Logs

**macOS**:
```bash
# D.Signer logs location
~/Library/Logs/D.Signer/

# View recent logs
tail -f ~/Library/Logs/D.Signer/dsigner.log
```

**Windows**:
```
C:\Users\[YourUsername]\AppData\Local\D.Signer\Logs\
```

**Linux**:
```bash
~/.local/share/D.Signer/logs/
```

---

## 📊 Testing the Fix

### Test 1: Basic Signing

1. Start server: `npm start`
2. Open: `http://localhost:3000`
3. Fill form and save XML
4. Open browser console (F12)
5. Click "🔐 Podpísať (Sign)"
6. Watch console for debug messages
7. Verify D.Signer window appears
8. Enter password: `test`
9. Verify signing completes
10. Verify `.asice` file downloads

**Expected console output**:
```
[D.Bridge JS - START] Beginning signing process
[D.Bridge JS - STEP 1] Deploying D.Bridge...
[D.Bridge JS - STEP 1] D.Bridge deployed successfully
[D.Bridge JS - STEP 2] Initializing signing session...
[D.Bridge JS - STEP 2] Signing session initialized
[D.Bridge JS - STEP 3] Adding XML object to signing queue...
[D.Bridge JS - STEP 3] XML object added successfully
[D.Bridge JS - STEP 4] Executing signing operation...
[D.Bridge JS - STEP 4] Document signed successfully
[D.Bridge JS - STEP 5] Retrieving signed ASiC-E container...
[D.Bridge JS - STEP 5] ASiC-E container retrieved
[D.Bridge JS - SUCCESS] Signing process completed
Downloaded signed file: student-registration-*-signed-*.asice
```

### Test 2: Error Handling

**Test 2.1: Cancel Signing**
1. Click "Sign" button
2. When D.Signer appears, click "Cancel"
3. Verify error message: "Signing operation failed: ... This may happen if you cancelled the signing..."

**Test 2.2: Wrong Password**
1. Click "Sign" button
2. Enter wrong password in D.Signer
3. Verify error message about certificate/password

**Test 2.3: D.Launcher Not Running**
1. Stop D.Launcher
2. Click "Sign" button
3. Verify error message: "Failed to deploy D.Bridge: ... Please ensure D.Launcher is running."

### Test 3: Timeout Handling

1. Click "Sign" button
2. Don't interact with D.Signer for 60 seconds
3. Verify timeout error appears
4. Verify button resets to normal state

---

## 📞 Getting Help

If you're still experiencing issues after trying these solutions:

1. **Collect diagnostic information**:
   - Browser console output (all debug messages)
   - D.Signer logs
   - D.Suite version
   - Operating system version
   - Browser version

2. **Check official resources**:
   - D.Suite documentation: https://www.slovensko.sk/sk/na-stiahnutie
   - Installation check: https://epodpis.ditec.sk/install-check
   - Test page: https://qes.ditec.sk/upvs/zep/dbridge_js/v1.0/test/dsignerbp.html

3. **Contact support**:
   - DITEC support for D.Suite issues
   - Check project documentation for application-specific issues

---

## ✅ Summary of Fix

The fix resolves the issue where D.Signer window doesn't appear by:

1. ✅ Correcting the Callback constructor to use `onSuccess` and `onError`
2. ✅ Adding comprehensive error handling at each step
3. ✅ Adding debug logging to track progress
4. ✅ Adding timeout detection (60 seconds)
5. ✅ Adding progress messages for better UX
6. ✅ Providing specific error messages for each failure scenario

**The signing process should now work correctly, and any errors will be clearly reported to the user.**

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-15  
**Status**: Fix Applied and Tested

