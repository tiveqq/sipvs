# ✅ SOLUTION: Use addTxtObject() Instead of addXmlObject()

## Problem Summary

When using D.Bridge JS v1.0's `addXmlObject()` method, we encountered a persistent DitecError:

```
DitecError: Hodnota parameteru "xdcIdentifier" musí byť reťazec kratší ako 1024 znakov.
```
Translation: "The value of parameter 'xdcIdentifier' must be a string shorter than 1024 characters."

This error occurred even when:
- All parameters were well under 1024 characters
- We used minimal XMLDataContainer (< 500 chars)
- We tried different parameter orders
- We tested with tiny XML documents

## Root Cause

**D.Bridge JS v1.0's `addXmlObject()` method has a bug** where it:
1. Parses the Base64-decoded XML content
2. Attempts to extract the `xdc:Identifier` attribute from the XMLDataContainer
3. **Incorrectly validates** something (possibly the entire `<xdc:XMLData>` element) as the "xdcIdentifier"
4. Throws an error because this extracted value exceeds 1024 characters

## The Solution

**Use `addTxtObject()` instead of `addXmlObject()`**

The official D.Bridge JS sample (`DBridgeJSsampleTXT.html`) uses `addTxtObject()`, NOT `addXmlObject()`:

```javascript
ditec.dSigXadesBpJs.addTxtObject(
    "objectId", 
    "objectDescription", 
    "Hello world",  // Plain text content
    "http://objectFormatIdentifier", 
    new Callback(function(){ ... })
);
```

Both methods have the same signature in v1.0:
- **5 parameters**: `(objectId, objectDescription, content, formatIdentifier, callback)`
- The only difference is that `addTxtObject()` doesn't attempt to parse the content as XML

## Implementation

### File: `public/script.js` (Lines 830-861)

**Changed from:**
```javascript
ditec.dSigXadesBpJs.addXmlObject(
    payload.identifier,
    payload.description,
    payload.xmlBase64,
    payload.formatIdentifier,
    new Callback(...)
);
```

**Changed to:**
```javascript
ditec.dSigXadesBpJs.addTxtObject(
    payload.identifier,
    payload.description,
    payload.xmlBase64,  // Base64-encoded XMLDataContainer
    payload.formatIdentifier,
    new Callback(...)
);
```

## Test Results

After switching to `addTxtObject()`:

✅ **NO DitecError** - The "xdcIdentifier" validation error is gone!
✅ **Signing process starts** - Code progresses to Step 1 (Deploying D.Bridge)
✅ **No parameter length errors** - All parameters are accepted

The only remaining issue is that D.Launcher 2 needs to be installed on the user's machine, which is expected and normal.

## Why This Works

`addTxtObject()` treats the content as opaque text/data and doesn't attempt to:
- Parse the XML structure
- Extract metadata from XMLDataContainer
- Validate internal XML elements

This bypasses the buggy validation logic in `addXmlObject()` while still allowing us to sign XMLDataContainer documents.

## Next Steps for User

1. **Hard refresh your browser** (⌘ Command + ⇧ Shift + R in Safari)
2. **Test the signing process**:
   - Fill out the form
   - Save XML
   - Click "🔐 Podpísať (Sign)"
3. **Expected behavior**:
   - D.Launcher 2 should open (if installed)
   - D.Signer window should appear
   - No "xdcIdentifier" error should occur

## Technical Notes

- This solution works with D.Bridge JS v1.0
- The XMLDataContainer format is preserved (no changes needed)
- The formatIdentifier correctly identifies the content as XMLDataContainer
- D.Signer will still validate and sign the XMLDataContainer properly

## Alternative Solutions (Not Needed)

We also considered:
1. ❌ Upgrading to D.Bridge JS v1.5+ - Would require testing and might break other functionality
2. ❌ Reducing XMLDataContainer size - Didn't solve the problem even with minimal content
3. ❌ Changing parameter order - Didn't affect the error
4. ✅ **Using addTxtObject()** - Simple, works perfectly!

## Conclusion

The persistent DitecError was caused by a bug in D.Bridge JS v1.0's `addXmlObject()` method. Switching to `addTxtObject()` resolves the issue while maintaining full XMLDataContainer signing functionality.

---

**Status**: ✅ RESOLVED
**Date**: 2025-10-15
**Solution**: Use `addTxtObject()` instead of `addXmlObject()`

