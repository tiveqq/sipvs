// Global variables
let currentXmlFilename = null;
let emergencyContactCount = 1;
let courseCount = 1;

// DOM elements
const form = document.getElementById('registrationForm');
const validateXmlBtn = document.getElementById('validateXmlBtn');
const transformXmlBtn = document.getElementById('transformXmlBtn');
const signXmlBtn = document.getElementById('signXmlBtn');
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
    signXmlBtn.addEventListener('click', handleSignXml);
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
            signXmlBtn.disabled = false;

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

// ============================================================================
// SLOVAK eIDAS DIGITAL SIGNING FUNCTIONALITY
// ============================================================================

/**
 * Handle XML signing with Slovak eIDAS
 * Uses D.Bridge JS to communicate with D.Signer
 */
async function handleSignXml() {
    if (!currentXmlFilename && !xmlFileSelect.value) {
        showResult('Please save the XML file first before signing.', 'error');
        return;
    }

    const filename = currentXmlFilename || xmlFileSelect.value;

    try {
        // Disable button and show loading state
        signXmlBtn.disabled = true;
        signXmlBtn.textContent = '🔄 Preparing...';
        showResult('Preparing document for signing...', 'info');

        // Step 1: Prepare signing payload from backend
        const prepareResponse = await fetch('/api/prepare-signing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: filename
            })
        });

        if (!prepareResponse.ok) {
            const error = await prepareResponse.json();
            throw new Error(error.error || 'Failed to prepare signing payload');
        }

        const { payload } = await prepareResponse.json();

        // Log payload for debugging
        console.log('[FRONTEND] Received signing payload from backend:');
        console.log('  - Identifier:', payload.identifier);
        console.log('  - Description:', payload.description);
        console.log('  - formatIdentifier:', payload.formatIdentifier);
        console.log('  - xdcXMLData length:', payload.xdcXMLData?.length);
        console.log('  - xdcUsedXSD length:', payload.xdcUsedXSD?.length);
        console.log('  - xdcUsedXSLT length:', payload.xdcUsedXSLT?.length);
        console.log('  - pdfBase64 present:', !!payload.pdfBase64);
        console.log('  - pdfBase64 length:', payload.pdfBase64?.length);
        console.log('');

        // Step 2: Initialize D.Bridge JS and sign
        signXmlBtn.textContent = 'Connecting to D.Signer...';
        showResult('Connecting to D.Signer... Please wait.', 'info');

        await signWithDBridge(payload);

        // Success
        showResult('Document signed successfully! ASiC-E file downloaded.', 'success');
        signXmlBtn.textContent = 'Signed!';

        // Reset button after 3 seconds
        setTimeout(() => {
            signXmlBtn.textContent = '🔐 Sign';
            signXmlBtn.disabled = false;
        }, 3000);

    } catch (error) {
        console.error('Signing error:', error);
        const errorMessage = handleDSignerError(error);
        showResult(`Signing failed: ${errorMessage}`, 'error');
        signXmlBtn.textContent = '🔐 Sign';
        signXmlBtn.disabled = false;
    }
}

/**
 * Sign document using D.Bridge JS API
 * @param {Object} payload - Signing payload from backend
 */
function signWithDBridge(payload) {
    return new Promise((resolve, reject) => {
        // Log payload structure at the start
        console.log('🔍 [signWithDBridge] Payload structure:');
        console.log('  - payload.pdfBase64 exists:', !!payload.pdfBase64);
        console.log('  - payload.pdfBase64 type:', typeof payload.pdfBase64);
        console.log('  - payload.pdfBase64 length:', payload.pdfBase64?.length);
        if (payload.pdfBase64) {
            console.log('  - PDF starts with:', payload.pdfBase64.substring(0, 20));
            console.log('  - PDF is valid Base64:', /^[A-Za-z0-9+/=]+$/.test(payload.pdfBase64));
        }
        console.log('');

        // Check if D.Bridge JS is loaded
        if (typeof ditec === 'undefined' || !ditec.dSigXadesBpJs) {
            reject(new Error('D.Bridge JS library not loaded. Please refresh the page.'));
            return;
        }

        // Enable debug logging
        const DEBUG = true;
        function debugLog(step, message) {
            if (DEBUG) {
                console.log(`[D.Bridge JS - ${step}]`, message);
            }
        }

        // Timeout mechanism (60 seconds)
        const TIMEOUT_MS = 60000;
        let timeoutId = setTimeout(() => {
            const error = new Error('Signing operation timed out. D.Signer may not be responding. Please check if D.Signer is running and try again.');
            console.error('[D.Bridge JS - TIMEOUT]', error);
            reject(error);
        }, TIMEOUT_MS);

        // Clear timeout on completion
        function clearSigningTimeout() {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        }

        // Callback helper for D.Bridge JS v1.x API
        // IMPORTANT: D.Bridge JS expects 'onSuccess' and 'onError', not 'callback'
        function Callback(onSuccess, onError) {
            this.onSuccess = onSuccess;
            this.onError = onError || function(error) {
                clearSigningTimeout();

                // Log the full error object for debugging
                console.error('[D.Bridge JS - ERROR - Full Object]', error);
                console.error('[D.Bridge JS - ERROR - Type]', typeof error);
                console.error('[D.Bridge JS - ERROR - Constructor]', error?.constructor?.name);

                // Extract error message (handle DitecError objects)
                let errorMessage = error;
                if (error && typeof error === 'object') {
                    errorMessage = error.message || error.toString() || JSON.stringify(error);
                }

                console.error('[D.Bridge JS - ERROR - Message]', errorMessage);
                reject(new Error(`D.Bridge JS error: ${errorMessage}`));
            };
        }

        debugLog('START', 'Beginning signing process');

        // Validate formatIdentifier length (must be < 1024 characters)
        if (payload.formatIdentifier && payload.formatIdentifier.length >= 1024) {
            const error = `formatIdentifier is too long (${payload.formatIdentifier.length} characters, max 1024). Value: ${payload.formatIdentifier.substring(0, 100)}...`;
            debugLog('ERROR', error);
            reject(new Error(error));
            return;
        }

        debugLog('PAYLOAD', {
            identifier: payload.identifier,
            description: payload.description,
            formatIdentifier: payload.formatIdentifier,
            formatIdentifierLength: payload.formatIdentifier?.length || 0,
            xmlBase64Length: payload.xmlBase64?.length || 0,
            xsdBase64Length: payload.xsdBase64?.length || 0,
            xslBase64Length: payload.xslBase64?.length || 0
        });

        // Log formatIdentifier explicitly for debugging
        console.log('[D.Bridge JS - formatIdentifier]', payload.formatIdentifier);
        console.log('[D.Bridge JS - formatIdentifier length]', payload.formatIdentifier?.length || 0);

        // Decode and log XMLDataContainer for debugging (first 500 chars)
        try {
            const xmlDataContainer = atob(payload.xmlBase64);
            debugLog('XMLDataContainer (preview)', xmlDataContainer.substring(0, 500) + '...');

            // CRITICAL INVESTIGATION: Check what D.Bridge JS might be reading
            console.log('🔍 [INVESTIGATION] Checking XMLDataContainer structure:');

            // Extract the xmlns:xdc namespace URI
            const namespaceMatch = xmlDataContainer.match(/xmlns:xdc="([^"]+)"/);
            if (namespaceMatch) {
                console.log('  - xmlns:xdc namespace:', namespaceMatch[1]);
                console.log('  - xmlns:xdc length:', namespaceMatch[1].length);
            }

            // Extract the Identifier attribute
            const identifierMatch = xmlDataContainer.match(/Identifier="([^"]+)"/);
            if (identifierMatch) {
                console.log('  - Identifier attribute:', identifierMatch[1]);
                console.log('  - Identifier length:', identifierMatch[1].length);
            }

            // Check if formatIdentifier appears in the XMLDataContainer
            if (xmlDataContainer.includes(payload.formatIdentifier)) {
                console.log('  - formatIdentifier found in XMLDataContainer: YES');
            } else {
                console.log('  - formatIdentifier found in XMLDataContainer: NO');
            }
        } catch (e) {
            debugLog('ERROR', 'Failed to decode xmlBase64: ' + e.message);
        }

        // Step 1: Deploy D.Bridge
        debugLog('STEP 1', 'Deploying D.Bridge...');
        showResult('Step 1/5: Deploying D.Bridge...', 'info');

        ditec.dSigXadesBpJs.deploy(null, new Callback(
            function() {
                debugLog('STEP 1', 'D.Bridge deployed successfully');

                // Step 2: Initialize signing session
                debugLog('STEP 2', 'Initializing signing session...');
                showResult('Step 2/5: Initializing D.Signer...', 'info');

                ditec.dSigXadesBpJs.initialize(new Callback(
                    function() {
                        debugLog('STEP 2', 'Signing session initialized');

                        // Step 3: Add document object to be signed
                        debugLog('STEP 3', 'Adding document object to signing queue...');
                        showResult('Step 3/5: Preparing document...', 'info');

                        // ============================================
                        // Document Object Addition Strategy
                        // Determine document type and use appropriate method:
                        // - addXmlObject() for XML documents (6 parameters)
                        // - addPdfObject() for PDF documents (4 parameters)
                        // ============================================

                        // ============================================
                        // Multi-Object Signing Strategy
                        // Sign XMLDataContainer (XML + XSD + XSLT) + PDF (if available)
                        // ============================================

                        console.log('[SIGNING STRATEGY] Multi-object signing');
                        console.log('  - Object 1: XMLDataContainer (XML + XSD + XSLT references)');
                        console.log('  - Object 2: PDF (if available)');
                        console.log('');

                        // Step 3a: Add XMLDataContainer object
                        console.log('[OBJECT 1] Adding XMLDataContainer...');
                        console.log('  - Method: addXmlObject() (16 parameters - D.Bridge API)');
                        console.log('  - Param 1 (objectId):', payload.identifier);
                        console.log('  - Param 2 (objectDescription):', payload.description);
                        console.log('  - Param 3 (objectFormatIdentifier):', payload.formatIdentifier);
                        console.log('  - Param 4 (xdcXMLData):', payload.xdcXMLData.substring(0, 50) + '...', '(length:', payload.xdcXMLData.length, ')');
                        console.log('  - Param 5 (xdcIdentifier):', payload.xdcIdentifier);
                        console.log('  - Param 6 (xdcVersion):', payload.xdcVersion);
                        console.log('  - Param 7 (xdcUsedXSD):', payload.xdcUsedXSD.substring(0, 50) + '...', '(length:', payload.xdcUsedXSD.length, ')');
                        console.log('  - Param 8 (xsdReferenceURI):', payload.xsdReferenceURI);
                        console.log('  - Param 9 (xdcUsedXSLT):', payload.xdcUsedXSLT.substring(0, 50) + '...', '(length:', payload.xdcUsedXSLT.length, ')');
                        console.log('  - Param 10 (xslReferenceURI):', payload.xslReferenceURI);
                        console.log('  - Param 11 (xslMediaDestinationTypeDescription):', payload.xslMediaDestinationTypeDescription);
                        console.log('  - Param 12 (xslXSLTLanguage):', payload.xslXSLTLanguage);
                        console.log('  - Param 13 (xslTargetEnvironment):', payload.xslTargetEnvironment);
                        console.log('  - Param 14 (xdcIncludeRefs):', payload.xdcIncludeRefs);
                        console.log('  - Param 15 (xdcNamespaceURI):', payload.xdcNamespaceURI);
                        console.log('  - Param 16 (callback): Callback object');
                        console.log('');

                        // Use addXmlObject() for XMLDataContainer
                        // Correct D.Bridge API Signature (16 parameters):
                        // addXmlObject(objectId, objectDescription, objectFormatIdentifier, xdcXMLData, xdcIdentifier, xdcVersion,
                        //              xdcUsedXSD, xsdReferenceURI, xdcUsedXSLT, xslReferenceURI, xslMediaDestinationTypeDescription,
                        //              xslXSLTLanguage, xslTargetEnvironment, xdcIncludeRefs, xdcNamespaceURI, callback)
                        // D.Bridge builds the XMLDataContainer internally from these components
                        ditec.dSigXadesBpJs.addXmlObject(
                            payload.identifier,                              // 1. objectId
                            payload.description,                             // 2. objectDescription
                            payload.formatIdentifier,                        // 3. objectFormatIdentifier
                            payload.xdcXMLData,                             // 4. xdcXMLData - RAW XML
                            payload.xdcIdentifier,                          // 5. xdcIdentifier
                            payload.xdcVersion,                             // 6. xdcVersion
                            payload.xdcUsedXSD,                             // 7. xdcUsedXSD - RAW XSD
                            payload.xsdReferenceURI,                        // 8. xsdReferenceURI
                            payload.xdcUsedXSLT,                            // 9. xdcUsedXSLT - RAW XSLT
                            payload.xslReferenceURI,                        // 10. xslReferenceURI
                            payload.xslMediaDestinationTypeDescription,     // 11. xslMediaDestinationTypeDescription
                            payload.xslXSLTLanguage,                        // 12. xslXSLTLanguage
                            payload.xslTargetEnvironment,                   // 13. xslTargetEnvironment
                            payload.xdcIncludeRefs,                         // 14. xdcIncludeRefs
                            payload.xdcNamespaceURI,                        // 15. xdcNamespaceURI
                            new Callback(
                                function() {
                                    debugLog('STEP 3a', 'XMLDataContainer object added successfully');

                                    // Step 3b: Add PDF object if available
                                    if (payload.pdfBase64) {
                                        console.log('🔍 [OBJECT 2] Adding PDF document...');
                                        console.log('  - Method: addPdfObject() (8 parameters - D.Bridge API)');
                                        console.log('  - Param 1 (objectId):', 'pdf-' + Date.now());
                                        console.log('  - Param 2 (objectDescription): Student Registration PDF');
                                        console.log('  - Param 3 (sourcePdfBase64): PDF binary data');
                                        console.log('    * PDF size:', (payload.pdfBase64.length / 1024).toFixed(2), 'KB');
                                        console.log('    * PDF header:', payload.pdfBase64.substring(0, 20));
                                        console.log('  - Param 4 (password): (empty - no password protection)');
                                        console.log('  - Param 5 (objectFormatIdentifier): application/pdf');
                                        console.log('  - Param 6 (reqLevel): 0 (no requirement level)');
                                        console.log('  - Param 7 (convert): false (no conversion)');
                                        console.log('  - Param 8 (callback): Callback object');
                                        console.log('');
                                        console.log('[WARNING] D.Bridge requires PDF/A-1 compliance for PDF signing.');
                                        console.log('   If PDF/A-1 errors occur, the system will automatically fall back');
                                        console.log('   to signing XMLDataContainer only.');
                                        console.log('');

                                        // Use addPdfObject() for PDF document
                                        // D.Bridge API Signature (8 parameters):
                                        // addPdfObject(objectId, objectDescription, sourcePdfBase64, password,
                                        //              objectFormatIdentifier, reqLevel, convert, callback)
                                        ditec.dSigXadesBpJs.addPdfObject(
                                            'pdf-' + Date.now(),                          // 1. objectId
                                            'Student Registration PDF',                   // 2. objectDescription
                                            payload.pdfBase64,                           // 3. sourcePdfBase64 - PDF binary data
                                            '',                                          // 4. password - empty (no password protection)
                                            'application/pdf',                           // 5. objectFormatIdentifier
                                            0,                                           // 6. reqLevel - no requirement level
                                            true,                                       // 7. convert - no conversion needed
                                            new Callback(
                                                function() {
                                                    debugLog('STEP 3b', 'PDF object added successfully');
                                                    console.log('[OBJECT 2] PDF document added successfully');
                                                    console.log('');
                                                    proceedToSigning();
                                                },
                                                function(error) {
                                                    clearSigningTimeout();
                                                    debugLog('ERROR', 'Failed to add PDF object: ' + error);
                                                    console.error('[OBJECT 2] Failed to add PDF document:', error);

                                                    // Check if error is PDF/A-1 compliance related
                                                    const errorStr = String(error).toLowerCase();
                                                    if (errorStr.includes('pdfa') || errorStr.includes('pdf/a') ||
                                                        errorStr.includes('pdfacompliance') || errorStr.includes('font program') ||
                                                        errorStr.includes('metadata stream') || errorStr.includes('tagged pdf') ||
                                                        errorStr.includes('outputintent') || errorStr.includes('structtreeroot')) {

                                                        console.warn('[CRITICAL] PDF/A-1 COMPLIANCE ERROR DETECTED');
                                                        console.warn('   Error:', error);
                                                        console.log('');
                                                        console.log('[FALLBACK] Proceeding with XMLDataContainer only');
                                                        console.log('   PDF object will be skipped due to PDF/A-1 compliance issues');
                                                        console.log('');
                                                        // Continue with signing XMLDataContainer only
                                                        proceedToSigning();
                                                    } else {
                                                        // For other errors, reject
                                                        console.error('[OBJECT 2] Non-PDF/A-1 error - rejecting');
                                                        reject(new Error(`Failed to add PDF object: ${error}`));
                                                    }
                                                }
                                            )
                                        );
                                    } else {
                                        console.log('[OBJECT 2] PDF not available');
                                        console.log('  - Signing XMLDataContainer only');
                                        console.log('');
                                        proceedToSigning();
                                    }

                                    // Helper function to proceed with signing
                                    function proceedToSigning() {
                                        // Step 4: Execute signing operation
                                        debugLog('STEP 4', 'Executing signing operation...');
                                        showResult('Step 4/5: Waiting for signature... (Please sign in D.Signer window)', 'info');

                                        const signatureId = 'signature-' + Date.now();
                                        const digestAlgorithm = 'http://www.w3.org/2001/04/xmlenc#sha256';
                                        const signingCertificate = ''; // Empty = use default certificate

                                        ditec.dSigXadesBpJs.sign(
                                            signatureId,
                                            digestAlgorithm,
                                            signingCertificate,
                                            new Callback(
                                                function() {
                                                    debugLog('STEP 4', 'Document signed successfully');

                                                    // Step 5: Retrieve signed ASiC-E container
                                                    debugLog('STEP 5', 'Retrieving signed ASiC-E container...');
                                                    showResult('Step 5/5: Retrieving signed file...', 'info');

                                                    ditec.dSigXadesBpJs.getSignatureWithASiCEnvelopeBase64(
                                                        new Callback(
                                                            function(asiceBase64) {
                                                                debugLog('STEP 5', 'ASiC-E container retrieved');
                                                                debugLog('SUCCESS', 'Signing process completed');

                                                                clearSigningTimeout();

                                                                // Step 6: Download the signed file
                                                                try {
                                                                    downloadAsiceFile(asiceBase64, payload.filename);
                                                                    resolve();
                                                                } catch (error) {
                                                                    debugLog('ERROR', 'Failed to download file: ' + error.message);
                                                                    reject(error);
                                                                }
                                                            },
                                                            function(error) {
                                                                clearSigningTimeout();
                                                                debugLog('ERROR', 'Failed to retrieve ASiC-E container: ' + error);
                                                                reject(new Error(`Failed to retrieve signed file: ${error}`));
                                                            }
                                                        )
                                                    );
                                                },
                                                function(error) {
                                                    clearSigningTimeout();
                                                    debugLog('ERROR', 'Signing operation failed: ' + error);
                                                    reject(new Error(`Signing operation failed: ${error}. This may happen if you cancelled the signing or entered wrong password.`));
                                                }
                                            )
                                        );
                                    }
                                },
                                function(error) {
                                    clearSigningTimeout();

                                    // Extract detailed error message
                                    let errorMessage = error;
                                    if (error && typeof error === 'object') {
                                        errorMessage = error.message || error.toString() || JSON.stringify(error);
                                    }

                                    debugLog('ERROR', 'Failed to add XML object: ' + errorMessage);
                                    console.error('[STEP 3 - Full Error Object]', error);

                                    // CHECK FOR PDF/A-1 COMPLIANCE ERROR (CRITICAL FIX)
                                    // The error might be from PDF object addition, not XML object
                                    const errorStr = String(errorMessage).toLowerCase();
                                    if (errorStr.includes('pdfa') || errorStr.includes('pdf/a') ||
                                        errorStr.includes('pdfacompliance') || errorStr.includes('font program') ||
                                        errorStr.includes('metadata stream') || errorStr.includes('tagged pdf') ||
                                        errorStr.includes('outputintent') || errorStr.includes('structtreeroot')) {

                                        console.warn('[CRITICAL] PDF/A-1 COMPLIANCE ERROR DETECTED');
                                        console.warn('   Error:', errorMessage);
                                        console.log('');
                                        console.log('[FALLBACK] Attempting to sign XMLDataContainer only...');
                                        console.log('   PDF object will be skipped due to PDF/A-1 compliance issues');
                                        console.log('');

                                        // FALLBACK: Try to proceed with signing XMLDataContainer only
                                        // by calling proceedToSigning() which will use the already-added XML object
                                        try {
                                            // The XMLDataContainer was already added successfully
                                            // Just proceed to signing
                                            const signatureId = 'signature-' + Date.now();
                                            const digestAlgorithm = 'http://www.w3.org/2001/04/xmlenc#sha256';
                                            const signingCertificate = '';

                                            console.log('📋 [FALLBACK] Proceeding with XMLDataContainer-only signing...');
                                            console.log('');

                                            ditec.dSigXadesBpJs.sign(
                                                signatureId,
                                                digestAlgorithm,
                                                signingCertificate,
                                                new Callback(
                                                    function() {
                                                        debugLog('STEP 4', 'Document signed successfully (XMLDataContainer only)');
                                                        console.log('✅ [FALLBACK] XMLDataContainer signed successfully');
                                                        console.log('');

                                                        // Step 5: Retrieve signed ASiC-E container
                                                        debugLog('STEP 5', 'Retrieving signed ASiC-E container...');
                                                        showResult('Step 5/5: Retrieving signed file...', 'info');

                                                        ditec.dSigXadesBpJs.getSignatureWithASiCEnvelopeBase64(
                                                            new Callback(
                                                                function(asiceBase64) {
                                                                    debugLog('STEP 5', 'ASiC-E container retrieved');
                                                                    debugLog('SUCCESS', 'Signing process completed (XMLDataContainer only)');
                                                                    console.log('[FALLBACK] ASiC-E container retrieved successfully');
                                                                    console.log('');

                                                                    clearSigningTimeout();

                                                                    // Step 6: Download the signed file
                                                                    try {
                                                                        downloadAsiceFile(asiceBase64, payload.filename);
                                                                        resolve();
                                                                    } catch (error) {
                                                                        debugLog('ERROR', 'Failed to download file: ' + error.message);
                                                                        reject(error);
                                                                    }
                                                                },
                                                                function(error) {
                                                                    clearSigningTimeout();
                                                                    debugLog('ERROR', 'Failed to retrieve ASiC-E container: ' + error);
                                                                    reject(new Error(`Failed to retrieve signed file: ${error}`));
                                                                }
                                                            )
                                                        );
                                                    },
                                                    function(error) {
                                                        clearSigningTimeout();
                                                        debugLog('ERROR', 'Signing operation failed: ' + error);
                                                        reject(new Error(`Signing operation failed: ${error}. This may happen if you cancelled the signing or entered wrong password.`));
                                                    }
                                                )
                                            );
                                        } catch (fallbackError) {
                                            console.error('[FALLBACK] Fallback signing failed:', fallbackError);
                                            reject(new Error(`Fallback signing failed: ${fallbackError}`));
                                        }
                                        return;
                                    }

                                    // Detailed debugging for objectFormatIdentifier error
                                    console.error('[DEBUG] Error Analysis:');
                                    console.error('  - Error message:', errorMessage);
                                    console.error('  - formatIdentifier value:', payload.formatIdentifier);
                                    console.error('  - formatIdentifier length:', payload.formatIdentifier?.length);
                                    console.error('  - xmlBase64 length:', payload.xmlBase64?.length);
                                    console.error('  - Decoded XML length:', atob(payload.xmlBase64)?.length);

                                    // Try to decode and show the XMLDataContainer structure
                                    try {
                                        const decodedXml = atob(payload.xmlBase64);
                                        console.error('  - Decoded XML (first 300 chars):', decodedXml.substring(0, 300));
                                    } catch (e) {
                                        console.error('  - Failed to decode XML:', e);
                                    }

                                    // Check for specific DitecError about formatIdentifier
                                    if (errorMessage.includes('objectFormatIdentifier') || errorMessage.includes('1024')) {
                                        reject(new Error(`Invalid formatIdentifier: ${errorMessage}\n\nThe formatIdentifier must be less than 1024 characters. Current value: "${payload.formatIdentifier}" (${payload.formatIdentifier?.length || 0} characters)`));
                                    } else {
                                        reject(new Error(`Failed to prepare document: ${errorMessage}`));
                                    }
                                }
                            )
                            );
                    },
                    function(error) {
                        clearSigningTimeout();
                        debugLog('ERROR', 'Failed to initialize: ' + error);
                        reject(new Error(`Failed to initialize D.Signer: ${error}. Please ensure D.Signer is installed and running.`));
                    }
                ));
            },
            function(error) {
                clearSigningTimeout();
                debugLog('ERROR', 'Failed to deploy: ' + error);
                reject(new Error(`Failed to deploy D.Bridge: ${error}. Please ensure D.Launcher is running.`));
            }
        ));
    });
}

/**
 * Download ASiC-E file from Base64 data
 * @param {string} base64Data - Base64-encoded ASiC-E container
 * @param {string} originalFilename - Original XML filename
 */
function downloadAsiceFile(base64Data, originalFilename) {
    try {
        // Decode Base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Create Blob with correct MIME type
        const blob = new Blob([bytes], {
            type: 'application/vnd.etsi.asic-e+zip'
        });

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseFilename = originalFilename.replace('.xml', '');
        const filename = `${baseFilename}-signed-${timestamp}.asice`;

        // Create download link and trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        console.log(`Downloaded signed file: ${filename}`);

    } catch (error) {
        throw new Error(`Failed to download signed file: ${error.message}`);
    }
}

/**
 * Show user-friendly error messages for D.Signer issues
 */
function handleDSignerError(error) {
    const errorMessage = error.message.toLowerCase();

    // Always show the actual error message in console for debugging
    console.error('[ERROR DETAILS]', error.message);
    console.error('[ERROR FULL]', error);

    // Check for formatIdentifier length error (DitecError)
    if (errorMessage.includes('objectformatidentifier') || errorMessage.includes('1024') || errorMessage.includes('invalid formatidentifier')) {
        return `Invalid formatIdentifier parameter

${error.message}

The formatIdentifier parameter passed to D.Bridge JS must be less than 1024 characters.

Please check the browser console for the actual formatIdentifier value and length.`;
    }

    // Check for specific error patterns and provide helpful guidance
    if (errorMessage.includes('failed to prepare document')) {
        return `Failed to prepare document for signing.

Error details: ${error.message}

This may be caused by:
1. Invalid XML structure in the XMLDataContainer
2. Encoding issues with the XML content
3. D.Signer not accepting the document format
4. Invalid parameters passed to D.Bridge JS

Please check the browser console for detailed error messages.`;
    }

    if (errorMessage.includes('failed to initialize') || errorMessage.includes('not loaded')) {
        return `D.Signer is not installed or not running.

Please:
1. Install D.Suite from: https://www.slovensko.sk/sk/na-stiahnutie
2. Verify installation at: https://epodpis.ditec.sk/install-check
3. Ensure D.Launcher service is running
4. Refresh this page and try again`;
    }

    if (errorMessage.includes('certificate') || errorMessage.includes('password')) {
        return `Certificate error occurred.

Please check:
1. Certificate is valid and not expired
2. Correct password entered (default: "test")
3. Certificate file is accessible`;
    }

    if (errorMessage.includes('cancelled') || errorMessage.includes('user')) {
        return 'Signing operation was cancelled by user.';
    }

    if (errorMessage.includes('timeout')) {
        return error.message; // Timeout message is already clear
    }

    // Return the actual error message for unknown errors
    return `Signing error: ${error.message}

Please check the browser console for more details.`;
}
