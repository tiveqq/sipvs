#!/usr/bin/env node

/**
 * Test script to convert wrapped ASiC-E container to XAdES-T using provided TS/TSResponse.tsr
 */

const fs = require('fs');
const path = require('path');
const xadesTExtension = require('../lib/xades-t-extension');
const xadesBesValidator = require('../lib/xades-bes-validator');
const asiceHandler = require('../lib/asice-handler');

console.log('================================================================================');
console.log('CONVERTING WRAPPED ASiC-E TO XAdES-T WITH PROVIDED TIMESTAMP');
console.log('================================================================================\n');

async function testConversion() {
  try {
    // Step 1: Load provided timestamp response
    console.log('[STEP 1] Loading provided TSResponse.tsr');
    const tsResponsePath = path.join(__dirname, 'TS', 'TSResponse.tsr');
    const timeStampResp = fs.readFileSync(tsResponsePath);
    console.log(`✓ Loaded ${timeStampResp.length} bytes`);

    // Step 2: Extract TimeStampToken
    console.log('\n[STEP 2] Extracting TimeStampToken from TSResponse');
    const timestampToken = xadesTExtension.extractTimeStampToken(timeStampResp);
    console.log(`✓ Extracted token (${timestampToken.length} chars)`);

    // Step 3: Load wrapped ASiC-E container
    console.log('\n[STEP 3] Loading wrapped ASiC-E container');
    const wrappedAsicePath = path.join(__dirname, 'data', 'student-registration-2025-11-17T23-06-55-781Z-signed-2025-11-17T23-07-30-486Z.asice');
    if (!fs.existsSync(wrappedAsicePath)) {
      throw new Error(`File not found: ${wrappedAsicePath}`);
    }
    const fileBuffer = fs.readFileSync(wrappedAsicePath);
    console.log(`✓ Loaded ${fileBuffer.length} bytes`);

    // Step 4: Extract and validate
    console.log('\n[STEP 4] Extracting ASiC-E container');
    const { files, signatures, manifest } = asiceHandler.extractAsiceContainer(fileBuffer);
    console.log(`✓ Extracted ${Object.keys(files).length} files`);

    // Step 5: Validate structure
    console.log('\n[STEP 5] Validating ASiC-E structure');
    const validation = asiceHandler.validateAsiceStructure(files);
    if (!validation.valid) {
      throw new Error(`Invalid structure: ${validation.errors.join(', ')}`);
    }
    console.log(`✓ Structure is valid`);

    // Step 6: Parse and validate signature
    console.log('\n[STEP 6] Parsing and validating signature');
    const doc = xadesBesValidator.loadXMLWithPreservation(signatures);
    const xadesValidation = xadesBesValidator.validateXAdESBES(doc);
    if (!xadesValidation.valid) {
      throw new Error(`Invalid XAdES-BES: ${xadesValidation.errors.join(', ')}`);
    }
    console.log(`✓ XAdES-BES is valid`);

    // Step 7: Extend to XAdES-T
    console.log('\n[STEP 7] Extending to XAdES-T');
    const extendedDoc = xadesTExtension.extendToXAdEST(doc, timestampToken);
    console.log(`✓ Extended to XAdES-T`);

    // Step 8: Serialize
    console.log('\n[STEP 8] Serializing extended signature');
    const updatedSignature = xadesBesValidator.serializeXML(extendedDoc);
    console.log(`✓ Serialized (${updatedSignature.length} chars)`);

    // Step 9: Update manifest
    console.log('\n[STEP 9] Updating manifest');
    const updatedManifest = asiceHandler.updateManifest(manifest, Buffer.from(updatedSignature, 'utf8'));
    console.log(`✓ Manifest updated`);

    // Step 10: Repackage container
    console.log('\n[STEP 10] Repackaging ASiC-E container');
    const signaturePath = asiceHandler.locateSignatureFile(files);
    const newContainerBuffer = asiceHandler.repackageAsiceContainer(files, updatedSignature, updatedManifest, signaturePath);
    console.log(`✓ Repackaged (${newContainerBuffer.length} bytes)`);

    // Step 11: Save output
    console.log('\n[STEP 11] Saving converted container');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(__dirname, 'output', `wrapped-asice-xades-t-provided-ts-${timestamp}.asice`);
    fs.writeFileSync(outputPath, newContainerBuffer);
    console.log(`✓ Saved to: ${outputPath}`);

    console.log('\n================================================================================');
    console.log('✅ CONVERSION SUCCESSFUL!');
    console.log('================================================================================\n');
    console.log(`Output file: ${outputPath}`);
    console.log(`File size: ${newContainerBuffer.length} bytes`);
    console.log('\nYou can now upload this file to D.Viewer for validation.\n');

  } catch (error) {
    console.error(`\n✗ ERROR: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

testConversion();

