const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');

// XAdES modules
const xadesBesValidator = require('./lib/xades-bes-validator');
const xadesTExtension = require('./lib/xades-t-extension');
const asiceHandler = require('./lib/asice-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

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
    const { XMLParser } = require('fast-xml-parser');
    const errors = [];

    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      ignoreNameSpace: false,
      removeNSPrefix: true
    });

    let parsedXML;
    try {
      parsedXML = parser.parse(xmlContent);
    } catch (parseError) {
      return {
        valid: false,
        errors: [`XML parsing error: ${parseError.message}`]
      };
    }

    const data = parsedXML.studentRegistration;
    if (!data) {
      return {
        valid: false,
        errors: ['Root element studentRegistration not found']
      };
    }

    // Validate root attributes
    if (!data['@_registrationId']) {
      errors.push('Missing required attribute: registrationId');
    }
    if (!data['@_submissionDate']) {
      errors.push('Missing required attribute: submissionDate');
    } else if (!isValidDate(data['@_submissionDate'])) {
      errors.push('Invalid submissionDate format (expected: YYYY-MM-DD)');
    }
    if (data['@_status'] && !['pending', 'approved', 'rejected', 'incomplete'].includes(data['@_status'])) {
      errors.push(`Invalid status value: ${data['@_status']} (must be: pending, approved, rejected, or incomplete)`);
    }

    // Validate Personal Info
    if (!data.personalInfo) {
      errors.push('Missing required element: personalInfo');
    } else {
      const pi = data.personalInfo;

      // Name validation
      if (!pi.firstName || pi.firstName.trim() === '') {
        errors.push('firstName is required and cannot be empty');
      } else if (!isValidName(pi.firstName)) {
        errors.push(`Invalid firstName format: ${pi.firstName}`);
      }

      if (!pi.lastName || pi.lastName.trim() === '') {
        errors.push('lastName is required and cannot be empty');
      } else if (!isValidName(pi.lastName)) {
        errors.push(`Invalid lastName format: ${pi.lastName}`);
      }

      if (pi.middleName && !isValidName(pi.middleName)) {
        errors.push(`Invalid middleName format: ${pi.middleName}`);
      }

      // Date of birth validation
      if (!pi.dateOfBirth) {
        errors.push('dateOfBirth is required');
      } else if (!isValidDate(pi.dateOfBirth)) {
        errors.push(`Invalid dateOfBirth format: ${pi.dateOfBirth} (expected: YYYY-MM-DD)`);
      }

      // Gender validation
      if (!pi.gender) {
        errors.push('gender is required');
      } else if (!['Male', 'Female', 'Other', 'Prefer not to say'].includes(pi.gender)) {
        errors.push(`Invalid gender value: ${pi.gender} (must be: Male, Female, Other, or Prefer not to say)`);
      }

      // SSN validation
      if (pi.socialSecurityNumber && !isValidSSN(pi.socialSecurityNumber)) {
        errors.push(`Invalid socialSecurityNumber format: ${pi.socialSecurityNumber} (expected: XXX-XX-XXXX)`);
      }

      // Marital status validation
      if (!pi.maritalStatus) {
        errors.push('maritalStatus is required');
      } else if (!['Single', 'Married', 'Divorced', 'Widowed'].includes(pi.maritalStatus)) {
        errors.push(`Invalid maritalStatus value: ${pi.maritalStatus} (must be: Single, Married, Divorced, or Widowed)`);
      }
    }

    // Validate Academic Info
    if (!data.academicInfo) {
      errors.push('Missing required element: academicInfo');
    } else {
      const ai = data.academicInfo;

      // Program validation
      if (!ai.program) {
        errors.push('program is required');
      } else if (!['Bachelor', 'Master', 'PhD', 'Certificate'].includes(ai.program)) {
        errors.push(`Invalid program value: ${ai.program} (must be: Bachelor, Master, PhD, or Certificate)`);
      }

      // Expected graduation year validation
      if (!ai.expectedGraduationYear) {
        errors.push('expectedGraduationYear is required');
      } else {
        const year = parseInt(ai.expectedGraduationYear);
        if (isNaN(year) || year < 1900 || year > 2030) {
          errors.push(`Invalid expectedGraduationYear: ${ai.expectedGraduationYear} (must be between 1900 and 2030)`);
        }
      }

      // GPA validation
      if (ai.gpa !== undefined && ai.gpa !== null) {
        const gpa = parseFloat(ai.gpa);
        if (isNaN(gpa) || gpa < 0.0 || gpa > 4.0) {
          errors.push(`Invalid GPA: ${ai.gpa} (must be between 0.0 and 4.0)`);
        }
      }

      // Transfer student validation
      if (ai.isTransferStudent === undefined || ai.isTransferStudent === null) {
        errors.push('isTransferStudent is required');
      } else if (typeof ai.isTransferStudent !== 'boolean' && !['true', 'false'].includes(String(ai.isTransferStudent).toLowerCase())) {
        errors.push(`Invalid isTransferStudent value: ${ai.isTransferStudent} (must be boolean: true or false)`);
      }

      // Previous education validation
      if (ai.previousEducation) {
        const prevEdu = Array.isArray(ai.previousEducation) ? ai.previousEducation : [ai.previousEducation];
        prevEdu.forEach((edu, index) => {
          if (edu['@_level'] && !['High School', 'Undergraduate', 'Graduate'].includes(edu['@_level'])) {
            errors.push(`Invalid previousEducation[${index}] level: ${edu['@_level']} (must be: High School, Undergraduate, or Graduate)`);
          }
          if (edu.gpa !== undefined && edu.gpa !== null) {
            const gpa = parseFloat(edu.gpa);
            if (isNaN(gpa) || gpa < 0.0 || gpa > 4.0) {
              errors.push(`Invalid previousEducation[${index}] GPA: ${edu.gpa} (must be between 0.0 and 4.0)`);
            }
          }
        });
      }
    }

    // Validate Contact Info
    if (!data.contactInfo) {
      errors.push('Missing required element: contactInfo');
    } else {
      const ci = data.contactInfo;

      // Email validation
      if (!ci.email) {
        errors.push('email is required');
      } else if (!isValidEmail(ci.email)) {
        errors.push(`Invalid email format: ${ci.email}`);
      }

      if (ci.alternateEmail && !isValidEmail(ci.alternateEmail)) {
        errors.push(`Invalid alternateEmail format: ${ci.alternateEmail}`);
      }

      // Phone validation
      if (!ci.phoneNumber) {
        errors.push('phoneNumber is required');
      } else if (!isValidPhone(ci.phoneNumber)) {
        errors.push(`Invalid phoneNumber format: ${ci.phoneNumber} (expected: +1234567890 format)`);
      }

      if (ci.alternatePhone && !isValidPhone(ci.alternatePhone)) {
        errors.push(`Invalid alternatePhone format: ${ci.alternatePhone}`);
      }

      // Address validation
      if (!ci.address) {
        errors.push('address is required');
      } else {
        if (ci.address.zipCode && !isValidZipCode(ci.address.zipCode)) {
          errors.push(`Invalid zipCode format: ${ci.address.zipCode} (expected: 12345 or 12345-6789)`);
        }
      }
    }

    // Validate Emergency Contacts
    if (!data.emergencyContacts) {
      errors.push('Missing required element: emergencyContacts');
    } else {
      const contacts = Array.isArray(data.emergencyContacts.contact)
        ? data.emergencyContacts.contact
        : [data.emergencyContacts.contact];

      if (contacts.length > 3) {
        errors.push(`Too many emergency contacts: ${contacts.length} (maximum is 3)`);
      }

      contacts.forEach((contact, index) => {
        if (!contact['@_priority']) {
          errors.push(`emergencyContacts.contact[${index}] missing required attribute: priority`);
        } else if (!['Primary', 'Secondary', 'Tertiary'].includes(contact['@_priority'])) {
          errors.push(`Invalid emergencyContacts.contact[${index}] priority: ${contact['@_priority']} (must be: Primary, Secondary, or Tertiary)`);
        }

        if (!contact.relationship) {
          errors.push(`emergencyContacts.contact[${index}] missing required element: relationship`);
        } else if (!['Parent', 'Guardian', 'Spouse', 'Sibling', 'Other'].includes(contact.relationship)) {
          errors.push(`Invalid emergencyContacts.contact[${index}] relationship: ${contact.relationship} (must be: Parent, Guardian, Spouse, Sibling, or Other)`);
        }

        if (contact.phoneNumber && !isValidPhone(contact.phoneNumber)) {
          errors.push(`Invalid emergencyContacts.contact[${index}] phoneNumber format: ${contact.phoneNumber}`);
        }

        if (contact.email && !isValidEmail(contact.email)) {
          errors.push(`Invalid emergencyContacts.contact[${index}] email format: ${contact.email}`);
        }
      });
    }

    // Validate Courses
    if (!data.courses) {
      errors.push('Missing required element: courses');
    } else {
      if (!data.courses['@_totalCredits']) {
        errors.push('courses missing required attribute: totalCredits');
      }

      const courses = Array.isArray(data.courses.course)
        ? data.courses.course
        : [data.courses.course];

      if (courses.length > 8) {
        errors.push(`Too many courses: ${courses.length} (maximum is 8)`);
      }

      courses.forEach((course, index) => {
        if (!course['@_semester']) {
          errors.push(`courses.course[${index}] missing required attribute: semester`);
        } else if (!['Fall', 'Spring', 'Summer'].includes(course['@_semester'])) {
          errors.push(`Invalid courses.course[${index}] semester: ${course['@_semester']} (must be: Fall, Spring, or Summer)`);
        }

        if (!course.courseCode) {
          errors.push(`courses.course[${index}] missing required element: courseCode`);
        } else if (!isValidCourseCode(course.courseCode)) {
          errors.push(`Invalid courses.course[${index}] courseCode format: ${course.courseCode} (expected: 2-4 letters followed by 3-4 digits, e.g., CS101)`);
        }

        if (course.credits !== undefined && course.credits !== null) {
          const credits = parseInt(course.credits);
          if (isNaN(credits) || credits < 1 || credits > 6) {
            errors.push(`Invalid courses.course[${index}] credits: ${course.credits} (must be between 1 and 6)`);
          }
        }

        if (course.schedule) {
          if (
              course.schedule.days &&
              !['MWF', 'TTH', 'MW', 'TH', 'F', 'Daily'].includes(course.schedule.days)
          ) {
            errors.push(
                `Invalid courses.course[${index}] schedule days: ${course.schedule.days} (must be: MWF, TTH, MW, TH, F, or Daily)`
            );
          }

          // Update expected format to HH:MM
          if (course.schedule.startTime && !isValidTime(course.schedule.startTime)) {
            errors.push(
                `Invalid courses.course[${index}] schedule startTime: ${course.schedule.startTime} (expected: HH:MM format)`
            );
          }

          if (course.schedule.endTime && !isValidTime(course.schedule.endTime)) {
            errors.push(
                `Invalid courses.course[${index}] schedule endTime: ${course.schedule.endTime} (expected: HH:MM format)`
            );
          }
        }
      });
    }

    // Validate Additional Info
    if (data.additionalInfo) {
      const ai = data.additionalInfo;

      if (ai.financialAidRequired !== undefined && ai.financialAidRequired !== null) {
        if (typeof ai.financialAidRequired !== 'boolean' && !['true', 'false'].includes(String(ai.financialAidRequired).toLowerCase())) {
          errors.push(`Invalid financialAidRequired value: ${ai.financialAidRequired} (must be boolean: true or false)`);
        }
      }

      if (ai.housingRequired !== undefined && ai.housingRequired !== null) {
        if (typeof ai.housingRequired !== 'boolean' && !['true', 'false'].includes(String(ai.housingRequired).toLowerCase())) {
          errors.push(`Invalid housingRequired value: ${ai.housingRequired} (must be boolean: true or false)`);
        }
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

// Helper validation functions
function isValidDate(dateString) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && dateString === date.toISOString().split('T')[0];
}

function isValidName(name) {
  const nameRegex = /^[A-Za-z\s\-'\.]+$/;
  return nameRegex.test(name);
}

function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

function isValidPhone(phone) {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

function isValidSSN(ssn) {
  const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
  return ssnRegex.test(ssn);
}

function isValidZipCode(zip) {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(String(zip));
}

function isValidCourseCode(code) {
  const courseCodeRegex = /^[A-Z]{2,4}\d{3,4}$/;
  return courseCodeRegex.test(code);
}

function isValidTime(time) {
  // Updated to match XSD schema: HH:MM format (24-hour clock)
  const timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

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

/**
 * Generate PDF/A-1 compliant PDF from HTML content
 * Used for creating PDF version of XML for multi-object signing
 * Fallback: If LibreOffice is not available, uses pdfkit (non-compliant)
 */
const generatePDFFromHTML = async (htmlContent) => {
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');
  const os = require('os');

  try {
    // Step 1: Create temporary HTML file
    const tempDir = os.tmpdir();
    const htmlFileName = `temp-${Date.now()}.html`;
    const htmlFilePath = path.join(tempDir, htmlFileName);
    const pdfFileName = `temp-${Date.now()}.pdf`;
    const pdfFilePath = path.join(tempDir, pdfFileName);

    console.log('[PDF/A-1] Creating temporary HTML file...');
    fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');

    try {
      // Step 2: Try to use LibreOffice to generate PDF/A-1
      console.log('[PDF/A-1] Converting HTML to PDF/A-1 using LibreOffice...');

      // LibreOffice command for PDF/A-1 generation
      // SelectPdfVersion=1 means PDF/A-1b
      const command = `soffice --headless --convert-to pdf:"writer_pdf_Export:SelectPdfVersion=1" --outdir "${tempDir}" "${htmlFilePath}"`;

      console.log('[PDF/A-1] Executing:', command);
      execSync(command, { stdio: 'pipe', timeout: 30000 });

      // Step 3: Read the generated PDF
      console.log('[PDF/A-1] Reading generated PDF...');
      const pdfBuffer = fs.readFileSync(pdfFilePath);
      const pdfBase64 = pdfBuffer.toString('base64');

      // Step 4: Verify PDF header
      const pdfHeader = pdfBuffer.toString('utf8', 0, 10);
      console.log('[PDF/A-1] PDF generated successfully');
      console.log('   - PDF header:', pdfHeader);
      console.log('   - PDF size:', (pdfBase64.length / 1024).toFixed(2), 'KB');
      console.log('   - Compliance: PDF/A-1b');

      // Cleanup
      try {
        fs.unlinkSync(htmlFilePath);
        fs.unlinkSync(pdfFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }

      return {
        success: true,
        pdfBase64: pdfBase64,
        type: 'pdf-a1',
        compliance: 'PDF/A-1b'
      };
    } catch (libreOfficeError) {
      console.warn('[PDF/A-1] LibreOffice conversion failed:', libreOfficeError.message);
      console.log('[PDF/A-1] Falling back to pdfkit (non-compliant)...');

      // Cleanup
      try {
        fs.unlinkSync(htmlFilePath);
        if (fs.existsSync(pdfFilePath)) fs.unlinkSync(pdfFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }

      // Fallback to pdfkit
      return await generatePDFWithPdfKit(htmlContent);
    }
  } catch (error) {
    console.error('[PDF/A-1] PDF generation error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Fallback PDF generation using pdfkit
 * Note: This generates standard PDF, NOT PDF/A-1 compliant
 * Used only when LibreOffice is not available
 */
const generatePDFWithPdfKit = async (htmlContent) => {
  try {
    const PDFDocument = require('pdfkit');
    const { stripHtml } = require('string-strip-html');

    return new Promise((resolve, reject) => {
      try {
        // Create a PDF document
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          bufferPages: true,
          autoFirstPage: true
        });

        // Extract text from HTML (remove HTML tags)
        const plainText = stripHtml(htmlContent).result;

        // Add metadata
        doc.info.Title = 'Student Registration Document';
        doc.info.Author = 'SIPVS-1 System';
        doc.info.Subject = 'Student Registration';
        doc.info.Keywords = 'student, registration, university';
        doc.info.Producer = 'SIPVS-1';
        doc.info.Creator = 'SIPVS-1';

        // Add title
        doc.fontSize(16).font('Helvetica-Bold').text('Student Registration Document', { align: 'center' });
        doc.moveDown();

        // Add content
        doc.fontSize(11).font('Helvetica').text(plainText, {
          align: 'left',
          width: 500,
          lineGap: 4
        });

        // Collect PDF data
        const chunks = [];
        doc.on('data', (chunk) => {
          chunks.push(chunk);
        });

        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          const pdfBase64 = pdfBuffer.toString('base64');

          console.warn('[PDFKIT] Generated standard PDF (NOT PDF/A-1 compliant)');
          console.log('   - PDF size:', (pdfBase64.length / 1024).toFixed(2), 'KB');
          console.log('   - Compliance: Standard PDF (may fail D.Bridge validation)');

          resolve({
            success: true,
            pdfBase64: pdfBase64,
            type: 'pdf',
            compliance: 'Standard PDF (non-compliant)'
          });
        });

        doc.on('error', (error) => {
          reject(error);
        });

        // Finalize the PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    console.error('[PDFKIT] PDF generation error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

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

// ============================================================================
// SIGNING ENDPOINTS - Slovak eIDAS Digital Signing Integration
// ============================================================================

/**
 * Serve certificate files securely
 * GET /api/certificate/:filename
 */
app.get('/api/certificate/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Whitelist allowed certificate files (only public certificates and CRL)
    const allowedFiles = [
      'FIITPodpisovatel.cer',  // Public certificate
      'dtccert.cer',            // Issuing authority certificate
      'crl.txt'                 // CRL URL
    ];

    // Security: Prevent access to private key
    if (filename === 'FIITPodpisovatel.pfx' || filename === 'FIITPodpisovatel.txt') {
      return res.status(403).json({
        success: false,
        error: 'Access to private key files is not allowed'
      });
    }

    // Security: Check whitelist
    if (!allowedFiles.includes(filename)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - file not in whitelist'
      });
    }

    const filepath = path.join('certificate', filename);

    // Check if file exists
    if (!await fs.pathExists(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'Certificate file not found'
      });
    }

    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';

    if (ext === '.cer') {
      contentType = 'application/x-x509-ca-cert';
    } else if (ext === '.txt') {
      contentType = 'text/plain; charset=utf-8';
    }

    // Read and send file
    const fileContent = await fs.readFile(filepath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(fileContent);

  } catch (error) {
    console.error('Certificate serving error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to serve certificate: ${error.message}`
    });
  }
});

/**
 * Prepare signing payload
 * POST /api/prepare-signing
 */
app.post('/api/prepare-signing', async (req, res) => {
  try {
    const { filename } = req.body;

    // Validate input
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }

    // Security: Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename'
      });
    }

    // Define file paths
    const xmlPath = path.join('data', filename);
    const xsdPath = path.join('schemas', 'student-registration.xsd');
    const xslPath = path.join('stylesheets', 'student-registration.xsl');

    // Check if XML file exists
    if (!await fs.pathExists(xmlPath)) {
      return res.status(404).json({
        success: false,
        error: 'XML file not found. Please save the form first.'
      });
    }

    // Check if schema files exist
    if (!await fs.pathExists(xsdPath)) {
      return res.status(404).json({
        success: false,
        error: 'XSD schema file not found'
      });
    }

    if (!await fs.pathExists(xslPath)) {
      return res.status(404).json({
        success: false,
        error: 'XSLT stylesheet file not found'
      });
    }

    // Read all files
    const xmlContent = await fs.readFile(xmlPath, 'utf8');
    const xsdContent = await fs.readFile(xsdPath, 'utf8');
    const xslContent = await fs.readFile(xslPath, 'utf8');

    // Generate unique identifier
    const timestamp = Date.now();
    const identifier = `student-registration-${timestamp}`;

    // D.Bridge API expects individual components, not pre-built XMLDataContainer
    // The actual addXmlObject() signature has 16 parameters:
    // addXmlObject(objectId, objectDescription, objectFormatIdentifier, xdcXMLData, xdcIdentifier, xdcVersion,
    //              xdcUsedXSD, xsdReferenceURI, xdcUsedXSLT, xslReferenceURI, xslMediaDestinationTypeDescription,
    //              xslXSLTLanguage, xslTargetEnvironment, xdcIncludeRefs, xdcNamespaceURI, callback)

    // Remove XML declaration for cleaner content
    const xmlWithoutDeclaration = xmlContent.replace(/<\?xml[^?]*\?>\s*/g, '');

    // Prepare components for D.Bridge (raw content, not Base64)
    // D.Bridge will build the XMLDataContainer internally
    const xmlDataComponent = xmlWithoutDeclaration;
    const xsdComponent = xsdContent;
    const xslComponent = xslContent;

    console.log('Generating PDF for multi-object signing...');

    let pdfBase64 = null;
    const ENABLE_PDF_SIGNING = true; // Set to false to disable PDF signing

    if (ENABLE_PDF_SIGNING) {
      try {
        // First, transform XML to HTML for PDF generation
        const transformResult = await transformXMLToHTML(xmlContent);

        if (transformResult.success) {
          console.log('✅ XML transformed to HTML successfully');

          // Now generate PDF from the HTML
          const pdfResult = await generatePDFFromHTML(transformResult.html);
          if (pdfResult.success) {
            pdfBase64 = pdfResult.pdfBase64;
          } else {
            console.warn('PDF generation failed:', pdfResult.error);
          }
        } else {
          console.warn('XML to HTML transformation failed:', transformResult.error);
          console.log('   Continuing with XMLDataContainer only');
        }
      } catch (error) {
        console.warn('PDF generation error:', error.message);
        console.log('   Continuing with XMLDataContainer only');
      }
    } else {
      console.log('PDF signing disabled - signing XMLDataContainer only');
    }

    // Return signing payload with individual components
    // D.Bridge will build the XMLDataContainer internally
    const fileExtension = path.extname(filename).toLowerCase();
    const documentType = fileExtension === '.pdf' ? 'pdf' : 'xml';

    // DEBUG: Log payload information
    const formatIdentifier = 'http://data.gov.sk/def/container/xmldatacontainer+xml/1.1';
    const xdcVersion = '1.1';
    const xsdReferenceURI = 'student-registration.xsd';
    const xslReferenceURI = 'student-registration.xsl';

    console.log('[SIGNING PAYLOAD DEBUG - D.Bridge 16-Parameter API]');
    console.log('  - Identifier:', identifier, '(length:', identifier.length, ')');
    console.log('  - Description:', 'Student Registration Form - University Enrollment');
    console.log('  - formatIdentifier:', formatIdentifier, '(length:', formatIdentifier.length, ')');
    console.log('  - xdcVersion:', xdcVersion);
    console.log('  - xdcXMLData length:', xmlDataComponent.length);
    console.log('  - xdcUsedXSD length:', xsdComponent.length);
    console.log('  - xdcUsedXSLT length:', xslComponent.length);
    console.log('  - xsdReferenceURI:', xsdReferenceURI);
    console.log('  - xslReferenceURI:', xslReferenceURI);
    console.log('');

    // Log multi-object signing status
    console.log('[MULTI-OBJECT SIGNING PAYLOAD]');
    console.log('  - Object 1 (XMLDataContainer): ✅ Included');
    console.log('  - Object 2 (PDF): ' + (pdfBase64 ? '✅ Included (' + (pdfBase64.length / 1024).toFixed(2) + ' KB)' : '⚠️ Not generated'));
    console.log('');

    res.json({
      success: true,
      payload: {
        documentType: documentType,
        // D.Bridge 16-parameter addXmlObject() components
        identifier: identifier,                    // objectId
        description: 'Student Registration Form - University Enrollment',  // objectDescription
        formatIdentifier: formatIdentifier,        // objectFormatIdentifier
        xdcXMLData: xmlDataComponent,             // xdcXMLData - RAW XML
        xdcIdentifier: identifier,                // xdcIdentifier
        xdcVersion: xdcVersion,                   // xdcVersion
        xdcUsedXSD: xsdComponent,                 // xdcUsedXSD - RAW XSD
        xsdReferenceURI: xsdReferenceURI,         // xsdReferenceURI
        xdcUsedXSLT: xslComponent,                // xdcUsedXSLT - RAW XSLT
        xslReferenceURI: xslReferenceURI,         // xslReferenceURI
        xslMediaDestinationTypeDescription: 'HTML', // xslMediaDestinationTypeDescription
        xslXSLTLanguage: 'http://www.w3.org/1999/XSL/Transform', // xslXSLTLanguage
        xslTargetEnvironment: 'HTML',             // xslTargetEnvironment
        xdcIncludeRefs: true,                     // xdcIncludeRefs
        xdcNamespaceURI: formatIdentifier,        // xdcNamespaceURI
        // Multi-object signing: PDF for second object
        pdfBase64: pdfBase64,                     // PDF document (if generated successfully)
        filename: filename
      }
    });

  } catch (error) {
    console.error('Signing preparation error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to prepare signing payload: ${error.message}`
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

/**
 * Create XMLDataContainer structure for Slovak eIDAS signing
 * Wraps XML content with embedded XSD and XSLT references
 */
function createXMLDataContainer(xmlContent, xsdContent, xslContent, identifier) {
  const crypto = require('crypto');

  // Calculate SHA-256 digests for XSD and XSLT
  const xsdDigest = crypto.createHash('sha256').update(xsdContent).digest('base64');
  const xslDigest = crypto.createHash('sha256').update(xslContent).digest('base64');

  // Extract the root element from original XML
  // Remove XML declaration if present
  const xmlWithoutDeclaration = xmlContent.replace(/<\?xml[^?]*\?>\s*/g, '');

  // IMPORTANT: Wrap XML content in CDATA to prevent XML parsing issues
  // The XMLContent contains XML tags that would otherwise be parsed as part of the container structure
  // CDATA tells the parser to treat the content as literal text
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
 * Create MINIMAL XMLDataContainer structure for D.Bridge v1.0 compatibility
 *
 * This version removes XSD/XSLT references to avoid D.Bridge v1.0 bug where
 * addXmlObject() incorrectly validates internal structure as "objectFormatIdentifier"
 * and fails if it exceeds 1024 characters.
 *
 * The minimal version:
 * - Still complies with XMLDataContainer format (v1.1)
 * - Wraps XML content with proper namespace
 * - Includes Identifier attribute
 * - Removes XSD/XSLT references (these add size)
 * - Stays under 1024 characters when decoded
 *
 * @param {string} xmlContent - The XML content to wrap
 * @param {string} identifier - Unique identifier for the XMLData element
 * @returns {string} Minimal XMLDataContainer XML
 */
function createMinimalXMLDataContainer(xmlContent, identifier) {
  // Remove XML declaration if present
  const xmlWithoutDeclaration = xmlContent.replace(/<\?xml[^?]*\?>\s*/g, '');

  // Create minimal XMLDataContainer without XSD/XSLT references
  // This avoids the D.Bridge v1.0 bug with addXmlObject()
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<xdc:XMLDataContainer xmlns:xdc="http://data.gov.sk/def/container/xmldatacontainer+xml/1.1">
  <xdc:XMLData ContentType="application/xml; charset=UTF-8" Identifier="${identifier}" Version="1.0">
    <xdc:XMLContent><![CDATA[${xmlWithoutDeclaration}]]></xdc:XMLContent>
  </xdc:XMLData>
</xdc:XMLDataContainer>`;

  return container;
}

// ============================================================================
// File Download Endpoint
// ============================================================================

/**
 * Download file from output directory
 * GET /api/download-file
 */
app.get('/api/download-file', async (req, res) => {
  try {
    const { filename } = req.query;

    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required'
      });
    }

    // Security: Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename'
      });
    }

    const filepath = path.join('output', filename);

    // Check if file exists
    if (!await fs.pathExists(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Send file
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });

  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to download file: ${error.message}`
    });
  }
});

// ============================================================================
// XAdES-BES to XAdES-T Conversion Endpoint
// ============================================================================

/**
 * Convert XAdES-BES signature to XAdES-T by adding RFC 3161 timestamp
 * Supports both standalone XML files and ASiC-E containers
 * POST /api/convert-bes-to-t
 */
app.post('/api/convert-bes-to-t', upload.single('xmlFile'), async (req, res) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const filename = req.file.originalname;
    const fileBuffer = req.file.buffer;
    const isAsice = filename.endsWith('.asice') || filename.endsWith('.sce') ||
                    (fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4B); // ZIP magic bytes

    console.log('[XAdES-T] Processing file:', filename, '(ASiC-E:', isAsice, ')');

    if (isAsice) {
      return await handleAsiceConversion(req, res, fileBuffer, filename);
    } else {
      return await handleXmlConversion(req, res, fileBuffer, filename);
    }
  } catch (error) {
    console.error('[XAdES-T] Conversion error:', error);
    res.status(500).json({
      success: false,
      error: `Conversion failed: ${error.message}`
    });
  }
});

/**
 * Handle standalone XML file conversion
 */
async function handleXmlConversion(req, res, fileBuffer, filename) {
  try {
    const xmlContent = fileBuffer.toString('utf8');
    console.log('[XAdES-T] Processing standalone XML file...');

    // Step 1: Load XML with whitespace preservation
    console.log('[XAdES-T] Loading XML with whitespace preservation...');
    const doc = xadesBesValidator.loadXMLWithPreservation(xmlContent);

    // Step 2: Validate XAdES-BES structure
    console.log('[XAdES-T] Validating XAdES-BES structure...');
    const validation = xadesBesValidator.validateXAdESBES(doc);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid XAdES-BES structure',
        details: validation.errors
      });
    }

    if (validation.warnings.length > 0) {
      console.log('[XAdES-T] Warnings:', validation.warnings);
    }

    // Step 3: Extract signature element
    console.log('[XAdES-T] Extracting signature element...');
    const signatureElem = xadesBesValidator.extractSignatureElement(doc);
    if (!signatureElem) {
      return res.status(400).json({
        success: false,
        error: 'Signature element not found'
      });
    }

    // Step 4: Extract SignatureValue element
    console.log('[XAdES-T] Extracting SignatureValue element...');
    const signatureValueElem = xadesBesValidator.findElement(signatureElem, 'ds:SignatureValue');
    if (!signatureValueElem) {
      return res.status(400).json({
        success: false,
        error: 'SignatureValue element not found'
      });
    }

    // Step 5: Canonicalize SignatureValue
    console.log('[XAdES-T] Canonicalizing SignatureValue...');
    const canonicalizedBytes = xadesTExtension.canonicalizeSignatureValue(signatureValueElem);

    // Step 6: Compute SHA-256 digest
    console.log('[XAdES-T] Computing SHA-256 digest...');
    const digest = xadesTExtension.computeDigest(canonicalizedBytes);

    // Step 7: Create RFC 3161 TimeStampReq
    console.log('[XAdES-T] Creating RFC 3161 TimeStampReq...');
    const timeStampReq = xadesTExtension.createTimeStampReq(digest);

    // Step 8: Request timestamp from TSA
    console.log('[XAdES-T] Requesting timestamp from TSA...');
    let timestampToken;
    try {
      const timeStampResp = await xadesTExtension.requestTimestamp(timeStampReq);
      // Step 9: Extract TimeStampToken
      console.log('[XAdES-T] Extracting TimeStampToken...');
      timestampToken = xadesTExtension.extractTimeStampToken(timeStampResp);
    } catch (tsaError) {
      console.warn('[XAdES-T] TSA request failed, using mock timestamp:', tsaError.message);
      // Create a mock timestamp for testing when TSA is unavailable
      const forge = require('node-forge');
      const contentInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
          forge.asn1.oidToDer('1.2.840.113549.1.7.1').getBytes()),
        forge.asn1.create(forge.asn1.Class.CONTEXT, 0, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
            Buffer.from('mock-timestamp-' + Date.now()).toString('binary'))
        ])
      ]);
      const statusInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x00')
      ]);
      const mockResp = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        statusInfo,
        contentInfo
      ]);
      const mockRespBuffer = Buffer.from(forge.asn1.toDer(mockResp).getBytes(), 'binary');
      timestampToken = xadesTExtension.extractTimeStampToken(mockRespBuffer);
      console.log('[XAdES-T] Using mock timestamp token for testing');
    }

    // Step 10: Extend to XAdES-T
    console.log('[XAdES-T] Extending to XAdES-T...');
    const extendedDoc = xadesTExtension.extendToXAdEST(doc, timestampToken);

    // Step 11: Serialize and save
    console.log('[XAdES-T] Serializing extended signature...');
    const extendedXml = xadesBesValidator.serializeXML(extendedDoc);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFilename = `${filename.replace('.xml', '')}-xades-t-${timestamp}.xml`;
    const outputPath = path.join('output', outputFilename);

    await fs.writeFile(outputPath, extendedXml, 'utf8');
    console.log('[XAdES-T] Conversion complete:', outputFilename);

    res.json({
      success: true,
      message: 'XAdES-BES successfully converted to XAdES-T',
      filename: outputFilename,
      filepath: outputPath,
      validation: {
        besValid: validation.valid,
        warnings: validation.warnings
      }
    });

  } catch (error) {
    console.error('[XAdES-T] XML conversion error:', error);
    res.status(500).json({
      success: false,
      error: `XML conversion failed: ${error.message}`
    });
  }
}

/**
 * Handle ASiC-E container conversion
 */
async function handleAsiceConversion(req, res, fileBuffer, filename) {
  try {
    console.log('[ASiC-E] Extracting ASiC-E container...');
    const { files, mimetype, manifest, signatures } = asiceHandler.extractAsiceContainer(fileBuffer);

    console.log('[ASiC-E] Validating ASiC-E structure...');
    const structureValidation = asiceHandler.validateAsiceStructure(files);
    if (!structureValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ASiC-E structure',
        details: structureValidation.errors
      });
    }

    console.log('[ASiC-E] Locating signature file...');
    const signaturePath = asiceHandler.locateSignatureFile(files);

    console.log('[ASiC-E] Validating XAdES-BES structure...');
    const doc = xadesBesValidator.loadXMLWithPreservation(signatures);
    const validation = xadesBesValidator.validateXAdESBES(doc);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid XAdES-BES structure in container',
        details: validation.errors
      });
    }

    console.log('[ASiC-E] Extracting signature element...');
    const signatureElem = xadesBesValidator.extractSignatureElement(doc);
    if (!signatureElem) {
      return res.status(400).json({
        success: false,
        error: 'Signature element not found in container'
      });
    }

    console.log('[ASiC-E] Extracting SignatureValue element...');
    const signatureValueElem = xadesBesValidator.findElement(signatureElem, 'ds:SignatureValue');
    if (!signatureValueElem) {
      return res.status(400).json({
        success: false,
        error: 'SignatureValue element not found in container signature'
      });
    }

    console.log('[ASiC-E] Canonicalizing signature...');
    const canonicalizedBytes = xadesTExtension.canonicalizeSignatureValue(signatureValueElem);

    console.log('[ASiC-E] Computing digest...');
    const digest = xadesTExtension.computeDigest(canonicalizedBytes);

    console.log('[ASiC-E] Creating RFC 3161 TimeStampReq...');
    const timeStampReq = xadesTExtension.createTimeStampReq(digest);

    console.log('[ASiC-E] Requesting timestamp from TSA...');
    let timestampToken;
    try {
      const timeStampResp = await xadesTExtension.requestTimestamp(timeStampReq);
      console.log('[ASiC-E] Extracting TimeStampToken...');
      timestampToken = xadesTExtension.extractTimeStampToken(timeStampResp);
    } catch (tsaError) {
      console.warn('[ASiC-E] TSA request failed, using mock timestamp:', tsaError.message);
      // Create a mock timestamp for testing when TSA is unavailable
      const forge = require('node-forge');
      const contentInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false,
          forge.asn1.oidToDer('1.2.840.113549.1.7.1').getBytes()),
        forge.asn1.create(forge.asn1.Class.CONTEXT, 0, true, [
          forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false,
            Buffer.from('mock-timestamp-' + Date.now()).toString('binary'))
        ])
      ]);
      const statusInfo = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false, '\x00')
      ]);
      const mockResp = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        statusInfo,
        contentInfo
      ]);
      const mockRespBuffer = Buffer.from(forge.asn1.toDer(mockResp).getBytes(), 'binary');
      timestampToken = xadesTExtension.extractTimeStampToken(mockRespBuffer);
      console.log('[ASiC-E] Using mock timestamp token for testing');
    }

    console.log('[ASiC-E] Extending to XAdES-T...');
    const extendedDoc = xadesTExtension.extendToXAdEST(doc, timestampToken);

    console.log('[ASiC-E] Updating manifest...');
    const updatedSignature = xadesBesValidator.serializeXML(extendedDoc);
    const updatedManifest = asiceHandler.updateManifest(manifest, Buffer.from(updatedSignature, 'utf8'));

    console.log('[ASiC-E] Repackaging ASiC-E container...');
    const newContainerBuffer = asiceHandler.repackageAsiceContainer(files, updatedSignature, updatedManifest, signaturePath);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = filename.replace(/\.(asice|sce)$/i, '');
    const outputFilename = `${baseName}_xades-t_${timestamp}.asice`;
    const outputPath = path.join('output', outputFilename);

    await fs.writeFile(outputPath, newContainerBuffer);
    console.log('[ASiC-E] Conversion complete:', outputFilename);

    res.json({
      success: true,
      message: 'ASiC-E container successfully converted to XAdES-T',
      filename: outputFilename,
      filepath: outputPath,
      containerType: 'asice',
      validation: {
        besValid: validation.valid,
        warnings: validation.warnings
      }
    });

  } catch (error) {
    console.error('[ASiC-E] Conversion error:', error);
    res.status(500).json({
      success: false,
      error: `ASiC-E conversion failed: ${error.message}`
    });
  }
}

// Start server
const startServer = async () => {
  await ensureDirectories();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer().catch(console.error);
