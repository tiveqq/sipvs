#!/usr/bin/env node

/**
 * Test script to analyze and extract TimeStampToken from provided TS/TSResponse.tsr file
 */

const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

console.log('================================================================================');
console.log('ANALYZING PROVIDED TIMESTAMP RESPONSE FILE');
console.log('================================================================================\n');

// Load the provided TSResponse.tsr file
const tsResponsePath = path.join(__dirname, 'TS', 'TSResponse.tsr');
console.log(`[STEP 1] Loading TSResponse.tsr from: ${tsResponsePath}`);

if (!fs.existsSync(tsResponsePath)) {
  console.error(`✗ File not found: ${tsResponsePath}`);
  process.exit(1);
}

const tsResponseBuffer = fs.readFileSync(tsResponsePath);
console.log(`✓ Loaded ${tsResponseBuffer.length} bytes`);

// Display hex dump of first 64 bytes
console.log(`\n[STEP 2] Hex dump (first 64 bytes):`);
console.log(tsResponseBuffer.slice(0, 64).toString('hex'));

// Parse the DER structure
console.log(`\n[STEP 3] Parsing DER structure...`);
try {
  const asn1 = forge.asn1.fromDer(tsResponseBuffer.toString('binary'));
  
  console.log(`✓ Root element:`);
  console.log(`  - Tag class: ${asn1.tagClass} (${asn1.tagClass === forge.asn1.Class.UNIVERSAL ? 'UNIVERSAL' : 'OTHER'})`);
  console.log(`  - Type: ${asn1.type} (${asn1.type === forge.asn1.Type.SEQUENCE ? 'SEQUENCE' : 'OTHER'})`);
  console.log(`  - Children: ${asn1.value ? asn1.value.length : 0}`);
  
  if (asn1.value && asn1.value.length >= 1) {
    console.log(`\n✓ First child (PKIStatusInfo):`);
    const statusInfo = asn1.value[0];
    console.log(`  - Tag class: ${statusInfo.tagClass}`);
    console.log(`  - Type: ${statusInfo.type}`);
    console.log(`  - Children: ${statusInfo.value ? statusInfo.value.length : 0}`);
    
    if (statusInfo.value && statusInfo.value.length >= 1) {
      const statusElement = statusInfo.value[0];
      console.log(`\n✓ Status element:`);
      console.log(`  - Type: ${statusElement.type} (${statusElement.type === forge.asn1.Type.INTEGER ? 'INTEGER' : 'OTHER'})`);
      const statusValue = statusElement.value.charCodeAt(0);
      console.log(`  - Value: ${statusValue} (${statusValue === 0 ? 'granted' : statusValue === 1 ? 'grantedWithMods' : 'other'})`);
    }
  }
  
  if (asn1.value && asn1.value.length >= 2) {
    console.log(`\n✓ Second child (TimeStampToken/ContentInfo):`);
    const timeStampToken = asn1.value[1];
    console.log(`  - Tag class: ${timeStampToken.tagClass}`);
    console.log(`  - Type: ${timeStampToken.type} (${timeStampToken.type === forge.asn1.Type.SEQUENCE ? 'SEQUENCE' : 'OTHER'})`);
    console.log(`  - Children: ${timeStampToken.value ? timeStampToken.value.length : 0}`);
    
    // Convert to DER and check size
    const tokenDer = forge.asn1.toDer(timeStampToken).getBytes();
    console.log(`  - DER size: ${tokenDer.length} bytes`);
    
    // Base64 encode
    const tokenBase64 = Buffer.from(tokenDer, 'binary').toString('base64');
    console.log(`  - Base64 size: ${tokenBase64.length} chars`);
    console.log(`  - Base64 (first 100 chars): ${tokenBase64.substring(0, 100)}...`);
  }
  
  console.log(`\n✓ TimeStampResp structure is valid!`);
  
} catch (error) {
  console.error(`✗ Failed to parse: ${error.message}`);
  process.exit(1);
}

console.log(`\n================================================================================`);
console.log(`✅ ANALYSIS COMPLETE`);
console.log(`================================================================================\n`);

