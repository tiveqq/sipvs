/**
 * Test wrapped ASiC-E container (asic:XAdESSignatures wrapper)
 * This tests the fix for handling user-uploaded ASiC-E files
 */

const fs = require('fs-extra');
const asiceHandler = require('../lib/asice-handler');
const xadesBesValidator = require('../lib/xades-bes-validator');

async function testWrappedAsice() {
  try {
    console.log('='.repeat(80));
    console.log('TESTING WRAPPED ASiC-E CONTAINER FIX');
    console.log('='.repeat(80));

    const filePath = 'data/student-registration-2025-11-17T23-06-55-781Z-signed-2025-11-17T23-07-30-486Z.asice';
    
    if (!await fs.pathExists(filePath)) {
      console.error(`✗ Test file not found: ${filePath}`);
      return;
    }

    console.log(`\n[TEST 1] Extract ASiC-E container`);
    const fileBuffer = await fs.readFile(filePath);
    const { files, mimetype, manifest, signatures } = asiceHandler.extractAsiceContainer(fileBuffer);
    console.log(`✓ Extracted ${files.size} files`);
    console.log(`✓ Signature content length: ${signatures.length} chars`);

    console.log(`\n[TEST 2] Validate ASiC-E structure`);
    const structValidation = asiceHandler.validateAsiceStructure(files);
    if (!structValidation.valid) {
      console.error(`✗ Structure validation failed:`, structValidation.errors);
      return;
    }
    console.log(`✓ ASiC-E structure is valid`);

    console.log(`\n[TEST 3] Parse signature XML`);
    const doc = xadesBesValidator.loadXMLWithPreservation(signatures);
    console.log(`✓ XML parsed successfully`);
    console.log(`✓ Root element: ${doc.documentElement.nodeName}`);

    console.log(`\n[TEST 4] Validate XAdES-BES structure`);
    const validation = xadesBesValidator.validateXAdESBES(doc);
    if (!validation.valid) {
      console.error(`✗ XAdES-BES validation failed:`, validation.errors);
      return;
    }
    console.log(`✓ XAdES-BES structure is valid`);
    if (validation.warnings.length > 0) {
      console.log(`⚠ Warnings:`, validation.warnings);
    }

    console.log(`\n[TEST 5] Extract signature element`);
    const sigElem = xadesBesValidator.extractSignatureElement(doc);
    if (!sigElem) {
      console.error(`✗ Failed to extract signature element`);
      return;
    }
    console.log(`✓ Signature element extracted`);
    console.log(`✓ Element: ${sigElem.nodeName}`);
    console.log(`✓ Namespace: ${sigElem.namespaceURI}`);

    console.log(`\n[TEST 6] Find required child elements`);
    const requiredElements = [
      'ds:SignedInfo',
      'ds:SignatureValue',
      'ds:KeyInfo',
      'ds:Object'
    ];
    
    for (const elemPath of requiredElements) {
      const elem = xadesBesValidator.findElement(sigElem, elemPath);
      if (!elem) {
        console.error(`✗ Missing element: ${elemPath}`);
        return;
      }
      console.log(`✓ Found: ${elemPath}`);
    }

    console.log(`\n[TEST 7] Extract SignatureValue`);
    const sigValueElem = xadesBesValidator.findElement(sigElem, 'ds:SignatureValue');
    if (!sigValueElem) {
      console.error(`✗ SignatureValue not found`);
      return;
    }
    console.log(`✓ SignatureValue extracted`);
    console.log(`✓ Content length: ${sigValueElem.textContent.length} chars`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS PASSED - Wrapped ASiC-E container is now supported!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testWrappedAsice();

