/**
 * ระบบสอบย้อนกลับผักอุดร - Group & Farmer Functions
 * ===============================================
 */

/**
 * GROUP MANAGEMENT FUNCTIONS
 */

/**
 * Get group data (Group Manager access)
 */
function handleGetGroupData(params) {
  try {
    console.log('🔥 handleGetGroupData called with params:', params);
    
    const groupId = params.groupId;
    console.log('📊 Received groupId:', groupId, 'type:', typeof groupId);
    
    if (!groupId) {
      console.log('❌ No groupId provided');
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม - ไม่มี groupId' };
    }
    
    console.log('🔍 Calling getGroupById with:', groupId);
    const groupData = getGroupById(groupId);
    console.log('📦 getGroupById result:', groupData);
    
    if (!groupData) {
      console.log('❌ getGroupById returned null/undefined');
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม - ไม่มีข้อมูลในฐานข้อมูล' };
    }
    
    console.log('📈 Getting group statistics for groupId:', groupId);
    // Get group statistics with error handling
    let stats;
    try {
      stats = getGroupStatistics(groupId);
      console.log('📊 Group statistics result:', stats);
    } catch (statsError) {
      console.error('❌ Error getting group statistics:', statsError);
      // Provide fallback stats
      stats = {
        totalFarmers: 0,
        totalQRCodes: 0,
        totalSearchCodes: 0
      };
      console.log('📊 Using fallback stats:', stats);
    }
    
    const result = {
      success: true,
      message: 'ดึงข้อมูลกลุ่มสำเร็จ',
      data: {
        ...groupData,
        statistics: stats
      }
    };
    
    console.log('✅ handleGetGroupData returning:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Get group data error:', error);
    console.error('❌ Error stack:', error.stack);
    return { 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่ม: ' + error.message,
      error: error.toString()
    };
  }
}

/**
 * Update group profile (Group Manager access)
 */
function handleUpdateGroupProfile(params) {
  try {
    const groupId = params.groupId;
    
    console.log('=== DEBUG handleUpdateGroupProfile ===');
    console.log('Received params:', JSON.stringify(params));
    console.log('Looking for groupId:', groupId, typeof groupId);
    
    if (!groupId) {
      console.log('ERROR: No groupId provided');
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม - ไม่ได้รับ groupId' };
    }
    
    // ตรวจสอบการเชื่อมต่อ Google Sheets
    let sheet;
    try {
      sheet = getSheet(CONFIG.SHEETS.GROUPS);
      console.log('Successfully connected to Groups sheet');
    } catch (sheetError) {
      console.error('Error connecting to Groups sheet:', sheetError);
      return { success: false, message: 'ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้' };
    }
    
    let data;
    try {
      data = sheet.getDataRange().getValues();
      console.log('Successfully retrieved sheet data');
    } catch (dataError) {
      console.error('Error retrieving sheet data:', dataError);
      return { success: false, message: 'ไม่สามารถอ่านข้อมูลจากฐานข้อมูลได้' };
    }
    
    console.log('Groups sheet data:', data);
    console.log('Total rows in groups sheet:', data.length);
    
    // ตรวจสอบถ้า sheet ว่าง (ไม่น่าจะเกิดขึ้นเพราะมีข้อมูลแล้ว)
    if (data.length <= 1) {
      console.log('Groups sheet is empty - this should not happen as groups already exist');
      return { success: false, message: 'ไม่พบข้อมูลกลุ่มในระบบ กรุณาติดต่อผู้ดูแลระบบ' };
    }
    
    for (let i = 1; i < data.length; i++) {
      console.log(`Checking row ${i}: data[${i}][0] = "${data[i][0]}" (type: ${typeof data[i][0]}) vs groupId "${groupId}" (type: ${typeof groupId})`);
      
      // ตรวจสอบแบบหลากหลายรูปแบบ
      const currentGroupId = data[i][0];
      const match = (currentGroupId === groupId) || 
                   (currentGroupId?.toString() === groupId?.toString()) ||
                   (String(currentGroupId) === String(groupId));
      
      console.log(`Match result for row ${i}: ${match}`);
      
      if (match) {
        // Update allowed fields
        if (params.groupName) {
          sheet.getRange(i + 1, 3).setValue(params.groupName); // GroupName
        }
        if (params.registrationDoc) {
          sheet.getRange(i + 1, 4).setValue(params.registrationDoc); // RegistrationDoc
        }
        if (params.gapCert) {
          sheet.getRange(i + 1, 5).setValue(params.gapCert); // GAPCert
        }
        
        // Update timestamp
        sheet.getRange(i + 1, 8).setValue(new Date().toISOString()); // Updated column
        
        console.log(`Updated group profile for groupId: ${groupId}`);
        return { success: true, message: 'อัพเดทข้อมูลกลุ่มสำเร็จ' };
      }
    }
    
    console.log(`Group with ID "${groupId}" not found in ${data.length - 1} existing rows.`);
    console.log('Available groups in sheet:');
    for (let i = 1; i < data.length; i++) {
      console.log(`Row ${i}: GroupID="${data[i][0]}", GroupCode="${data[i][1]}", GroupName="${data[i][2]}"`);
    }
    
    return { success: false, message: `ไม่พบกลุ่มที่ต้องการอัพเดท (GroupID: ${groupId})` };
    
  } catch (error) {
    console.error('Update group profile error:', error);
    console.error('Error stack:', error.stack);
    
    return { 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: ' + error.message,
      error: error.toString()
    };
  }
}

/**
 * Get all farmers in group (Group Manager access) - OPTIMIZED VERSION
 */
function handleGetGroupFarmers(params) {
  try {
    const groupId = params.groupId;
    
    if (!groupId) {
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม' };
    }
    
    // Check cache first (2-minute TTL for farmer data)
    const cache = CacheService.getScriptCache();
    const cacheKey = `groupFarmers_${groupId}_v1`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log('🎯 Cache hit for getGroupFarmers, groupId:', groupId);
      return JSON.parse(cached);
    }
    
    console.log('🔄 Cache miss, fetching farmers for groupId:', groupId);
    
    // OPTIMIZATION 1: Load all needed data at once
    const sheetsData = batchLoadFarmerSheets();
    const farmers = [];
    
    if (!sheetsData.farmers || sheetsData.farmers.length === 0) {
      const result = {
        success: true,
        message: 'ดึงข้อมูลเกษตรกรในกลุ่มสำเร็จ',
        farmers: [],
        totalFarmers: 0
      };
      cache.put(cacheKey, JSON.stringify(result), 120); // 2 minutes
      return result;
    }
    
    // OPTIMIZATION 2: Create lookup maps for efficient checking
    const qrCodeMap = createQRCodeLookupMap(sheetsData.qrCodes);
    const dataCompletenessMap = createDataCompletenessLookupMap(sheetsData, groupId);
    
    // OPTIMIZATION 3: Process farmers efficiently
    sheetsData.farmers.forEach(row => {
      if (row[1] === groupId) { // Filter by groupId
        const farmerId = row[0];
        farmers.push({
          farmerId: farmerId,
          groupId: row[1],
          plotNumber: row[2],
          idCard: row[3],
          fullName: row[4],
          address: row[5],
          area: row[6],
          phone: row[7],
          username: row[8],
          status: row[9],
          created: row[10],
          hasQRCode: qrCodeMap.has(farmerId),
          dataCompleteness: dataCompletenessMap.get(farmerId) || 0
        });
      }
    });
    
    const result = {
      success: true,
      message: 'ดึงข้อมูลเกษตรกรในกลุ่มสำเร็จ',
      farmers: farmers,
      totalFarmers: farmers.length
    };
    
    // Cache the result for 2 minutes
    try {
      cache.put(cacheKey, JSON.stringify(result), 120);
      console.log(`✅ Cached farmers result: ${farmers.length} farmers for group ${groupId}`);
    } catch (cacheError) {
      console.warn('Cache storage failed:', cacheError);
    }
    
    return result;
    
  } catch (error) {
    console.error('Get group farmers error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเกษตรกร' };
  }
}

/**
 * Add new farmer to group (Group Manager access)
 */
function handleAddFarmer(params) {
  try {
    console.log('🔥 handleAddFarmer called with params:', params);
    
    const groupCode = params.groupCode; // ใช้ GroupCode แทน groupId
    const phone = params.phone;
    const username = params.username;
    const password = params.password;
    const created = params.created;
    
    console.log('📊 Extracted values:', {
      groupCode, phone, username, password, created
    });
    
    if (!groupCode || !phone || !username || !password) {
      console.log('❌ Missing required fields:', {
        hasGroupCode: !!groupCode,
        hasPhone: !!phone,
        hasUsername: !!username,
        hasPassword: !!password
      });
      return { success: false, message: 'กรุณาใส่ข้อมูลให้ครบถ้วน' };
    }
    
    // Validate phone number
    console.log('📱 Validating phone number:', phone);
    try {
      const phoneValid = validatePhoneNumber(phone);
      console.log('📱 Phone validation result:', phoneValid);
      if (!phoneValid) {
        console.log('❌ Phone validation failed for:', phone);
        return { success: false, message: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง' };
      }
    } catch (phoneValidationError) {
      console.error('❌ Phone validation error:', phoneValidationError);
      return { success: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบเบอร์โทรศัพท์: ' + phoneValidationError.message };
    }
    
    // Check if phone number already exists
    console.log('📱 Checking if phone exists:', phone);
    try {
      const phoneExists = phoneNumberExists(phone);
      console.log('📱 Phone exists check result:', phoneExists);
      if (phoneExists) {
        console.log('❌ Phone already exists:', phone);
        return { success: false, message: 'เบอร์โทรศัพท์นี้มีอยู่ในระบบแล้ว' };
      }
    } catch (phoneExistsError) {
      console.error('❌ Phone exists check error:', phoneExistsError);
      return { success: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบเบอร์โทรศัพท์: ' + phoneExistsError.message };
    }
    
    // Generate farmer ID
    const farmerId = generateId();
    
    // ดึง GroupID จาก GroupCode
    console.log('🔍 Looking up GroupID for GroupCode:', groupCode);
    const groupSheet = getSheet(CONFIG.SHEETS.GROUPS);
    const groupData = groupSheet.getDataRange().getValues();
    let groupId = null;
    
    console.log('📋 Groups data length:', groupData.length);
    console.log('📋 Groups headers:', groupData[0]);
    
    for (let i = 1; i < groupData.length; i++) {
      const currentGroupCode = String(groupData[i][1] || '').replace(/^'/, ''); // Clean format
      const targetGroupCode = String(groupCode || '').replace(/^'/, ''); // Clean format
      
      console.log(`🔄 Row ${i}: GroupCode="${currentGroupCode}" vs target="${targetGroupCode}"`);
      
      if (currentGroupCode === targetGroupCode) { // เปรียบเทียบกับ GroupCode (column B)
        groupId = groupData[i][0]; // เอา GroupID (column A)
        console.log(`✅ Found matching group: GroupID="${groupId}" for GroupCode="${groupCode}"`);
        break;
      }
    }
    
    if (!groupId) {
      console.log('❌ No group found for GroupCode:', groupCode);
      console.log('📊 Available groups:');
      for (let i = 1; i < Math.min(groupData.length, 6); i++) {
        console.log(`  - Row ${i}: GroupID="${groupData[i][0]}", GroupCode="${groupData[i][1]}"`);
      }
      return { success: false, message: 'ไม่พบกลุ่มที่ตรงกับรหัสกลุ่ม: ' + groupCode };
    }
    
    // Save farmer data (ลดข้อมูลลงเหลือแค่ที่จำเป็น)
    // Skip folder creation during farmer addition for performance (lazy creation)
    console.log('Skipping farmer folder creation for performance optimization');
    const farmerFolderResult = { folderId: '' }; // Empty FolderID for lazy creation
    
    const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
    const farmerData = [
      farmerId,
      groupId,
      '', // plotNumber (ว่างไว้)
      '', // idCard (ว่างไว้)
      '', // fullName (ว่างไว้)
      '', // address (ว่างไว้)
      '', // area (ว่างไว้)
      "'" + phone, // บังคับให้เป็ text เพื่อคงเลข 0 หน้าเบอร์โทร
      "'" + username, // บังคับให้เป็ text เพื่อคงเลข 0 หน้า Username
      'Active', // status
      created,
      '', // plotImages (ว่างไว้)
      '', // productImages (ว่างไว้)
      '', // activityImages (ว่างไว้)
      '', // certificationDocs (ว่างไว้)
      '', // plantingMethod (ว่างไว้)
      '', // plantingMethodImages (ว่างไว้)
      '', // careRecords (ว่างไว้)
      '', // careRecordImages (ว่างไว้)
      farmerFolderResult.folderId // folderID
    ];
    
    farmersSheet.appendRow(farmerData);
    
    // Create farmer user account
    console.log('👤 Creating user account for farmer:', { username, role: 'farmer', groupId });
    
    let userResult;
    try {
      console.log('👤 Calling createUserAccount with params:', {
        username: username,
        password: password,
        role: 'farmer',
        groupId: groupId
      });
      userResult = createUserAccount({
        username: username,
        password: password,
        role: 'farmer',
        groupId: groupId
      });
      console.log('👤 User account creation result:', userResult);
    } catch (userError) {
      console.error('❌ User account creation error:', userError);
      console.error('❌ User error type:', typeof userError);
      console.error('❌ User error message:', userError.message);
      console.error('❌ User error stack:', userError.stack);
      // Rollback farmer creation if user creation fails
      try {
        console.log('🔄 Rolling back farmer creation for farmerId:', farmerId);
        deleteFarmerRow(farmerId);
      } catch (rollbackError) {
        console.error('❌ Rollback error:', rollbackError);
      }
      return { 
        success: false, 
        message: 'เกิดข้อผิดพลาดในการสร้างบัญชีเกษตรกร: ' + userError.message 
      };
    }
    
    if (!userResult.success) {
      console.error('User account creation failed:', userResult);
      // Rollback farmer creation if user creation fails
      deleteFarmerRow(farmerId);
      return { 
        success: false, 
        message: 'เกิดข้อผิดพลาดในการสร้างบัญชีเกษตรกร: ' + (userResult.message || 'Unknown error')
      };
    }
    
    return {
      success: true,
      message: 'เพิ่มเกษตรกรสำเร็จ',
      farmer: {
        farmerId: farmerId,
        phone: phone,
        username: username,
        groupCode: groupCode,
        created: created
      }
    };
    
  } catch (error) {
    console.error('❌ Add farmer error:', error);
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    return { 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการเพิ่มเกษตรกร: ' + error.message,
      errorType: error.name,
      errorDetails: error.toString()
    };
  }
}

/**
 * Create farmer folder structure in Google Drive
 */
function createFarmerFolders(groupId, farmerId, phone) {
  try {
    console.log(`=== Creating farmer folders ===`);
    console.log(`GroupID: ${groupId}, FarmerID: ${farmerId}, Phone: ${phone}`);
    
    // Get group data with folder information
    const groupData = getGroupByIdWithFolders(groupId);
    console.log('Group data:', groupData);
    
    if (!groupData) {
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม' };
    }
    
    if (!groupData.farmerDocsFolderId) {
      return { success: false, message: 'กลุ่มยังไม่มี FarmerDocs folder - กรุณาให้ Admin สร้างโฟลเดอร์กลุ่มก่อน' };
    }
    
    const farmersFolder = DriveApp.getFolderById(groupData.farmerDocsFolderId);
    
    // Create main folder for this farmer (ใช้ farmerId เพื่อความเป็นเอกลักษณ์)
    const farmerFolderName = `เกษตรกร_${farmerId}_${phone}`;
    const farmerFolder = farmersFolder.createFolder(farmerFolderName);
    
    // Create subfolders for different document types
    const subfolders = [
      'รูปแปลงปลูก',           // Plot Images
      'รูปสินค้า',              // Product Images  
      'รูปกิจกรรมการปลูก',      // Activity Images
      'เอกสารการรับรอง',       // Certification Documents
      'วิธีการปลูก',            // Planting Method Images
      'การบำรุงรักษา'          // Care Record Images
    ];
    
    const subfolderIds = {};
    subfolders.forEach(folderName => {
      const subfolder = farmerFolder.createFolder(folderName);
      subfolderIds[folderName] = subfolder.getId();
    });
    
    Logger.log(`Created farmer folders for ${phone}: ${farmerFolder.getId()}`);
    
    return {
      success: true,
      folderId: farmerFolder.getId(),
      subfolders: subfolderIds,
      folderUrl: farmerFolder.getUrl()
    };
    
  } catch (error) {
    Logger.log('Create farmer folders error: ' + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * Helper function to ensure farmer folder exists and update FolderID
 * Creates folder structure when needed (lazy creation)
 */
function ensureFarmerFolderExists(farmerId, groupId, phone) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.FARMERS);
    const data = sheet.getDataRange().getValues();
    
    // Find farmer record
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === farmerId) {
        const existingFolderId = data[i][19]; // Column T (FolderID) - Fixed column index
        
        // If folder already exists, return it
        if (existingFolderId && existingFolderId.trim() !== '') {
          try {
            DriveApp.getFolderById(existingFolderId);
            return { success: true, folderId: existingFolderId };
          } catch (e) {
            console.log('Existing folder not found, will create new one');
          }
        }
        
        // Create folder structure if not exists
        console.log('Creating farmer folders for:', farmerId);
        const farmerFolderResult = createFarmerFolders(groupId, farmerId, phone);
        
        if (farmerFolderResult.success) {
          // Update FolderID in database
          sheet.getRange(i + 1, 20).setValue(farmerFolderResult.folderId); // Column T (FolderID) - Fixed column index
          console.log('Updated FolderID for farmer:', farmerId, 'FolderID:', farmerFolderResult.folderId);
          
          return { 
            success: true, 
            folderId: farmerFolderResult.folderId,
            message: 'สร้างโฟลเดอร์เกษตรกรเรียบร้อยแล้ว'
          };
        } else {
          return { 
            success: false, 
            message: 'ไม่สามารถสร้างโฟลเดอร์เกษตรกรได้: ' + farmerFolderResult.message 
          };
        }
      }
    }
    
    return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    
  } catch (error) {
    console.error('Error in ensureFarmerFolderExists:', error);
    return { 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการสร้างโฟลเดอร์: ' + error.toString() 
    };
  }
}

/**
 * Update farmer data (Group Manager access)
 */
function handleUpdateFarmer(params) {
  try {
    const farmerId = params.farmerId;
    
    if (!farmerId) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    const sheet = getSheet(CONFIG.SHEETS.FARMERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === farmerId) {
        // Update allowed fields
        if (params.fullName) {
          sheet.getRange(i + 1, 5).setValue(params.fullName);
        }
        if (params.idCard) {
          sheet.getRange(i + 1, 4).setValue(params.idCard);
        }
        if (params.address) {
          sheet.getRange(i + 1, 6).setValue(params.address);
        }
        if (params.area) {
          sheet.getRange(i + 1, 7).setValue(params.area);
        }
        if (params.phone) {
          // Validate new phone number
          if (!validatePhoneNumber(params.phone)) {
            return { success: false, message: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง' };
          }
          
          // Check if new phone number already exists (except current farmer)
          if (phoneNumberExistsExcept(params.phone, farmerId)) {
            return { success: false, message: 'เบอร์โทรศัพท์นี้มีอยู่ในระบบแล้ว' };
          }
          
          sheet.getRange(i + 1, 8).setValue("'" + params.phone); // บังคับให้เป็น text
          
          // Update username if phone changed
          const newUsername = generateFarmerUsername(params.phone);
          sheet.getRange(i + 1, 10).setValue(newUsername);
          
          // Update user account
          const oldUsername = data[i][9];
          updateUserUsername(oldUsername, newUsername);
        }
        
        return { success: true, message: 'อัพเดทข้อมูลเกษตรกรสำเร็จ' };
      }
    }
    
    return { success: false, message: 'ไม่พบเกษตรกรที่ต้องการอัพเดท' };
    
  } catch (error) {
    console.error('Update farmer error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูลเกษตรกร' };
  }
}

/**
 * Delete farmer (Group Manager access)
 */
function handleDeleteFarmer(params) {
  try {
    const farmerId = params.farmerId;
    
    if (!farmerId) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    // Get farmer data before deletion
    const farmerData = getFarmerById(farmerId);
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    // Deactivate farmer user account
    if (farmerData.username) {
      deactivateUser(farmerData.username);
    }
    
    // Delete related data
    deleteFarmerAllData(farmerId);
    
    // Delete farmer
    const deleteResult = deleteFarmerRow(farmerId);
    if (!deleteResult) {
      return { success: false, message: 'เกิดข้อผิดพลาดในการลบเกษตรกร' };
    }
    
    return { success: true, message: 'ลบเกษตรกรสำเร็จ' };
    
  } catch (error) {
    console.error('Delete farmer error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบเกษตรกร' };
  }
}

/**
 * FARMER DATA FUNCTIONS
 */

/**
 * Get farmer data (Farmer access)
 */
function handleGetFarmerData(params) {
  try {
    const farmerId = params.farmerId;
    
    if (!farmerId) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    const farmerData = getFarmerById(farmerId);
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    // Get group data
    const groupData = getGroupById(farmerData.groupId);
    
    // Get all sections data
    const sectionsData = getAllFarmerSectionsData(farmerId);
    
    return {
      success: true,
      message: 'ดึงข้อมูลเกษตรกรสำเร็จ',
      farmer: {
        ...farmerData,
        groupName: groupData ? groupData.groupName : 'ไม่พบข้อมูล',
        groupCode: groupData ? groupData.groupCode : ''
      },
      sections: sectionsData,
      dataCompleteness: calculateDataCompleteness(farmerId)
    };
    
  } catch (error) {
    console.error('Get farmer data error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเกษตรกร' };
  }
}

/**
 * Save farmer section data (Farmer access)
 */
function handleSaveFarmerSection(params) {
  try {
    const farmerId = params.farmerId;
    const sectionNumber = parseInt(params.sectionNumber);
    const sectionData = JSON.parse(params.sectionData);
    
    if (!farmerId || !sectionNumber || !sectionData) {
      return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };
    }
    
    let result;
    
    switch (sectionNumber) {
      case 2:
        result = saveFarmerProductionData(farmerId, sectionData);
        break;
      case 3:
        result = saveFarmerHarvestData(farmerId, sectionData);
        break;
      case 4:
        result = saveFarmerTransportData(farmerId, sectionData);
        break;
      case 6:
        result = saveFarmerAdditionalInfo(farmerId, sectionData);
        break;
      default:
        return { success: false, message: 'หมายเลขส่วนไม่ถูกต้อง' };
    }
    
    if (result.success) {
      // Check if all required sections are complete for QR generation
      checkAndGenerateQRCode(farmerId);
    }
    
    return result;
    
  } catch (error) {
    console.error('Save farmer section error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

/**
 * HELPER FUNCTIONS
 */

/**
 * Generate plot number for farmer
 */
function generatePlotNumber(groupId) {
  try {
    // Get group data to determine group code
    const groupData = getGroupById(groupId);
    if (!groupData) {
      return generateId(10); // Fallback
    }
    
    // Count existing farmers in group
    const farmersCount = countGroupFarmers(groupId);
    
    // Generate 10-digit plot number: GGXXXXXXXX (GG = group code)
    const baseNumber = (farmersCount + 1).toString().padStart(8, '0');
    return groupData.groupCode + baseNumber;
    
  } catch (error) {
    console.error('Generate plot number error:', error);
    return generateId(10);
  }
}

/**
 * Validate phone number
 */
function validatePhoneNumber(phone) {
  // แปลงเป็น string และเก็บเลข 0 หน้าไว้
  const phoneStr = String(phone);
  const cleanPhone = phoneStr.replace(/[^\d]/g, '');
  // ต้องขึ้นต้นด้วย 0 และตามด้วย 8 หรือ 9 แล้วตามด้วยตัวเลข 8 หลัก
  return /^0[89][0-9]{8}$/.test(cleanPhone);
}

/**
 * Check if phone number exists
 */
function phoneNumberExists(phone) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.FARMERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][7] === phone) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Phone number exists check error:', error);
    return false;
  }
}

/**
 * Check if phone number exists except for specific farmer
 */
function phoneNumberExistsExcept(phone, farmerId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.FARMERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][7] === phone && data[i][0] !== farmerId) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Phone number exists except check error:', error);
    return false;
  }
}

/**
 * Update user username
 */
function updateUserUsername(oldUsername, newUsername) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === oldUsername) {
        sheet.getRange(i + 1, 2).setValue(newUsername);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Update user username error:', error);
    return false;
  }
}

/**
 * Delete farmer row
 */
function deleteFarmerRow(farmerId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.FARMERS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === farmerId) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Delete farmer row error:', error);
    return false;
  }
}

/**
 * Delete all farmer data from all sheets
 */
function deleteFarmerAllData(farmerId) {
  try {
    const sheetsToClean = [
      CONFIG.SHEETS.PRODUCTION_DATA,
      CONFIG.SHEETS.HARVEST_DATA,
      CONFIG.SHEETS.TRANSPORT_DATA,
      CONFIG.SHEETS.DOCUMENTS,
      CONFIG.SHEETS.ADDITIONAL_INFO,
      CONFIG.SHEETS.QR_CODES,
      CONFIG.SHEETS.SEARCH_CODES
    ];
    
    sheetsToClean.forEach(sheetName => {
      deleteRowsByFarmerId(sheetName, farmerId);
    });
    
  } catch (error) {
    console.error('Delete farmer all data error:', error);
  }
}

/**
 * Delete rows by farmer ID
 */
function deleteRowsByFarmerId(sheetName, farmerId) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    
    // Delete from bottom to top to avoid index issues
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === farmerId) {
        sheet.deleteRow(i + 1);
      }
    }
    
  } catch (error) {
    console.error(`Delete rows by farmer ID error (${sheetName}):`, error);
  }
}

/**
 * OPTIMIZATION HELPER: Batch load all sheets needed for farmer operations
 */
function batchLoadFarmerSheets() {
  const sheetsData = {};
  
  try {
    // Load Farmers sheet
    const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
    const farmersLastRow = farmersSheet.getLastRow();
    sheetsData.farmers = farmersLastRow > 1 ? 
      farmersSheet.getRange(2, 1, farmersLastRow - 1, 11).getValues() : [];
    
    // Load QR Codes sheet
    const qrSheet = getSheet(CONFIG.SHEETS.QR_CODES);
    const qrLastRow = qrSheet.getLastRow();
    sheetsData.qrCodes = qrLastRow > 1 ? 
      qrSheet.getRange(2, 1, qrLastRow - 1, 6).getValues() : []; // 6 columns: QRID to Created
    
    // Load data sheets for completeness calculation
    const dataSheets = [
      CONFIG.SHEETS.PRODUCTION_DATA,
      CONFIG.SHEETS.HARVEST_DATA,
      CONFIG.SHEETS.TRANSPORT_DATA,
      CONFIG.SHEETS.ADDITIONAL_INFO
    ];
    
    dataSheets.forEach(sheetName => {
      try {
        const sheet = getSheet(sheetName);
        const lastRow = sheet.getLastRow();
        sheetsData[sheetName] = lastRow > 1 ? 
          sheet.getRange(2, 1, lastRow - 1, 3).getValues() : []; // Only need first 3 columns
      } catch (error) {
        console.warn(`Could not load ${sheetName}:`, error);
        sheetsData[sheetName] = [];
      }
    });
    
    console.log(`📊 Batch loaded: ${sheetsData.farmers.length} farmers, ${sheetsData.qrCodes.length} QR codes`);
    
  } catch (error) {
    console.error('Batch load farmer sheets error:', error);
    sheetsData.farmers = [];
    sheetsData.qrCodes = [];
  }
  
  return sheetsData;
}

/**
 * OPTIMIZATION HELPER: Create QR Code lookup map
 */
function createQRCodeLookupMap(qrCodesData) {
  const qrMap = new Set();
  
  if (!qrCodesData || qrCodesData.length === 0) return qrMap;
  
  qrCodesData.forEach(row => {
    const farmerId = row[4]; // FarmerID is in column E (index 4) 
    const status = row[5];   // Status is in column F (index 5)
    
    if (farmerId && status === 'active') {
      qrMap.add(farmerId);
    }
  });
  
  console.log(`🎯 QR Code map created for ${qrMap.size} farmers`);
  return qrMap;
}

/**
 * OPTIMIZATION HELPER: Create data completeness lookup map
 */
function createDataCompletenessLookupMap(sheetsData, groupId) {
  const completenessMap = new Map();
  
  // Get all farmers in the group
  const groupFarmers = new Set();
  if (sheetsData.farmers) {
    sheetsData.farmers.forEach(row => {
      if (row[1] === groupId) { // groupId is in column B (index 1)
        const farmerId = row[0]; // farmerId is in column A (index 0)
        groupFarmers.add(farmerId);
        completenessMap.set(farmerId, 0); // Initialize with 0%
      }
    });
  }
  
  // Count data sections for each farmer
  const dataSheets = [
    CONFIG.SHEETS.PRODUCTION_DATA,
    CONFIG.SHEETS.HARVEST_DATA,
    CONFIG.SHEETS.TRANSPORT_DATA,
    CONFIG.SHEETS.ADDITIONAL_INFO
  ];
  
  const farmerSectionCount = {};
  
  dataSheets.forEach(sheetName => {
    const sheetData = sheetsData[sheetName];
    if (!sheetData) return;
    
    const farmersWithData = new Set();
    sheetData.forEach(row => {
      const farmerId = row[1]; // farmerId is typically in column B (index 1) for data sheets
      if (groupFarmers.has(farmerId)) {
        farmersWithData.add(farmerId);
      }
    });
    
    // Increment section count for farmers who have data
    farmersWithData.forEach(farmerId => {
      farmerSectionCount[farmerId] = (farmerSectionCount[farmerId] || 0) + 1;
    });
  });
  
  // Calculate completion percentage
  Object.entries(farmerSectionCount).forEach(([farmerId, sectionCount]) => {
    const completionPercentage = Math.round((sectionCount / dataSheets.length) * 100);
    completenessMap.set(farmerId, completionPercentage);
  });
  
  console.log(`📈 Data completeness calculated for ${completenessMap.size} farmers`);
  return completenessMap;
}

/**
 * Check if farmer has QR Code (LEGACY - kept for backward compatibility)
 */
function hasQRCode(farmerId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.QR_CODES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][4] === farmerId && data[i][5] === 'active') { // Updated column indices
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Has QR Code check error:', error);
    return false;
  }
}

/**
 * Calculate data completeness percentage
 */
function calculateDataCompleteness(farmerId) {
  try {
    const sections = [
      CONFIG.SHEETS.PRODUCTION_DATA,
      CONFIG.SHEETS.HARVEST_DATA,
      CONFIG.SHEETS.TRANSPORT_DATA,
      CONFIG.SHEETS.ADDITIONAL_INFO
    ];
    
    let completedSections = 0;
    
    sections.forEach(sheetName => {
      if (farmerHasDataInSheet(sheetName, farmerId)) {
        completedSections++;
      }
    });
    
    return Math.round((completedSections / sections.length) * 100);
  } catch (error) {
    console.error('Calculate data completeness error:', error);
    return 0;
  }
}

/**
 * Check if farmer has data in sheet
 */
function farmerHasDataInSheet(sheetName, farmerId) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === farmerId) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Farmer has data in sheet check error:', error);
    return false;
  }
}

/**
 * Get all farmer sections data
 */
function getAllFarmerSectionsData(farmerId) {
  try {
    return {
      section2: getFarmerSectionData(CONFIG.SHEETS.PRODUCTION_DATA, farmerId),
      section3: getFarmerSectionData(CONFIG.SHEETS.HARVEST_DATA, farmerId),
      section4: getFarmerSectionData(CONFIG.SHEETS.TRANSPORT_DATA, farmerId),
      section5: getFarmerDocuments(farmerId),
      section6: getFarmerSectionData(CONFIG.SHEETS.ADDITIONAL_INFO, farmerId)
    };
  } catch (error) {
    console.error('Get all farmer sections data error:', error);
    return {};
  }
}

/**
 * Check and generate QR Code if data is complete
 */
function checkAndGenerateQRCode(farmerId) {
  try {
    // Check if farmer already has QR Code
    if (hasQRCode(farmerId)) {
      return;
    }
    
    // Check if required sections are complete (sections 2 and 3)
    const hasSection2 = farmerHasDataInSheet(CONFIG.SHEETS.PRODUCTION_DATA, farmerId);
    const hasSection3 = farmerHasDataInSheet(CONFIG.SHEETS.HARVEST_DATA, farmerId);
    
    if (hasSection2 && hasSection3) {
      // Generate QR Code
      handleGenerateQRCode({ farmerId: farmerId });
    }
    
  } catch (error) {
    console.error('Check and generate QR Code error:', error);
  }
}

/**
 * NEW 6-SECTION DATA MANAGEMENT FUNCTIONS
 * =====================================
 */

/**
 * Save Part 1 (Farm/Farmer Information) - One time only
 */
function savePart1(data) {
  try {
    // Validate required fields
    const required = ['GroupCode', 'PlotNumber', 'FullName', 'Address', 'Area', 'Phone'];
    for (const field of required) {
      if (!data[field]) {
        return { success: false, message: `ฟิลด์ ${field} จำเป็นต้องกรอก` };
      }
    }
    
    // Validate PlotNumber (17 digits)
    if (String(data.PlotNumber).length !== 17) {
      return { success: false, message: 'หมายเลขแปลงต้องเป็นตัวเลข 17 หลัก' };
    }
    
    // Validate IDCard (13 digits) if provided
    if (data.IDCard && String(data.IDCard).length !== 13) {
      return { success: false, message: 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก' };
    }
    
    // Validate phone
    if (!validatePhoneNumber(data.Phone)) {
      return { success: false, message: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง' };
    }
    
    // Save to Farmers sheet with text format
    const sheet = getSheet(CONFIG.SHEETS.FARMERS);
    const textRow = asTextRow([
      data.FarmerID,
      data.GroupID, 
      data.PlotNumber,
      data.IDCard || '',
      data.FullName,
      data.Address,
      data.Area,
      data.Phone,
      new Date().toISOString(),
      data.Username || '',
      'Active'
    ]);
    
    sheet.appendRow(textRow);
    
    // Generate and save QR Code
    const qrCode = data.GroupCode + '-' + data.PlotNumber;
    const qrResult = getOrCreateQrPng(qrCode, data.FarmerID, data.GroupID, data.Phone);
    
    if (qrResult.success) {
      // Save QR to QR_Codes sheet
      const qrSheet = getSheet(CONFIG.SHEETS.QR_CODES);
      const qrRow = asTextRow([
        generateId(),
        qrCode,
        data.FarmerID,
        qrResult.fileId,
        qrResult.publicUrl,
        qrResult.base64,
        new Date().toISOString(),
        'active'
      ]);
      qrSheet.appendRow(qrRow);
    }
    
    return { 
      success: true, 
      message: 'บันทึกข้อมูลส่วนที่ 1 สำเร็จ',
      qrCode: qrCode,
      qrData: qrResult
    };
    
  } catch (error) {
    console.error('Save Part 1 error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

/**
 * Create Production data (Section 2) - Multiple rounds
 */
function createProduction(data) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    const textRow = asTextRow([
      generateId(),
      data.FarmerID,
      data.SeedVariety || '',
      data.PlantingDate || '',
      data.WaterManagement || '',
      data.FertilizerType || '',
      data.PestControl || '',
      new Date().toISOString()
    ]);
    
    sheet.appendRow(textRow);
    
    return { success: true, message: 'บันทึกข้อมูลการผลิตสำเร็จ' };
  } catch (error) {
    console.error('Create Production error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลการผลิต' };
  }
}

/**
 * Create Harvest data (Section 3) - Multiple rounds
 */
function createHarvest(data) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.HARVEST_DATA);
    
    // Auto-generate LotCode from ShipDate
    const lotCode = data.ShipDate ? toBuddhistYMD(data.ShipDate) : '';
    
    const textRow = asTextRow([
      generateId(),
      data.FarmerID,
      data.HarvestDate || '',
      data.PackagingCompany || '',
      data.PackagingLocation || '',
      data.ResponsiblePerson || '',
      lotCode,
      data.ShipDate || '',
      data.Quantity || '',
      data.Unit || '',
      new Date().toISOString()
    ]);
    
    sheet.appendRow(textRow);
    
    return { 
      success: true, 
      message: 'บันทึกข้อมูลการเก็บเกี่ยวสำเร็จ',
      lotCode: lotCode
    };
  } catch (error) {
    console.error('Create Harvest error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลการเก็บเกี่ยว' };
  }
}

/**
 * Create Transport data (Section 4) - Multiple rounds
 */
function createTransport(data) {
  try {
    // Validate DistributorCode
    const validDistributors = ['001', '002', '003'];
    if (!validDistributors.includes(data.DistributorCode)) {
      return { success: false, message: 'รหัสผู้จำหน่ายไม่ถูกต้อง' };
    }
    
    const sheet = getSheet(CONFIG.SHEETS.TRANSPORT_DATA);
    const textRow = asTextRow([
      generateId(),
      data.FarmerID,
      data.TransportMethod || '',
      data.TransportCompany || '',
      data.DistributorCode,
      data.ShipDate || '',
      new Date().toISOString()
    ]);
    
    sheet.appendRow(textRow);
    
    return { success: true, message: 'บันทึกข้อมูลการขนส่งสำเร็จ' };
  } catch (error) {
    console.error('Create Transport error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลการขนส่ง' };
  }
}

/**
 * Create Document record (Section 5) - Multiple rounds
 */
function createDocument(meta) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.DOCUMENTS);
    const textRow = asTextRow([
      generateId(),
      meta.FarmerID,
      meta.DocumentType || '',
      meta.FileName || '',
      meta.FileID || '',
      meta.FileURL || '',
      meta.FolderName || '',
      new Date().toISOString()
    ]);
    
    sheet.appendRow(textRow);
    
    // Also save to FileRecords if needed
    if (meta.FileID) {
      const fileSheet = getSheet(CONFIG.SHEETS.FILE_RECORDS);
      const fileRow = asTextRow([
        generateId(),
        meta.FileID,
        meta.FileName,
        meta.FarmerID,
        meta.DocumentType,
        new Date().toISOString()
      ]);
      fileSheet.appendRow(fileRow);
    }
    
    return { success: true, message: 'บันทึกข้อมูลเอกสารสำเร็จ' };
  } catch (error) {
    console.error('Create Document error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลเอกสาร' };
  }
}

/**
 * Create Additional Info (Section 6) - Multiple rounds, text only
 */
function createAdditionalInfo(data) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.ADDITIONAL_INFO);
    const textRow = asTextRow([
      generateId(),
      data.FarmerID,
      data.Story || '',
      data.Philosophy || '',
      data.Highlights || '',
      new Date().toISOString()
    ]);
    
    sheet.appendRow(textRow);
    
    return { success: true, message: 'บันทึกข้อมูลเพิ่มเติมสำเร็จ' };
  } catch (error) {
    console.error('Create Additional Info error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลเพิ่มเติม' };
  }
}

/**
 * Create Search Code - Only after Part 1 is complete
 */
function createSearchCode(payload) {
  try {
    // Check if Part 1 is complete
    const farmerData = getFarmerById(payload.FarmerID);
    if (!farmerData || !farmerData.PlotNumber) {
      return { success: false, message: 'ต้องกรอกข้อมูลส่วนที่ 1 ให้ครบก่อน' };
    }
    
    // Validate DistributorCode
    const validDistributors = ['001', '002', '003'];
    if (!validDistributors.includes(payload.DistributorCode)) {
      return { success: false, message: 'รหัสผู้จำหน่ายไม่ถูกต้อง' };
    }
    
    // Generate SearchCode from ShipDate
    const searchCode = toBuddhistYMD(payload.ShipDate) + '-' + payload.DistributorCode;
    
    const sheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const textRow = asTextRow([
      generateId(),
      searchCode,
      payload.FarmerID,
      payload.ProductionID || '',
      payload.ShipDate || '',
      payload.DistributorCode,
      new Date().toISOString()
    ]);
    
    sheet.appendRow(textRow);
    
    return { 
      success: true, 
      message: 'สร้างรหัสค้นหาสำเร็จ',
      searchCode: searchCode
    };
  } catch (error) {
    console.error('Create Search Code error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างรหัสค้นหา' };
  }
}

/**
 * Get Dashboard State for farmer
 */
function getDashboardState(farmerID) {
  try {
    const farmerData = getFarmerById(farmerID);
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    // Check if Part 1 is complete
    const part1Complete = !!(farmerData.PlotNumber && farmerData.FullName && farmerData.Address);
    
    // Get productions list with complete data
    const productionsResult = getLatestProductionRecords(farmerID, 10);
    const productions = productionsResult.success ? productionsResult.records : [];
    
    // Get latest 10 search codes
    const searchCodesSheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const searchData = searchCodesSheet.getDataRange().getValues();
    const searchCodes = [];
    
    for (let i = searchData.length - 1; i >= 1 && searchCodes.length < 10; i--) {
      if (searchData[i][2] === farmerID) {
        searchCodes.push({
          id: searchData[i][0],
          code: searchData[i][1],
          created: searchData[i][6]
        });
      }
    }
    
    // Get QR data
    let qrData = null;
    if (part1Complete) {
      const qrCode = farmerData.GroupCode + '-' + farmerData.PlotNumber;
      const qrSheet = getSheet(CONFIG.SHEETS.QR_CODES);
      const qrSheetData = qrSheet.getDataRange().getValues();
      
      for (let i = 1; i < qrSheetData.length; i++) {
        if (qrSheetData[i][4] === farmerID && qrSheetData[i][5] === 'active') {
          qrData = {
            qrCode: qrSheetData[i][1],
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrSheetData[i][1])}`,
            groupCode: qrSheetData[i][2],
            plotNumber: qrSheetData[i][3]
          };
          break;
        }
      }
    }
    
    return {
      success: true,
      part1Complete: part1Complete,
      productions: productions.map(p => ({ id: p[0], label: `การผลิต ${Utils.formatDateThai(p[3])}` })),
      searchCodes: searchCodes,
      qrData: qrData
    };
    
  } catch (error) {
    console.error('Get Dashboard State error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลแดชบอร์ด' };
  }
}

/**
 * Get farmer section data by sheet name and farmer ID
 */
function getFarmerSectionData(sheetName, farmerId) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const results = [];
    
    // Find all records for this farmer (skip header row)
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === farmerId) { // FarmerID is in column B (index 1)
        const rowData = {};
        
        // Map columns based on sheet type
        switch (sheetName) {
          case CONFIG.SHEETS.PRODUCTION_DATA:
            rowData.ProductionID = data[i][0];
            rowData.FarmerID = data[i][1];
            rowData.SeedVariety = data[i][2];
            rowData.PlantingDate = data[i][3];
            rowData.WaterManagement = data[i][4];
            rowData.FertilizerType = data[i][5];
            rowData.PestControl = data[i][6];
            rowData.CreatedAt = data[i][7];
            break;
            
          case CONFIG.SHEETS.HARVEST_DATA:
            rowData.HarvestID = data[i][0];
            rowData.FarmerID = data[i][1];
            rowData.HarvestDate = data[i][2];
            rowData.PackagingCompany = data[i][3];
            rowData.PackagingLocation = data[i][4];
            rowData.ResponsiblePerson = data[i][5];
            rowData.LotCode = data[i][6];
            rowData.ShipDate = data[i][7];
            rowData.Quantity = data[i][8];
            rowData.Unit = data[i][9];
            rowData.CreatedAt = data[i][10];
            break;
            
          case CONFIG.SHEETS.TRANSPORT_DATA:
            rowData.TransportID = data[i][0];
            rowData.FarmerID = data[i][1];
            rowData.TransportMethod = data[i][2];
            rowData.TransportCompany = data[i][3];
            rowData.DistributorCode = data[i][4];
            rowData.ShipDate = data[i][5];
            rowData.CreatedAt = data[i][6];
            break;
            
          case CONFIG.SHEETS.DOCUMENTS:
            rowData.DocumentID = data[i][0];
            rowData.FarmerID = data[i][1];
            rowData.DocumentType = data[i][2];
            rowData.FileName = data[i][3];
            rowData.FileID = data[i][4];
            rowData.FileURL = data[i][5];
            rowData.FolderName = data[i][6];
            rowData.CreatedAt = data[i][7];
            break;
            
          case CONFIG.SHEETS.ADDITIONAL_INFO:
            rowData.InfoID = data[i][0];
            rowData.FarmerID = data[i][1];
            rowData.Story = data[i][2];
            rowData.Philosophy = data[i][3];
            rowData.Highlights = data[i][4];
            rowData.CreatedAt = data[i][5];
            break;
        }
        
        results.push(rowData);
      }
    }
    
    return results;
    
  } catch (error) {
    console.error('Get farmer section data error:', error);
    return [];
  }
}

/**
 * Handle document upload for Section 5
 */
function handleUploadDocument(params) {
  try {
    const { FarmerID, DocumentType, FileName, FileContent, MimeType, FolderName } = params;
    
    if (!FarmerID || !FileName || !FileContent) {
      return { success: false, message: 'ข้อมูลไม่ครบถ้วนสำหรับการอัพโหลด' };
    }
    
    // Get farmer data to find folder
    const farmerData = getFarmerById(FarmerID);
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    // Create blob from base64
    const blob = Utilities.newBlob(
      Utilities.base64Decode(FileContent), 
      MimeType || 'application/octet-stream', 
      FileName
    );
    
    // Upload to appropriate folder
    const folder = DriveApp.getFolderById(farmerData.folderId);
    const uploadedFile = folder.createFile(blob);
    
    // Save document record
    const documentResult = createDocument({
      FarmerID: FarmerID,
      DocumentType: DocumentType,
      FileName: FileName,
      FileID: uploadedFile.getId(),
      FileURL: uploadedFile.getUrl(),
      FolderName: FolderName
    });
    
    return {
      success: true,
      message: 'อัพโหลดเอกสารสำเร็จ',
      fileId: uploadedFile.getId(),
      fileUrl: uploadedFile.getUrl()
    };
    
  } catch (error) {
    console.error('Handle upload document error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัพโหลดเอกสาร' };
  }
}

/**
 * Create folder for farmer 2se7h3F9
 */
function createFolderForFarmer2se7h3F9() {
  try {
    console.log('🔧 Creating folder for farmer 2se7h3F9...');
    
    // Get farmer data first
    const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
    const farmersData = farmersSheet.getDataRange().getValues();
    let farmerData = null;
    
    for (let i = 1; i < farmersData.length; i++) {
      if (farmersData[i][0] === '2se7h3F9') {
        farmerData = {
          farmerId: farmersData[i][0],
          groupId: farmersData[i][1],
          phone: farmersData[i][7]
        };
        break;
      }
    }
    
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร 2se7h3F9 ในระบบ' };
    }
    
    console.log('👤 Found farmer data:', farmerData);
    
    // Call ensureFarmerFolderExists
    const result = ensureFarmerFolderExists(farmerData.farmerId, farmerData.groupId, farmerData.phone);
    console.log('📁 Folder creation result:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error creating folder for farmer 2se7h3F9:', error);
    return { success: false, error: error.toString() };
  }
}