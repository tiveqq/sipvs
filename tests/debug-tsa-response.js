/**
 * Debug TSA response structure
 */

const xadesTExtension = require('../lib/xades-t-extension');
const xadesBesValidator = require('../lib/xades-bes-validator');
const forge = require('node-forge');
const crypto = require('crypto');

async function debugTSAResponse() {
  try {
    console.log('='.repeat(80));
    console.log('DEBUGGING TSA RESPONSE');
    console.log('='.repeat(80));

    // Create a test digest
    console.log('\n[STEP 1] Create test digest');
    const testData = Buffer.from('test-data');
    const digest = crypto.createHash('sha256').update(testData).digest();
    console.log(`✓ Digest: ${digest.toString('hex')}`);

    // Create TimeStampReq
    console.log('\n[STEP 2] Create TimeStampReq');
    const timeStampReq = xadesTExtension.createTimeStampReq(digest);
    console.log(`✓ TimeStampReq created (${timeStampReq.length} bytes)`);
    console.log(`  Hex: ${timeStampReq.toString('hex').substring(0, 100)}...`);

    // Request timestamp
    console.log('\n[STEP 3] Request timestamp from TSA');
    let timeStampResp;
    try {
      timeStampResp = await xadesTExtension.requestTimestamp(timeStampReq);
      console.log(`✓ Received response (${timeStampResp.length} bytes)`);
      console.log(`  Hex: ${timeStampResp.toString('hex').substring(0, 100)}...`);
    } catch (error) {
      console.error(`✗ TSA request failed: ${error.message}`);
      return;
    }

    // Parse response
    console.log('\n[STEP 4] Parse TimeStampResp structure');
    try {
      const asn1 = forge.asn1.fromDer(timeStampResp.toString('binary'));
      
      console.log(`✓ Parsed ASN.1 structure`);
      console.log(`  Root type: ${asn1.type === forge.asn1.Type.SEQUENCE ? 'SEQUENCE' : 'OTHER'}`);
      console.log(`  Root children: ${asn1.value ? asn1.value.length : 0}`);

      if (asn1.value && asn1.value.length > 0) {
        const statusInfo = asn1.value[0];
        console.log(`\n  StatusInfo type: ${statusInfo.type === forge.asn1.Type.SEQUENCE ? 'SEQUENCE' : 'OTHER'}`);
        console.log(`  StatusInfo children: ${statusInfo.value ? statusInfo.value.length : 0}`);

        if (statusInfo.value && statusInfo.value.length > 0) {
          const status = statusInfo.value[0];
          console.log(`\n  Status type: ${status.type === forge.asn1.Type.INTEGER ? 'INTEGER' : 'OTHER'}`);
          const statusValue = status.value.charCodeAt(0);
          console.log(`  Status value: ${statusValue}`);
          
          const statusNames = {
            0: 'granted',
            1: 'grantedWithMods',
            2: 'rejection',
            3: 'waiting',
            4: 'revocationWarning',
            5: 'revocationNotification'
          };
          console.log(`  Status name: ${statusNames[statusValue] || 'unknown'}`);

          // If rejection, try to get failure info
          if (statusValue === 2 && statusInfo.value.length > 1) {
            const failInfo = statusInfo.value[1];
            console.log(`\n  FailInfo present: ${failInfo ? 'yes' : 'no'}`);
            if (failInfo) {
              console.log(`  FailInfo type: ${failInfo.type}`);
              console.log(`  FailInfo value: ${failInfo.value}`);
            }
          }

          // Check for statusString
          if (statusInfo.value.length > 1) {
            const statusString = statusInfo.value[1];
            console.log(`\n  StatusString present: ${statusString ? 'yes' : 'no'}`);
            if (statusString && statusString.type === forge.asn1.Type.SEQUENCE) {
              console.log(`  StatusString is SEQUENCE with ${statusString.value ? statusString.value.length : 0} items`);
              if (statusString.value && statusString.value.length > 0) {
                const firstString = statusString.value[0];
                if (firstString.value) {
                  console.log(`  First message: ${firstString.value}`);
                }
              }
            }
          }
        }
      }

      // Try to extract token
      console.log('\n[STEP 5] Try to extract TimeStampToken');
      try {
        const token = xadesTExtension.extractTimeStampToken(timeStampResp);
        console.log(`✓ Token extracted successfully`);
      } catch (error) {
        console.log(`✗ Token extraction failed: ${error.message}`);
      }

    } catch (error) {
      console.error(`✗ Failed to parse response: ${error.message}`);
      console.error(error.stack);
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('\n✗ DEBUG FAILED:', error.message);
    console.error(error.stack);
  }
}

debugTSAResponse();

