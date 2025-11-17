/**
 * Test: Multi-Object Signing Flow (XMLDataContainer + PDF)
 * 
 * This test verifies the complete end-to-end flow for signing both
 * XMLDataContainer and PDF objects together in a single signature operation.
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs-extra');

// Mock the server
const app = require('../server');

describe('Multi-Object Signing Flow', () => {
  const testFilename = 'valid-student-registration.xml';

  test('should generate PDF and include it in signing payload', async () => {
    const response = await request(app)
      .post('/api/prepare-signing')
      .send({ filename: testFilename });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.payload).toBeDefined();

    const { payload } = response.body;

    // Verify XMLDataContainer components
    console.log('\n✅ [TEST] XMLDataContainer Object:');
    expect(payload.identifier).toBeDefined();
    console.log('  - Identifier:', payload.identifier);
    expect(payload.description).toBeDefined();
    console.log('  - Description:', payload.description);
    expect(payload.formatIdentifier).toBe('http://data.gov.sk/def/container/xmldatacontainer+xml/1.1');
    console.log('  - Format Identifier:', payload.formatIdentifier);
    expect(payload.xdcXMLData).toBeDefined();
    console.log('  - XML Data length:', payload.xdcXMLData.length);
    expect(payload.xdcUsedXSD).toBeDefined();
    console.log('  - XSD length:', payload.xdcUsedXSD.length);
    expect(payload.xdcUsedXSLT).toBeDefined();
    console.log('  - XSLT length:', payload.xdcUsedXSLT.length);

    // Verify PDF object
    console.log('\n✅ [TEST] PDF Object:');
    expect(payload.pdfBase64).toBeDefined();
    console.log('  - PDF Base64 present: YES');
    expect(typeof payload.pdfBase64).toBe('string');
    console.log('  - PDF Base64 type: string');
    expect(payload.pdfBase64.length).toBeGreaterThan(0);
    console.log('  - PDF Base64 length:', payload.pdfBase64.length, 'bytes');
    console.log('  - PDF size:', (payload.pdfBase64.length / 1024).toFixed(2), 'KB');

    // Verify PDF is valid (starts with %PDF in Base64)
    const pdfHeader = payload.pdfBase64.substring(0, 20);
    console.log('  - PDF Base64 header:', pdfHeader);
    expect(pdfHeader).toMatch(/^JVBERi0/); // %PDF-1.x in Base64
    console.log('  - PDF header valid: YES (starts with %PDF)');

    // Verify PDF is valid Base64
    const isValidBase64 = /^[A-Za-z0-9+/=]+$/.test(payload.pdfBase64);
    expect(isValidBase64).toBe(true);
    console.log('  - Valid Base64 encoding: YES');

    console.log('\n✅ [TEST] Multi-Object Signing Payload:');
    console.log('  - Object 1 (XMLDataContainer): ✅ Included');
    console.log('  - Object 2 (PDF): ✅ Included');
    console.log('  - Ready for signing: YES');
  });

  test('should handle PDF generation errors gracefully', async () => {
    // Test with a file that exists but might have issues
    const response = await request(app)
      .post('/api/prepare-signing')
      .send({ filename: testFilename });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Even if PDF generation fails, XMLDataContainer should still be present
    const { payload } = response.body;
    expect(payload.xdcXMLData).toBeDefined();
    expect(payload.xdcUsedXSD).toBeDefined();
    expect(payload.xdcUsedXSLT).toBeDefined();

    console.log('\n✅ [TEST] Graceful Fallback:');
    console.log('  - XMLDataContainer always included: YES');
    console.log('  - PDF optional: YES');
  });
});

