/**
 * XAdES-BES Validation Module
 * Validates and constructs XAdES-BES signatures with whitespace preservation
 */

const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

// Namespace constants
const NAMESPACES = {
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  xades: 'http://uri.etsi.org/01903/v1.3.2#',
  xzep: 'http://www.ditec.sk/ep/signature_formats/xades_zep/v1.0'
};

/**
 * Load XML with whitespace preservation
 * @param {string} xmlContent - Raw XML content
 * @returns {Document} - Parsed XML document
 */
function loadXMLWithPreservation(xmlContent) {
  const parser = new DOMParser({
    errorHandler: {
      warning: () => {},
      error: (msg) => { throw new Error(`XML Parse Error: ${msg}`); },
      fatalError: (msg) => { throw new Error(`XML Fatal Error: ${msg}`); }
    }
  });
  
  return parser.parseFromString(xmlContent, 'text/xml');
}

/**
 * Find element by XPath-like query
 * @param {Document|Element} node - Starting node
 * @param {string} path - XPath-like path (e.g., "ds:Signature/ds:SignedInfo")
 * @returns {Element|null} - Found element or null
 */
function findElement(node, path) {
  const parts = path.split('/').filter(p => p);
  let current = node;
  
  for (const part of parts) {
    const [prefix, localName] = part.includes(':') ? part.split(':') : ['', part];
    const ns = prefix ? NAMESPACES[prefix] : null;
    
    let found = null;
    for (let i = 0; i < current.childNodes.length; i++) {
      const child = current.childNodes[i];
      if (child.nodeType === 1) { // Element node
        if (ns ? (child.namespaceURI === ns && child.localName === localName) 
               : (child.localName === localName || child.nodeName === localName)) {
          found = child;
          break;
        }
      }
    }
    
    if (!found) return null;
    current = found;
  }
  
  return current;
}

/**
 * Validate XAdES-BES structure
 * @param {Document} doc - Parsed XML document
 * @returns {Object} - { valid: boolean, errors: string[], warnings: string[] }
 */
function validateXAdESBES(doc) {
  const errors = [];
  const warnings = [];

  // Handle both direct ds:Signature and wrapped asic:XAdESSignatures structures
  let signatureRoot = findElement(doc, 'ds:Signature');

  if (!signatureRoot) {
    // Try to find wrapped signature (asic:XAdESSignatures/ds:Signature)
    const wrapper = doc.documentElement;
    if (wrapper && wrapper.localName === 'XAdESSignatures') {
      // Find first ds:Signature child
      for (let i = 0; i < wrapper.childNodes.length; i++) {
        const child = wrapper.childNodes[i];
        if (child.nodeType === 1 && child.localName === 'Signature' &&
            child.namespaceURI === NAMESPACES.ds) {
          signatureRoot = child;
          break;
        }
      }
    }
  }

  if (!signatureRoot) {
    errors.push('Missing required element: ds:Signature');
    return { valid: false, errors, warnings };
  }

  // Check required elements relative to signature root
  const requiredPaths = [
    'ds:SignedInfo',
    'ds:SignatureValue',
    'ds:KeyInfo',
    'ds:Object/xades:QualifyingProperties/xades:SignedProperties/xades:SignedSignatureProperties'
  ];

  for (const path of requiredPaths) {
    if (!findElement(signatureRoot, path)) {
      errors.push(`Missing required element: ds:Signature/${path}`);
    }
  }

  // Check namespace declarations
  const nsAttrs = ['xmlns:ds', 'xmlns:xades', 'xmlns:xzep'];
  const expectedNs = [NAMESPACES.ds, NAMESPACES.xades, NAMESPACES.xzep];

  for (let i = 0; i < nsAttrs.length; i++) {
    const attr = signatureRoot.getAttribute(nsAttrs[i]);
    if (!attr) {
      warnings.push(`Missing namespace declaration: ${nsAttrs[i]}`);
    } else if (attr !== expectedNs[i]) {
      errors.push(`Invalid namespace for ${nsAttrs[i]}: ${attr}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Extract signature element from document (handles both direct and wrapped)
 * @param {Document} doc - Parsed XML document
 * @returns {Element|null} - The ds:Signature element or null
 */
function extractSignatureElement(doc) {
  // Try direct ds:Signature
  let sig = findElement(doc, 'ds:Signature');
  if (sig) return sig;

  // Try wrapped in asic:XAdESSignatures
  const wrapper = doc.documentElement;
  if (wrapper && wrapper.localName === 'XAdESSignatures') {
    for (let i = 0; i < wrapper.childNodes.length; i++) {
      const child = wrapper.childNodes[i];
      if (child.nodeType === 1 && child.localName === 'Signature' &&
          child.namespaceURI === NAMESPACES.ds) {
        return child;
      }
    }
  }

  return null;
}

/**
 * Serialize XML preserving whitespace
 * @param {Document|Element} node - Node to serialize
 * @returns {string} - Serialized XML
 */
function serializeXML(node) {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(node);
}

module.exports = {
  loadXMLWithPreservation,
  findElement,
  validateXAdESBES,
  extractSignatureElement,
  serializeXML,
  NAMESPACES
};

