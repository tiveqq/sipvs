// Global variables
let currentXmlFilename = null;
let emergencyContactCount = 1;
let courseCount = 1;

// DOM elements
const form = document.getElementById('registrationForm');
const validateXmlBtn = document.getElementById('validateXmlBtn');
const transformXmlBtn = document.getElementById('transformXmlBtn');
const loadSampleBtn = document.getElementById('loadSampleBtn');
const refreshFilesBtn = document.getElementById('refreshFilesBtn');
const xmlFileSelect = document.getElementById('xmlFileSelect');
const resultsSection = document.getElementById('resultsSection');
const resultsContent = document.getElementById('resultsContent');
const fileSelectionSection = document.getElementById('fileSelectionSection');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    setupEventListeners();
    loadXmlFiles();
});

// Initialize form with default values and validation
function initializeForm() {
    // Set default values
    document.getElementById('country').value = 'United States';
    document.getElementById('expectedGraduationYear').value = new Date().getFullYear() + 2;
    
    // Initialize date validation
    const today = new Date();
    const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
    const maxDate = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
    
    const dobInput = document.getElementById('dateOfBirth');
    dobInput.min = minDate.toISOString().split('T')[0];
    dobInput.max = maxDate.toISOString().split('T')[0];
    
    // Initialize credits calculation
    updateTotalCredits();
}

// Setup all event listeners
function setupEventListeners() {
    // Form submission
    form.addEventListener('submit', handleFormSubmit);
    
    // Button clicks
    validateXmlBtn.addEventListener('click', handleValidateXml);
    transformXmlBtn.addEventListener('click', handleTransformXml);
    loadSampleBtn.addEventListener('click', loadSampleData);
    refreshFilesBtn.addEventListener('click', loadXmlFiles);
    
    // File selection
    xmlFileSelect.addEventListener('change', handleFileSelection);
    
    // Dynamic form elements
    document.getElementById('addEmergencyContact').addEventListener('click', addEmergencyContact);
    document.getElementById('addCourse').addEventListener('click', addCourse);
    document.getElementById('isTransferStudent').addEventListener('change', toggleTransferCredits);
    
    // Credits calculation
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('credits-input')) {
            updateTotalCredits();
        }
    });
    
    // Real-time validation
    setupRealTimeValidation();
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        showResult('Please fix the validation errors before submitting.', 'error');
        return;
    }
    
    const formData = collectFormData();
    
    try {
        const response = await fetch('/api/save-xml', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ formData })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentXmlFilename = result.filename;
            showResult(`XML saved successfully as ${result.filename}`, 'success');
            
            // Enable other buttons
            validateXmlBtn.disabled = false;
            transformXmlBtn.disabled = false;
            
            // Show file selection section
            fileSelectionSection.style.display = 'block';
            loadXmlFiles();
        } else {
            showResult(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        showResult(`Network error: ${error.message}`, 'error');
    }
}

// Handle XML validation
async function handleValidateXml() {
    if (!currentXmlFilename && !xmlFileSelect.value) {
        showResult('Please save XML first or select a file to validate.', 'error');
        return;
    }
    
    const filename = xmlFileSelect.value || currentXmlFilename;
    
    try {
        const response = await fetch('/api/validate-xml', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filename })
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (result.validation.valid) {
                showResult('✅ XML is valid according to the XSD schema!', 'success');
            } else {
                let errorHtml = '<div class="validation-errors"><h4>Validation Errors:</h4><ul>';
                result.validation.errors.forEach(error => {
                    errorHtml += `<li>${error}</li>`;
                });
                errorHtml += '</ul></div>';
                showResult(errorHtml, 'error');
            }
        } else {
            showResult(`Validation error: ${result.error}`, 'error');
        }
    } catch (error) {
        showResult(`Network error: ${error.message}`, 'error');
    }
}

// Handle XML to HTML transformation
async function handleTransformXml() {
    if (!currentXmlFilename && !xmlFileSelect.value) {
        showResult('Please save XML first or select a file to transform.', 'error');
        return;
    }
    
    const filename = xmlFileSelect.value || currentXmlFilename;
    
    try {
        const response = await fetch('/api/transform-xml', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filename })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showResult(`✅ XML transformed to HTML successfully! Saved as ${result.htmlFilename}`, 'success');
            
            // Show preview of the HTML
            const previewHtml = `
                <div class="result-info">
                    <h4>HTML Preview:</h4>
                    <iframe srcdoc="${escapeHtml(result.html)}" style="width: 100%; height: 400px; border: 1px solid #ddd; border-radius: 5px;"></iframe>
                </div>
            `;
            showResult(previewHtml, 'info', true);
        } else {
            showResult(`Transformation error: ${result.error}`, 'error');
        }
    } catch (error) {
        showResult(`Network error: ${error.message}`, 'error');
    }
}

// Load XML files list
async function loadXmlFiles() {
    try {
        const response = await fetch('/api/xml-files');
        const result = await response.json();
        
        if (result.success) {
            xmlFileSelect.innerHTML = '<option value="">Choose a file...</option>';
            result.files.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                xmlFileSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading XML files:', error);
    }
}

// Handle file selection
function handleFileSelection() {
    if (xmlFileSelect.value) {
        validateXmlBtn.disabled = false;
        transformXmlBtn.disabled = false;
    } else {
        if (!currentXmlFilename) {
            validateXmlBtn.disabled = true;
            transformXmlBtn.disabled = true;
        }
    }
}

// Collect form data
function collectFormData() {
    const formData = new FormData(form);
    const data = {};
    
    // Basic fields
    for (let [key, value] of formData.entries()) {
        if (key.includes('[') && key.includes(']')) {
            // Handle array fields (emergency contacts, courses, etc.)
            const match = key.match(/(\w+)\[(\d+)\]\[(\w+)\]/);
            if (match) {
                const [, arrayName, index, fieldName] = match;
                if (!data[arrayName]) data[arrayName] = [];
                if (!data[arrayName][index]) data[arrayName][index] = {};
                data[arrayName][index][fieldName] = value;
            } else {
                // Handle nested object fields (additionalInfo)
                const nestedMatch = key.match(/(\w+)\[(\w+)\]/);
                if (nestedMatch) {
                    const [, objectName, fieldName] = nestedMatch;
                    if (!data[objectName]) data[objectName] = {};
                    data[objectName][fieldName] = value;
                }
            }
        } else {
            data[key] = value;
        }
    }
    
    // Calculate total credits
    if (data.courses) {
        data.totalCredits = data.courses.reduce((total, course) => {
            return total + (parseInt(course.credits) || 0);
        }, 0);
    }
    
    // Add previous education if not exists
    if (!data.previousEducation) {
        data.previousEducation = [{
            level: 'High School',
            institutionName: 'Previous School',
            degree: 'High School Diploma',
            graduationYear: new Date().getFullYear() - 1,
            gpa: ''
        }];
    }
    
    return data;
}

// Add emergency contact
function addEmergencyContact() {
    if (emergencyContactCount >= 3) {
        showResult('Maximum 3 emergency contacts allowed.', 'error');
        return;
    }
    
    const container = document.getElementById('emergencyContactsContainer');
    const priorities = ['Primary', 'Secondary', 'Tertiary'];
    const priority = priorities[emergencyContactCount];
    
    const contactHtml = `
        <div class="emergency-contact" data-index="${emergencyContactCount}">
            <h3>${priority} Emergency Contact</h3>
            <div class="field-group">
                <div class="field">
                    <label>Contact Name *</label>
                    <input type="text" name="emergencyContacts[${emergencyContactCount}][name]" required 
                           pattern="[A-Za-z\\s\\-'\\.]{1,50}">
                </div>
                <div class="field">
                    <label>Relationship *</label>
                    <select name="emergencyContacts[${emergencyContactCount}][relationship]" required>
                        <option value="">Select Relationship</option>
                        <option value="Parent">Parent</option>
                        <option value="Guardian">Guardian</option>
                        <option value="Spouse">Spouse</option>
                        <option value="Sibling">Sibling</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="field">
                    <label>Phone Number *</label>
                    <input type="tel" name="emergencyContacts[${emergencyContactCount}][phoneNumber]" required 
                           pattern="\\+?[1-9]\\d{1,14}">
                </div>
                <div class="field">
                    <label>Email</label>
                    <input type="email" name="emergencyContacts[${emergencyContactCount}][email]">
                </div>
            </div>
            <input type="hidden" name="emergencyContacts[${emergencyContactCount}][priority]" value="${priority}">
            <button type="button" class="btn-danger remove-contact">Remove Contact</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', contactHtml);
    emergencyContactCount++;
    
    // Add remove functionality
    const removeBtn = container.lastElementChild.querySelector('.remove-contact');
    removeBtn.addEventListener('click', function() {
        this.parentElement.remove();
        emergencyContactCount--;
    });
}

// Add course
function addCourse() {
    if (courseCount >= 8) {
        showResult('Maximum 8 courses allowed per semester.', 'error');
        return;
    }
    
    const container = document.getElementById('coursesContainer');
    
    const courseHtml = `
        <div class="course" data-index="${courseCount}">
            <h3>Course ${courseCount + 1}</h3>
            <div class="field-group">
                <div class="field">
                    <label>Course Code *</label>
                    <input type="text" name="courses[${courseCount}][courseCode]" required 
                           pattern="[A-Z]{2,4}\\d{3,4}" placeholder="CS101"
                           title="Format: 2-4 letters followed by 3-4 digits">
                </div>
                <div class="field">
                    <label>Course Name *</label>
                    <input type="text" name="courses[${courseCount}][courseName]" required>
                </div>
                <div class="field">
                    <label>Credits *</label>
                    <input type="number" name="courses[${courseCount}][credits]" required 
                           min="1" max="6" value="3" class="credits-input">
                </div>
                <div class="field">
                    <label>Semester *</label>
                    <select name="courses[${courseCount}][semester]" required>
                        <option value="Fall">Fall</option>
                        <option value="Spring">Spring</option>
                        <option value="Summer">Summer</option>
                    </select>
                </div>
            </div>
            <div class="field-group">
                <div class="field">
                    <label>Instructor</label>
                    <input type="text" name="courses[${courseCount}][instructor]">
                </div>
                <div class="field">
                    <label>Days *</label>
                    <select name="courses[${courseCount}][days]" required>
                        <option value="MWF">Monday, Wednesday, Friday</option>
                        <option value="TTH">Tuesday, Thursday</option>
                        <option value="MW">Monday, Wednesday</option>
                        <option value="TH">Tuesday, Thursday</option>
                        <option value="F">Friday</option>
                        <option value="Daily">Daily</option>
                    </select>
                </div>
                <div class="field">
                    <label>Start Time *</label>
                    <input type="time" name="courses[${courseCount}][startTime]" required value="09:00">
                </div>
                <div class="field">
                    <label>End Time *</label>
                    <input type="time" name="courses[${courseCount}][endTime]" required value="10:00">
                </div>
                <div class="field">
                    <label>Room</label>
                    <input type="text" name="courses[${courseCount}][room]" placeholder="Building-Room">
                </div>
            </div>
            <button type="button" class="btn-danger remove-course">Remove Course</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', courseHtml);
    courseCount++;
    
    // Add remove functionality
    const removeBtn = container.lastElementChild.querySelector('.remove-course');
    removeBtn.addEventListener('click', function() {
        this.parentElement.remove();
        courseCount--;
        updateTotalCredits();
        
        // Show remove buttons if more than one course
        const courses = document.querySelectorAll('.course');
        courses.forEach((course, index) => {
            const removeBtn = course.querySelector('.remove-course');
            removeBtn.style.display = courses.length > 1 ? 'block' : 'none';
        });
    });
    
    // Show remove buttons if more than one course
    const courses = document.querySelectorAll('.course');
    courses.forEach(course => {
        const removeBtn = course.querySelector('.remove-course');
        removeBtn.style.display = courses.length > 1 ? 'block' : 'none';
    });
    
    updateTotalCredits();
}

// Toggle transfer credits field
function toggleTransferCredits() {
    const isTransfer = document.getElementById('isTransferStudent').value === 'true';
    const transferCreditsField = document.getElementById('transferCreditsField');
    transferCreditsField.style.display = isTransfer ? 'block' : 'none';
    
    if (!isTransfer) {
        document.getElementById('transferCredits').value = '';
    }
}

// Update total credits
function updateTotalCredits() {
    const creditsInputs = document.querySelectorAll('.credits-input');
    let total = 0;
    
    creditsInputs.forEach(input => {
        total += parseInt(input.value) || 0;
    });
    
    const display = document.getElementById('totalCreditsDisplay');
    display.textContent = total;
    document.getElementById('totalCredits').value = total;
    
    // Add warning if over 18 credits
    if (total > 18) {
        display.classList.add('credits-warning');
        display.title = 'Warning: Over 18 credits may require advisor approval';
    } else {
        display.classList.remove('credits-warning');
        display.title = '';
    }
}

// Setup real-time validation
function setupRealTimeValidation() {
    // SSN formatting
    const ssnInput = document.getElementById('socialSecurityNumber');
    ssnInput.addEventListener('input', function() {
        let value = this.value.replace(/\D/g, '');
        if (value.length >= 6) {
            value = value.substring(0, 3) + '-' + value.substring(3, 5) + '-' + value.substring(5, 9);
        } else if (value.length >= 3) {
            value = value.substring(0, 3) + '-' + value.substring(3);
        }
        this.value = value;
    });
    
    // Phone number formatting
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function() {
            let value = this.value.replace(/\D/g, '');
            if (!value.startsWith('1') && value.length === 10) {
                value = '1' + value;
            }
            if (value.length > 0 && !value.startsWith('+')) {
                value = '+' + value;
            }
            this.value = value;
        });
    });
}

// Validate form
function validateForm() {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.style.borderColor = '#e74c3c';
            isValid = false;
        } else {
            field.style.borderColor = '#27ae60';
        }
    });
    
    return isValid;
}

// Load sample data
function loadSampleData() {
    // Personal Information
    document.getElementById('firstName').value = 'John';
    document.getElementById('middleName').value = 'Michael';
    document.getElementById('lastName').value = 'Smith';
    document.getElementById('dateOfBirth').value = '2002-05-15';
    document.getElementById('gender').value = 'Male';
    document.getElementById('nationality').value = 'American';
    document.getElementById('socialSecurityNumber').value = '123-45-6789';
    document.getElementById('maritalStatus').value = 'Single';
    
    // Academic Information
    document.getElementById('program').value = 'Bachelor';
    document.getElementById('major').value = 'Computer Science';
    document.getElementById('minor').value = 'Mathematics';
    document.getElementById('expectedGraduationYear').value = '2026';
    document.getElementById('gpa').value = '3.75';
    document.getElementById('isTransferStudent').value = 'false';
    
    // Contact Information
    document.getElementById('street').value = '123 Main Street';
    document.getElementById('city').value = 'Springfield';
    document.getElementById('state').value = 'Illinois';
    document.getElementById('zipCode').value = '62701';
    document.getElementById('country').value = 'United States';
    document.getElementById('phoneNumber').value = '+12175551234';
    document.getElementById('email').value = 'john.smith@email.com';
    document.getElementById('alternateEmail').value = 'j.smith.alt@gmail.com';
    
    // Emergency Contact
    const emergencyInputs = document.querySelectorAll('[name^="emergencyContacts[0]"]');
    const emergencyValues = {
        'emergencyContacts[0][name]': 'Mary Smith',
        'emergencyContacts[0][relationship]': 'Parent',
        'emergencyContacts[0][phoneNumber]': '+12175555678',
        'emergencyContacts[0][email]': 'mary.smith@email.com'
    };
    
    emergencyInputs.forEach(input => {
        if (emergencyValues[input.name]) {
            input.value = emergencyValues[input.name];
        }
    });
    
    // Course
    const courseInputs = document.querySelectorAll('[name^="courses[0]"]');
    const courseValues = {
        'courses[0][courseCode]': 'CS101',
        'courses[0][courseName]': 'Introduction to Computer Science',
        'courses[0][credits]': '3',
        'courses[0][semester]': 'Fall',
        'courses[0][instructor]': 'Dr. Johnson',
        'courses[0][days]': 'MWF',
        'courses[0][startTime]': '09:00',
        'courses[0][endTime]': '10:00',
        'courses[0][room]': 'CS-101'
    };
    
    courseInputs.forEach(input => {
        if (courseValues[input.name]) {
            input.value = courseValues[input.name];
        }
    });
    
    // Additional Information
    document.getElementById('extracurricularActivities').value = 'Chess Club, Programming Club';
    document.getElementById('workExperience').value = 'Part-time tutor for high school students';
    document.getElementById('financialAidRequired').value = 'true';
    document.getElementById('housingRequired').value = 'true';
    
    updateTotalCredits();
    showResult('Sample data loaded successfully!', 'success');
}

// Show result message
function showResult(message, type, append = false) {
    resultsSection.style.display = 'block';
    
    const resultClass = `result-${type}`;
    const resultHtml = `<div class="${resultClass}">${message}</div>`;
    
    if (append) {
        resultsContent.innerHTML += resultHtml;
    } else {
        resultsContent.innerHTML = resultHtml;
    }
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Escape HTML for iframe srcdoc attribute
function escapeHtml(html) {
    // For iframe srcdoc, we only need to escape quotes, not convert HTML to text
    return html.replace(/"/g, '&quot;');
}
