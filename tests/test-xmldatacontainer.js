/**
 * Test script to verify XMLDataContainer structure
 * Run with: node test-xmldatacontainer.js
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

/**
 * Create XMLDataContainer structure (same as server.js)
 */
function createXMLDataContainer(xmlContent, xsdContent, xslContent, identifier) {
  // Calculate SHA-256 digests for XSD and XSLT
  const xsdDigest = crypto.createHash('sha256').update(xsdContent).digest('base64');
  const xslDigest = crypto.createHash('sha256').update(xslContent).digest('base64');

  // Extract the root element from original XML
  // Remove XML declaration if present
  const xmlWithoutDeclaration = xmlContent.replace(/<\?xml[^?]*\?>\s*/g, '');

  // IMPORTANT: Wrap XML content in CDATA to prevent XML parsing issues
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<xdc:XMLDataContainer xmlns:xdc="http://data.gov.sk/def/container/xmldatacontainer+xml/1.1">
  <xdc:XMLData ContentType="application/xml; charset=UTF-8" Identifier="${identifier}" Version="1.0">
    <xdc:XMLContent><![CDATA[${xmlWithoutDeclaration}]]></xdc:XMLContent>
  </xdc:XMLData>
  <xdc:UsedSchemasReferenced>
    <xdc:UsedXSDReference SchemaFileIdentifier="student-registration.xsd">
      <xdc:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <xdc:DigestValue>${xsdDigest}</xdc:DigestValue>
      <xdc:TransformAlgorithm Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    </xdc:UsedXSDReference>
  </xdc:UsedSchemasReferenced>
  <xdc:UsedPresentationSchemasReferenced>
    <xdc:UsedXSLTReference PresentationSchemaFileIdentifier="student-registration.xsl">
      <xdc:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <xdc:DigestValue>${xslDigest}</xdc:DigestValue>
      <xdc:TransformAlgorithm Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    </xdc:UsedXSLTReference>
  </xdc:UsedPresentationSchemasReferenced>
</xdc:XMLDataContainer>`;

  return container;
}

/**
 * Validate XML structure
 */
function validateXML(xmlString) {
  const errors = [];
  
  // Check for CDATA
  if (!xmlString.includes('<![CDATA[')) {
    errors.push('❌ Missing CDATA section');
  } else {
    console.log('✅ CDATA section found');
  }
  
  // Check for proper namespace
  if (!xmlString.includes('xmlns:xdc="http://data.gov.sk/def/container/xmldatacontainer+xml/1.1"')) {
    errors.push('❌ Missing or incorrect namespace');
  } else {
    console.log('✅ Correct namespace');
  }
  
  // Check for XMLContent element
  if (!xmlString.includes('<xdc:XMLContent>')) {
    errors.push('❌ Missing XMLContent element');
  } else {
    console.log('✅ XMLContent element found');
  }
  
  // Check for digest values
  if (!xmlString.includes('<xdc:DigestValue>')) {
    errors.push('❌ Missing digest values');
  } else {
    console.log('✅ Digest values found');
  }
  
  // Try to parse as XML (basic check)
  try {
    // Simple check for balanced tags
    const openTags = (xmlString.match(/<xdc:[^/>]+>/g) || []).length;
    const closeTags = (xmlString.match(/<\/xdc:[^>]+>/g) || []).length;
    
    if (openTags !== closeTags) {
      errors.push(`❌ Unbalanced tags: ${openTags} open, ${closeTags} close`);
    } else {
      console.log(`✅ Balanced tags: ${openTags} open, ${closeTags} close`);
    }
  } catch (e) {
    errors.push(`❌ XML parsing error: ${e.message}`);
  }
  
  return errors;
}

/**
 * Main test function
 */
async function runTest() {
  console.log('='.repeat(70));
  console.log('XMLDataContainer Structure Test');
  console.log('='.repeat(70));
  console.log('');
  
  try {
    // Read test files
    console.log('📁 Reading test files...');
    const xmlPath = path.join('data', 'valid-student-registration.xml');
    const xsdPath = path.join('schemas', 'student-registration.xsd');
    const xslPath = path.join('stylesheets', 'student-registration.xsl');
    
    if (!await fs.pathExists(xmlPath)) {
      console.error('❌ XML file not found:', xmlPath);
      console.log('Please ensure valid-student-registration.xml exists in the data directory');
      return;
    }
    
    const xmlContent = await fs.readFile(xmlPath, 'utf8');
    const xsdContent = await fs.readFile(xsdPath, 'utf8');
    const xslContent = await fs.readFile(xslPath, 'utf8');
    
    console.log('✅ Files loaded successfully');
    console.log('');
    
    // Create XMLDataContainer
    console.log('🔨 Creating XMLDataContainer...');
    const identifier = `test-${Date.now()}`;
    const container = createXMLDataContainer(xmlContent, xsdContent, xslContent, identifier);
    
    console.log('✅ XMLDataContainer created');
    console.log('');
    
    // Display structure
    console.log('📄 XMLDataContainer Structure:');
    console.log('-'.repeat(70));
    console.log(container.substring(0, 800));
    console.log('...');
    console.log('-'.repeat(70));
    console.log('');
    
    // Validate structure
    console.log('🔍 Validating XMLDataContainer structure...');
    console.log('');
    const errors = validateXML(container);
    
    console.log('');
    if (errors.length === 0) {
      console.log('✅ All validation checks passed!');
    } else {
      console.log('❌ Validation errors found:');
      errors.forEach(error => console.log('  ' + error));
    }
    console.log('');
    
    // Test Base64 encoding
    console.log('🔐 Testing Base64 encoding...');
    const base64 = Buffer.from(container, 'utf8').toString('base64');
    console.log(`✅ Base64 encoded (${base64.length} characters)`);
    
    // Test decoding
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    if (decoded === container) {
      console.log('✅ Base64 decode successful (matches original)');
    } else {
      console.log('❌ Base64 decode mismatch!');
    }
    console.log('');
    
    // Summary
    console.log('='.repeat(70));
    console.log('Test Summary');
    console.log('='.repeat(70));
    console.log(`Identifier: ${identifier}`);
    console.log(`Container size: ${container.length} bytes`);
    console.log(`Base64 size: ${base64.length} bytes`);
    console.log(`CDATA present: ${container.includes('<![CDATA[') ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Validation errors: ${errors.length}`);
    console.log('');
    
    if (errors.length === 0) {
      console.log('🎉 XMLDataContainer is correctly formatted and ready for D.Bridge JS!');
    } else {
      console.log('⚠️  XMLDataContainer has issues that need to be fixed.');
    }
    console.log('');
    
    // Save to file for inspection
    const outputPath = path.join('output', 'test-xmldatacontainer.xml');
    await fs.ensureDir('output');
    await fs.writeFile(outputPath, container, 'utf8');
    console.log(`📝 XMLDataContainer saved to: ${outputPath}`);
    console.log('   You can inspect this file to verify the structure.');
    console.log('');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
runTest().catch(console.error);

