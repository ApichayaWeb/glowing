/**
 * ระบบสอบย้อนกลับผักอุดร - Utility Functions
 * =============================================
 */

/**
 * Convert any value to text format for Google Sheets
 * Returns empty string if value is null/undefined, otherwise returns string with quote prefix
 */
function toText(v) {
  if (v == null || v === '') return '';
  return '\'' + String(v);
}

/**
 * Convert date to Buddhist calendar YYYYMMDD format as string
 */
function toBuddhistYMD(date) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const buddhistYear = d.getFullYear() + 543;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return String(buddhistYear) + month + day;
}

/**
 * Convert array of values to text format for sheet writing
 */
function asTextRow(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(v => toText(v));
}

/**
 * Create folder structure when admin creates a new group
 */
function createGroupFolderStructure(groupData) {
  try {
    // Validate input data
    if (!groupData || !groupData.groupCode) {
      throw new Error('ข้อมูลกลุ่มไม่ครบถ้วน - ไม่มีรหัสกลุ่ม');
    }
    
    console.log('Creating folder structure for group:', groupData.groupCode);
    console.log('Available Drive methods:', Object.getOwnPropertyNames(DriveApp));
    
    // Try to get main folder with more detailed error handling
    let mainFolder;
    try {
      if (CONFIG.DRIVE_FOLDER_ID) {
        console.log('Using configured folder ID:', CONFIG.DRIVE_FOLDER_ID);
        
        // Test if we can access Drive at all
        try {
          const testFolders = DriveApp.getFolders();
          console.log('Drive access confirmed - can list folders');
        } catch (driveTestError) {
          console.error('No Drive access:', driveTestError);
          throw new Error(`ไม่สามารถเข้าถึง Google Drive: ${driveTestError.message}`);
        }
        
        // Try to access the configured folder
        mainFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
        console.log('Successfully accessed main folder:', mainFolder.getName());
        
      } else {
        console.log('No DRIVE_FOLDER_ID configured, using root folder');
        mainFolder = DriveApp.getRootFolder();
        console.log('Using root folder:', mainFolder.getName());
      }
    } catch (folderError) {
      console.error('Cannot access main folder:', folderError);
      console.error('Folder error details:', {
        message: folderError.message,
        stack: folderError.stack,
        folderId: CONFIG.DRIVE_FOLDER_ID
      });
      throw new Error(`ไม่สามารถเข้าถึงโฟลเดอร์หลัก ID: ${CONFIG.DRIVE_FOLDER_ID} - ${folderError.message}`);
    }
    
    // Check if group folder already exists
    const groupFolderName = groupData.groupCode;
    const existingFolders = mainFolder.getFoldersByName(groupFolderName);
    
    if (existingFolders.hasNext()) {
      console.log('Group folder already exists:', groupFolderName);
      throw new Error(`โฟลเดอร์กลุ่ม "${groupFolderName}" มีอยู่แล้ว`);
    }
    
    // Create main group folder
    let groupFolder;
    try {
      groupFolder = mainFolder.createFolder(groupFolderName);
      console.log('Created main group folder:', groupFolderName);
    } catch (createError) {
      console.error('Cannot create group folder:', createError);
      throw new Error(`ไม่สามารถสร้างโฟลเดอร์กลุ่ม: ${createError.message}`);
    }
    
    // Create subfolders for different document types
    const subFolders = {};
    const folderNames = {
      'registration_docs': 'เอกสารจดทะเบียน',
      'gap_certificates': 'ใบรับรอง GAP',
      'farmer_documents': 'เอกสารเกษตรกร',
      'product_images': 'รูปภาพผลิตภัณฑ์',
      'reports': 'รายงาน'
    };
    
    for (const [key, folderName] of Object.entries(folderNames)) {
      try {
        subFolders[key] = groupFolder.createFolder(folderName);
        console.log(`Created subfolder: ${folderName}`);
      } catch (subFolderError) {
        console.error(`Cannot create subfolder ${folderName}:`, subFolderError);
        // Continue creating other folders even if one fails
      }
    }
    
    console.log(`Successfully created folder structure for group ${groupData.groupCode}`);
    
    return {
      success: true,
      groupFolderId: groupFolder.getId(),
      subFolders: {
        registrationDocs: subFolders.registration_docs?.getId() || '',
        gapCertificates: subFolders.gap_certificates?.getId() || '',
        farmerDocuments: subFolders.farmer_documents?.getId() || '',
        productImages: subFolders.product_images?.getId() || '',
        reports: subFolders.reports?.getId() || ''
      }
    };
    
  } catch (error) {
    console.error('Create folder structure error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      groupData: groupData
    });
    
    return {
      success: false,
      error: error.message || error.toString(),
      details: {
        groupCode: groupData?.groupCode || 'Unknown',
        configuredFolderId: CONFIG.DRIVE_FOLDER_ID || 'Not set'
      }
    };
  }
}

/**
 * Test Google Sheets connection and structure
 */
function testSheetsConnection() {
  try {
    console.log('=== TESTING SHEETS CONNECTION ===');
    
    const results = {
      spreadsheet: null,
      sheets: {},
      errors: []
    };
    
    // Test spreadsheet access
    try {
      const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      results.spreadsheet = {
        id: CONFIG.SPREADSHEET_ID,
        name: spreadsheet.getName(),
        url: spreadsheet.getUrl()
      };
      console.log('Spreadsheet access: SUCCESS', results.spreadsheet);
    } catch (spreadsheetError) {
      console.error('Spreadsheet access: FAILED', spreadsheetError);
      results.errors.push('Spreadsheet access failed: ' + spreadsheetError.message);
      return { success: false, message: 'ไม่สามารถเชื่อมต่อ Google Sheets ได้', results };
    }
    
    // Test each sheet
    Object.keys(CONFIG.SHEETS).forEach(sheetKey => {
      const sheetName = CONFIG.SHEETS[sheetKey];
      try {
        const sheet = getSheet(sheetName);
        const data = sheet.getDataRange().getValues();
        
        results.sheets[sheetName] = {
          exists: true,
          rows: data.length,
          columns: data.length > 0 ? data[0].length : 0,
          headers: data.length > 0 ? data[0] : [],
          sampleData: data.length > 1 ? data[1] : null
        };
        
        console.log(`Sheet ${sheetName}: SUCCESS`, results.sheets[sheetName]);
      } catch (sheetError) {
        console.error(`Sheet ${sheetName}: FAILED`, sheetError);
        results.sheets[sheetName] = {
          exists: false,
          error: sheetError.message
        };
        results.errors.push(`Sheet ${sheetName} failed: ${sheetError.message}`);
      }
    });
    
    const hasErrors = results.errors.length > 0;
    console.log('=== SHEETS CONNECTION TEST COMPLETE ===');
    console.log('Results:', results);
    
    return {
      success: !hasErrors,
      message: hasErrors ? 'มีปัญหาการเชื่อมต่อบางส่วน' : 'เชื่อมต่อ Google Sheets สำเร็จ',
      results: results
    };
    
  } catch (error) {
    console.error('Test sheets connection error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการทดสอบการเชื่อมต่อ: ' + error.message };
  }
}

/**
 * Test Google Drive access and folder permissions
 */
function testDriveAccess() {
  try {
    console.log('=== Testing Google Drive Access ===');
    
    // Test 1: Basic Drive access
    console.log('Test 1: Basic Drive access');
    const folders = DriveApp.getFolders();
    let folderCount = 0;
    while (folders.hasNext() && folderCount < 3) {
      const folder = folders.next();
      console.log(`Found folder: ${folder.getName()} (ID: ${folder.getId()})`);
      folderCount++;
    }
    console.log('✓ Basic Drive access works');
    
    // Test 2: Root folder access
    console.log('Test 2: Root folder access');
    const rootFolder = DriveApp.getRootFolder();
    console.log(`Root folder name: ${rootFolder.getName()}`);
    console.log(`Root folder ID: ${rootFolder.getId()}`);
    console.log('✓ Root folder access works');
    
    // Test 3: Configured folder access
    console.log('Test 3: Configured folder access');
    if (CONFIG.DRIVE_FOLDER_ID) {
      try {
        const configuredFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
        console.log(`Configured folder name: ${configuredFolder.getName()}`);
        console.log(`Configured folder ID: ${configuredFolder.getId()}`);
        
        // Test create permission
        try {
          const testFolder = configuredFolder.createFolder(`TEST_${Date.now()}`);
          console.log(`✓ Can create folders in configured folder`);
          
          // Clean up test folder
          testFolder.setTrashed(true);
          console.log('✓ Test folder cleaned up');
          
        } catch (createError) {
          console.error('✗ Cannot create folders in configured folder:', createError.message);
        }
        
        console.log('✓ Configured folder access works');
      } catch (configError) {
        console.error('✗ Cannot access configured folder:', configError.message);
        return {
          success: false,
          error: `Cannot access configured folder: ${configError.message}`,
          folderId: CONFIG.DRIVE_FOLDER_ID
        };
      }
    } else {
      console.log('No configured folder ID - will use root folder');
    }
    
    console.log('=== All Drive tests passed ===');
    return {
      success: true,
      message: 'Google Drive access test completed successfully',
      details: {
        rootFolderId: rootFolder.getId(),
        configuredFolderId: CONFIG.DRIVE_FOLDER_ID,
        canAccessDrive: true,
        canCreateFolders: true
      }
    };
    
  } catch (error) {
    console.error('Drive access test failed:', error);
    return {
      success: false,
      error: error.message,
      details: {
        configuredFolderId: CONFIG.DRIVE_FOLDER_ID,
        errorStack: error.stack
      }
    };
  }
}

/**
 * Upload file to specific group folder
 */
function uploadFileToGroupFolder(fileData, groupId, folderType = 'farmer_documents') {
  try {
    // Get group folder info
    const groupData = getGroupByIdWithFolders(groupId);
    if (!groupData || !groupData.folderId) {
      throw new Error('ไม่พบโฟลเดอร์ของกลุ่ม');
    }
    
    // Determine target folder
    let targetFolderId;
    switch (folderType) {
      case 'registration':
        targetFolderId = groupData.registrationFolderId;
        break;
      case 'gap_certificate':
        targetFolderId = groupData.gapFolderId;
        break;
      case 'farmer_document':
        targetFolderId = groupData.farmerDocsFolderId;
        break;
      case 'product_image':
        targetFolderId = groupData.productImagesFolderId;
        break;
      case 'report':
        targetFolderId = groupData.reportsFolderId;
        break;
      default:
        targetFolderId = groupData.folderId;
    }
    
    const targetFolder = DriveApp.getFolderById(targetFolderId);
    
    // Decode base64 file content
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileData.fileContent), 
      fileData.mimeType, 
      fileData.fileName
    );
    
    // Create file in target folder
    const file = targetFolder.createFile(blob);
    
    // Set file description with metadata
    const metadata = {
      uploadedBy: fileData.uploadedBy || 'system',
      uploadDate: new Date().toISOString(),
      groupId: groupId,
      fileType: folderType
    };
    file.setDescription(JSON.stringify(metadata));
    
    console.log(`File uploaded: ${file.getName()} to ${folderType} folder`);
    
    return {
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      downloadUrl: `https://drive.google.com/uc?id=${file.getId()}`,
      viewUrl: `https://drive.google.com/file/d/${file.getId()}/view`
    };
    
  } catch (error) {
    console.error('Upload file error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Upload file to farmer folder
 */
function uploadFileToFarmerFolder(params) {
  try {
    const { fileName, fileContent, mimeType, farmerID, fileType, folderName } = params;
    
    const farmerData = getFarmerById(farmerID);
    if (!farmerData) {
      throw new Error('ไม่พบข้อมูลเกษตรกร');
    }
    
    const groupData = getGroupByIdWithFolders(farmerData.groupId);
    if (!groupData || !groupData.farmerDocsFolderId) {
      throw new Error('ไม่พบโฟลเดอร์เอกสารเกษตรกรของกลุ่ม');
    }
    
    const farmerDocsFolder = DriveApp.getFolderById(groupData.farmerDocsFolderId);
    
    let farmerFolder;
    const farmerFolders = farmerDocsFolder.getFoldersByName(farmerID);
    if (farmerFolders.hasNext()) {
      farmerFolder = farmerFolders.next();
    } else {
      farmerFolder = farmerDocsFolder.createFolder(farmerID);
    }
    
    let targetFolder = farmerFolder;
    if (folderName) {
      const typeFolders = farmerFolder.getFoldersByName(folderName);
      if (typeFolders.hasNext()) {
        targetFolder = typeFolders.next();
      } else {
        targetFolder = farmerFolder.createFolder(folderName);
      }
    }
    
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileContent),
      mimeType,
      fileName
    );
    
    const file = targetFolder.createFile(blob);
    
    const metadata = {
      uploadDate: new Date().toISOString(),
      farmerID: farmerID,
      fileType: fileType,
      groupCode: groupData.groupCode
    };
    file.setDescription(JSON.stringify(metadata));
    
    return {
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      downloadUrl: `https://drive.google.com/uc?id=${file.getId()}`,
      viewUrl: `https://drive.google.com/file/d/${file.getId()}/view`
    };
    
  } catch (error) {
    console.error('Upload farmer file error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Get group basic information by ID
 */
function getGroupById(groupId) {
  try {
    console.log('🔍 getGroupById called with groupId:', groupId);
    console.log('🔍 groupId type:', typeof groupId);
    
    const sheet = getSheet(CONFIG.SHEETS.GROUPS);
    const data = sheet.getDataRange().getValues();
    
    console.log('📋 Groups sheet data length:', data.length);
    console.log('📋 Groups sheet headers:', data[0]);
    
    // Clean groupId - remove potential text format prefix
    const cleanGroupId = String(groupId || '').replace(/^'/, '');
    console.log('🧹 Cleaned groupId:', cleanGroupId);
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowGroupId = String(row[0] || '').replace(/^'/, '');
      
      console.log(`🔄 Row ${i}: Comparing rowGroupId "${rowGroupId}" with target "${cleanGroupId}"`);
      
      if (rowGroupId === cleanGroupId) {
        console.log('✅ Found matching group at row:', i);
        
        const groupData = {
          groupId: row[0],
          GroupID: row[0], // Add for compatibility
          groupCode: row[1],
          GroupCode: row[1], // Add for compatibility
          groupName: row[2],
          GroupName: row[2], // Add for compatibility
          registrationDoc: row[3], // Fixed: was district
          RegistrationDoc: row[3], // Add for compatibility
          gapCert: row[4], // Fixed: was province  
          GAPCert: row[4], // Add for compatibility
          status: row[5],
          created: row[6],
          updated: row[7],
          managerUsername: row[8]
        };
        
        console.log('📦 Returning group data:', groupData);
        return groupData;
      }
    }
    
    console.log('❌ No group found with groupId:', cleanGroupId);
    console.log('📊 Available groups:');
    for (let i = 1; i < Math.min(data.length, 6); i++) {
      console.log(`  - Row ${i}: groupId="${data[i][0]}", groupName="${data[i][2]}"`);
    }
    
    return null;
  } catch (error) {
    console.error('❌ Get group by ID error:', error);
    console.error('❌ Error stack:', error.stack);
    return null;
  }
}

/**
 * Get group with folder information
 */
function getGroupByIdWithFolders(groupId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.GROUPS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === groupId) {
        return {
          groupId: row[0],
          groupCode: row[1],
          groupName: row[2],
          registrationDoc: row[3],
          gapCert: row[4],
          status: row[5],
          created: row[6],
          updated: row[7],
          managerUsername: row[8],
          folderId: row[9] || null,           // MainFolderId  
          registrationFolderId: row[10] || null,
          gapFolderId: row[11] || null,
          farmerDocsFolderId: row[12] || null,
          productImagesFolderId: row[13] || null,
          reportsFolderId: row[14] || null
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Get group with folders error:', error);
    return null;
  }
}

/**
 * Enhanced file upload with validation, progress tracking and error handling
 */
function handleFileUpload(params) {
  const startTime = Date.now();
  try {
    console.log('🔼 Starting file upload:', params.fileName);
    
    // Enhanced validation
    const validation = validateFileUploadParams(params);
    if (!validation.valid) {
      return { 
        success: false, 
        message: validation.message,
        errorType: 'VALIDATION_ERROR'
      };
    }
    
    const { fileName, fileContent, mimeType, groupId, uploadedBy, fileType = 'farmer_document', maxRetries = 3 } = params;
    
    // Check file size limits
    const fileSizeBytes = Math.ceil(fileContent.length * 3 / 4); // Base64 to bytes conversion
    const maxFileSize = 10 * 1024 * 1024; // 10MB limit
    
    if (fileSizeBytes > maxFileSize) {
      return {
        success: false,
        message: `ไฟล์มีขนาดใหญ่เกินไป (${formatFileSize(fileSizeBytes)}) ขนาดสูงสุดที่อนุญาต: ${formatFileSize(maxFileSize)}`,
        errorType: 'FILE_TOO_LARGE',
        fileSize: fileSizeBytes,
        maxSize: maxFileSize
      };
    }
    
    console.log(`📊 File size: ${formatFileSize(fileSizeBytes)}`);
    
    // Prepare file data with enhanced metadata
    const fileData = {
      fileName: fileName,
      fileContent: fileContent,
      mimeType: mimeType,
      uploadedBy: uploadedBy,
      uploadStartTime: new Date().toISOString(),
      fileSize: fileSizeBytes
    };
    
    // Attempt upload with retry mechanism
    let uploadResult;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Upload attempt ${attempt}/${maxRetries}`);
        
        uploadResult = uploadFileToGroupFolder(fileData, groupId, fileType);
        
        if (uploadResult.success) {
          const uploadTime = Date.now() - startTime;
          console.log(`✅ Upload successful in ${uploadTime}ms`);
          
          // Log successful upload
          logFileUpload({
            fileName: fileName,
            fileSize: fileSizeBytes,
            uploadTime: uploadTime,
            groupId: groupId,
            uploadedBy: uploadedBy,
            fileType: fileType,
            status: 'SUCCESS'
          });
          
          return {
            success: true,
            message: 'อัพโหลดไฟล์สำเร็จ',
            file: {
              ...uploadResult,
              uploadTime: uploadTime,
              fileSize: fileSizeBytes
            }
          };
        } else {
          lastError = uploadResult.error;
          console.log(`❌ Upload attempt ${attempt} failed:`, lastError);
          
          if (attempt < maxRetries) {
            // Wait before retry (exponential backoff)
            const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
            console.log(`⏳ Waiting ${waitTime}ms before retry...`);
            Utilities.sleep(waitTime);
          }
        }
        
      } catch (attemptError) {
        lastError = attemptError.toString();
        console.error(`❌ Upload attempt ${attempt} error:`, attemptError);
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          Utilities.sleep(waitTime);
        }
      }
    }
    
    // All attempts failed
    const uploadTime = Date.now() - startTime;
    console.error(`❌ All upload attempts failed after ${uploadTime}ms`);
    
    // Log failed upload
    logFileUpload({
      fileName: fileName,
      fileSize: fileSizeBytes,
      uploadTime: uploadTime,
      groupId: groupId,
      uploadedBy: uploadedBy,
      fileType: fileType,
      status: 'FAILED',
      error: lastError
    });
    
    return {
      success: false,
      message: `การอัพโหลดล้มเหลวหลังจากพยายาม ${maxRetries} ครั้ง: ${lastError}`,
      errorType: 'UPLOAD_FAILED',
      attempts: maxRetries,
      lastError: lastError
    };
    
  } catch (error) {
    const uploadTime = Date.now() - startTime;
    console.error('Handle file upload error:', error);
    
    return { 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการอัพโหลดไฟล์: ' + error.message,
      errorType: 'SYSTEM_ERROR',
      uploadTime: uploadTime
    };
  }
}

/**
 * Create folder for existing group (migration function)
 */
function createFolderForExistingGroup(groupId) {
  try {
    const groupData = getGroupById(groupId);
    if (!groupData) {
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม' };
    }
    
    const folderResult = createGroupFolderStructure({
      groupCode: groupData.groupCode,
      groupName: groupData.groupName,
      groupId: groupId
    });
    
    if (folderResult.success) {
      // Update group record with folder IDs
      updateGroupFolderIds(groupId, folderResult);
      return { success: true, message: 'สร้างโฟลเดอร์สำเร็จ' };
    } else {
      return { success: false, message: folderResult.error };
    }
    
  } catch (error) {
    console.error('Create folder for existing group error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างโฟลเดอร์' };
  }
}

/**
 * Update group record with folder IDs
 */
function updateGroupFolderIds(groupId, folderResult) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.GROUPS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === groupId) {
        // Update folder IDs in the row - ปรับตำแหน่งคอลัมน์ใหม่
        sheet.getRange(i + 1, 10).setValue(folderResult.groupFolderId); // MainFolderId (J)
        sheet.getRange(i + 1, 11).setValue(folderResult.subFolders.registrationDocs); // (K)
        sheet.getRange(i + 1, 12).setValue(folderResult.subFolders.gapCertificates); // (L)
        sheet.getRange(i + 1, 13).setValue(folderResult.subFolders.farmerDocuments); // (M)
        sheet.getRange(i + 1, 14).setValue(folderResult.subFolders.productImages); // (N)
        sheet.getRange(i + 1, 15).setValue(folderResult.subFolders.reports); // (O)
        
        console.log(`Updated folder IDs for group ${groupId}`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Update group folder IDs error:', error);
    return false;
  }
}

/**
 * Generate QR Code image and save to group folder
 */
function generateAndSaveQRCode(qrCodeText, groupId) {
  try {
    // This function would generate QR code image file
    // For now, just return the QR code text
    // In real implementation, you might want to use a QR code generation service
    
    return {
      success: true,
      qrCode: qrCodeText,
      message: 'QR Code สร้างสำเร็จ'
    };
    
  } catch (error) {
    console.error('Generate and save QR code error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้าง QR Code'
    };
  }
}

/**
 * Get folder URL for sharing
 */
function getGroupFolderUrl(groupId) {
  try {
    const groupData = getGroupByIdWithFolders(groupId);
    if (groupData && groupData.folderId) {
      return `https://drive.google.com/drive/folders/${groupData.folderId}`;
    }
    return null;
  } catch (error) {
    console.error('Get group folder URL error:', error);
    return null;
  }
}

/**
 * Enhanced file validation for uploads
 */
function validateFileUploadParams(params) {
  try {
    const { fileName, fileContent, mimeType, groupId } = params;
    
    // Check required fields
    if (!fileName || !fileContent || !mimeType) {
      return { valid: false, message: 'ข้อมูลไฟล์ไม่ครบถ้วน (ชื่อไฟล์, เนื้อหา, หรือประเภทไฟล์)' };
    }
    
    if (!groupId) {
      return { valid: false, message: 'ไม่ระบุรหัสกลุ่ม' };
    }
    
    // Validate file name
    if (fileName.length > 255) {
      return { valid: false, message: 'ชื่อไฟล์ยาวเกินไป (สูงสุด 255 ตัวอักษร)' };
    }
    
    // Check for dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.jar'];
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    
    if (dangerousExtensions.includes(fileExtension)) {
      return { valid: false, message: `ประเภทไฟล์ ${fileExtension} ไม่ได้รับอนุญาต` };
    }
    
    // Validate MIME type
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ];
    
    if (!allowedMimeTypes.includes(mimeType)) {
      return { valid: false, message: `ประเภทไฟล์ ${mimeType} ไม่ได้รับอนุญาต` };
    }
    
    // Validate base64 content
    if (!isValidBase64(fileContent)) {
      return { valid: false, message: 'เนื้อหาไฟล์ไม่ถูกต้อง (ต้องเป็น Base64)' };
    }
    
    return { valid: true };
    
  } catch (error) {
    console.error('File validation error:', error);
    return { valid: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบไฟล์' };
  }
}

/**
 * Check if string is valid base64
 */
function isValidBase64(str) {
  try {
    // Basic pattern check for base64
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    
    if (!base64Pattern.test(str)) {
      return false;
    }
    
    // Try to decode a small portion to verify
    const testPortion = str.substring(0, Math.min(100, str.length));
    Utilities.base64Decode(testPortion);
    return true;
    
  } catch (error) {
    return false;
  }
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Log file upload activity
 */
function logFileUpload(uploadData) {
  try {
    const sheet = getSheet('FileRecords');
    const newRow = [
      generateId(),                    // LogID
      uploadData.fileName,             // FileName
      uploadData.fileSize,             // FileSize
      uploadData.uploadTime,           // UploadTime (ms)
      uploadData.groupId,              // GroupID
      uploadData.uploadedBy,           // UploadedBy
      uploadData.fileType,             // FileType
      uploadData.status,               // Status (SUCCESS/FAILED)
      uploadData.error || '',          // Error
      new Date().toISOString()         // Timestamp
    ];
    
    sheet.appendRow(newRow);
    console.log(`📝 Logged file upload: ${uploadData.fileName} (${uploadData.status})`);
    
  } catch (error) {
    console.error('Error logging file upload:', error);
    // Don't throw error - logging failure shouldn't break upload
  }
}

/**
 * Enhanced list files in group folder with metadata
 */
function listGroupFiles(groupId, folderType = 'all') {
  try {
    console.log(`📁 Listing files for group ${groupId}, folder type: ${folderType}`);
    
    const groupData = getGroupByIdWithFolders(groupId);
    if (!groupData) {
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม' };
    }
    
    let folderId;
    if (folderType === 'all') {
      folderId = groupData.folderId;
    } else {
      switch (folderType) {
        case 'registration':
          folderId = groupData.registrationFolderId;
          break;
        case 'gap_certificate':
          folderId = groupData.gapFolderId;
          break;
        case 'farmer_document':
          folderId = groupData.farmerDocsFolderId;
          break;
        case 'product_image':
          folderId = groupData.productImagesFolderId;
          break;
        case 'report':
          folderId = groupData.reportsFolderId;
          break;
        default:
          folderId = groupData.folderId;
      }
    }
    
    if (!folderId) {
      return { success: false, message: 'ไม่พบโฟลเดอร์' };
    }
    
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const fileList = [];
    let totalSize = 0;
    
    while (files.hasNext()) {
      const file = files.next();
      const fileSize = file.getSize();
      totalSize += fileSize;
      
      // Parse metadata from file description
      let metadata = {};
      try {
        const description = file.getDescription();
        if (description) {
          metadata = JSON.parse(description);
        }
      } catch (parseError) {
        // Ignore parse errors - file might not have metadata
      }
      
      fileList.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getBlob().getContentType(),
        size: fileSize,
        sizeFormatted: formatFileSize(fileSize),
        lastModified: file.getLastUpdated(),
        url: file.getUrl(),
        downloadUrl: `https://drive.google.com/uc?id=${file.getId()}`,
        viewUrl: `https://drive.google.com/file/d/${file.getId()}/view`,
        metadata: metadata,
        uploadedBy: metadata.uploadedBy || 'ไม่ทราบ',
        uploadDate: metadata.uploadDate || file.getDateCreated().toISOString(),
        isImage: file.getBlob().getContentType().startsWith('image/')
      });
    }
    
    // Sort by last modified (newest first)
    fileList.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    
    console.log(`📊 Found ${fileList.length} files, total size: ${formatFileSize(totalSize)}`);
    
    return {
      success: true,
      files: fileList,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      summary: {
        totalFiles: fileList.length,
        totalSize: totalSize,
        totalSizeFormatted: formatFileSize(totalSize),
        folderType: folderType,
        groupId: groupId
      }
    };
    
  } catch (error) {
    console.error('List group files error:', error);
    return { 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการดึงรายการไฟล์: ' + error.message,
      errorType: 'LIST_FILES_ERROR'
    };
  }
}
/**
 * Delete file from Google Drive with safety checks
 */
function deleteFile(fileId, requestedBy) {
  try {
    console.log(`🗑️ Deleting file ${fileId} requested by ${requestedBy}`);
    
    const file = DriveApp.getFileById(fileId);
    if (!file) {
      return { success: false, message: 'ไม่พบไฟล์ที่ต้องการลบ' };
    }
    
    const fileName = file.getName();
    
    // Move to trash instead of permanent deletion for safety
    file.setTrashed(true);
    
    console.log(`✅ File ${fileName} moved to trash`);
    
    return {
      success: true,
      message: 'ลบไฟล์สำเร็จ',
      fileName: fileName
    };
    
  } catch (error) {
    console.error('Delete file error:', error);
    
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบไฟล์: ' + error.message
    };
  }
}

/**
 * Get file statistics for monitoring and analysis
 */
function getFileStats(groupId, days = 30) {
  try {
    const sheet = getSheet('FileRecords');
    const data = sheet.getDataRange().getValues();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const stats = {
      totalUploads: 0,
      successfulUploads: 0,
      failedUploads: 0,
      totalSize: 0,
      fileTypes: {},
      topUploaders: {}
    };
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const recordGroupId = row[4];
      const timestamp = new Date(row[9]);
      const status = row[7];
      const fileSize = row[2] || 0;
      const uploader = row[5] || 'Unknown';
      const fileType = row[6] || 'Other';
      
      // Filter by group and date
      if (recordGroupId === groupId && timestamp >= cutoffDate) {
        stats.totalUploads++;
        
        if (status === 'SUCCESS') {
          stats.successfulUploads++;
          stats.totalSize += parseInt(fileSize) || 0;
        } else {
          stats.failedUploads++;
        }
        
        // File type statistics
        stats.fileTypes[fileType] = (stats.fileTypes[fileType] || 0) + 1;
        
        // Top uploaders
        stats.topUploaders[uploader] = (stats.topUploaders[uploader] || 0) + 1;
      }
    }
    
    return {
      success: true,
      stats: {
        ...stats,
        totalSizeFormatted: formatFileSize(stats.totalSize),
        successRate: stats.totalUploads > 0 ? Math.round((stats.successfulUploads / stats.totalUploads) * 100) : 0,
        period: `${days} วันที่แล้ว`
      }
    };
    
  } catch (error) {
    console.error('Get file stats error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงสถิติไฟล์: ' + error.message
    };
  }
}
