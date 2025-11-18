#!/usr/bin/env node

/**
 * Test to verify TimeStampRequest generation fix
 */

const fs = require('fs');
const path = require('path');
const xadesTExtension = require('../lib/xades-t-extension');

console.log('================================================================================');
console.log('TESTING TimeStampRequest GENERATION FIX');
console.log('================================================================================\n');

// Load reference TimeStampRequest
const refPath = path.join(__dirname, 'TS', 'TSRequest.tsq');
const refBuffer = fs.readFileSync(refPath);

console.log('[STEP 1] Load reference TimeStampRequest');
console.log(`✓ Loaded ${refBuffer.length} bytes from ${refPath}`);
console.log(`  Hex: ${refBuffer.toString('hex')}\n`);

// Parse reference to extract hash
console.log('[STEP 2] Extract hash from reference');
const forge = require('node-forge');
const refAsn1 = forge.asn1.fromDer(refBuffer.toString('binary'));
const refMsgImprint = refAsn1.value[1];
const refHashedMsg = refMsgImprint.value[1];
const messageImprint = Buffer.from(refHashedMsg.value, 'binary');

console.log(`✓ Extracted hash: ${messageImprint.toString('hex')}`);
console.log(`  Hash length: ${messageImprint.length} bytes\n`);

// Generate new TimeStampRequest
console.log('[STEP 3] Generate new TimeStampRequest');
const generatedReq = xadesTExtension.createTimeStampReq(messageImprint);
console.log(`✓ Generated ${generatedReq.length} bytes`);
console.log(`  Hex: ${generatedReq.toString('hex')}\n`);

// Compare
console.log('[STEP 4] Compare with reference');
const match = refBuffer.equals(generatedReq);
console.log(`Reference size: ${refBuffer.length} bytes`);
console.log(`Generated size: ${generatedReq.length} bytes`);
console.log(`Match: ${match ? '✓ YES' : '✗ NO'}\n`);

if (!match) {
  console.log('[DIFFERENCES]');
  for (let i = 0; i < Math.max(refBuffer.length, generatedReq.length); i++) {
    const refByte = i < refBuffer.length ? refBuffer[i] : undefined;
    const genByte = i < generatedReq.length ? generatedReq[i] : undefined;
    if (refByte !== genByte) {
      const refHex = refByte !== undefined ? refByte.toString(16).padStart(2, '0') : 'XX';
      const genHex = genByte !== undefined ? genByte.toString(16).padStart(2, '0') : 'XX';
      console.log(`  Offset 0x${i.toString(16).padStart(2, '0')}: ref=${refHex} gen=${genHex}`);
    }
  }
  process.exit(1);
}

console.log('================================================================================');
console.log('✅ TimeStampRequest generation is CORRECT!');
console.log('================================================================================\n');
console.log('The generated TimeStampRequest now matches the reference exactly.');
console.log('This should resolve the TSA rejection issue.\n');

