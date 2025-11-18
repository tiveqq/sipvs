/**
 * ASiC-E Container Handler Module
 * Handles extraction, processing, and repackaging of ASiC-E containers
 */

const AdmZip = require('adm-zip');
const crypto = require('crypto');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

/**
 * Extract ASiC-E container from buffer
 * @param {Buffer} buffer - ASiC-E file buffer
 * @returns {Object} - { files: Map, mimetype: string, manifest: string, signatures: string }
 */
function extractAsiceContainer(buffer) {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    
    const files = new Map();
    let mimetype = null;
    let manifest = null;
    let signatures = null;
    
    for (const entry of entries) {
      const data = entry.getData();
      
      if (entry.entryName === 'mimetype') {
        mimetype = data.toString('utf8');
      } else if (entry.entryName === 'META-INF/manifest.xml') {
        manifest = data.toString('utf8');
      } else if (entry.entryName === 'META-INF/signatures.xml' || 
                 entry.entryName === 'META-INF/signature.xml') {
        signatures = data.toString('utf8');
      }
      
      files.set(entry.entryName, {
        data,
        isDirectory: entry.isDirectory,
        comment: entry.comment,
        method: entry.method
      });
    }
    
    if (!signatures) {
      throw new Error('No signature file found in ASiC-E container (expected META-INF/signatures.xml)');
    }
    
    return { files, mimetype, manifest, signatures };
  } catch (error) {
    throw new Error(`Failed to extract ASiC-E container: ${error.message}`);
  }
}

/**
 * Locate signature file path in container
 * @param {Map} files - Files map from extraction
 * @returns {string} - Path to signature file
 */
function locateSignatureFile(files) {
  for (const path of files.keys()) {
    if (path === 'META-INF/signatures.xml' || path === 'META-INF/signature.xml') {
      return path;
    }
  }
  throw new Error('Signature file not found in container');
}

/**
 * Update manifest with new signature digest
 * @param {string} manifestXml - Original manifest XML
 * @param {Buffer} signatureData - Updated signature data
 * @returns {string} - Updated manifest XML
 */
function updateManifest(manifestXml, signatureData) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(manifestXml, 'text/xml');
    
    // Compute new digest for signatures.xml
    const newDigest = crypto.createHash('sha256').update(signatureData).digest('base64');
    
    // Find and update the manifest entry for signatures.xml
    const entries = doc.getElementsByTagName('FileEntry');
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const fullPath = entry.getAttribute('FullPath');
      
      if (fullPath === 'META-INF/signatures.xml' || fullPath === 'META-INF/signature.xml') {
        // Update digest
        const digestNode = entry.getElementsByTagName('DigestValue')[0];
        if (digestNode) {
          digestNode.textContent = newDigest;
        }
        break;
      }
    }
    
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  } catch (error) {
    throw new Error(`Failed to update manifest: ${error.message}`);
  }
}

/**
 * Repackage ASiC-E container with updated signature
 * @param {Map} files - Original files map
 * @param {string} updatedSignature - Updated signature XML
 * @param {string} updatedManifest - Updated manifest XML
 * @param {string} signaturePath - Path to signature file
 * @returns {Buffer} - New ASiC-E container buffer
 */
function repackageAsiceContainer(files, updatedSignature, updatedManifest, signaturePath) {
  try {
    const zip = new AdmZip();
    
    // Add mimetype FIRST, uncompressed (STORE method)
    if (files.has('mimetype')) {
      const mimetypeData = files.get('mimetype').data;
      zip.addFile('mimetype', mimetypeData, '', 0); // 0 = STORE (no compression)
    } else {
      zip.addFile('mimetype', Buffer.from('application/vnd.etsi.asic-e+zip'), '', 0);
    }
    
    // Add all other files
    for (const [path, fileInfo] of files.entries()) {
      if (path === 'mimetype') continue; // Already added
      
      if (path === signaturePath) {
        // Add updated signature
        zip.addFile(path, Buffer.from(updatedSignature, 'utf8'));
      } else if (path === 'META-INF/manifest.xml') {
        // Add updated manifest
        zip.addFile(path, Buffer.from(updatedManifest, 'utf8'));
      } else if (!fileInfo.isDirectory) {
        // Add original file
        zip.addFile(path, fileInfo.data);
      }
    }
    
    return zip.toBuffer();
  } catch (error) {
    throw new Error(`Failed to repackage ASiC-E container: ${error.message}`);
  }
}

/**
 * Validate ASiC-E container structure
 * @param {Map} files - Files map from extraction
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateAsiceStructure(files) {
  const errors = [];
  
  // Check for required files
  if (!files.has('mimetype')) {
    errors.push('Missing mimetype file');
  }
  
  if (!files.has('META-INF/manifest.xml')) {
    errors.push('Missing META-INF/manifest.xml');
  }
  
  let hasSignature = false;
  for (const path of files.keys()) {
    if (path === 'META-INF/signatures.xml' || path === 'META-INF/signature.xml') {
      hasSignature = true;
      break;
    }
  }
  
  if (!hasSignature) {
    errors.push('Missing signature file (META-INF/signatures.xml or META-INF/signature.xml)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  extractAsiceContainer,
  locateSignatureFile,
  updateManifest,
  repackageAsiceContainer,
  validateAsiceStructure
};

