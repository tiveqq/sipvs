/**
 * Verify that XAdES-T extension was applied correctly
 * Checks for presence of UnsignedSignatureProperties and SignatureTimeStamp
 */

const fs = require('fs-extra');
const asiceHandler = require('../lib/asice-handler');
const xadesBesValidator = require('../lib/xades-bes-validator');

async function verifyXAdEST(filePath) {
  try {
    console.log('='.repeat(80));
    console.log(`VERIFYING XAdES-T EXTENSION: ${filePath}`);
    console.log('='.repeat(80));

    if (!await fs.pathExists(filePath)) {
      console.error(`✗ File not found: ${filePath}`);
      return;
    }

    console.log(`\n[STEP 1] Extract container`);
    const fileBuffer = await fs.readFile(filePath);
    const { signatures } = asiceHandler.extractAsiceContainer(fileBuffer);
    console.log(`✓ Extracted signature (${signatures.length} chars)`);

    console.log(`\n[STEP 2] Parse XML`);
    const doc = xadesBesValidator.loadXMLWithPreservation(signatures);
    console.log(`✓ XML parsed`);

    console.log(`\n[STEP 3] Extract signature element`);
    const sigElem = xadesBesValidator.extractSignatureElement(doc);
    if (!sigElem) {
      console.error(`✗ Signature element not found`);
      return;
    }
    console.log(`✓ Signature element found`);

    console.log(`\n[STEP 4] Check for XAdES-T elements`);
    
    // Check for UnsignedProperties
    const unsignedProps = xadesBesValidator.findElement(sigElem, 'ds:Object/xades:QualifyingProperties/xades:UnsignedProperties');
    if (unsignedProps) {
      console.log(`✓ UnsignedProperties found`);
    } else {
      console.log(`✗ UnsignedProperties NOT found`);
    }

    // Check for UnsignedSignatureProperties
    const unsignedSigProps = xadesBesValidator.findElement(sigElem, 'ds:Object/xades:QualifyingProperties/xades:UnsignedProperties/xades:UnsignedSignatureProperties');
    if (unsignedSigProps) {
      console.log(`✓ UnsignedSignatureProperties found`);
    } else {
      console.log(`✗ UnsignedSignatureProperties NOT found`);
    }

    // Check for SignatureTimeStamp
    const sigTimeStamp = xadesBesValidator.findElement(sigElem, 'ds:Object/xades:QualifyingProperties/xades:UnsignedProperties/xades:UnsignedSignatureProperties/xades:SignatureTimeStamp');
    if (sigTimeStamp) {
      console.log(`✓ SignatureTimeStamp found`);
      
      // Check for EncapsulatedTimeStamp
      const encapsTs = xadesBesValidator.findElement(sigTimeStamp, 'xades:EncapsulatedTimeStamp');
      if (encapsTs) {
        console.log(`✓ EncapsulatedTimeStamp found`);
        console.log(`  Content length: ${encapsTs.textContent.length} chars`);
      } else {
        console.log(`✗ EncapsulatedTimeStamp NOT found`);
      }
    } else {
      console.log(`✗ SignatureTimeStamp NOT found`);
    }

    console.log(`\n[STEP 5] Summary`);
    const hasXAdEST = unsignedProps && unsignedSigProps && sigTimeStamp;
    if (hasXAdEST) {
      console.log(`✅ XAdES-T extension successfully applied!`);
    } else {
      console.log(`❌ XAdES-T extension NOT properly applied`);
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('\n✗ VERIFICATION FAILED:', error.message);
    console.error(error.stack);
  }
}

// Get file path from command line or use default
const filePath = process.argv[2] || 'output/wrapped-asice-xades-t-2025-11-17T23-18-34-254Z.asice';
verifyXAdEST(filePath);

