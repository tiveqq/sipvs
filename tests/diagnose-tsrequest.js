#!/usr/bin/env node

/**
 * Diagnostic tool to compare reference TimeStampRequest with generated one
 */

const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

console.log('================================================================================');
console.log('DIAGNOSING TimeStampRequest GENERATION');
console.log('================================================================================\n');

// Load reference TimeStampRequest
const refPath = path.join(__dirname, 'TS', 'TSRequest.tsq');
const refBuffer = fs.readFileSync(refPath);

console.log('[REFERENCE FILE]');
console.log(`File: ${refPath}`);
console.log(`Size: ${refBuffer.length} bytes`);
console.log(`Hex: ${refBuffer.toString('hex')}\n`);

// Parse reference structure
console.log('[PARSING REFERENCE STRUCTURE]');
let refAsn1, messageImprint;

try {
  refAsn1 = forge.asn1.fromDer(refBuffer.toString('binary'));
  console.log(`✓ Parsed as SEQUENCE (${refAsn1.value.length} elements)`);

  // Element 0: version
  const version = refAsn1.value[0];
  console.log(`  [0] version: INTEGER = ${version.value.charCodeAt(0)}`);

  // Element 1: messageImprint
  const msgImprint = refAsn1.value[1];
  console.log(`  [1] messageImprint: SEQUENCE (${msgImprint.value.length} elements)`);

  const algId = msgImprint.value[0];
  console.log(`    [0] hashAlgorithm: SEQUENCE (${algId.value.length} elements)`);

  const oid = algId.value[0];
  const oidStr = forge.asn1.derToOid(oid.value);
  console.log(`      [0] algorithm OID: ${oidStr}`);

  const params = algId.value[1];
  console.log(`      [1] parameters: ${params.type === forge.asn1.Type.NULL ? 'NULL' : 'OTHER'}`);

  const hashedMsg = msgImprint.value[1];
  console.log(`    [1] hashedMessage: OCTET STRING (${hashedMsg.value.length} bytes)`);
  console.log(`        Hex: ${Buffer.from(hashedMsg.value, 'binary').toString('hex')}`);

  // Element 2: certReq (if present)
  if (refAsn1.value.length > 2) {
    const certReq = refAsn1.value[2];
    console.log(`  [2] certReq: ${certReq.tagClass === forge.asn1.Class.CONTEXT ? 'CONTEXT' : 'OTHER'} (${certReq.type})`);
    if (certReq.value && certReq.value.length > 0) {
      const certReqBool = certReq.value[0];
      console.log(`      BOOLEAN: ${certReqBool.value === '\xff' ? 'TRUE' : 'FALSE'}`);
    }
  }

  // Extract hash for generation
  const refMsgImprint = refAsn1.value[1];
  const refHashedMsg = refMsgImprint.value[1];
  messageImprint = Buffer.from(refHashedMsg.value, 'binary');

} catch (error) {
  console.error(`✗ Error parsing reference: ${error.message}`);
  process.exit(1);
}

console.log('\n[GENERATING NEW TimeStampRequest]');

console.log(`Using hash from reference: ${messageImprint.toString('hex')}`);

// Generate using current implementation
const xadesTExtension = require('../lib/xades-t-extension');
const generatedReq = xadesTExtension.createTimeStampReq(messageImprint);

console.log(`Generated size: ${generatedReq.length} bytes`);
console.log(`Generated hex: ${generatedReq.toString('hex')}\n`);

// Compare
console.log('[COMPARISON]');
console.log(`Reference size: ${refBuffer.length} bytes`);
console.log(`Generated size: ${generatedReq.length} bytes`);
console.log(`Match: ${refBuffer.equals(generatedReq) ? '✓ YES' : '✗ NO'}\n`);

if (!refBuffer.equals(generatedReq)) {
  console.log('[BYTE-BY-BYTE DIFFERENCES]');
  const maxLen = Math.max(refBuffer.length, generatedReq.length);
  let diffCount = 0;
  
  for (let i = 0; i < maxLen; i++) {
    const refByte = i < refBuffer.length ? refBuffer[i] : undefined;
    const genByte = i < generatedReq.length ? generatedReq[i] : undefined;
    
    if (refByte !== genByte) {
      diffCount++;
      const refHex = refByte !== undefined ? refByte.toString(16).padStart(2, '0') : 'XX';
      const genHex = genByte !== undefined ? genByte.toString(16).padStart(2, '0') : 'XX';
      console.log(`  Offset 0x${i.toString(16).padStart(2, '0')}: ref=${refHex} gen=${genHex}`);
    }
  }
  
  console.log(`\nTotal differences: ${diffCount} bytes`);
}

console.log('\n================================================================================');

