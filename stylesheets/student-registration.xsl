<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" 
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:sr="http://university.edu/student-registration">

  <xsl:output method="html" indent="yes" encoding="UTF-8"/>

  <xsl:template match="/">
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
            <p><strong>Registration ID:</strong> <xsl:value-of select="sr:studentRegistration/@registrationId"/></p>
            <p><strong>Submission Date:</strong> <xsl:value-of select="sr:studentRegistration/@submissionDate"/></p>
            <p><strong>Status:</strong>
              <span class="status-badge status-{sr:studentRegistration/@status}">
                <xsl:value-of select="sr:studentRegistration/@status"/>
              </span>
            </p>
          </div>

          <!-- Personal Information Section -->
          <div class="section">
            <div class="section-title">Personal Information</div>
            <div class="field-group">
              <div class="field">
                <div class="field-label">First Name</div>
                <div class="field-value"><xsl:value-of select="sr:studentRegistration/sr:personalInfo/sr:firstName"/></div>
              </div>
              <div class="field">
                <div class="field-label">Last Name</div>
                <div class="field-value"><xsl:value-of select="sr:studentRegistration/sr:personalInfo/sr:lastName"/></div>
              </div>
              <xsl:if test="sr:studentRegistration/sr:personalInfo/sr:middleName">
                <div class="field">
                  <div class="field-label">Middle Name</div>
                  <div class="field-value"><xsl:value-of select="sr:studentRegistration/sr:personalInfo/sr:middleName"/></div>
                </div>
              </xsl:if>
            </div>
            <div class="field-group">
              <div class="field">
                <div class="field-label">Date of Birth</div>
                <div class="field-value"><xsl:value-of select="sr:personalInfo/sr:dateOfBirth"/></div>
              </div>
              <div class="field">
                <div class="field-label">Gender</div>
                <div class="field-value"><xsl:value-of select="sr:personalInfo/sr:gender"/></div>
              </div>
              <div class="field">
                <div class="field-label">Nationality</div>
                <div class="field-value"><xsl:value-of select="sr:personalInfo/sr:nationality"/></div>
              </div>
            </div>
            <div class="field-group">
              <xsl:if test="sr:personalInfo/sr:socialSecurityNumber">
                <div class="field">
                  <div class="field-label">Social Security Number</div>
                  <div class="field-value"><xsl:value-of select="sr:personalInfo/sr:socialSecurityNumber"/></div>
                </div>
              </xsl:if>
              <div class="field">
                <div class="field-label">Marital Status</div>
                <div class="field-value"><xsl:value-of select="sr:personalInfo/sr:maritalStatus"/></div>
              </div>
            </div>
          </div>

          <!-- Academic Information Section -->
          <div class="section">
            <div class="section-title">Academic Information</div>
            <div class="field-group">
              <div class="field">
                <div class="field-label">Program</div>
                <div class="field-value"><xsl:value-of select="sr:academicInfo/sr:program"/></div>
              </div>
              <div class="field">
                <div class="field-label">Major</div>
                <div class="field-value"><xsl:value-of select="sr:academicInfo/sr:major"/></div>
              </div>
              <xsl:if test="sr:academicInfo/sr:minor">
                <div class="field">
                  <div class="field-label">Minor</div>
                  <div class="field-value"><xsl:value-of select="sr:academicInfo/sr:minor"/></div>
                </div>
              </xsl:if>
            </div>
            <div class="field-group">
              <div class="field">
                <div class="field-label">Expected Graduation Year</div>
                <div class="field-value"><xsl:value-of select="sr:academicInfo/sr:expectedGraduationYear"/></div>
              </div>
              <xsl:if test="sr:academicInfo/sr:gpa">
                <div class="field">
                  <div class="field-label">Current GPA</div>
                  <div class="field-value"><xsl:value-of select="sr:academicInfo/sr:gpa"/></div>
                </div>
              </xsl:if>
              <div class="field">
                <div class="field-label">Transfer Student</div>
                <div class="field-value">
                  <xsl:choose>
                    <xsl:when test="sr:academicInfo/sr:isTransferStudent = 'true'">
                      <span class="boolean-yes">Yes</span>
                    </xsl:when>
                    <xsl:otherwise>
                      <span class="boolean-no">No</span>
                    </xsl:otherwise>
                  </xsl:choose>
                </div>
              </div>
            </div>

            <!-- Previous Education -->
            <xsl:if test="sr:academicInfo/sr:previousEducation">
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
                  <xsl:for-each select="sr:academicInfo/sr:previousEducation">
                    <tr>
                      <td><xsl:value-of select="@level"/></td>
                      <td><xsl:value-of select="sr:institutionName"/></td>
                      <td><xsl:value-of select="sr:degree"/></td>
                      <td><xsl:value-of select="sr:graduationYear"/></td>
                      <td><xsl:value-of select="sr:gpa"/></td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </xsl:if>
          </div>

          <!-- Contact Information Section -->
          <div class="section">
            <div class="section-title">Contact Information</div>
            <div class="field-group">
              <div class="field">
                <div class="field-label">Address</div>
                <div class="field-value">
                  <xsl:value-of select="sr:contactInfo/sr:address/sr:street"/><br/>
                  <xsl:value-of select="sr:contactInfo/sr:address/sr:city"/>, 
                  <xsl:value-of select="sr:contactInfo/sr:address/sr:state"/> 
                  <xsl:value-of select="sr:contactInfo/sr:address/sr:zipCode"/><br/>
                  <xsl:value-of select="sr:contactInfo/sr:address/sr:country"/>
                </div>
              </div>
            </div>
            <div class="field-group">
              <div class="field">
                <div class="field-label">Phone Number</div>
                <div class="field-value"><xsl:value-of select="sr:contactInfo/sr:phoneNumber"/></div>
              </div>
              <xsl:if test="sr:contactInfo/sr:alternatePhone">
                <div class="field">
                  <div class="field-label">Alternate Phone</div>
                  <div class="field-value"><xsl:value-of select="sr:contactInfo/sr:alternatePhone"/></div>
                </div>
              </xsl:if>
            </div>
            <div class="field-group">
              <div class="field">
                <div class="field-label">Email</div>
                <div class="field-value"><xsl:value-of select="sr:contactInfo/sr:email"/></div>
              </div>
              <xsl:if test="sr:contactInfo/sr:alternateEmail">
                <div class="field">
                  <div class="field-label">Alternate Email</div>
                  <div class="field-value"><xsl:value-of select="sr:contactInfo/sr:alternateEmail"/></div>
                </div>
              </xsl:if>
            </div>
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
                <xsl:for-each select="sr:emergencyContacts/sr:contact">
                  <tr>
                    <td><xsl:value-of select="@priority"/></td>
                    <td><xsl:value-of select="sr:name"/></td>
                    <td><xsl:value-of select="sr:relationship"/></td>
                    <td><xsl:value-of select="sr:phoneNumber"/></td>
                    <td><xsl:value-of select="sr:email"/></td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </div>

          <!-- Courses Section -->
          <div class="section">
            <div class="section-title">Course Registration (Total Credits: <xsl:value-of select="sr:courses/@totalCredits"/>)</div>
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
                <xsl:for-each select="sr:courses/sr:course">
                  <tr>
                    <td><xsl:value-of select="sr:courseCode"/></td>
                    <td><xsl:value-of select="sr:courseName"/></td>
                    <td><xsl:value-of select="sr:credits"/></td>
                    <td><xsl:value-of select="@semester"/></td>
                    <td><xsl:value-of select="sr:instructor"/></td>
                    <td>
                      <xsl:value-of select="sr:schedule/sr:days"/>
                      <xsl:value-of select="sr:schedule/sr:startTime"/> -
                      <xsl:value-of select="sr:schedule/sr:endTime"/>
                    </td>
                    <td><xsl:value-of select="sr:schedule/sr:room"/></td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </div>

          <!-- Additional Information Section -->
          <xsl:if test="sr:additionalInfo">
            <div class="section">
              <div class="section-title">Additional Information</div>
              <div class="field-group">
                <xsl:if test="sr:additionalInfo/sr:specialNeeds">
                  <div class="field">
                    <div class="field-label">Special Needs</div>
                    <div class="field-value"><xsl:value-of select="sr:additionalInfo/sr:specialNeeds"/></div>
                  </div>
                </xsl:if>
                <xsl:if test="sr:additionalInfo/sr:medicalConditions">
                  <div class="field">
                    <div class="field-label">Medical Conditions</div>
                    <div class="field-value"><xsl:value-of select="sr:additionalInfo/sr:medicalConditions"/></div>
                  </div>
                </xsl:if>
              </div>
              <div class="field-group">
                <xsl:if test="sr:additionalInfo/sr:extracurricularActivities">
                  <div class="field">
                    <div class="field-label">Extracurricular Activities</div>
                    <div class="field-value"><xsl:value-of select="sr:additionalInfo/sr:extracurricularActivities"/></div>
                  </div>
                </xsl:if>
                <xsl:if test="sr:additionalInfo/sr:workExperience">
                  <div class="field">
                    <div class="field-label">Work Experience</div>
                    <div class="field-value"><xsl:value-of select="sr:additionalInfo/sr:workExperience"/></div>
                  </div>
                </xsl:if>
              </div>
              <div class="field-group">
                <div class="field">
                  <div class="field-label">Financial Aid Required</div>
                  <div class="field-value">
                    <xsl:choose>
                      <xsl:when test="sr:additionalInfo/sr:financialAidRequired = 'true'">
                        <span class="boolean-yes">Yes</span>
                      </xsl:when>
                      <xsl:otherwise>
                        <span class="boolean-no">No</span>
                      </xsl:otherwise>
                    </xsl:choose>
                  </div>
                </div>
                <div class="field">
                  <div class="field-label">Housing Required</div>
                  <div class="field-value">
                    <xsl:choose>
                      <xsl:when test="sr:additionalInfo/sr:housingRequired = 'true'">
                        <span class="boolean-yes">Yes</span>
                      </xsl:when>
                      <xsl:otherwise>
                        <span class="boolean-no">No</span>
                      </xsl:otherwise>
                    </xsl:choose>
                  </div>
                </div>
              </div>
            </div>
          </xsl:if>
        </div>
      </body>
    </html>
  </xsl:template>

</xsl:stylesheet>
