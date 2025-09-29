const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Ensure directories exist
const ensureDirectories = async () => {
  await fs.ensureDir('data');
  await fs.ensureDir('output');
  await fs.ensureDir('public');
  await fs.ensureDir('schemas');
  await fs.ensureDir('stylesheets');
};

// XML Validation function
const validateXMLAgainstXSD = async (xmlContent, xsdPath) => {
  try {
    // Simple string-based validation to avoid XML parsing issues
    const errors = [];

    // Check if XML contains the required root element
    if (!xmlContent.includes('<sr:studentRegistration')) {
      errors.push('Root element sr:studentRegistration not found');
    }

    // Check for required attributes
    if (!xmlContent.includes('registrationId=')) {
      errors.push('Missing required attribute: registrationId');
    }
    if (!xmlContent.includes('submissionDate=')) {
      errors.push('Missing required attribute: submissionDate');
    }

    // Check for required child elements
    const requiredElements = ['sr:personalInfo', 'sr:academicInfo', 'sr:contactInfo', 'sr:emergencyContacts', 'sr:courses'];
    for (const element of requiredElements) {
      if (!xmlContent.includes(`<${element}`)) {
        errors.push(`Missing required element: ${element}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Validation error: ${error.message}`]
    };
  }
};

// Manual HTML transformation function using fast-xml-parser
const transformXMLToHTML = async (xmlContent) => {
  try {
    const { XMLParser } = require('fast-xml-parser');

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      ignoreNameSpace: false,
      removeNSPrefix: true
    });

    const jsonObj = parser.parse(xmlContent);
    const studentData = jsonObj.studentRegistration;

    if (!studentData) {
      throw new Error('Invalid XML structure - studentRegistration element not found');
    }

    // Build HTML manually
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Student Registration Form</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .form-container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .section {
            margin-bottom: 25px;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
        }
        .section-title {
            background-color: #34495e;
            color: white;
            padding: 10px;
            margin: -15px -15px 15px -15px;
            border-radius: 5px 5px 0 0;
            font-weight: bold;
            font-size: 16px;
        }
        .field-group {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 10px;
        }
        .field {
            flex: 1;
            min-width: 200px;
        }
        .field-label {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        .field-value {
            padding: 8px;
            border: 1px solid #bdc3c7;
            border-radius: 3px;
            background-color: #ecf0f1;
            min-height: 20px;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .table th, .table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        .table th {
            background-color: #34495e;
            color: white;
        }
        .table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .status-badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-pending {
            background-color: #f39c12;
            color: white;
        }
        .status-approved {
            background-color: #27ae60;
            color: white;
        }
        .status-rejected {
            background-color: #e74c3c;
            color: white;
        }
        .boolean-yes {
            color: #27ae60;
            font-weight: bold;
        }
        .boolean-no {
            color: #e74c3c;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="form-container">
        <div class="header">
            <h1>UNIVERSITY STUDENT REGISTRATION FORM</h1>
            <p><strong>Registration ID:</strong> ${studentData['@_registrationId'] || 'N/A'}</p>
            <p><strong>Submission Date:</strong> ${studentData['@_submissionDate'] || 'N/A'}</p>
            <p><strong>Status:</strong>
                <span class="status-badge status-${studentData['@_status'] || 'pending'}">
                    ${(studentData['@_status'] || 'pending').toUpperCase()}
                </span>
            </p>
        </div>

        <!-- Personal Information Section -->
        <div class="section">
            <div class="section-title">Personal Information</div>
            <div class="field-group">
                <div class="field">
                    <div class="field-label">First Name</div>
                    <div class="field-value">${studentData.personalInfo?.firstName || 'N/A'}</div>
                </div>
                <div class="field">
                    <div class="field-label">Last Name</div>
                    <div class="field-value">${studentData.personalInfo?.lastName || 'N/A'}</div>
                </div>
                ${studentData.personalInfo?.middleName ? `
                <div class="field">
                    <div class="field-label">Middle Name</div>
                    <div class="field-value">${studentData.personalInfo.middleName}</div>
                </div>` : ''}
            </div>
            <div class="field-group">
                <div class="field">
                    <div class="field-label">Date of Birth</div>
                    <div class="field-value">${studentData.personalInfo?.dateOfBirth || 'N/A'}</div>
                </div>
                <div class="field">
                    <div class="field-label">Gender</div>
                    <div class="field-value">${studentData.personalInfo?.gender || 'N/A'}</div>
                </div>
                <div class="field">
                    <div class="field-label">Nationality</div>
                    <div class="field-value">${studentData.personalInfo?.nationality || 'N/A'}</div>
                </div>
            </div>
            <div class="field-group">
                ${studentData.personalInfo?.socialSecurityNumber ? `
                <div class="field">
                    <div class="field-label">Social Security Number</div>
                    <div class="field-value">${studentData.personalInfo.socialSecurityNumber}</div>
                </div>` : ''}
                <div class="field">
                    <div class="field-label">Marital Status</div>
                    <div class="field-value">${studentData.personalInfo?.maritalStatus || 'N/A'}</div>
                </div>
            </div>
        </div>

        <!-- Contact Information Section -->
        <div class="section">
            <div class="section-title">Contact Information</div>
            <div class="field-group">
                <div class="field">
                    <div class="field-label">Address</div>
                    <div class="field-value">
                        ${studentData.contactInfo?.address?.street || 'N/A'}<br/>
                        ${studentData.contactInfo?.address?.city || 'N/A'},
                        ${studentData.contactInfo?.address?.state || 'N/A'}
                        ${studentData.contactInfo?.address?.zipCode || 'N/A'}<br/>
                        ${studentData.contactInfo?.address?.country || 'N/A'}
                    </div>
                </div>
            </div>
            <div class="field-group">
                <div class="field">
                    <div class="field-label">Phone Number</div>
                    <div class="field-value">${studentData.contactInfo?.phoneNumber || 'N/A'}</div>
                </div>
                ${studentData.contactInfo?.alternatePhone ? `
                <div class="field">
                    <div class="field-label">Alternate Phone</div>
                    <div class="field-value">${studentData.contactInfo.alternatePhone}</div>
                </div>` : ''}
            </div>
            <div class="field-group">
                <div class="field">
                    <div class="field-label">Email</div>
                    <div class="field-value">${studentData.contactInfo?.email || 'N/A'}</div>
                </div>
                ${studentData.contactInfo?.alternateEmail ? `
                <div class="field">
                    <div class="field-label">Alternate Email</div>
                    <div class="field-value">${studentData.contactInfo.alternateEmail}</div>
                </div>` : ''}
            </div>
        </div>

        <!-- Academic Information Section -->
        <div class="section">
            <div class="section-title">Academic Information</div>
            <div class="field-group">
                <div class="field">
                    <div class="field-label">Program</div>
                    <div class="field-value">${studentData.academicInfo?.program || 'N/A'}</div>
                </div>
                <div class="field">
                    <div class="field-label">Major</div>
                    <div class="field-value">${studentData.academicInfo?.major || 'N/A'}</div>
                </div>
                ${studentData.academicInfo?.minor ? `
                <div class="field">
                    <div class="field-label">Minor</div>
                    <div class="field-value">${studentData.academicInfo.minor}</div>
                </div>` : ''}
            </div>
            <div class="field-group">
                <div class="field">
                    <div class="field-label">Expected Graduation Year</div>
                    <div class="field-value">${studentData.academicInfo?.expectedGraduationYear || 'N/A'}</div>
                </div>
                ${studentData.academicInfo?.gpa ? `
                <div class="field">
                    <div class="field-label">Current GPA</div>
                    <div class="field-value">${studentData.academicInfo.gpa}</div>
                </div>` : ''}
                <div class="field">
                    <div class="field-label">Transfer Student</div>
                    <div class="field-value">
                        <span class="boolean-${studentData.academicInfo?.isTransferStudent ? 'yes' : 'no'}">
                            ${studentData.academicInfo?.isTransferStudent ? 'Yes' : 'No'}
                        </span>
                    </div>
                </div>
            </div>

            ${studentData.academicInfo?.previousEducation ? `
            <h4>Previous Education</h4>
            <table class="table">
                <thead>
                    <tr>
                        <th>Level</th>
                        <th>Institution</th>
                        <th>Degree</th>
                        <th>Graduation Year</th>
                        <th>GPA</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${studentData.academicInfo.previousEducation['@_level'] || 'N/A'}</td>
                        <td>${studentData.academicInfo.previousEducation.institutionName || 'N/A'}</td>
                        <td>${studentData.academicInfo.previousEducation.degree || 'N/A'}</td>
                        <td>${studentData.academicInfo.previousEducation.graduationYear || 'N/A'}</td>
                        <td>${studentData.academicInfo.previousEducation.gpa || 'N/A'}</td>
                    </tr>
                </tbody>
            </table>` : ''}
        </div>

        <!-- Emergency Contacts Section -->
        <div class="section">
            <div class="section-title">Emergency Contacts</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Priority</th>
                        <th>Name</th>
                        <th>Relationship</th>
                        <th>Phone</th>
                        <th>Email</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.isArray(studentData.emergencyContacts?.contact)
                        ? studentData.emergencyContacts.contact.map(contact => `
                    <tr>
                        <td>${contact['@_priority'] || 'N/A'}</td>
                        <td>${contact.name || 'N/A'}</td>
                        <td>${contact.relationship || 'N/A'}</td>
                        <td>+${contact.phoneNumber || 'N/A'}</td>
                        <td>${contact.email || 'N/A'}</td>
                    </tr>`).join('')
                        : `<tr><td colspan="5">No emergency contacts</td></tr>`}
                </tbody>
            </table>
        </div>

        <!-- Courses Section -->
        <div class="section">
            <div class="section-title">Course Registration (Total Credits: ${studentData.courses?.['@_totalCredits'] || '0'})</div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Course Code</th>
                        <th>Course Name</th>
                        <th>Credits</th>
                        <th>Semester</th>
                        <th>Instructor</th>
                        <th>Schedule</th>
                        <th>Room</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.isArray(studentData.courses?.course)
                        ? studentData.courses.course.map(course => `
                    <tr>
                        <td>${course.courseCode || 'N/A'}</td>
                        <td>${course.courseName || 'N/A'}</td>
                        <td>${course.credits || 'N/A'}</td>
                        <td>${course['@_semester'] || 'N/A'}</td>
                        <td>${course.instructor || 'N/A'}</td>
                        <td>
                            ${course.schedule?.days || 'N/A'}
                            ${course.schedule?.startTime || 'N/A'} -
                            ${course.schedule?.endTime || 'N/A'}
                        </td>
                        <td>${course.schedule?.room || 'N/A'}</td>
                    </tr>`).join('')
                        : `<tr><td colspan="7">No courses registered</td></tr>`}
                </tbody>
            </table>
        </div>

        ${studentData.additionalInfo ? `
        <!-- Additional Information Section -->
        <div class="section">
            <div class="section-title">Additional Information</div>
            <div class="field-group">
                ${studentData.additionalInfo.specialNeeds ? `
                <div class="field">
                    <div class="field-label">Special Needs</div>
                    <div class="field-value">${studentData.additionalInfo.specialNeeds}</div>
                </div>` : ''}
                ${studentData.additionalInfo.medicalConditions ? `
                <div class="field">
                    <div class="field-label">Medical Conditions</div>
                    <div class="field-value">${studentData.additionalInfo.medicalConditions}</div>
                </div>` : ''}
            </div>
            <div class="field-group">
                ${studentData.additionalInfo.extracurricularActivities ? `
                <div class="field">
                    <div class="field-label">Extracurricular Activities</div>
                    <div class="field-value">${studentData.additionalInfo.extracurricularActivities}</div>
                </div>` : ''}
                ${studentData.additionalInfo.workExperience ? `
                <div class="field">
                    <div class="field-label">Work Experience</div>
                    <div class="field-value">${studentData.additionalInfo.workExperience}</div>
                </div>` : ''}
            </div>
            <div class="field-group">
                <div class="field">
                    <div class="field-label">Financial Aid Required</div>
                    <div class="field-value">
                        <span class="boolean-${studentData.additionalInfo.financialAidRequired ? 'yes' : 'no'}">
                            ${studentData.additionalInfo.financialAidRequired ? 'Yes' : 'No'}
                        </span>
                    </div>
                </div>
                <div class="field">
                    <div class="field-label">Housing Required</div>
                    <div class="field-value">
                        <span class="boolean-${studentData.additionalInfo.housingRequired ? 'yes' : 'no'}">
                            ${studentData.additionalInfo.housingRequired ? 'Yes' : 'No'}
                        </span>
                    </div>
                </div>
            </div>
        </div>` : ''}
    </div>
</body>
</html>`;

    return {
      success: true,
      html: html,
      studentData: studentData // For debugging
    };
  } catch (error) {
    console.error('XML to HTML transformation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Routes

// Serve the main form page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Save XML data
app.post('/api/save-xml', async (req, res) => {
  try {
    const { formData } = req.body;
    
    // Convert form data to XML
    const xmlData = buildXMLFromFormData(formData);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `student-registration-${timestamp}.xml`;
    const filepath = path.join('data', filename);
    
    // Save XML file
    await fs.writeFile(filepath, xmlData, 'utf8');
    
    res.json({
      success: true,
      message: 'XML saved successfully',
      filename: filename,
      filepath: filepath
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Failed to save XML: ${error.message}`
    });
  }
});

// Validate XML against XSD
app.post('/api/validate-xml', async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }

    const xmlPath = path.join('data', filename);
    const xsdPath = path.join('schemas', 'student-registration.xsd');

    // Check if files exist
    if (!await fs.pathExists(xmlPath)) {
      return res.status(404).json({
        success: false,
        error: 'XML file not found'
      });
    }

    if (!await fs.pathExists(xsdPath)) {
      return res.status(404).json({
        success: false,
        error: 'XSD schema file not found'
      });
    }

    // Read XML content
    const xmlContent = await fs.readFile(xmlPath, 'utf8');

    // Validate XML
    const validationResult = await validateXMLAgainstXSD(xmlContent, xsdPath);

    res.json({
      success: true,
      validation: validationResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Validation failed: ${error.message}`
    });
  }
});

// Transform XML to HTML
app.post('/api/transform-xml', async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }
    
    const xmlPath = path.join('data', filename);
    const xslPath = path.join('stylesheets', 'student-registration.xsl');
    
    // Check if files exist
    if (!await fs.pathExists(xmlPath)) {
      return res.status(404).json({
        success: false,
        error: 'XML file not found'
      });
    }
    
    if (!await fs.pathExists(xslPath)) {
      return res.status(404).json({
        success: false,
        error: 'XSL stylesheet not found'
      });
    }
    
    // Read XML content
    const xmlContent = await fs.readFile(xmlPath, 'utf8');
    
    // Transform XML to HTML
    const transformResult = await transformXMLToHTML(xmlContent);
    
    if (transformResult.success) {
      // Save HTML output
      const htmlFilename = filename.replace('.xml', '.html');
      const htmlPath = path.join('output', htmlFilename);
      await fs.writeFile(htmlPath, transformResult.html, 'utf8');
      
      res.json({
        success: true,
        message: 'XML transformed to HTML successfully',
        htmlFilename: htmlFilename,
        htmlPath: htmlPath,
        html: transformResult.html
      });
    } else {
      res.status(500).json({
        success: false,
        error: transformResult.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Transformation failed: ${error.message}`
    });
  }
});

// Get list of saved XML files
app.get('/api/xml-files', async (req, res) => {
  try {
    const files = await fs.readdir('data');
    const xmlFiles = files.filter(file => file.endsWith('.xml'));
    
    res.json({
      success: true,
      files: xmlFiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Failed to list files: ${error.message}`
    });
  }
});

// Helper function to build XML from form data
function buildXMLFromFormData(formData) {
  const timestamp = new Date().toISOString().split('T')[0];
  const registrationId = `REG-${Date.now()}`;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sr:studentRegistration xmlns:sr="http://university.edu/student-registration"
                       registrationId="${registrationId}"
                       submissionDate="${timestamp}"
                       status="pending">
  
  <sr:personalInfo>
    <sr:firstName>${escapeXML(formData.firstName || '')}</sr:firstName>
    <sr:lastName>${escapeXML(formData.lastName || '')}</sr:lastName>`;
  
  if (formData.middleName) {
    xml += `\n    <sr:middleName>${escapeXML(formData.middleName)}</sr:middleName>`;
  }
  
  xml += `
    <sr:dateOfBirth>${formData.dateOfBirth || ''}</sr:dateOfBirth>
    <sr:gender>${formData.gender || ''}</sr:gender>
    <sr:nationality>${escapeXML(formData.nationality || '')}</sr:nationality>`;
  
  if (formData.socialSecurityNumber) {
    xml += `\n    <sr:socialSecurityNumber>${formData.socialSecurityNumber}</sr:socialSecurityNumber>`;
  }
  
  xml += `
    <sr:maritalStatus>${formData.maritalStatus || ''}</sr:maritalStatus>
  </sr:personalInfo>

  <sr:academicInfo>
    <sr:program>${formData.program || ''}</sr:program>
    <sr:major>${escapeXML(formData.major || '')}</sr:major>`;
  
  if (formData.minor) {
    xml += `\n    <sr:minor>${escapeXML(formData.minor)}</sr:minor>`;
  }
  
  xml += `
    <sr:expectedGraduationYear>${formData.expectedGraduationYear || ''}</sr:expectedGraduationYear>`;
  
  // Add previous education if provided
  if (formData.previousEducation && formData.previousEducation.length > 0) {
    formData.previousEducation.forEach(edu => {
      xml += `
    <sr:previousEducation level="${edu.level || ''}">
      <sr:institutionName>${escapeXML(edu.institutionName || '')}</sr:institutionName>
      <sr:degree>${edu.degree || ''}</sr:degree>
      <sr:graduationYear>${edu.graduationYear || ''}</sr:graduationYear>`;
      if (edu.gpa) {
        xml += `\n      <sr:gpa>${edu.gpa}</sr:gpa>`;
      }
      xml += `\n    </sr:previousEducation>`;
    });
  }
  
  if (formData.gpa) {
    xml += `\n    <sr:gpa>${formData.gpa}</sr:gpa>`;
  }
  
  xml += `
    <sr:isTransferStudent>${formData.isTransferStudent === 'true' ? 'true' : 'false'}</sr:isTransferStudent>`;
  
  if (formData.transferCredits) {
    xml += `\n    <sr:transferCredits>${formData.transferCredits}</sr:transferCredits>`;
  }
  
  xml += `
  </sr:academicInfo>

  <sr:contactInfo>
    <sr:address>
      <sr:street>${escapeXML(formData.street || '')}</sr:street>
      <sr:city>${escapeXML(formData.city || '')}</sr:city>
      <sr:state>${escapeXML(formData.state || '')}</sr:state>
      <sr:zipCode>${formData.zipCode || ''}</sr:zipCode>
      <sr:country>${escapeXML(formData.country || '')}</sr:country>
    </sr:address>
    <sr:phoneNumber>${formData.phoneNumber || ''}</sr:phoneNumber>`;
  
  if (formData.alternatePhone) {
    xml += `\n    <sr:alternatePhone>${formData.alternatePhone}</sr:alternatePhone>`;
  }
  
  xml += `
    <sr:email>${formData.email || ''}</sr:email>`;
  
  if (formData.alternateEmail) {
    xml += `\n    <sr:alternateEmail>${formData.alternateEmail}</sr:alternateEmail>`;
  }
  
  xml += `
  </sr:contactInfo>

  <sr:emergencyContacts>`;
  
  // Add emergency contacts
  if (formData.emergencyContacts && formData.emergencyContacts.length > 0) {
    formData.emergencyContacts.forEach(contact => {
      xml += `
    <sr:contact priority="${contact.priority || 'Primary'}">
      <sr:name>${escapeXML(contact.name || '')}</sr:name>
      <sr:relationship>${contact.relationship || ''}</sr:relationship>
      <sr:phoneNumber>${contact.phoneNumber || ''}</sr:phoneNumber>`;
      if (contact.email) {
        xml += `\n      <sr:email>${contact.email}</sr:email>`;
      }
      xml += `\n    </sr:contact>`;
    });
  }
  
  xml += `
  </sr:emergencyContacts>

  <sr:courses totalCredits="${formData.totalCredits || '0'}">`;
  
  // Add courses
  if (formData.courses && formData.courses.length > 0) {
    formData.courses.forEach(course => {
      xml += `
    <sr:course semester="${course.semester || 'Fall'}">
      <sr:courseCode>${course.courseCode || ''}</sr:courseCode>
      <sr:courseName>${escapeXML(course.courseName || '')}</sr:courseName>
      <sr:credits>${course.credits || '3'}</sr:credits>`;
      if (course.instructor) {
        xml += `\n      <sr:instructor>${escapeXML(course.instructor)}</sr:instructor>`;
      }
      xml += `
      <sr:schedule>
        <sr:days>${course.days || 'MWF'}</sr:days>
        <sr:startTime>${course.startTime || '09:00:00'}</sr:startTime>
        <sr:endTime>${course.endTime || '10:00:00'}</sr:endTime>`;
      if (course.room) {
        xml += `\n        <sr:room>${escapeXML(course.room)}</sr:room>`;
      }
      xml += `
      </sr:schedule>
    </sr:course>`;
    });
  }
  
  xml += `
  </sr:courses>`;
  
  // Add additional info if provided
  if (formData.additionalInfo) {
    xml += `

  <sr:additionalInfo>`;
    if (formData.additionalInfo.specialNeeds) {
      xml += `\n    <sr:specialNeeds>${escapeXML(formData.additionalInfo.specialNeeds)}</sr:specialNeeds>`;
    }
    if (formData.additionalInfo.medicalConditions) {
      xml += `\n    <sr:medicalConditions>${escapeXML(formData.additionalInfo.medicalConditions)}</sr:medicalConditions>`;
    }
    if (formData.additionalInfo.extracurricularActivities) {
      xml += `\n    <sr:extracurricularActivities>${escapeXML(formData.additionalInfo.extracurricularActivities)}</sr:extracurricularActivities>`;
    }
    if (formData.additionalInfo.workExperience) {
      xml += `\n    <sr:workExperience>${escapeXML(formData.additionalInfo.workExperience)}</sr:workExperience>`;
    }
    xml += `
    <sr:financialAidRequired>${formData.additionalInfo.financialAidRequired === 'true' ? 'true' : 'false'}</sr:financialAidRequired>
    <sr:housingRequired>${formData.additionalInfo.housingRequired === 'true' ? 'true' : 'false'}</sr:housingRequired>
  </sr:additionalInfo>`;
  }
  
  xml += `

</sr:studentRegistration>`;
  
  return xml;
}

// Helper function to escape XML special characters
function escapeXML(str) {
  if (!str) return '';
  return str.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

// Start server
const startServer = async () => {
  await ensureDirectories();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer().catch(console.error);
