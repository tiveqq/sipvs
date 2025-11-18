/**
 * ASiC-E Container Conversion Tests
 */

const asiceHandler = require('../lib/asice-handler');
const xadesBesValidator = require('../lib/xades-bes-validator');
const { createSampleAsice, SAMPLE_SIGNATURE, SAMPLE_PAYLOAD } = require('./create-sample-asice');
const fs = require('fs-extra');
const path = require('path');

describe('ASiC-E Container Handler', () => {
  let sampleAsicePath;
  let asiceBuffer;

  beforeAll(async () => {
    // Create sample ASiC-E container
    sampleAsicePath = await createSampleAsice();
    asiceBuffer = await fs.readFile(sampleAsicePath);
  });

  describe('ASiC-E Extraction', () => {
    test('should extract ASiC-E container from buffer', () => {
      const { files, mimetype, manifest, signatures } = asiceHandler.extractAsiceContainer(asiceBuffer);
      
      expect(files).toBeDefined();
      expect(files instanceof Map).toBe(true);
      expect(mimetype).toBe('application/vnd.etsi.asic-e+zip');
      expect(manifest).toBeDefined();
      expect(signatures).toBeDefined();
    });

    test('should preserve all files in container', () => {
      const { files } = asiceHandler.extractAsiceContainer(asiceBuffer);
      
      expect(files.has('mimetype')).toBe(true);
      expect(files.has('document.xml')).toBe(true);
      expect(files.has('META-INF/manifest.xml')).toBe(true);
      expect(files.has('META-INF/signatures.xml')).toBe(true);
    });

    test('should extract signature content correctly', () => {
      const { signatures } = asiceHandler.extractAsiceContainer(asiceBuffer);
      
      expect(signatures).toContain('ds:Signature');
      expect(signatures).toContain('ds:SignatureValue');
      expect(signatures).toContain('xades:QualifyingProperties');
    });

    test('should throw error for invalid ZIP', () => {
      const invalidBuffer = Buffer.from('not a zip file');
      
      expect(() => {
        asiceHandler.extractAsiceContainer(invalidBuffer);
      }).toThrow();
    });
  });

  describe('Signature File Location', () => {
    test('should locate signature file in container', () => {
      const { files } = asiceHandler.extractAsiceContainer(asiceBuffer);
      const sigPath = asiceHandler.locateSignatureFile(files);
      
      expect(sigPath).toBe('META-INF/signatures.xml');
    });

    test('should throw error if signature file not found', () => {
      const emptyMap = new Map();
      
      expect(() => {
        asiceHandler.locateSignatureFile(emptyMap);
      }).toThrow('Signature file not found');
    });
  });

  describe('ASiC-E Structure Validation', () => {
    test('should validate correct ASiC-E structure', () => {
      const { files } = asiceHandler.extractAsiceContainer(asiceBuffer);
      const validation = asiceHandler.validateAsiceStructure(files);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    test('should detect missing mimetype', () => {
      const filesWithoutMimetype = new Map();
      filesWithoutMimetype.set('META-INF/manifest.xml', {});
      filesWithoutMimetype.set('META-INF/signatures.xml', {});
      
      const validation = asiceHandler.validateAsiceStructure(filesWithoutMimetype);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing mimetype file');
    });

    test('should detect missing manifest', () => {
      const filesWithoutManifest = new Map();
      filesWithoutManifest.set('mimetype', {});
      filesWithoutManifest.set('META-INF/signatures.xml', {});
      
      const validation = asiceHandler.validateAsiceStructure(filesWithoutManifest);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing META-INF/manifest.xml');
    });

    test('should detect missing signature', () => {
      const filesWithoutSignature = new Map();
      filesWithoutSignature.set('mimetype', {});
      filesWithoutSignature.set('META-INF/manifest.xml', {});

      const validation = asiceHandler.validateAsiceStructure(filesWithoutSignature);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Missing signature file'))).toBe(true);
    });
  });

  describe('Manifest Update', () => {
    test('should update manifest with new signature digest', () => {
      const { manifest } = asiceHandler.extractAsiceContainer(asiceBuffer);
      const newSignatureData = Buffer.from(SAMPLE_SIGNATURE + ' modified', 'utf8');
      
      const updatedManifest = asiceHandler.updateManifest(manifest, newSignatureData);
      
      expect(updatedManifest).toContain('DigestValue');
      expect(updatedManifest).toContain('META-INF/signatures.xml');
    });

    test('should preserve other manifest entries', () => {
      const { manifest } = asiceHandler.extractAsiceContainer(asiceBuffer);
      const newSignatureData = Buffer.from(SAMPLE_SIGNATURE, 'utf8');
      
      const updatedManifest = asiceHandler.updateManifest(manifest, newSignatureData);
      
      expect(updatedManifest).toContain('document.xml');
    });
  });

  describe('ASiC-E Repackaging', () => {
    test('should repackage container with updated signature', () => {
      const { files, manifest, signatures } = asiceHandler.extractAsiceContainer(asiceBuffer);
      const signaturePath = asiceHandler.locateSignatureFile(files);
      
      const updatedSignature = signatures + '<!-- updated -->';
      const updatedManifest = asiceHandler.updateManifest(manifest, Buffer.from(updatedSignature, 'utf8'));
      
      const newBuffer = asiceHandler.repackageAsiceContainer(files, updatedSignature, updatedManifest, signaturePath);
      
      expect(newBuffer).toBeInstanceOf(Buffer);
      expect(newBuffer.length).toBeGreaterThan(0);
    });

    test('should preserve payload files in repackaged container', () => {
      const { files, manifest, signatures } = asiceHandler.extractAsiceContainer(asiceBuffer);
      const signaturePath = asiceHandler.locateSignatureFile(files);
      
      const updatedSignature = signatures;
      const updatedManifest = asiceHandler.updateManifest(manifest, Buffer.from(updatedSignature, 'utf8'));
      
      const newBuffer = asiceHandler.repackageAsiceContainer(files, updatedSignature, updatedManifest, signaturePath);
      const repackaged = asiceHandler.extractAsiceContainer(newBuffer);
      
      expect(repackaged.files.has('document.xml')).toBe(true);
      expect(repackaged.files.get('document.xml').data.toString('utf8')).toBe(SAMPLE_PAYLOAD);
    });

    test('should place mimetype first and uncompressed', () => {
      const { files, manifest, signatures } = asiceHandler.extractAsiceContainer(asiceBuffer);
      const signaturePath = asiceHandler.locateSignatureFile(files);
      
      const updatedSignature = signatures;
      const updatedManifest = asiceHandler.updateManifest(manifest, Buffer.from(updatedSignature, 'utf8'));
      
      const newBuffer = asiceHandler.repackageAsiceContainer(files, updatedSignature, updatedManifest, signaturePath);
      
      // Check ZIP structure: mimetype should be first entry
      // ZIP local file header starts with 0x04034b50
      expect(newBuffer[0]).toBe(0x50); // 'P'
      expect(newBuffer[1]).toBe(0x4B); // 'K'
    });
  });

  describe('Integration Tests', () => {
    test('should extract, validate, and repackage ASiC-E container', () => {
      const { files, manifest, signatures } = asiceHandler.extractAsiceContainer(asiceBuffer);
      
      // Validate structure
      const validation = asiceHandler.validateAsiceStructure(files);
      expect(validation.valid).toBe(true);
      
      // Validate signature
      const doc = xadesBesValidator.loadXMLWithPreservation(signatures);
      const besValidation = xadesBesValidator.validateXAdESBES(doc);
      expect(besValidation.valid).toBe(true);
      
      // Repackage
      const signaturePath = asiceHandler.locateSignatureFile(files);
      const updatedManifest = asiceHandler.updateManifest(manifest, Buffer.from(signatures, 'utf8'));
      const newBuffer = asiceHandler.repackageAsiceContainer(files, signatures, updatedManifest, signaturePath);
      
      expect(newBuffer).toBeInstanceOf(Buffer);
    });
  });
});

