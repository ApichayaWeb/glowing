/**
 * ระบบสอบย้อนกลับผักอุดร - Authentication Functions
 * ==================================================
 */

/**
 * Handle user login with FirstLogin detection
 */
function handleLogin(params) {
  try {
    const username = params.username;
    const password = params.password;
    
    if (!username || !password) {
      return { success: false, message: 'กรุณาใส่ชื่อผู้ใช้และรหัสผ่าน' };
    }
    
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    // Debug logging
    Logger.log(`Login attempt: username=${username}, password=${password}`);
    Logger.log(`Sheet data rows: ${data.length}`);
    Logger.log(`Headers: ${JSON.stringify(data[0])}`);
    if (data.length > 1) {
      Logger.log(`First user row: ${JSON.stringify(data[1])}`);
    }
    
    // Get column indexes based on your sheet structure
    const headers = data[0];
    const userIdCol = headers.indexOf('UserID');
    const usernameCol = headers.indexOf('Username');
    const passwordCol = headers.indexOf('Password');
    const roleCol = headers.indexOf('Role');
    const groupIdCol = headers.indexOf('GroupID');
    const statusCol = headers.indexOf('Status');
    const firstLoginCol = headers.indexOf('FirstLogin');
    const lastLoginCol = headers.indexOf('LastLogin');
    
    // Check if essential columns exist
    if (usernameCol === -1 || passwordCol === -1) {
      Logger.log(`Missing columns: usernameCol=${usernameCol}, passwordCol=${passwordCol}`);
      return { success: false, message: 'โครงสร้างตารางไม่ถูกต้อง - ขาดคอลัมน์ที่จำเป็น' };
    }
    
    // Find user
    Logger.log(`Total data rows: ${data.length}, searching for username: "${username}"`);
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Clean username and password from sheet (remove leading ' if exists)
      const sheetUsername = String(row[usernameCol]).replace(/^'/, '');
      const sheetPassword = String(row[passwordCol]).replace(/^'/, '');
      const sheetStatus = row[statusCol];
      
      Logger.log(`Row ${i}: input username="${username}" vs sheet username="${sheetUsername}"`);
      Logger.log(`Row ${i}: input password="${password}" vs sheet password="${sheetPassword}"`);
      Logger.log(`Row ${i}: status="${sheetStatus}"`);
      
      if (sheetUsername === username && sheetPassword === password) {
        // Check if user is active
        if (row[statusCol] !== 'Active') {
          return { success: false, message: 'บัญชีผู้ใช้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ' };
        }
        
        // Check FirstLogin flag
        let isFirstLogin = false;
        if (firstLoginCol !== -1) {
          const firstLoginValue = row[firstLoginCol];
          isFirstLogin = firstLoginValue === true || 
                        firstLoginValue === 'TRUE' || 
                        firstLoginValue === '1' || 
                        firstLoginValue === 1;
          Logger.log(`FirstLogin check: column=${firstLoginCol}, value=${firstLoginValue}, result=${isFirstLogin}`);
        } else {
          Logger.log('FirstLogin column not found in headers');
        }
        
        // Return user data (without password)
        const userData = {
          userID: row[userIdCol],
          username: row[usernameCol],
          role: row[roleCol],
          GroupID: row[groupIdCol], // Use GroupID (PascalCase) to match Google Sheets
          groupID: row[groupIdCol], // Keep camelCase for backward compatibility
          status: row[statusCol],
          firstLogin: isFirstLogin,
          lastLogin: row[lastLoginCol]
        };
        
        // Get additional data based on role
        if (userData.role === 'group' && (userData.GroupID || userData.groupID)) {
          const groupData = getGroupById(userData.GroupID || userData.groupID);
          if (groupData) {
            userData.groupName = groupData.groupName;
            userData.groupCode = groupData.groupCode;
          }
        } else if (userData.role === 'farmer') {
          const farmerResponse = handleGetFarmerByUsername({username: username});
          console.log('Farmer lookup response:', farmerResponse);
          if (farmerResponse && farmerResponse.success && farmerResponse.data) {
            userData.farmerID = farmerResponse.data.FarmerID;
            userData.fullName = farmerResponse.data.FullName;
            userData.plotNumber = farmerResponse.data.PlotNumber;
            console.log('Set farmer data - FarmerID:', userData.farmerID);
          } else {
            console.log('No farmer data found for username:', username);
          }
        }
        
        // If NOT first login, update LastLogin
        if (!isFirstLogin) {
          sheet.getRange(i + 1, lastLoginCol + 1).setValue(new Date());
        }
        
        Logger.log('Final userData before return:', JSON.stringify(userData));
        
        return { 
          success: true, 
          message: 'เข้าสู่ระบบสำเร็จ',
          user: userData 
        };
      }
    }
    
    Logger.log('No matching user found in database');
    Logger.log(`Search completed. Total rows checked: ${data.length - 1}`);
    return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
    
  } catch (error) {
    Logger.log('Login error: ' + error.toString());
    return { success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' };
  }
}

/**
 * Handle password change (regular change)
 */
function handleChangePassword(params) {
  try {
    const username = params.username;
    const oldPassword = params.oldPassword;
    const newPassword = params.newPassword;
    
    if (!username || !oldPassword || !newPassword) {
      return { success: false, message: 'กรุณาใส่ข้อมูลให้ครบถ้วน' };
    }
    
    if (newPassword.length < 6) {
      return { success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' };
    }
    
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    const headers = data[0];
    const usernameCol = headers.indexOf('Username');
    const passwordCol = headers.indexOf('Password');
    
    // Find user and verify old password
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Clean stored values (remove leading ' if exists)
      const storedUsername = String(row[usernameCol]).replace(/^'/, '');
      const storedPassword = String(row[passwordCol]).replace(/^'/, '');
      
      if (storedUsername === username) {
        if (storedPassword !== oldPassword) {
          return { success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' };
        }
        
        // Update password with ' prefix to maintain text format
        sheet.getRange(i + 1, passwordCol + 1).setValue("'" + newPassword);
        
        return { 
          success: true, 
          message: 'เปลี่ยนรหัสผ่านสำเร็จ' 
        };
      }
    }
    
    return { success: false, message: 'ไม่พบผู้ใช้นี้ในระบบ' };
    
  } catch (error) {
    Logger.log('Change password error: ' + error.toString());
    return { success: false, message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' };
  }
}

/**
 * Handle first-time password change
 */
function handleChangePasswordFirstTime(params) {
  try {
    const username = params.username;
    const oldPassword = params.oldPassword;
    const newPassword = params.newPassword;
    
    if (!username || !oldPassword || !newPassword) {
      return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };
    }
    
    if (newPassword.length < 6) {
      return { success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' };
    }
    
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    const headers = data[0];
    const usernameCol = headers.indexOf('Username');
    const passwordCol = headers.indexOf('Password');
    const firstLoginCol = headers.indexOf('FirstLogin');
    const lastLoginCol = headers.indexOf('LastLogin');
    
    // Find user and verify old password
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Clean stored values (remove leading ' if exists)
      const storedUsername = String(row[usernameCol]).replace(/^'/, '');
      const storedPassword = String(row[passwordCol]).replace(/^'/, '');
      
      if (storedUsername === username) {
        // Verify current password
        if (storedPassword !== oldPassword) {
          return { success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' };
        }
        
        const rowNum = i + 1;
        
        // Update all related fields
        sheet.getRange(rowNum, passwordCol + 1).setValue("'" + newPassword);  // Update password with ' prefix
        sheet.getRange(rowNum, firstLoginCol + 1).setValue('FALSE');          // Set FirstLogin to FALSE
        sheet.getRange(rowNum, lastLoginCol + 1).setValue(new Date());        // Set LastLogin to current time
        
        Logger.log(`First-time password changed successfully for user: ${username}`);
        
        return { 
          success: true, 
          message: 'เปลี่ยนรหัสผ่านสำเร็จ',
          updatedFields: {
            firstLogin: false,
            lastLogin: new Date().toISOString()
          }
        };
      }
    }
    
    return { success: false, message: 'ไม่พบผู้ใช้' };
    
  } catch (error) {
    Logger.log('First-time password change error: ' + error.toString());
    return { success: false, message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' };
  }
}

/**
 * Create new user account with proper FirstLogin handling
 */
function createUserAccount(userData) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    
    // Check if username already exists  
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const usernameCol = headers.indexOf('Username');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameCol] === userData.username) {
        throw new Error('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว');
      }
    }
    
    // Determine FirstLogin value based on role and explicit setting
    let firstLogin = false; // Default for admin and farmer
    
    if (userData.role === 'group') {
      // Group managers should change password on first login
      firstLogin = true;
    }
    
    // Allow explicit override
    if (userData.hasOwnProperty('firstLogin')) {
      firstLogin = userData.firstLogin;
    }
    
    // Create new user with updated header structure: 
    // ['UserID', 'Username', 'Password', 'Role', 'GroupID', 'Status', 'FirstLogin', 'LastLogin', 'Created']
    const newUser = [
      generateId(),                    // UserID
      "'" + userData.username,         // Username - บังคับให้เป็น text เพื่อคงเลข 0 หน้า
      "'" + userData.password,         // Password - บังคับให้เป็น text เพื่อคงเลข 0 หน้า
      userData.role,                   // Role
      userData.groupId || '',          // GroupID
      'Active',                        // Status
      firstLogin ? 'TRUE' : 'FALSE',   // FirstLogin
      null,                            // LastLogin (empty for new users)
      new Date()                       // Created
    ];
    
    sheet.appendRow(newUser);
    
    Logger.log(`Created new user: ${userData.username} (role: ${userData.role}, firstLogin: ${firstLogin})`);
    
    return {
      success: true,
      message: 'สร้างบัญชีผู้ใช้สำเร็จ',
      userId: newUser[0],
      firstLogin: firstLogin
    };
    
  } catch (error) {
    Logger.log('Create user error: ' + error.toString());
    throw error;
  }
}

/**
 * Generate farmer username from phone number
 */
function generateFarmerUsername(phone) {
  // แปลงเป็น string และเก็บเลข 0 หน้าไว้
  const phoneStr = String(phone);
  const cleanPhone = phoneStr.replace(/[^\d]/g, '');
  
  // Use full phone number as username
  return cleanPhone;
}

/**
 * Generate farmer password from phone number
 */
function generateFarmerPassword(phone) {
  // แปลงเป็น string และเก็บเลข 0 หน้าไว้
  const phoneStr = String(phone);
  const cleanPhone = phoneStr.replace(/[^\d]/g, '');
  
  // Use phone number without first 3 digits (ตัดเลข 3 ตัวแรกออก)
  if (cleanPhone.length >= 3) {
    return cleanPhone.substring(3);
  }
  
  return cleanPhone;
}

/**
 * Get group data by ID
 */
function getGroupById(groupId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.GROUPS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === groupId) {
        return {
          groupId: row[0],           // GroupID
          groupCode: row[1],         // GroupCode  
          groupName: row[2],         // GroupName
          registrationDoc: row[3],   // RegistrationDoc
          gapCert: row[4],          // GAPCert
          status: row[5],           // Status
          created: row[6],          // Created
          updated: row[7],          // Updated
          mainFolderId: row[8],     // MainFolderId
          registrationFolderId: row[9], // RegistrationFolderId
          gapFolderId: row[10],     // GAPFolderId
          farmerDocsFolderId: row[11], // FarmerDocsFolderId
          productImagesFolderId: row[12], // ProductImagesFolderId
          reportsFolderId: row[13]  // ReportsFolderId
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Get group error:', error);
    return null;
  }
}


/**
 * Get farmer data by ID
 */
function getFarmerById(farmerId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.FARMERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === farmerId) {
        return {
          FarmerID: row[0],
          farmerId: row[0],
          groupId: row[1],
          plotNumber: row[2],
          idCard: row[3],
          fullName: row[4],
          address: row[5],
          area: row[6],
          phone: row[7],
          username: row[8],
          status: row[9],
          created: row[10]
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Get farmer by ID error:', error);
    return null;
  }
}

/**
 * Reset user password
 */
function resetUserPassword(username, newPassword) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[1] === username) {
        sheet.getRange(i + 1, 3).setValue(newPassword);
        return { success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ' };
      }
    }
    
    return { success: false, message: 'ไม่พบผู้ใช้นี้ในระบบ' };
    
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน' };
  }
}

/**
 * Deactivate user account
 */
function deactivateUser(username) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[1] === username) {
        sheet.getRange(i + 1, 6).setValue('inactive');
        return { success: true, message: 'ปิดการใช้งานบัญชีสำเร็จ' };
      }
    }
    
    return { success: false, message: 'ไม่พบผู้ใช้นี้ในระบบ' };
    
  } catch (error) {
    console.error('Deactivate user error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการปิดการใช้งานบัญชี' };
  }
}

/**
 * Activate user account
 */
function activateUser(username) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[1] === username) {
        sheet.getRange(i + 1, 6).setValue('active');
        return { success: true, message: 'เปิดการใช้งานบัญชีสำเร็จ' };
      }
    }
    
    return { success: false, message: 'ไม่พบผู้ใช้นี้ในระบบ' };
    
  } catch (error) {
    console.error('Activate user error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการเปิดการใช้งานบัญชี' };
  }
}

/**
 * Get all users (for admin)
 */
function getAllUsers() {
  try {
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    const users = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      users.push({
        id: row[0],
        username: row[1],
        role: row[3],
        groupId: row[4],
        status: row[5],
        created: row[6],
        lastLogin: row[7]
      });
    }
    
    return { success: true, users: users };
    
  } catch (error) {
    console.error('Get all users error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' };
  }
}

/**
 * Validate session and user authentication
 */
function handleValidateSession(params) {
  try {
    const { username, sessionId, timestamp } = params;
    
    if (!username) {
      return { success: false, message: 'ไม่พบข้อมูลผู้ใช้' };
    }
    
    // Validate user exists and is active
    const user = validateUser(username);
    if (!user) {
      return { success: false, message: 'ไม่พบผู้ใช้หรือบัญชีถูกปิดใช้งาน' };
    }
    
    // Check session validity (optional - can be enhanced with actual session storage)
    const sessionAge = timestamp ? Date.now() - new Date(timestamp).getTime() : 0;
    const maxSessionAge = 8 * 60 * 60 * 1000; // 8 hours
    
    if (sessionAge > maxSessionAge) {
      return { 
        success: false, 
        message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
        expired: true 
      };
    }
    
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        groupId: user.groupId
      },
      message: 'เซสชันถูกต้อง'
    };
    
  } catch (error) {
    console.error('Session validation error:', error);
    return { 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการตรวจสอบเซสชัน' 
    };
  }
}

/**
 * Enhanced permission checking with session validation
 */
function checkPermissionWithSession(username, requiredRole, targetGroupId = null, sessionData = null) {
  try {
    // First validate session if provided
    if (sessionData) {
      const sessionValidation = handleValidateSession({
        username: username,
        sessionId: sessionData.sessionId,
        timestamp: sessionData.timestamp
      });
      
      if (!sessionValidation.success) {
        return { 
          hasPermission: false, 
          message: sessionValidation.message,
          expired: sessionValidation.expired 
        };
      }
    }
    
    // Then check regular permissions
    const user = validateUser(username);
    if (!user) {
      return { hasPermission: false, message: 'ไม่พบผู้ใช้หรือไม่มีสิทธิ์เข้าถึง' };
    }
    
    // Admin has access to everything
    if (user.role === 'admin') {
      return { hasPermission: true, user: user };
    }
    
    // Check role requirement
    if (requiredRole && user.role !== requiredRole) {
      return { hasPermission: false, message: 'ไม่มีสิทธิ์เข้าถึงฟังก์ชันนี้' };
    }
    
    // Group manager can only access their own group
    if (user.role === 'group' && targetGroupId && user.groupId !== targetGroupId) {
      return { hasPermission: false, message: 'สามารถเข้าถึงได้เฉพาะกลุ่มของตนเอง' };
    }
    
    return { hasPermission: true, user: user };
    
  } catch (error) {
    console.error('Permission check error:', error);
    return { hasPermission: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' };
  }
}

/**
 * Check if user has permission for action (backward compatibility)
 */
function checkPermission(username, requiredRole, targetGroupId = null) {
  return checkPermissionWithSession(username, requiredRole, targetGroupId, null);
}

/**
 * Rate limiting for API calls (basic implementation)
 */
function checkRateLimit(username, action) {
  try {
    const now = Date.now();
    const rateLimitKey = `rate_limit_${username}_${action}`;
    
    // Get PropertiesService for temporary storage
    const properties = PropertiesService.getScriptProperties();
    const lastCallStr = properties.getProperty(rateLimitKey);
    
    if (lastCallStr) {
      const lastCall = parseInt(lastCallStr);
      const timeDiff = now - lastCall;
      
      // Different limits for different actions
      const limits = {
        'login': 1000,           // 1 second between login attempts
        'upload': 5000,          // 5 seconds between uploads
        'search': 500,           // 0.5 seconds between searches
        'default': 200           // 0.2 seconds for other actions
      };
      
      const limit = limits[action] || limits['default'];
      
      if (timeDiff < limit) {
        return {
          allowed: false,
          message: 'การเรียกใช้งานถี่เกินไป กรุณารอสักครู่',
          retryAfter: Math.ceil((limit - timeDiff) / 1000)
        };
      }
    }
    
    // Update last call time
    properties.setProperty(rateLimitKey, now.toString());
    
    return { allowed: true };
    
  } catch (error) {
    console.error('Rate limit check error:', error);
    // If rate limiting fails, allow the request
    return { allowed: true };
  }
}