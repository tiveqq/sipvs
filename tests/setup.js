// Jest setup file for XML Form Processing System tests

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log during tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock XMLHttpRequest for browser-like testing
global.XMLHttpRequest = class XMLHttpRequest {
  constructor() {
    this.readyState = 0;
    this.status = 0;
    this.statusText = '';
    this.responseText = '';
    this.response = '';
    this.onreadystatechange = null;
  }

  open(method, url) {
    this.method = method;
    this.url = url;
    this.readyState = 1;
  }

  send(data) {
    this.data = data;
    this.readyState = 4;
    this.status = 200;
    this.statusText = 'OK';
    
    if (this.onreadystatechange) {
      this.onreadystatechange();
    }
  }

  setRequestHeader(name, value) {
    this.headers = this.headers || {};
    this.headers[name] = value;
  }
};

// Mock fetch for Node.js environment
if (!global.fetch) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve('mock response')
    })
  );
}

// Mock DOM elements for client-side testing
global.document = {
  getElementById: jest.fn(() => ({
    value: '',
    textContent: '',
    innerHTML: '',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    style: {},
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(() => false)
    }
  })),
  createElement: jest.fn(() => ({
    textContent: '',
    innerHTML: '',
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    appendChild: jest.fn(),
    style: {},
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    }
  })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  getElementsByTagName: jest.fn(() => []),
  getElementsByClassName: jest.fn(() => [])
};

global.window = {
  location: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000'
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Test utilities
global.testUtils = {
  // Create mock form data
  createMockFormData: () => ({
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    nationality: 'American',
    maritalStatus: 'Single',
    program: 'Bachelor',
    major: 'Computer Science',
    expectedGraduationYear: 2024,
    street: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    country: 'USA',
    phoneNumber: '+1234567890',
    email: 'john@email.com',
    emergencyContacts: [{
      name: 'Jane Doe',
      relationship: 'Parent',
      phoneNumber: '+1234567891',
      priority: 'Primary'
    }],
    courses: [{
      courseCode: 'CS101',
      courseName: 'Intro to CS',
      credits: 3,
      semester: 'Fall',
      days: 'MWF',
      startTime: '09:00',
      endTime: '10:00'
    }]
  }),

  // Create mock XML content
  createMockXML: () => `<?xml version="1.0" encoding="UTF-8"?>
<sr:studentRegistration xmlns:sr="http://university.edu/student-registration"
                       registrationId="REG-TEST-001"
                       submissionDate="2024-01-01"
                       status="pending">
  <sr:personalInfo>
    <sr:firstName>John</sr:firstName>
    <sr:lastName>Doe</sr:lastName>
    <sr:dateOfBirth>1990-01-01</sr:dateOfBirth>
    <sr:gender>Male</sr:gender>
    <sr:nationality>American</sr:nationality>
    <sr:maritalStatus>Single</sr:maritalStatus>
  </sr:personalInfo>
  <sr:academicInfo>
    <sr:program>Bachelor</sr:program>
    <sr:major>Computer Science</sr:major>
    <sr:expectedGraduationYear>2024</sr:expectedGraduationYear>
    <sr:previousEducation level="High School">
      <sr:institutionName>Test High School</sr:institutionName>
      <sr:degree>High School Diploma</sr:degree>
      <sr:graduationYear>2020</sr:graduationYear>
    </sr:previousEducation>
    <sr:isTransferStudent>false</sr:isTransferStudent>
  </sr:academicInfo>
  <sr:contactInfo>
    <sr:address>
      <sr:street>123 Main St</sr:street>
      <sr:city>Springfield</sr:city>
      <sr:state>IL</sr:state>
      <sr:zipCode>62701</sr:zipCode>
      <sr:country>USA</sr:country>
    </sr:address>
    <sr:phoneNumber>+1234567890</sr:phoneNumber>
    <sr:email>john@email.com</sr:email>
  </sr:contactInfo>
  <sr:emergencyContacts>
    <sr:contact priority="Primary">
      <sr:name>Jane Doe</sr:name>
      <sr:relationship>Parent</sr:relationship>
      <sr:phoneNumber>+1234567891</sr:phoneNumber>
    </sr:contact>
  </sr:emergencyContacts>
  <sr:courses totalCredits="3">
    <sr:course semester="Fall">
      <sr:courseCode>CS101</sr:courseCode>
      <sr:courseName>Intro to CS</sr:courseName>
      <sr:credits>3</sr:credits>
      <sr:schedule>
        <sr:days>MWF</sr:days>
        <sr:startTime>09:00:00</sr:startTime>
        <sr:endTime>10:00:00</sr:endTime>
      </sr:schedule>
    </sr:course>
  </sr:courses>
</sr:studentRegistration>`,

  // Create mock HTML output
  createMockHTML: () => `<!DOCTYPE html>
<html>
<head>
  <title>Student Registration Form</title>
  <style>
    body { font-family: Arial, sans-serif; }
    .form-container { background-color: white; }
  </style>
</head>
<body>
  <div class="form-container">
    <div class="header">
      <h1>UNIVERSITY STUDENT REGISTRATION FORM</h1>
      <p><strong>Registration ID:</strong> REG-TEST-001</p>
    </div>
    <div class="section">
      <div class="section-title">Personal Information</div>
      <div class="field-value">John</div>
      <div class="field-value">Doe</div>
    </div>
  </div>
</body>
</html>`,

  // Validation helpers
  isValidXML: (xmlString) => {
    try {
      const { DOMParser } = require('xmldom');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'text/xml');
      const parseErrors = doc.getElementsByTagName('parsererror');
      return parseErrors.length === 0;
    } catch (error) {
      return false;
    }
  },

  isValidHTML: (htmlString) => {
    try {
      const { DOMParser } = require('xmldom');
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      return doc.getElementsByTagName('html').length > 0;
    } catch (error) {
      return false;
    }
  }
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Reset global mocks
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

// Setup before all tests
beforeAll(() => {
  // Suppress console output during tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

// Cleanup after all tests
afterAll(() => {
  // Restore console
  console.log.mockRestore();
  console.error.mockRestore();
  console.warn.mockRestore();
});
