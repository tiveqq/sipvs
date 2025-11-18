/**
 * Detailed ASiC-E Debugging Tool
 * Analyzes any ASiC-E file to identify issues
 */

const fs = require('fs-extra');
const path = require('path');
const asiceHandler = require('../lib/asice-handler');
const xadesBesValidator = require('../lib/xades-bes-validator');

async function debugAsiceFile(filePath) {
  try {
    console.log('='.repeat(80));
    console.log(`DETAILED ASiC-E ANALYSIS: ${filePath}`);
    console.log('='.repeat(80));

    if (!await fs.pathExists(filePath)) {
      console.error(`✗ File not found: ${filePath}`);
      return;
    }

    const fileBuffer = await fs.readFile(filePath);
    console.log(`\n[FILE INFO]`);
    console.log(`  Size: ${fileBuffer.length} bytes`);
    console.log(`  Magic: ${fileBuffer.slice(0, 4).toString('hex')}`);

    // Extract
    console.log(`\n[EXTRACTION]`);
    let extracted;
    try {
      extracted = asiceHandler.extractAsiceContainer(fileBuffer);
      console.log(`✓ Extraction successful`);
    } catch (error) {
      console.error(`✗ Extraction failed: ${error.message}`);
      return;
    }

    const { files, mimetype, manifest, signatures } = extracted;

    // Files
    console.log(`\n[FILES IN CONTAINER] (${files.size} total)`);
    for (const [fpath, info] of files.entries()) {
      console.log(`  - ${fpath} (${info.data.length} bytes)`);
    }

    // Signature content
    console.log(`\n[SIGNATURE CONTENT]`);
    console.log(`  Length: ${signatures.length} chars`);
    console.log(`  Type: ${typeof signatures}`);
    console.log(`  First 300 chars:\n${signatures.substring(0, 300)}`);

    // Parse XML
    console.log(`\n[XML PARSING]`);
    let doc;
    try {
      doc = xadesBesValidator.loadXMLWithPreservation(signatures);
      console.log(`✓ XML parsed successfully`);
      console.log(`  Root: ${doc.documentElement.nodeName}`);
      console.log(`  Namespace: ${doc.documentElement.namespaceURI}`);
    } catch (error) {
      console.error(`✗ XML parsing failed: ${error.message}`);
      console.log(`\n[SIGNATURE CONTENT DUMP]`);
      console.log(signatures);
      return;
    }

    // Validate
    console.log(`\n[VALIDATION]`);
    const validation = xadesBesValidator.validateXAdESBES(doc);
    console.log(`  Valid: ${validation.valid}`);
    if (validation.errors.length > 0) {
      console.log(`  Errors (${validation.errors.length}):`);
      validation.errors.forEach(e => console.log(`    - ${e}`));
    }
    if (validation.warnings.length > 0) {
      console.log(`  Warnings (${validation.warnings.length}):`);
      validation.warnings.forEach(w => console.log(`    - ${w}`));
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('\n✗ DEBUG FAILED:', error.message);
    console.error(error.stack);
  }
}

// Get file path from command line or use default
const filePath = process.argv[2] || 'sample/sample-xades-bes.asice';
debugAsiceFile(filePath);

