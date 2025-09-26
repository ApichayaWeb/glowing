/**
 * ระบบสอบย้อนกลับผักอุดร - Admin Functions
 * =====================================
 */

/**
 * Get all groups (Admin only) - Optimized version
 */
function handleGetAllGroups(params) {
  try {
    // Check cache first (5-minute TTL)
    const cache = CacheService.getScriptCache();
    const cacheKey = 'allGroups_v2';
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log('🎯 Cache hit for getAllGroups');
      return JSON.parse(cached);
    }
    
    console.log('🔄 Cache miss, fetching from sheet');
    const sheet = getSheet(CONFIG.SHEETS.GROUPS);
    
    // Get only the rows that contain data, limited to 8 columns we need
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      // No data rows (only header)
      const result = {
        success: true,
        message: 'ดึงข้อมูลกลุ่มสำเร็จ',
        groups: [],
        totalGroups: 0
      };
      cache.put(cacheKey, JSON.stringify(result), 300); // 5 minutes
      return result;
    }
    
    // Optimized: Read only necessary range (columns A-I for 9 basic fields)
    const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
    const groups = [];
    
    // Process rows more efficiently
    data.forEach(row => {
      // Skip empty rows
      if (row[0] && row[1]) {
        groups.push({
          groupId: row[0],        // GroupID
          groupCode: row[1],      // GroupCode  
          groupName: row[2],      // GroupName
          registrationDoc: row[3], // RegistrationDoc
          gapCert: row[4],        // GAPCert
          status: row[5],         // Status
          created: row[6],        // Created
          updated: row[7],        // Updated (แก้ไขจาก managerUsername)
          managerUsername: row[8] // ManagerUsername (column I)
        });
      }
    });
    
    const result = {
      success: true,
      message: 'ดึงข้อมูลกลุ่มสำเร็จ',
      groups: groups,
      totalGroups: groups.length
    };
    
    // Cache the result for 5 minutes
    try {
      cache.put(cacheKey, JSON.stringify(result), 300);
      console.log(`✅ Cached result with ${groups.length} groups`);
    } catch (cacheError) {
      console.warn('Cache storage failed:', cacheError);
    }
    
    return result;
    
  } catch (error) {
    console.error('Get all groups error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่ม' };
  }
}

/**
 * Create new group (Admin only)
 */
function handleCreateGroup(params) {
  try {
    const managerUsername = params.managerUsername;
    const managerPassword = params.managerPassword;
    
    if (!managerUsername || !managerPassword) {
      return { success: false, message: 'กรุณาใส่ข้อมูลให้ครบถ้วน' };
    }
    
    // Generate group code and ID only
    const groupId = generateId();
    const groupCode = generateGroupCode();
    
    // ไม่ต้องสร้างชื่อกลุ่ม ให้ผู้จัดการกลุ่มกรอกเอง
    const groupName = ''; // ชื่อกลุ่มเป็นค่าว่าง
    
    // ใช้ username และ password ที่ได้รับจาก frontend
    // const managerUsername และ managerPassword ได้ประกาศไว้แล้วข้างบน
    
    // Create group folders in Google Drive
    const folderData = {
      groupId: groupId,
      groupCode: groupCode,
      groupName: groupName
    };
    
    let folderResult;
    try {
      folderResult = createGroupFolderStructure(folderData);
      
      // Check if folder creation failed
      if (!folderResult.success) {
        console.error('Folder creation failed:', folderResult);
        return { 
          success: false, 
          message: `เกิดข้อผิดพลาดในการสร้างโฟลเดอร์กลุ่ม: ${folderResult.error}`,
          details: folderResult.details
        };
      }
      
      console.log('Folder creation successful:', folderResult);
      
    } catch (error) {
      console.error('Failed to create group folders:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        folderData: folderData
      });
      
      return { 
        success: false, 
        message: `เกิดข้อผิดพลาดในการสร้างโฟลเดอร์กลุ่ม: ${error.message}`,
        errorType: 'FOLDER_CREATION_ERROR',
        timestamp: getCurrentTimestamp()
      };
    }
    
    // Save group data
    const groupsSheet = getSheet(CONFIG.SHEETS.GROUPS);
    const groupData = [
      groupId,
      "'" + groupCode, // บังคับให้เป็น text เพื่อคงเลข 0 หน้ารหัสกลุ่ม
      groupName,
      '', // Registration document (to be uploaded later)
      '', // GAP certificate (to be uploaded later)
      'active',
      getCurrentTimestamp(),
      managerUsername
    ];
    
    groupsSheet.appendRow(groupData);
    
    // Create manager user account
    const userResult = createUserAccount({
      username: managerUsername,
      password: managerPassword,
      role: 'group',
      groupId: groupId
    });
    
    if (!userResult.success) {
      // Rollback group creation if user creation fails
      deleteGroupRow(groupId);
      return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างบัญชีผู้จัดการกลุ่ม' };
    }
    
    // Update group row with folder IDs if folder creation was successful
    if (folderResult && folderResult.success) {
      updateGroupFolderIds(groupId, folderResult);
    }
    
    return {
      success: true,
      message: 'สร้างกลุ่มเกษตรกรสำเร็จ',
      firstLoginRequired: true, // บอกให้ frontend รู้ว่าต้องเปลี่ยนรหัสผ่านครั้งแรก
      group: {
        groupId: groupId,
        groupCode: groupCode,
        groupName: groupName,
        managerUsername: managerUsername,
        managerPassword: managerPassword,
        folders: folderResult
      },
      instructions: {
        login: `ผู้จัดการกลุ่มสามารถเข้าสู่ระบบด้วยชื่อผู้ใช้: ${managerUsername}`,
        password: 'เมื่อเข้าสู่ระบบครั้งแรก จะต้องเปลี่ยนรหัสผ่านเพื่อความปลอดภัย'
      }
    };
    
  } catch (error) {
    console.error('Create group error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างกลุ่ม' };
  }
}

/**
 * Update group (Admin only)
 */
function handleUpdateGroup(params) {
  try {
    const groupId = params.groupId;
    
    if (!groupId) {
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม' };
    }
    
    const sheet = getSheet(CONFIG.SHEETS.GROUPS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === groupId) {
        // Update group data
        if (params.groupName) {
          sheet.getRange(i + 1, 3).setValue(params.groupName);
        }
        if (params.status) {
          sheet.getRange(i + 1, 6).setValue(params.status);
        }
        if (params.registrationDoc) {
          sheet.getRange(i + 1, 4).setValue(params.registrationDoc);
        }
        if (params.gapCert) {
          sheet.getRange(i + 1, 5).setValue(params.gapCert);
        }
        
        return { success: true, message: 'อัพเดทข้อมูลกลุ่มสำเร็จ' };
      }
    }
    
    return { success: false, message: 'ไม่พบกลุ่มที่ต้องการอัพเดท' };
    
  } catch (error) {
    console.error('Update group error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัพเดทกลุ่ม' };
  }
}

/**
 * Delete group (Admin only)
 */
function handleDeleteGroup(params) {
  try {
    const groupId = params.groupId;
    
    if (!groupId) {
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม' };
    }
    
    // Check if group has farmers
    const farmersCount = countGroupFarmers(groupId);
    if (farmersCount > 0) {
      return { 
        success: false, 
        message: `ไม่สามารถลบกลุ่มได้ เนื่องจากมีเกษตรกร ${farmersCount} ราย กรุณาลบเกษตรกรทั้งหมดก่อน` 
      };
    }
    
    // Get group data for cleanup
    const groupData = getGroupById(groupId);
    if (!groupData) {
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม' };
    }
    
    // Delete group manager user account
    if (groupData.managerUsername) {
      deactivateUser(groupData.managerUsername);
    }
    
    // Delete group
    const deleteResult = deleteGroupRow(groupId);
    if (!deleteResult) {
      return { success: false, message: 'เกิดข้อผิดพลาดในการลบกลุ่ม' };
    }
    
    return { success: true, message: 'ลบกลุ่มเกษตรกรสำเร็จ' };
    
  } catch (error) {
    console.error('Delete group error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบกลุ่ม' };
  }
}

/**
 * Get system statistics (Admin only) - Optimized version
 */
function handleGetSystemStats(params) {
  try {
    // Check cache first (10-minute TTL for stats)
    const cache = CacheService.getScriptCache();
    const cacheKey = 'systemStats_v2';
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log('🎯 Cache hit for getSystemStats');
      return JSON.parse(cached);
    }
    
    console.log('🔄 Cache miss, calculating stats');
    const stats = {
      totalGroups: 0,
      activeGroups: 0,
      totalFarmers: 0,
      activeFarmers: 0,
      totalUsers: 0,
      activeUsers: 0,
      totalQRCodes: 0,
      totalSearchCodes: 0,
      recentActivity: []
    };
    
    // Count groups - optimized range reading
    const groupsSheet = getSheet(CONFIG.SHEETS.GROUPS);
    const groupsLastRow = groupsSheet.getLastRow();
    if (groupsLastRow > 1) {
      const groupsData = groupsSheet.getRange(2, 6, groupsLastRow - 1, 1).getValues(); // Only Status column (F)
      stats.totalGroups = groupsData.length;
      
      stats.activeGroups = groupsData.filter(row => row[0] === 'active').length;
    }
    
    // Count farmers - optimized
    const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
    const farmersLastRow = farmersSheet.getLastRow();
    if (farmersLastRow > 1) {
      stats.totalFarmers = farmersLastRow - 1; // Just count rows, faster than reading data
      stats.activeFarmers = stats.totalFarmers; // All farmers are considered active
    }
    
    // Count users - optimized
    const usersSheet = getSheet(CONFIG.SHEETS.USERS);
    const usersLastRow = usersSheet.getLastRow();
    if (usersLastRow > 1) {
      const usersData = usersSheet.getRange(2, 6, usersLastRow - 1, 1).getValues(); // Only status column
      stats.totalUsers = usersData.length;
      stats.activeUsers = usersData.filter(row => row[0] === 'active').length;
    }
    
    // Count QR Codes - optimized
    const qrSheet = getSheet(CONFIG.SHEETS.QR_CODES);
    const qrLastRow = qrSheet.getLastRow();
    if (qrLastRow > 1) {
      stats.totalQRCodes = qrLastRow - 1; // Just count rows
    }
    
    // Count Search Codes - optimized
    const searchSheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const searchLastRow = searchSheet.getLastRow();
    if (searchLastRow > 1) {
      stats.totalSearchCodes = searchLastRow - 1; // Just count rows
    }
    
    // Get recent activity (limit to reduce processing time)
    stats.recentActivity = getRecentActivity(5); // Reduced from 10 to 5
    
    const result = {
      success: true,
      message: 'ดึงสถิติระบบสำเร็จ',
      statistics: stats
    };
    
    // Cache the result for 10 minutes
    try {
      cache.put(cacheKey, JSON.stringify(result), 600);
      console.log('✅ Cached system stats');
    } catch (cacheError) {
      console.warn('Cache storage failed:', cacheError);
    }
    
    return result;
    
  } catch (error) {
    console.error('Get system stats error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงสถิติระบบ' };
  }
}

/**
 * Generate system report (Admin only)
 */
function handleGenerateSystemReport(params) {
  try {
    const reportType = params.reportType;
    const dateFrom = params.dateFrom ? new Date(params.dateFrom) : null;
    const dateTo = params.dateTo ? new Date(params.dateTo) : null;
    
    let reportData = {};
    
    switch (reportType) {
      case 'groups':
        reportData = generateGroupsReport(dateFrom, dateTo);
        break;
      case 'farmers':
        reportData = generateFarmersReport(dateFrom, dateTo);
        break;
      case 'activity':
        reportData = generateActivityReport(dateFrom, dateTo);
        break;
      case 'qrcodes':
        reportData = generateQRCodesReport(dateFrom, dateTo);
        break;
      default:
        return { success: false, message: 'ประเภทรายงานไม่ถูกต้อง' };
    }
    
    return {
      success: true,
      message: 'สร้างรายงานสำเร็จ',
      reportType: reportType,
      dateFrom: dateFrom,
      dateTo: dateTo,
      data: reportData
    };
    
  } catch (error) {
    console.error('Generate system report error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างรายงาน' };
  }
}

/**
 * Helper Functions
 */

/**
 * Get group statistics
 */
function getGroupStatistics(groupId) {
  try {
    const stats = {
      totalFarmers: 0,
      totalQRCodes: 0,
      totalSearchCodes: 0
    };
    
    // Count farmers in group
    stats.totalFarmers = countGroupFarmers(groupId);
    
    // Count QR codes for group
    const qrSheet = getSheet(CONFIG.SHEETS.QR_CODES);
    const qrData = qrSheet.getDataRange().getValues();
    
    for (let i = 1; i < qrData.length; i++) {
      const farmerId = qrData[i][3];
      const farmer = getFarmerById(farmerId);
      if (farmer && farmer.groupId === groupId) {
        stats.totalQRCodes++;
      }
    }
    
    // Count search codes for group
    const searchSheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const searchData = searchSheet.getDataRange().getValues();
    
    for (let i = 1; i < searchData.length; i++) {
      const farmerId = searchData[i][3];
      const farmer = getFarmerById(farmerId);
      if (farmer && farmer.groupId === groupId) {
        stats.totalSearchCodes++;
      }
    }
    
    return stats;
  } catch (error) {
    console.error('Get group statistics error:', error);
    return { totalFarmers: 0, totalQRCodes: 0, totalSearchCodes: 0 };
  }
}

/**
 * Count farmers in group
 */
function countGroupFarmers(groupId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.FARMERS);
    const data = sheet.getDataRange().getValues();
    let count = 0;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === groupId) {
        count++;
      }
    }
    
    return count;
  } catch (error) {
    console.error('Count group farmers error:', error);
    return 0;
  }
}

/**
 * Delete group row
 */
function deleteGroupRow(groupId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.GROUPS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === groupId) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Delete group row error:', error);
    return false;
  }
}

/**
 * Get recent activity
 */
function getRecentActivity(limit = 10) {
  try {
    const activities = [];
    
    // Get recent user logins
    const usersSheet = getSheet(CONFIG.SHEETS.USERS);
    const usersData = usersSheet.getDataRange().getValues();
    
    for (let i = 1; i < usersData.length; i++) {
      const row = usersData[i];
      if (row[7]) { // LastLogin
        activities.push({
          type: 'login',
          user: row[1],
          role: row[3],
          timestamp: row[7],
          description: `${row[1]} เข้าสู่ระบบ`
        });
      }
    }
    
    // Get recent QR code generations
    const qrSheet = getSheet(CONFIG.SHEETS.QR_CODES);
    const qrData = qrSheet.getDataRange().getValues();
    
    for (let i = 1; i < qrData.length; i++) {
      const row = qrData[i];
      activities.push({
        type: 'qr_code',
        qrCode: row[0],
        timestamp: row[5],
        description: `สร้าง QR Code: ${row[0]}`
      });
    }
    
    // Sort by timestamp (newest first) and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return activities.slice(0, limit);
  } catch (error) {
    console.error('Get recent activity error:', error);
    return [];
  }
}

/**
 * Generate groups report
 */
function generateGroupsReport(dateFrom, dateTo) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.GROUPS);
    const data = sheet.getDataRange().getValues();
    const groups = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const createdDate = new Date(row[6]);
      
      // Filter by date range if provided
      if (dateFrom && createdDate < dateFrom) continue;
      if (dateTo && createdDate > dateTo) continue;
      
      const stats = getGroupStatistics(row[0]);
      
      groups.push({
        groupCode: row[1],
        groupName: row[2],
        status: row[5],
        created: row[6],
        managerUsername: row[7],
        statistics: stats
      });
    }
    
    return { groups: groups, total: groups.length };
  } catch (error) {
    console.error('Generate groups report error:', error);
    return { groups: [], total: 0 };
  }
}

/**
 * Generate farmers report
 */
function generateFarmersReport(dateFrom, dateTo) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.FARMERS);
    const data = sheet.getDataRange().getValues();
    const farmers = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const createdDate = new Date(row[8]);
      
      // Filter by date range if provided
      if (dateFrom && createdDate < dateFrom) continue;
      if (dateTo && createdDate > dateTo) continue;
      
      const groupData = getGroupById(row[1]);
      
      farmers.push({
        farmerId: row[0],
        groupName: groupData ? groupData.groupName : 'ไม่พบข้อมูล',
        plotNumber: row[2],
        fullName: row[4],
        area: row[6],
        phone: row[7],
        created: row[8]
      });
    }
    
    return { farmers: farmers, total: farmers.length };
  } catch (error) {
    console.error('Generate farmers report error:', error);
    return { farmers: [], total: 0 };
  }
}

/**
 * Generate activity report
 */
function generateActivityReport(dateFrom, dateTo) {
  try {
    const activities = getRecentActivity(100); // Get more for filtering
    const filteredActivities = [];
    
    for (const activity of activities) {
      const activityDate = new Date(activity.timestamp);
      
      // Filter by date range if provided
      if (dateFrom && activityDate < dateFrom) continue;
      if (dateTo && activityDate > dateTo) continue;
      
      filteredActivities.push(activity);
    }
    
    return { activities: filteredActivities, total: filteredActivities.length };
  } catch (error) {
    console.error('Generate activity report error:', error);
    return { activities: [], total: 0 };
  }
}

/**
 * Generate QR codes report
 */
function generateQRCodesReport(dateFrom, dateTo) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.QR_CODES);
    const data = sheet.getDataRange().getValues();
    const qrCodes = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const createdDate = new Date(row[5]);
      
      // Filter by date range if provided
      if (dateFrom && createdDate < dateFrom) continue;
      if (dateTo && createdDate > dateTo) continue;
      
      const farmerData = getFarmerById(row[3]);
      const groupData = farmerData ? getGroupById(farmerData.groupId) : null;
      
      qrCodes.push({
        qrCode: row[0],
        groupCode: row[1],
        groupName: groupData ? groupData.groupName : 'ไม่พบข้อมูล',
        farmerName: farmerData ? farmerData.fullName : 'ไม่พบข้อมูล',
        plotNumber: row[2],
        status: row[4],
        created: row[5]
      });
    }
    
    return { qrCodes: qrCodes, total: qrCodes.length };
  } catch (error) {
    console.error('Generate QR codes report error:', error);
    return { qrCodes: [], total: 0 };
  }
}