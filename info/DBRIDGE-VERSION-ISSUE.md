# D.Bridge JS Version Mismatch - Critical Discovery! 🚨

## 🔍 **Root Cause Identified**

You're using **D.Bridge JS v1.0**, but the `xslMediaDestinationTypeDescription` parameter was added in **v1.5.2.0**!

### **Evidence:**

**Your HTML file** (`public/index.html` lines 10-12):
```html
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/config.js"></script>
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/dCommon.min.js"></script>
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/dSigXadesBp.min.js"></script>
```

**Official Documentation:**
> **D.Bridge JS v1.5.2.0** (released March 11, 2025)
> adding and processing the XHTML constant in the **xslMediaDestinationTypeDescription parameter** of addXmlObject method

---

## ⚠️ **The Problem**

### D.Bridge JS v1.0 Signature (5 parameters):
```javascript
ditec.dSigXadesBpJs.addXmlObject(
    objectId,              // 1st param
    objectDescription,     // 2nd param
    xmlBase64,            // 3rd param
    formatIdentifier,     // 4th param
    callback              // 5th param
);
```

### D.Bridge JS v1.5.2.0+ Signature (6 parameters):
```javascript
ditec.dSigXadesBpJs.addXmlObject(
    objectId,                           // 1st param
    objectDescription,                  // 2nd param
    xmlBase64,                         // 3rd param
    formatIdentifier,                  // 4th param
    xslMediaDestinationTypeDescription, // 5th param ⬅️ ADDED IN v1.5.2.0
    callback                           // 6th param
);
```

---

## 🎯 **Solution Options**

### **Option 1: Upgrade to D.Bridge JS v1.5+ (RECOMMENDED)**

**Update** `public/index.html`:

```html
<!-- OLD (v1.0) -->
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/config.js"></script>
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/dCommon.min.js"></script>
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.0/dSigXadesBp.min.js"></script>

<!-- NEW (v1.5) -->
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.5/config.js"></script>
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.5/dCommon.min.js"></script>
<script src="https://www.slovensko.sk/static/zep/dbridge_js/v1.5/dSigXadesBp.min.js"></script>
```

**Then update** `public/script.js` to use 6 parameters:

```javascript
ditec.dSigXadesBpJs.addXmlObject(
    payload.identifier,
    payload.description,
    payload.xmlBase64,
    payload.formatIdentifier,
    "HTML",                      // xslMediaDestinationTypeDescription
    new Callback(...)
);
```

---

### **Option 2: Stay with v1.0 (Use 5 parameters)**

**Keep** `public/index.html` as is (v1.0)

**Update** `public/script.js` to use 5 parameters (ALREADY DONE):

```javascript
ditec.dSigXadesBpJs.addXmlObject(
    payload.identifier,
    payload.description,
    payload.xmlBase64,
    payload.formatIdentifier,
    new Callback(...)
);
```

---

## 🔧 **Current Status**

I've already reverted the code to use the **v1.0 signature (5 parameters)** with enhanced diagnostic logging.

**Current code** (`public/script.js` lines 805-813):
```javascript
ditec.dSigXadesBpJs.addXmlObject(
    payload.identifier,           // objectId
    payload.description,          // objectDescription
    payload.xmlBase64,           // xmlBase64
    payload.formatIdentifier,    // formatIdentifier
    new Callback(...)            // callback
);
```

---

## 📋 **Next Steps for Testing**

### **Step 1: Hard Refresh Browser**
- Safari: **⌘ Command + ⇧ Shift + R**
- Or clear cache completely

### **Step 2: Test Signing**
1. Fill out the form
2. Save XML
3. Click "🔐 Podpísať (Sign)"

### **Step 3: Check Console Output**

You should see:
```
🔍 [DIAGNOSTIC] D.Bridge JS Version Check:
  - Your HTML loads: v1.0 (from slovensko.sk/static/zep/dbridge_js/v1.0/)
  - xslMediaDestinationTypeDescription was added in: v1.5.2.0
  - This parameter might NOT exist in v1.0!

🔍 [DIAGNOSTIC] Testing WITHOUT xslMediaDestinationTypeDescription (v1.0 signature):
  1. objectId: student-registration-...
  2. objectDescription: Student Registration Form - University Enrollment
  3. xmlBase64 (length): ~XXXX
  4. formatIdentifier: http://data.gov.sk/def/container/xmldatacontainer+xml/1.1
  5. formatIdentifier length: 57
  6. callback: Callback object
```

### **Step 4: Report Results**

Tell me:
1. **Did you see the diagnostic messages?** (This confirms new code is loaded)
2. **Did the error change or disappear?**
3. **Did D.Signer open?**
4. **What's the exact error message now?** (if any)

---

## 🤔 **Why This Matters**

If you're still getting the error with v1.0 signature (5 parameters), then the problem is NOT the parameter count. It means:

1. **Something else is wrong** with one of the parameters
2. **The XMLDataContainer format** might be incorrect
3. **The formatIdentifier value** might be getting corrupted somewhere
4. **D.Bridge JS v1.0** might have a bug or different requirements

---

## 🔍 **Alternative Debugging Approach**

If the error persists, we should:

1. **Check the actual D.Bridge JS library code** (dSigXadesBp.min.js) to see the exact validation
2. **Try using `addTxtObject()` instead** to see if that works (simpler test)
3. **Examine the XMLDataContainer structure** more carefully
4. **Check if there's a length limit** on the entire XMLDataContainer, not just formatIdentifier

---

## 📚 **References**

- **D.Bridge JS v1.5.2.0 Release Notes**: https://www.slovensko.sk/en/download/information-about-changes-to-c
- **Integration Manual**: Integracna_prirucka_D.Bridge_JS_v1.x.zip
- **Current Version Check**: View page source and search for "dbridge_js/v"

---

**Status**: ⏳ **WAITING FOR TEST RESULTS**

Please test with the current code (v1.0 signature, 5 parameters) and report back!

