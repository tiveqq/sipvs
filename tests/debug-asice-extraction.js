/**
 * Debug ASiC-E Extraction and Validation
 * Traces the signature content through extraction and validation pipeline
 */

const fs = require('fs-extra');
const path = require('path');
const asiceHandler = require('../lib/asice-handler');
const xadesBesValidator = require('../lib/xades-bes-validator');
const { createSampleAsice } = require('./create-sample-asice');

async function debugAsiceExtraction() {
  try {
    console.log('='.repeat(80));
    console.log('ASiC-E EXTRACTION AND VALIDATION DEBUG');
    console.log('='.repeat(80));

    // Step 1: Create or load sample ASiC-E
    console.log('\n[STEP 1] Creating sample ASiC-E container...');
    const samplePath = await createSampleAsice();
    console.log(`✓ Sample created at: ${samplePath}`);

    // Step 2: Read file
    console.log('\n[STEP 2] Reading ASiC-E file...');
    const fileBuffer = await fs.readFile(samplePath);
    console.log(`✓ File size: ${fileBuffer.length} bytes`);
    console.log(`✓ Magic bytes: ${fileBuffer.slice(0, 4).toString('hex')} (should be 504b0304 for ZIP)`);

    // Step 3: Extract container
    console.log('\n[STEP 3] Extracting ASiC-E container...');
    const { files, mimetype, manifest, signatures } = asiceHandler.extractAsiceContainer(fileBuffer);
    console.log(`✓ Extracted ${files.size} files`);
    console.log(`✓ Mimetype: ${mimetype}`);
    console.log(`✓ Files in container:`);
    for (const [path, info] of files.entries()) {
      console.log(`  - ${path} (${info.data.length} bytes, isDir: ${info.isDirectory})`);
    }

    // Step 4: Validate structure
    console.log('\n[STEP 4] Validating ASiC-E structure...');
    const structValidation = asiceHandler.validateAsiceStructure(files);
    console.log(`✓ Structure valid: ${structValidation.valid}`);
    if (!structValidation.valid) {
      console.log('✗ Errors:', structValidation.errors);
    }

    // Step 5: Inspect signature content
    console.log('\n[STEP 5] Inspecting signature content...');
    console.log(`✓ Signature type: ${typeof signatures}`);
    console.log(`✓ Signature length: ${signatures.length} characters`);
    console.log(`✓ First 200 chars:\n${signatures.substring(0, 200)}`);
    console.log(`✓ Contains "ds:Signature": ${signatures.includes('ds:Signature')}`);
    console.log(`✓ Contains "ds:SignatureValue": ${signatures.includes('ds:SignatureValue')}`);
    console.log(`✓ Contains "xades:QualifyingProperties": ${signatures.includes('xades:QualifyingProperties')}`);

    // Step 6: Parse XML
    console.log('\n[STEP 6] Parsing signature XML...');
    let doc;
    try {
      doc = xadesBesValidator.loadXMLWithPreservation(signatures);
      console.log(`✓ XML parsed successfully`);
      console.log(`✓ Document type: ${doc.constructor.name}`);
      console.log(`✓ Document element: ${doc.documentElement.nodeName}`);
    } catch (error) {
      console.log(`✗ XML parsing failed: ${error.message}`);
      return;
    }

    // Step 7: Find elements
    console.log('\n[STEP 7] Finding required elements...');
    const requiredPaths = [
      'ds:Signature',
      'ds:Signature/ds:SignedInfo',
      'ds:Signature/ds:SignatureValue',
      'ds:Signature/ds:KeyInfo',
      'ds:Signature/ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties'
    ];

    for (const pathStr of requiredPaths) {
      const elem = xadesBesValidator.findElement(doc, pathStr);
      console.log(`  ${elem ? '✓' : '✗'} ${pathStr}`);
      if (elem) {
        console.log(`    └─ Tag: ${elem.nodeName}, NS: ${elem.namespaceURI}`);
      }
    }

    // Step 8: Validate BES
    console.log('\n[STEP 8] Validating XAdES-BES structure...');
    const validation = xadesBesValidator.validateXAdESBES(doc);
    console.log(`✓ Valid: ${validation.valid}`);
    if (validation.errors.length > 0) {
      console.log('✗ Errors:');
      validation.errors.forEach(e => console.log(`  - ${e}`));
    }
    if (validation.warnings.length > 0) {
      console.log('⚠ Warnings:');
      validation.warnings.forEach(w => console.log(`  - ${w}`));
    }

    // Step 9: Debug document structure
    console.log('\n[STEP 9] Document structure analysis...');
    console.log(`✓ Root element: ${doc.documentElement.nodeName}`);
    console.log(`✓ Root namespace: ${doc.documentElement.namespaceURI}`);
    console.log(`✓ Root attributes:`);
    for (let i = 0; i < doc.documentElement.attributes.length; i++) {
      const attr = doc.documentElement.attributes[i];
      console.log(`  - ${attr.nodeName}: ${attr.nodeValue}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('DEBUG COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n✗ DEBUG FAILED:', error.message);
    console.error(error.stack);
  }
}

debugAsiceExtraction();

