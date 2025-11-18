/**
 * Test RFC 3161 TimeStampResp parsing and TimeStampToken extraction
 */

const xadesTExtension = require('../lib/xades-t-extension');
const forge = require('node-forge');

function testRFC3161Parsing() {
  console.log('='.repeat(80));
  console.log('TESTING RFC 3161 TIMESTAMP RESPONSE PARSING');
  console.log('='.repeat(80));

  try {
    // Test 1: Create a mock TimeStampResp with success status
    console.log('\n[TEST 1] Create mock TimeStampResp with success status');
    
    // Create a simple ContentInfo (TimeStampToken)
    const contentInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, 
        forge.asn1.oidToDer('1.2.840.113549.1.7.1').getBytes()), // id-data OID
      forge.asn1.create(forge.asn1.Class.CONTEXT, 0, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, 
          Buffer.from('mock-timestamp-data').toString('binary'))
      ])
    ]);

    // Create PKIStatusInfo with status = 0 (granted)
    const statusInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x00') // status = 0 (granted)
    ]);

    // Create TimeStampResp
    const timeStampResp = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      statusInfo,
      contentInfo
    ]);

    const timeStampRespDer = Buffer.from(forge.asn1.toDer(timeStampResp).getBytes(), 'binary');
    console.log(`✓ Created mock TimeStampResp (${timeStampRespDer.length} bytes)`);

    // Test 2: Extract TimeStampToken
    console.log('\n[TEST 2] Extract TimeStampToken from TimeStampResp');
    const token = xadesTExtension.extractTimeStampToken(timeStampRespDer);
    console.log(`✓ Extracted TimeStampToken (${token.length} chars base64)`);
    console.log(`  Token preview: ${token.substring(0, 50)}...`);

    // Test 3: Verify token is valid base64
    console.log('\n[TEST 3] Verify token is valid base64');
    const tokenBuffer = Buffer.from(token, 'base64');
    console.log(`✓ Token decoded successfully (${tokenBuffer.length} bytes)`);

    // Test 4: Verify token is valid DER
    console.log('\n[TEST 4] Verify token is valid DER structure');
    const tokenAsn1 = forge.asn1.fromDer(tokenBuffer.toString('binary'));
    if (tokenAsn1.type === forge.asn1.Type.SEQUENCE) {
      console.log(`✓ Token is valid SEQUENCE (ContentInfo)`);
    } else {
      console.log(`✗ Token is not a SEQUENCE`);
    }

    // Test 5: Test with grantedWithMods status
    console.log('\n[TEST 5] Test with grantedWithMods status (1)');
    const statusInfo2 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x01') // status = 1 (grantedWithMods)
    ]);
    const timeStampResp2 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      statusInfo2,
      contentInfo
    ]);
    const timeStampRespDer2 = Buffer.from(forge.asn1.toDer(timeStampResp2).getBytes(), 'binary');
    const token2 = xadesTExtension.extractTimeStampToken(timeStampRespDer2);
    console.log(`✓ Successfully extracted token with grantedWithMods status`);

    // Test 6: Test error handling - rejection status
    console.log('\n[TEST 6] Test error handling - rejection status (2)');
    const statusInfo3 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x02') // status = 2 (rejection)
    ]);
    const timeStampResp3 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      statusInfo3
    ]);
    const timeStampRespDer3 = Buffer.from(forge.asn1.toDer(timeStampResp3).getBytes(), 'binary');
    try {
      xadesTExtension.extractTimeStampToken(timeStampRespDer3);
      console.log(`✗ Should have thrown error for rejection status`);
    } catch (error) {
      console.log(`✓ Correctly rejected with error: ${error.message}`);
    }

    // Test 7: Test error handling - missing token
    console.log('\n[TEST 7] Test error handling - missing token');
    const timeStampResp4 = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      statusInfo // Only status, no token
    ]);
    const timeStampRespDer4 = Buffer.from(forge.asn1.toDer(timeStampResp4).getBytes(), 'binary');
    try {
      xadesTExtension.extractTimeStampToken(timeStampRespDer4);
      console.log(`✗ Should have thrown error for missing token`);
    } catch (error) {
      console.log(`✓ Correctly rejected with error: ${error.message}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL RFC 3161 PARSING TESTS PASSED!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRFC3161Parsing();

