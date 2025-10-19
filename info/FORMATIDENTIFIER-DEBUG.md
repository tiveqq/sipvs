# formatIdentifier Length Error - Debugging Guide

## Error Message

```
DitecError: Hodnota parameteru "objectFormatIdentifier" musí byť reťazec kratší ako 1024 znakov.
```

**Translation**: "The value of parameter 'objectFormatIdentifier' must be a string shorter than 1024 characters."

---

## Root Cause

The `formatIdentifier` parameter passed to `ditec.dSigXadesBpJs.addXmlObject()` exceeds 1024 characters, causing D.Bridge JS to reject the request immediately with a DitecError.

---

## Expected vs Actual

### Expected formatIdentifier (67 characters):
```
http://data.gov.sk/def/container/xmldatacontainer+xml/1.1
```

### What might be happening:
The formatIdentifier might be getting replaced with:
- The entire XMLDataContainer content (6000+ characters)
- The Base64-encoded XMLDataContainer (8000+ characters)
- Some other long string

---

## Debugging Steps

### Step 1: Check Backend Response

Open browser console and run:

```javascript
// After clicking "Sign" button, check the network request
// Look for the /api/prepare-signing response
```

Or add this to `public/script.js` before the signing code:

```javascript
console.log('[DEBUG - Backend Response]', payload);
console.log('[DEBUG - formatIdentifier]', payload.formatIdentifier);
console.log('[DEBUG - formatIdentifier length]', payload.formatIdentifier?.length);
```

### Step 2: Check What's Passed to addXmlObject()

The code now logs this automatically:

```javascript
[D.Bridge JS - formatIdentifier] http://data.gov.sk/def/container/xmldatacontainer+xml/1.1
[D.Bridge JS - formatIdentifier length] 67
```

If you see a different value or length > 1024, that's the problem.

### Step 3: Check for Variable Corruption

Look for any code that might be reassigning `payload.formatIdentifier`:

```javascript
// Search for patterns like:
payload.formatIdentifier = ...
formatIdentifier = ...
```

---

## Fixes Applied

### 1. Enhanced Error Logging

**File**: `public/script.js`

Added detailed logging:
- formatIdentifier value
- formatIdentifier length
- Full error object from DitecError
- Validation before calling addXmlObject()

### 2. Pre-validation Check

Added validation before calling `addXmlObject()`:

```javascript
// Validate formatIdentifier length (must be < 1024 characters)
if (payload.formatIdentifier && payload.formatIdentifier.length >= 1024) {
    const error = `formatIdentifier is too long (${payload.formatIdentifier.length} characters, max 1024)`;
    debugLog('ERROR', error);
    reject(new Error(error));
    return;
}
```

This will catch the error immediately instead of waiting for D.Bridge JS to reject it.

### 3. Better Error Messages

Updated error handler to detect formatIdentifier errors:

```javascript
if (errorMessage.includes('objectFormatIdentifier') || errorMessage.includes('1024')) {
    reject(new Error(`Invalid formatIdentifier: ${errorMessage}\n\n...`));
}
```

### 4. DitecError Object Handling

Improved Callback error handler to extract messages from DitecError objects:

```javascript
let errorMessage = error;
if (error && typeof error === 'object') {
    errorMessage = error.message || error.toString() || JSON.stringify(error);
}
```

---

## Testing

### Test 1: Check Console Output

1. Start server: `npm start`
2. Open browser console (F12)
3. Fill form and save XML
4. Click "🔐 Podpísať (Sign)"
5. Look for these console messages:

```
[D.Bridge JS - PAYLOAD] {
    identifier: "student-registration-...",
    description: "Student Registration Form - University Enrollment",
    formatIdentifier: "http://data.gov.sk/def/container/xmldatacontainer+xml/1.1",
    formatIdentifierLength: 67,
    ...
}
[D.Bridge JS - formatIdentifier] http://data.gov.sk/def/container/xmldatacontainer+xml/1.1
[D.Bridge JS - formatIdentifier length] 67
```

**Expected**: Length should be 67 characters

**If you see**: Length > 1024, then the formatIdentifier is being corrupted somewhere

### Test 2: Network Tab

1. Open browser DevTools → Network tab
2. Click "🔐 Podpísať (Sign)"
3. Find the `prepare-signing` request
4. Check the Response:

```json
{
  "success": true,
  "payload": {
    "xmlBase64": "...",
    "xsdBase64": "...",
    "xslBase64": "...",
    "filename": "student-registration-...",
    "identifier": "student-registration-...",
    "description": "Student Registration Form - University Enrollment",
    "formatIdentifier": "http://data.gov.sk/def/container/xmldatacontainer+xml/1.1"
  }
}
```

**Expected**: `formatIdentifier` should be the short URI (67 characters)

### Test 3: Manual Validation

In browser console, after the error occurs:

```javascript
// Check the payload object
console.log(payload.formatIdentifier);
console.log(payload.formatIdentifier.length);

// Verify it's the correct value
const expected = 'http://data.gov.sk/def/container/xmldatacontainer+xml/1.1';
console.log('Match:', payload.formatIdentifier === expected);
```

---

## Possible Causes

### Cause 1: Variable Reassignment

Somewhere in the code, `payload.formatIdentifier` might be getting reassigned:

```javascript
// WRONG - Don't do this:
payload.formatIdentifier = payload.xmlBase64;  // Assigns Base64 content!
```

**Solution**: Search for any code that modifies `payload.formatIdentifier`

### Cause 2: Parameter Order Confusion

The `addXmlObject()` parameters might be in the wrong order:

```javascript
// CORRECT order:
ditec.dSigXadesBpJs.addXmlObject(
    identifier,           // 1st param
    description,          // 2nd param
    xmlBase64,           // 3rd param
    formatIdentifier,    // 4th param - must be < 1024 chars
    callback             // 5th param
);

// WRONG - if parameters are swapped:
ditec.dSigXadesBpJs.addXmlObject(
    identifier,
    description,
    formatIdentifier,    // WRONG - this is the 3rd param (xmlBase64)
    xmlBase64,          // WRONG - this is the 4th param (formatIdentifier)
    callback
);
```

**Solution**: Verify parameter order matches D.Bridge JS API

### Cause 3: Backend Sending Wrong Value

The backend might be sending the wrong value:

```javascript
// WRONG - Don't do this:
formatIdentifier: xmlDataContainer  // Sends entire XML!

// CORRECT:
formatIdentifier: 'http://data.gov.sk/def/container/xmldatacontainer+xml/1.1'
```

**Solution**: Check `server.js` line ~1295

---

## Current Code Review

### Backend (server.js - Line 1295)

```javascript
formatIdentifier: 'http://data.gov.sk/def/container/xmldatacontainer+xml/1.1'
```

✅ **CORRECT** - This is a valid, short URI (67 characters)

### Frontend (public/script.js - Lines 762-766)

```javascript
ditec.dSigXadesBpJs.addXmlObject(
    payload.identifier,           // ✅ identifier
    payload.description,          // ✅ description
    payload.xmlBase64,           // ✅ xmlBase64 (Base64-encoded XMLDataContainer)
    payload.formatIdentifier,    // ✅ formatIdentifier (should be 67 chars)
    new Callback(...)
);
```

✅ **CORRECT** - Parameters are in the correct order

---

## Expected Console Output After Fix

### Successful Case:

```
[D.Bridge JS - START] Beginning signing process
[D.Bridge JS - PAYLOAD] {
    identifier: "student-registration-1234567890",
    description: "Student Registration Form - University Enrollment",
    formatIdentifier: "http://data.gov.sk/def/container/xmldatacontainer+xml/1.1",
    formatIdentifierLength: 67,
    xmlBase64Length: 8244,
    xsdBase64Length: 1234,
    xslBase64Length: 5678
}
[D.Bridge JS - formatIdentifier] http://data.gov.sk/def/container/xmldatacontainer+xml/1.1
[D.Bridge JS - formatIdentifier length] 67
[D.Bridge JS - XMLDataContainer (preview)] <?xml version="1.0" encoding="UTF-8"?>...
[D.Bridge JS - STEP 1] Deploying D.Bridge...
[D.Bridge JS - STEP 1] D.Bridge deployed successfully
[D.Bridge JS - STEP 2] Initializing signing session...
[D.Bridge JS - STEP 2] Signing session initialized
[D.Bridge JS - STEP 3] Adding XML object to signing queue...
[D.Bridge JS - STEP 3] XML object added successfully  ← Should succeed!
```

### Error Case (if formatIdentifier is too long):

```
[D.Bridge JS - START] Beginning signing process
[D.Bridge JS - PAYLOAD] {
    formatIdentifier: "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHhkYzpYTUxEYXRhQ29udGFpbmVyIHhtbG5zOnhkYz0iaHR0cDovL2RhdGEuZ292LnNrL2RlZi9jb250YWluZXIveG1sZGF0YWNvbnRhaW5lcit4bWwvMS4xIj4KICA8eGRjOlhNTERhdGEgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3htbDsgY2hhcnNldD1VVEYtOCIgSWRlbnRpZmllcj0ic3R1ZGVudC1yZWdpc3RyYXRpb24tMTcwNjU1OTcwODEwNCIgVmVyc2lvbj0iMS4wIj4KICAgIDx4ZGM6WE1MQ29udGVudD48IVtDREFUQVs8c3I6c3R1ZGVudFJlZ2lzdHJhdGlvbiB4bWxuczpzcj0iaHR0cDovL3VuaXZlcnNpdHkuZWR1L3N0dWRlbnQtcmVnaXN0cmF0aW9uIgogICAgICAgICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbklkPSJSRUctMjAyNC0wMDEiCiAgICAgICAgICAgICAgICAgICAgICAgc3VibWlzc2lvbkRhdGU9IjIwMjQtMDktMTUiCiAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzPSJwZW5kaW5nIj4KICAKICA8c3I6cGVyc29uYWxJbmZvPgogICAgPHNyOmZpcnN0TmFtZT5Kb2huPC9zcjpmaXJzdE5hbWU+CiAgICA8c3I6bGFzdE5hbWU+U21pdGg8L3NyOmxhc3ROYW1lPgogICAgPHNyOm1pZGRsZU5hbWU+TWljaGFlbDwvc3I6bWlkZGxlTmFtZT4KICAgIDxzcjpkYXRlT2ZCaXJ0aD4yMDAyLTA1LTE1PC9zcjpkYXRlT2ZCaXJ0aD4KICAgIDxzcjpnZW5kZXI+TWFsZTwvc3I6Z2VuZGVyPgogICAgPHNyOm5hdGlvbmFsaXR5PkFtZXJpY2FuPC9zcjpuYXRpb25hbGl0eT4KICAgIDxzcjpzb2NpYWxTZWN1cml0eU51bWJlcj4xMjMtNDUtNjc4OTwvc3I6c29jaWFsU2VjdXJpdHlOdW1iZXI+CiAgICA8c3I6bWFyaXRhbFN0YXR1cz5TaW5nbGU8L3NyOm1hcml0YWxTdGF0dXM+CiAgPC9zcjpwZXJzb25hbEluZm8+...",
    formatIdentifierLength: 8244,  ← TOO LONG!
    ...
}
[D.Bridge JS - ERROR] formatIdentifier is too long (8244 characters, max 1024)
❌ Signing failed: formatIdentifier is too long...
```

---

## Next Steps

1. **Run the test** and check console output
2. **Verify formatIdentifier length** is 67 characters
3. **If length is wrong**, search for code that modifies `payload.formatIdentifier`
4. **If length is correct but still getting error**, check D.Bridge JS version compatibility

---

## Summary

- ✅ Added pre-validation to catch formatIdentifier length errors
- ✅ Enhanced error logging to show actual DitecError messages
- ✅ Improved error handling to detect formatIdentifier issues
- ✅ Added detailed console logging for debugging
- ✅ Backend is sending correct formatIdentifier (67 characters)
- ✅ Frontend parameter order is correct

**The error should now be caught immediately with a clear message instead of timing out.**

---

**Document Version**: 1.0  
**Date**: 2025-10-15  
**Status**: Debugging Enhancements Applied

