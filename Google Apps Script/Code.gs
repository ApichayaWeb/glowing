
// Global Configuration
const CONFIG = {
  SPREADSHEET_ID: '14dAkaGLAjHLm58X2Y1JSneVwMSWVJhlbKJALd2fRIyo', // จะใส่ ID ของ Google Sheets
  DRIVE_FOLDER_ID: '1OJKP554SpkIpdwb56ycOUOOeij-1ajcM', // จะใส่ ID ของ Google Drive Folder สำหรับเก็บไฟล์

  // Folder Structure Configuration
  FOLDER_STRUCTURE: {
    group: {
      documents: 'เอกสารกลุ่ม',
      farmers: 'เกษตรกร'
    },
    farmer: {
      farmPhoto: 'รูปภาพแปลงปลูก',
      certificate: 'เอกสารการรับรอง',
      productPhoto: 'รูปภาพผลิตภัณฑ์',
      qrStickers: 'QR-Stickers'
    }
  },
  
  // Sheet Names
  SHEETS: {
    USERS: 'Users',
    GROUPS: 'Groups', 
    FARMERS: 'Farmers',
    PRODUCTION_DATA: 'Production_Data',
    HARVEST_DATA: 'Harvest_Data',
    TRANSPORT_DATA: 'Transport_Data',
    DOCUMENTS: 'Documents',
    ADDITIONAL_INFO: 'Additional_Info',
    QR_CODES: 'QR_Codes',
    SEARCH_CODES: 'Search_Codes',
    FOLDER_MAPPING: 'FolderMapping',
    FILE_RECORDS: 'FileRecords',
    QR_FILES: 'QR_Files'
  },
  
  // Default Admin Credentials
  DEFAULT_ADMIN: {
    username: 'admin',
    password: 'admin123',
    role: 'admin'
  }
};

/**
 * Initialize Google Sheets structure
 */
function initializeSheets() {
  try {
    let spreadsheet;
    
    // Get or create spreadsheet
    if (CONFIG.SPREADSHEET_ID) {
      spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    } else {
      spreadsheet = SpreadsheetApp.create('ระบบสอบย้อนกลับผักอุดร');
      CONFIG.SPREADSHEET_ID = spreadsheet.getId();
      console.log('Created new spreadsheet with ID:', CONFIG.SPREADSHEET_ID);
    }
    
    // Create sheets if they don't exist
    Object.values(CONFIG.SHEETS).forEach(sheetName => {
      let sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
        console.log('Created sheet:', sheetName);
        
        // Initialize headers based on sheet type
        initializeSheetHeaders(sheet, sheetName);
      }
    });
    
    // Initialize default admin user
    initializeDefaultAdmin();
    
    console.log('Sheets initialization completed');
    return { success: true, spreadsheetId: CONFIG.SPREADSHEET_ID };
    
  } catch (error) {
    console.error('Error initializing sheets:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Get folder mapping data for farmer
 */
function getFolderMapping(farmerId) {
  try {
    console.log('🔍 Looking for farmer folder mapping for ID:', farmerId);
    
    const sheet = getSheet(CONFIG.SHEETS.FOLDER_MAPPING);
    const data = sheet.getDataRange().getValues();
    
    console.log('📊 FOLDER_MAPPING sheet has', data.length - 1, 'rows (excluding header)');
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      console.log(`Row ${i}: farmerId=${row[3]}, farmerFolderId=${row[7]}`);
      
      if (row[3] === farmerId) { // farmerId column (index 3) - แก้ไขให้ถูกต้อง
        const folderMapping = {
          mappingId: row[0],
          type: row[1],
          groupId: row[2], 
          farmerId: row[3], // แก้ไข index
          groupFolderId: row[4], // แก้ไข index
          documentsFolderId: row[5], // แก้ไข index
          farmersFolderId: row[6], // แก้ไข index
          farmerFolderId: row[7], // แก้ไข index - สำคัญ!
          farmPhotoFolderId: row[8], // แก้ไข index
          certificateFolderId: row[9], // แก้ไข index
          productPhotoFolderId: row[10], // แก้ไข index
          createdAt: row[11], // แก้ไข index
          groupCode: row[12], // แก้ไข index
          groupName: row[13], // แก้ไข index
          plotNumber: row[14], // แก้ไข index
          farmerName: row[15] // แก้ไข index
        };
        
        console.log('✅ Found folder mapping:', folderMapping);
        return folderMapping;
      }
    }
    
    console.log('❌ Farmer folder mapping not found for ID:', farmerId);
    return null; // Farmer folder mapping not found
    
  } catch (error) {
    console.error('❌ Error getting folder mapping:', error);
    return null;
  }
}

/**
 * Create or get QR Stickers folder for farmer
 */
function getOrCreateQRStickersFolder(farmerId) {
  try {
    console.log('📁 Getting QR Stickers folder for farmerId:', farmerId);
    
    const folderData = getFolderMapping(farmerId);
    if (!folderData) {
      throw new Error(`Farmer folder mapping not found for ID: ${farmerId}`);
    }

    console.log('🗂️ Farmer main folder ID:', folderData.farmerFolderId);
    const farmerMainFolder = DriveApp.getFolderById(folderData.farmerFolderId);
    console.log('✅ Successfully accessed farmer main folder:', farmerMainFolder.getName());
    
    // Check if QR-Stickers folder exists
    const qrStickersName = CONFIG.FOLDER_STRUCTURE.farmer.qrStickers;
    console.log('🔍 Looking for QR folder with name:', qrStickersName);
    
    const qrFolders = farmerMainFolder.getFoldersByName(qrStickersName);
    
    if (qrFolders.hasNext()) {
      const existingFolder = qrFolders.next();
      console.log('✅ Found existing QR-Stickers folder:', existingFolder.getId());
      return existingFolder;
    } else {
      // Create new QR-Stickers folder
      console.log('📂 Creating new QR-Stickers folder...');
      const newFolder = farmerMainFolder.createFolder(qrStickersName);
      console.log('✅ Created QR-Stickers folder:', newFolder.getId());
      return newFolder;
    }
    
  } catch (error) {
    console.error('❌ Error creating QR stickers folder:', error);
    throw error;
  }
}

/**
 * Check if QR PDF already exists in Google Drive
 */
function checkExistingQRFile(qrCode) {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.QR_FILES);
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) { // Skip header
      if (data[i][0] === qrCode) { // QRCode column
        return {
          exists: true,
          fileId: data[i][2], // PDFFileID column
          fileName: data[i][3], // PDFFileName column
          downloadUrl: data[i][6] // DownloadURL column
        };
      }
    }
    
    return { exists: false };
    
  } catch (error) {
    console.error('Error checking existing QR file:', error);
    return { exists: false };
  }
}

/**
 * Save QR PDF file to Google Drive and record in database
 */
function saveQRPDFToDrive(qrCode, farmerId, htmlContent) {
  try {
    console.log('📁 Starting saveQRPDFToDrive...');
    console.log('📋 Parameters:', { qrCode, farmerId, htmlContentLength: htmlContent?.length });
    
    // Create HTML file in Drive (temporary)
    const htmlBlob = Utilities.newBlob(htmlContent, 'text/html', `QR-Stickers-${qrCode}.html`);
    console.log('✅ Created HTML blob');
    
    // Get QR Stickers folder for this farmer
    console.log('🔍 Getting QR Stickers folder...');
    const qrFolder = getOrCreateQRStickersFolder(farmerId);
    
    // Save HTML file to Drive
    const htmlFile = qrFolder.createFile(htmlBlob);
    
    // Generate public download URL
    htmlFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileUrl = `https://drive.google.com/file/d/${htmlFile.getId()}/view`;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${htmlFile.getId()}`;
    
    // Save to QR_FILES sheet
    console.log('💾 Saving to QR_FILES sheet...');
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // Check if QR_FILES sheet exists, create if not
    let sheet = spreadsheet.getSheetByName(CONFIG.SHEETS.QR_FILES);
    if (!sheet) {
      console.log('📋 QR_FILES sheet not found, creating...');
      sheet = spreadsheet.insertSheet(CONFIG.SHEETS.QR_FILES);
      // Add headers
      const headers = ['QRCode', 'FarmerID', 'PDFFileID', 'PDFFileName', 'CreatedAt', 'FileURL', 'DownloadURL'];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      console.log('✅ Created QR_FILES sheet with headers');
    }
    
    const now = new Date().toISOString();
    const rowData = [
      qrCode,                    // QRCode
      farmerId,                  // FarmerID  
      htmlFile.getId(),          // PDFFileID
      htmlFile.getName(),        // PDFFileName
      now,                       // CreatedAt
      fileUrl,                   // FileURL
      downloadUrl                // DownloadURL
    ];
    
    console.log('💾 Adding row to QR_FILES sheet:', rowData);
    sheet.appendRow(rowData);
    console.log('✅ Data saved to QR_FILES sheet');
    
    console.log('✅ PDF saved to Drive:', fileUrl);
    
    return {
      success: true,
      fileId: htmlFile.getId(),
      fileName: htmlFile.getName(),
      fileUrl: fileUrl,
      downloadUrl: downloadUrl
    };
    
  } catch (error) {
    console.error('❌ Error saving PDF to Drive:', error);
    throw error;
  }
}

/**
 * Initialize sheet headers
 */
function initializeSheetHeaders(sheet, sheetName) {
  let headers = [];
  
  switch (sheetName) {
    case CONFIG.SHEETS.USERS:
      headers = ['UserID', 'Username', 'Password', 'Role', 'GroupID', 'Status', 'FirstLogin', 'LastLogin', 'Created'];
      break;
      
    case CONFIG.SHEETS.GROUPS:
      headers = ['GroupID', 'GroupCode', 'GroupName', 'RegistrationDoc', 'GAPCert', 'Status', 'Created', 'Updated', 'ManagerUsername', 'MainFolderId', 'RegistrationFolderId', 'GAPFolderId', 'FarmerDocsFolderId', 'ProductImagesFolderId', 'ReportsFolderId'];
      break;
      
    case CONFIG.SHEETS.FARMERS:
      headers = ['FarmerID', 'GroupID', 'PlotNumber', 'IDCard', 'FullName', 'Address', 'Area', 'Phone', 'Username', 'Status', 'Created', 'PlotImages', 'ProductImages', 'ActivityImages', 'CertificationDocs', 'PlantingMethod', 'PlantingMethodImages', 'CareRecords', 'CareRecordImages', 'FolderID'];
      break;
      
    case CONFIG.SHEETS.PRODUCTION_DATA:
      headers = ['ProductionID', 'FarmerID', 'SeasonID', 'CropType', 'CropVariety', 'PlantingMethod', 'PlantingMethodOther', 'Fertilizer', 'Pesticide', 'PlantDate', 'HarvestDate', 'RecordMethod', 'MaintenanceRecord', 'PestControl', 'WaterSource', 'WaterManagement', 'WaterSourceType', 'Status', 'Created', 'UpdatedAt'];
      break;
      
    case CONFIG.SHEETS.HARVEST_DATA:
      headers = ['HarvestID', 'FarmerID', 'ProductionID', 'ShipDate', 'HarvestMethod', 'PackagingCompany', 'PackagingLocation', 'PackagingProvince', 'ResponsiblePerson', 'LotCode', 'Quantity', 'Unit', 'Created', 'UpdatedAt'];
      break;
      
    case CONFIG.SHEETS.TRANSPORT_DATA:
      headers = ['TransportID', 'FarmerID', 'ProductionID', 'ShipDate', 'TransportChannel', 'TransportMethodOther', 'TransportMethod', 'TransportCompany', 'DistributorCode', 'Status', 'Created', 'UpdatedAt'];
      break;
      
    case CONFIG.SHEETS.DOCUMENTS:
      headers = ['DocumentID', 'FarmerID', 'ProductionID', 'FileType', 'FileName', 'FileURL', 'UploadDate', 'Status', 'UpdatedAt'];
      break;
      
    case CONFIG.SHEETS.ADDITIONAL_INFO:
      headers = ['InfoID', 'FarmerID', 'ProductionID', 'Story', 'Philosophy', 'Highlights', 'Comments', 'LastUpdate'];
      break;
      
    case CONFIG.SHEETS.QR_CODES:
      headers = ['QRID', 'QRCode', 'GroupCode', 'PlotNumber', 'FarmerID', 'Status', 'Created', 'ViewCount', 'LastViewed'];
      break;
      
    case CONFIG.SHEETS.SEARCH_CODES:
      headers = ['SearchID', 'SearchCode', 'ShipDate', 'QRCode', 'FarmerID', 'ProductionID', 'DistributorCode', 'LotCode', 'Status', 'Created', 'ViewCount', 'LastViewed'];
      break;
      
    case CONFIG.SHEETS.FOLDER_MAPPING:
      headers = ['type', 'groupId', 'farmerId', 'groupFolderId', 'documentsFolderId', 'farmersFolderId', 'farmerFolderId', 'farmPhotoFolderId', 'certificateFolderId', 'productPhotoFolderId', 'createdAt', 'groupCode', 'groupName', 'plotNumber', 'farmerName'];
      break;
      
    case CONFIG.SHEETS.FILE_RECORDS:
      headers = ['fileId', 'fileName', 'fileUrl', 'downloadUrl', 'farmerId', 'productionId', 'fileType', 'folderName', 'mimeType', 'fileSize', 'uploadedAt', 'status', 'updatedAt'];
      break;
      
    case CONFIG.SHEETS.QR_FILES:
      headers = ['QRCode', 'FarmerID', 'PDFFileID', 'PDFFileName', 'CreatedAt', 'FileURL', 'DownloadURL'];
      break;
  }
  
  if (headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

/**
 * Initialize default admin user
 */
function initializeDefaultAdmin() {
  const sheet = getSheet(CONFIG.SHEETS.USERS);
  const data = sheet.getDataRange().getValues();
  
  // Check if admin already exists
  const adminExists = data.some(row => row[1] === CONFIG.DEFAULT_ADMIN.username);
  
  if (!adminExists) {
    const adminData = [
      generateId(),
      CONFIG.DEFAULT_ADMIN.username,
      CONFIG.DEFAULT_ADMIN.password,
      CONFIG.DEFAULT_ADMIN.role,
      '',
      'Active',
      'FALSE',    // FirstLogin = FALSE (admin already set up)
      new Date(), // LastLogin
      new Date()  // Created
    ];
    
    sheet.appendRow(adminData);
    console.log('Default admin user created');
  }
}


/**
 * Health Check Endpoint - ตรวจสอบสถานะของระบบ
 */
function healthCheck() {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      checks: {}
    };
    
    // Test Spreadsheet Access
    try {
      const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      const sheetNames = spreadsheet.getSheets().map(sheet => sheet.getName());
      healthData.checks.spreadsheet = {
        status: 'ok',
        id: CONFIG.SPREADSHEET_ID,
        sheets: sheetNames.length,
        accessible: true
      };
    } catch (error) {
      healthData.checks.spreadsheet = {
        status: 'error',
        error: error.toString(),
        accessible: false
      };
      healthData.status = 'degraded';
    }
    
    // Test Drive Access
    try {
      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      healthData.checks.drive = {
        status: 'ok',
        folderId: CONFIG.DRIVE_FOLDER_ID,
        folderName: folder.getName(),
        accessible: true
      };
    } catch (error) {
      healthData.checks.drive = {
        status: 'error',
        error: error.toString(),
        accessible: false
      };
      healthData.status = 'degraded';
    }
    
    // Test Required Sheets
    try {
      const missingSheets = [];
      const requiredSheets = Object.values(CONFIG.SHEETS);
      const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      
      requiredSheets.forEach(sheetName => {
        try {
          const sheet = spreadsheet.getSheetByName(sheetName);
          if (!sheet) {
            missingSheets.push(sheetName);
          } else {
            // Test read access
            sheet.getDataRange().getValues();
          }
        } catch (error) {
          missingSheets.push(`${sheetName} (${error.message})`);
        }
      });
      
      healthData.checks.sheets = {
        status: missingSheets.length === 0 ? 'ok' : 'error',
        required: requiredSheets.length,
        missing: missingSheets,
        accessible: missingSheets.length === 0
      };
      
      if (missingSheets.length > 0) {
        healthData.status = 'error';
      }
    } catch (error) {
      healthData.checks.sheets = {
        status: 'error',
        error: error.toString()
      };
      healthData.status = 'error';
    }
    
    return healthData;
  } catch (error) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.toString(),
      message: 'Health check failed'
    };
  }
}

/**
 * Test Sheets Connection - ทดสอบการเชื่อมต่อ Google Sheets
 */
function testSheetsConnection() {
  try {
    console.log('🔍 Testing Google Sheets connection...');
    
    // Test spreadsheet access
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    console.log('✅ Spreadsheet accessible:', spreadsheet.getName());
    
    // Test each required sheet
    const requiredSheets = Object.values(CONFIG.SHEETS);
    const results = {
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      spreadsheetName: spreadsheet.getName(),
      totalSheets: spreadsheet.getSheets().length,
      requiredSheets: requiredSheets.length,
      missingSheets: [],
      accessibleSheets: [],
      errors: []
    };
    
    requiredSheets.forEach(sheetName => {
      try {
        const sheet = spreadsheet.getSheetByName(sheetName);
        if (!sheet) {
          results.missingSheets.push(sheetName);
        } else {
          // Test read access
          const data = sheet.getDataRange().getValues();
          results.accessibleSheets.push({
            name: sheetName,
            rows: data.length,
            columns: data.length > 0 ? data[0].length : 0
          });
          console.log(`✅ Sheet "${sheetName}" accessible with ${data.length} rows`);
        }
      } catch (error) {
        console.error(`❌ Error accessing sheet "${sheetName}":`, error);
        results.errors.push({
          sheet: sheetName,
          error: error.toString()
        });
      }
    });
    
    const success = results.missingSheets.length === 0 && results.errors.length === 0;
    
    console.log(success ? '✅ Sheets connection test PASSED' : '❌ Sheets connection test FAILED');
    
    return {
      success: success,
      message: success ? 'All sheets accessible' : 'Some sheets have issues',
      data: results
    };
    
  } catch (error) {
    console.error('❌ Critical error in sheets connection test:', error);
    return {
      success: false,
      error: error.toString(),
      message: 'Cannot access spreadsheet - check SPREADSHEET_ID and permissions'
    };
  }
}

/**
 * Test Drive Access - ทดสอบการเข้าถึง Google Drive
 */
function testDriveAccess() {
  try {
    console.log('🔍 Testing Google Drive access...');
    
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const files = folder.getFiles();
    const subfolders = folder.getFolders();
    
    let fileCount = 0;
    let folderCount = 0;
    
    while (files.hasNext()) {
      files.next();
      fileCount++;
    }
    
    while (subfolders.hasNext()) {
      subfolders.next();
      folderCount++;
    }
    
    console.log('✅ Drive access test PASSED');
    
    return {
      success: true,
      message: 'Drive folder accessible',
      data: {
        folderId: CONFIG.DRIVE_FOLDER_ID,
        folderName: folder.getName(),
        filesCount: fileCount,
        subfoldersCount: folderCount,
        folderUrl: folder.getUrl()
      }
    };
    
  } catch (error) {
    console.error('❌ Drive access test FAILED:', error);
    return {
      success: false,
      error: error.toString(),
      message: 'Cannot access drive folder - check DRIVE_FOLDER_ID and permissions'
    };
  }
}

/**
 * Enhanced Main Web App entry point with better error handling
 */
function doPost(e) {
  const startTime = new Date();
  console.log('🚀 === doPost started ===', startTime.toISOString());
  
  
  try {
    console.log('📋 Request parameters:', e.parameter);
    console.log('📨 Content type:', e.postData?.type);
    console.log('📦 Raw postData length:', e.postData?.contents?.length || 0);
    
    // Parse request data based on content type
    let requestData = {};
    let action = '';
    
    if (e.postData && e.postData.contents) {
      if (e.postData.type === 'application/json') {
        try {
          requestData = JSON.parse(e.postData.contents);
          action = requestData.action;
          console.log('✅ Parsed JSON data, action:', action);
        } catch (parseError) {
          console.error('❌ Failed to parse JSON:', parseError);
          return ContentService
            .createTextOutput(JSON.stringify({ 
              success: false,
              error: 'Invalid JSON format',
              message: 'ข้อมูล JSON ไม่ถูกต้อง',
              timestamp: new Date().toISOString()
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      } else {
        // Handle URL encoded data - parse nested objects
        requestData = e.parameter;
        action = e.parameter.action;
        
        // Parse nested objects for complex operations
        if (action === 'updateProductionData') {
          try {
            ['production', 'harvest', 'transport', 'additionalInfo'].forEach(key => {
              if (requestData[key] && typeof requestData[key] === 'string') {
                requestData[key] = JSON.parse(requestData[key]);
              }
            });
            console.log('✅ Parsed nested objects for updateProductionData');
          } catch (nestedParseError) {
            console.error('❌ Failed to parse nested objects:', nestedParseError);
            return ContentService
              .createTextOutput(JSON.stringify({
                success: false,
                error: 'Invalid nested data format',
                message: 'รูปแบบข้อมูลซ้อนไม่ถูกต้อง'
              }))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
    } else {
      requestData = e.parameter || {};
      action = requestData.action;
    }
    
    // Handle special system endpoints first
    if (action === 'health' || action === 'healthCheck') {
      console.log('🏥 Health check requested');
      const healthResult = healthCheck();
      return ContentService
        .createTextOutput(JSON.stringify(healthResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'testSheetsConnection') {
      console.log('🔍 Sheets connection test requested');
      const testResult = testSheetsConnection();
      return ContentService
        .createTextOutput(JSON.stringify(testResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'testDriveAccess') {
      console.log('📁 Drive access test requested');
      const driveResult = testDriveAccess();
      return ContentService
        .createTextOutput(JSON.stringify(driveResult))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (!action) {
      console.warn('⚠️ No action specified in request');
      return ContentService
        .createTextOutput(JSON.stringify({ 
          success: false,
          error: 'No action specified',
          message: 'ไม่พบการระบุการทำงาน (action)',
          availableActions: ['health', 'testSheetsConnection', 'testDriveAccess', 'login', 'getAllGroups'],
          timestamp: new Date().toISOString()
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    console.log('🎯 Processing action:', action);
    let result;
    
    // Route to appropriate function based on action
    switch (action) {
      // Authentication
      case 'login':
        result = handleLogin(requestData);
        break;
      case 'changePassword':
        result = handleChangePassword(requestData);
        break;
      case 'changePasswordFirstTime':
        result = handleChangePasswordFirstTime(requestData);
        break;
      case 'validateSession':
        result = handleValidateSession(requestData);
        break;
        
      // QR Code operations
      case 'searchQRCode':
        result = handleSearchQRCode(e.parameter);
        break;
      case 'searchDeepCode':
        result = handleSearchDeepCode(e.parameter);
        break;
      case 'handleDeepSearch':
        result = handleDeepSearch(e.parameter);
        break;
      case 'checkSearchCodes':
        result = handleCheckSearchCodes(e.parameter);
        break;
      case 'generateQRCode':
        result = handleGenerateQRCode(e.parameter);
        break;
        
      // Admin operations
      case 'getAllGroups':
        result = handleGetAllGroups(e.parameter);
        break;
      case 'createGroup':
        result = handleCreateGroup(e.parameter);
        break;
      case 'updateGroup':
        result = handleUpdateGroup(e.parameter);
        break;
      case 'deleteGroup':
        result = handleDeleteGroup(e.parameter);
        break;
      case 'getSystemStats':
        result = handleGetSystemStats(e.parameter);
        break;
      case 'testDriveAccess':
        result = testDriveAccess();
        break;
      case 'testSheetsConnection':
        result = testSheetsConnection();
        break;
        
      // Group operations
      case 'getGroupData':
        result = handleGetGroupData(e.parameter);
        break;
      case 'updateGroupProfile':
        result = handleUpdateGroupProfile(e.parameter);
        break;
      case 'getGroupFarmers':
        result = handleGetGroupFarmers(e.parameter);
        break;
      case 'addFarmer':
        result = handleAddFarmer(e.parameter);
        break;
      case 'updateFarmer':
        result = handleUpdateFarmer(e.parameter);
        break;
      case 'deleteFarmer':
        result = handleDeleteFarmer(e.parameter);
        break;
        
      // Farmer operations
      case 'getFarmerData':
        result = handleGetFarmerData(e.parameter);
        break;
      case 'saveFarmerSection':
        result = handleSaveFarmerSection(e.parameter);
        break;
      case 'getFarmerQRCode':
        result = handleGetFarmerQRCode(e.parameter);
        break;
        
      // File operations
      case 'uploadFile':
        result = handleFileUpload(e.parameter);
        break;
      case 'uploadFileToFarmerFolder':
        result = uploadFileToFarmerFolder(e.parameter);
        break;
      case 'getFileUrl':
        result = handleGetFileUrl(e.parameter);
        break;
      case 'saveFarmerDocument':
        result = handleSaveFarmerDocument(e.parameter);
        break;
      case 'saveGroupDocument':
        result = handleSaveGroupDocument(e.parameter);
        break;
      case 'deleteFile':
        result = deleteFile(e.parameter.fileId, e.parameter.requestedBy);
        break;
      case 'listGroupFiles':
        result = listGroupFiles(e.parameter.groupId, e.parameter.folderType);
        break;
      case 'getFileStats':
        result = getFileStats(e.parameter.groupId, e.parameter.days);
        break;
        
      // System operations
      case 'initialize':
        result = initializeSheets();
        break;
      case 'debugFolderMapping':
        result = debugFolderMapping();
        break;
      case 'debugQRFiles':
        result = debugQRFiles();
        break;
      
      // NEW FARMER FUNCTIONS
      case 'getFarmerDashboardState':
        result = getFarmerDashboardState(e.parameter);
        break;
      case 'getFarmerByUsername':
        result = handleGetFarmerByUsername(e.parameter);
        break;
      case 'updateFarmerProfile':
        result = updateFarmerProfile(e.parameter);
        break;
      case 'generateFarmerQRCode':
        result = getOrCreateFarmerQRCode(e.parameter.farmerID);
        break;
      case 'createProductionCycle':
        result = createProductionCycle(e.parameter);
        break;
      case 'getProductionHistory':
        result = getLatestProductionRecords(e.parameter.farmerID, e.parameter.limit);
        break;
      case 'getProductionDetail':
        result = getProductionDetail(e.parameter);
        break;
      case 'updateProductionCycle':
        result = updateProductionCycle(e.parameter);
        break;
      case 'deleteProductionCycle':
        result = deleteProductionCycle(e.parameter);
        break;
      case 'uploadFarmerDocument':
        result = uploadFarmerDocument(e.parameter);
        break;
      case 'getFarmerDocuments':
        result = getFarmerDocuments(e.parameter);
        break;
      case 'deleteFarmerDocument':
        result = deleteFarmerDocument(e.parameter);
        break;
      case 'generateSearchCode':
        result = generateSearchCodeForProduction(e.parameter);
        break;
      case 'generateQRStickerPDF':
        result = generateQRStickerPDF(e.parameter);
        break;
      case 'getFarmerStatistics':
        result = getFarmerStatistics(e.parameter);
        break;
      case 'searchByQRCode':
        result = handleSearchQRCode(e.parameter);
        break;
      case 'searchBySearchCode':
        result = handleSearchBySearchCode(e.parameter);
        break;
      case 'checkExistingQRFile':
        result = checkExistingQRFile(e.parameter.qrCode);
        break;
      case 'updateProductionData':
        console.log('🔄 Code.gs: updateProductionData case triggered');
        console.log('🔄 requestData:', JSON.stringify(requestData, null, 2));
        
        try {
          // Check if function exists
          if (typeof updateProductionData === 'function') {
            console.log('✅ updateProductionData function found');
            result = updateProductionData(requestData);
            console.log('🔄 updateProductionData result:', result);
          } else {
            console.error('❌ updateProductionData function not found!');
            result = {
              success: false,
              message: 'updateProductionData function not available'
            };
          }
        } catch (funcError) {
          console.error('❌ Error calling updateProductionData:', funcError);
          console.error('❌ Error stack:', funcError.stack);
          result = {
            success: false,
            message: 'Error calling updateProductionData: ' + funcError.toString()
          };
        }
        break;
      case 'debugUpdateTest':
        result = debugUpdateTest(e.parameter);
        break;
      case 'deleteFileRecord':
        result = deleteFileRecord(e.parameter);
        break;
        
      default:
        result = { error: 'Unknown action: ' + action };
    }
    
    // Add processing time to response
    const endTime = new Date();
    const processingTime = endTime.getTime() - startTime.getTime();
    
    if (result && typeof result === 'object') {
      result.processingTime = processingTime;
      result.timestamp = endTime.toISOString();
    }
    
    console.log(`✅ Request processed successfully in ${processingTime}ms`);
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    const endTime = new Date();
    const processingTime = endTime.getTime() - startTime.getTime();
    
    console.error('❌ Critical error in doPost:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Request action:', action);
    console.error('❌ Processing time before error:', processingTime + 'ms');
    
    // Enhanced error response with more details
    const errorResponse = {
      success: false,
      error: 'Server Error',
      message: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์',
      details: {
        action: action || 'unknown',
        errorType: error.name || 'UnknownError',
        errorMessage: error.toString(),
        processingTime: processingTime,
        timestamp: endTime.toISOString()
      }
    };
    
    // Add helpful hints for common errors
    if (error.toString().includes('SpreadsheetApp')) {
      errorResponse.hint = 'ปัญหาการเข้าถึง Google Sheets - ตรวจสอบ SPREADSHEET_ID และสิทธิ์การเข้าถึง';
    } else if (error.toString().includes('DriveApp')) {
      errorResponse.hint = 'ปัญหาการเข้าถึง Google Drive - ตรวจสอบ DRIVE_FOLDER_ID และสิทธิ์การเข้าถึง';
    } else if (error.toString().includes('Permission')) {
      errorResponse.hint = 'ปัญหาสิทธิ์การเข้าถึง - ตรวจสอบการตั้งค่าสิทธิ์ในไฟล์และโฟลเดอร์';
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle getting file URL for viewing documents
 */
function handleGetFileUrl(params) {
  try {
    const groupId = params.groupId;
    const fileName = params.fileName;
    const fileType = params.fileType;
    
    if (!groupId || !fileName) {
      return { success: false, message: 'กรุณาระบุ groupId และ fileName' };
    }
    
    // Get group data with folder information
    const groupData = getGroupByIdWithFolders(groupId);
    if (!groupData) {
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม' };
    }
    
    // Determine which folder to search based on file type
    let folderId = null;
    switch (fileType) {
      case 'registration':
        folderId = groupData.registrationFolderId;
        break;
      case 'gap':
        folderId = groupData.gapFolderId;
        break;
      default:
        folderId = groupData.mainFolderId;
    }
    
    if (!folderId) {
      return { success: false, message: 'ไม่พบ folder สำหรับประเภทไฟล์นี้' };
    }
    
    // Search for the file in the specified folder
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName(fileName);
    
    if (files.hasNext()) {
      const file = files.next();
      return {
        success: true,
        fileUrl: file.getUrl(),
        viewUrl: `https://drive.google.com/file/d/${file.getId()}/view`,
        downloadUrl: `https://drive.google.com/uc?id=${file.getId()}`,
        fileName: file.getName(),
        fileSize: file.getSize(),
        lastModified: file.getLastUpdated()
      };
    } else {
      return { success: false, message: 'ไม่พบไฟล์ที่ระบุ' };
    }
    
  } catch (error) {
    Logger.log('Get file URL error: ' + error.toString());
    return { success: false, message: 'เกิดข้อผิดพลาดในการเข้าถึงไฟล์: ' + error.toString() };
  }
}

/**
 * ดึง QR Code หรือสร้างใหม่หากยังไม่มี
 */
function getOrCreateFarmerQRCode(farmerID) {
  // เรียกใช้ function จาก farmer-functions.gs
  return getOrCreateQRCode(farmerID);
}

/**
 * Handle GET requests
 */
function doGet(e) {
  try {
    // Basic info endpoint
    if (e.parameter.info) {
      return ContentService
        .createTextOutput(JSON.stringify({
          name: 'ระบบสอบย้อนกลับผักอุดร API',
          version: '1.0.0',
          status: 'active',
          timestamp: new Date().toISOString()
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Default response
    return HtmlService.createHtmlOutput(`
      <h1>ระบบสอบย้อนกลับผักอุดร API</h1>
      <p>API is running successfully</p>
      <p>Use POST method for API calls</p>
      <p>Timestamp: ${new Date().toISOString()}</p>
    `);
    
  } catch (error) {
    return HtmlService.createHtmlOutput(`
      <h1>Error</h1>
      <p>${error.toString()}</p>
    `);
  }
}

/**
 * Enhanced utility function to get sheet with comprehensive error handling
 */
function getSheet(sheetName) {
  try {
    if (!CONFIG.SPREADSHEET_ID) {
      throw new Error('SPREADSHEET_ID not configured in CONFIG');
    }
    
    if (!sheetName) {
      throw new Error('Sheet name is required');
    }
    
    console.log(`🔍 Accessing sheet: "${sheetName}"`);
    
    // Test spreadsheet access first
    let spreadsheet;
    try {
      spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    } catch (spreadsheetError) {
      console.error(`❌ Cannot access spreadsheet ${CONFIG.SPREADSHEET_ID}:`, spreadsheetError);
      throw new Error(`Cannot access spreadsheet. Check SPREADSHEET_ID (${CONFIG.SPREADSHEET_ID}) and permissions: ${spreadsheetError.message}`);
    }
    
    // Get the specific sheet
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      // List available sheets for debugging
      const availableSheets = spreadsheet.getSheets().map(s => s.getName());
      console.error(`❌ Sheet "${sheetName}" not found. Available sheets:`, availableSheets);
      throw new Error(`Sheet "${sheetName}" not found. Available sheets: ${availableSheets.join(', ')}`);
    }
    
    // Test sheet access by trying to read
    try {
      sheet.getDataRange().getValues();
      console.log(`✅ Sheet "${sheetName}" accessible`);
    } catch (accessError) {
      console.error(`❌ Cannot read sheet "${sheetName}":`, accessError);
      throw new Error(`Cannot read sheet "${sheetName}": ${accessError.message}`);
    }
    
    return sheet;
    
  } catch (error) {
    console.error(`❌ getSheet("${sheetName}") failed:`, error);
    throw error;
  }
}

/**
 * Generate unique ID
 */
function generateId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate group code (01, 02, 03, etc.)
 */
function generateGroupCode() {
  const sheet = getSheet(CONFIG.SHEETS.GROUPS);
  const data = sheet.getDataRange().getValues();
  
  // Count existing groups (excluding header)
  const groupCount = data.length - 1;
  
  // Generate next group code (zero-padded)
  const nextNumber = groupCount + 1;
  return nextNumber.toString().padStart(2, '0');
}

/**
 * Get current Thailand timestamp
 */
function getCurrentTimestamp() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Validate user authentication
 */
function validateUser(username, role = null) {
  const sheet = getSheet(CONFIG.SHEETS.USERS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[1] === username && row[5] === 'active') {
      if (role && row[3] !== role) {
        return null; // Wrong role
      }
      return {
        id: row[0],
        username: row[1],
        role: row[3],
        groupId: row[4]
      };
    }
  }
  
  return null;
}

/**
 * Update last login time
 */
function updateLastLogin(username) {
  const sheet = getSheet(CONFIG.SHEETS.USERS);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    // Clean stored username (remove leading ' if exists)
    const storedUsername = String(data[i][1]).replace(/^'/, '');
    if (storedUsername === username) {
      sheet.getRange(i + 1, 8).setValue(getCurrentTimestamp());
      break;
    }
  }
}

/**
 * Handle user login
 */
function handleLogin(params) {
  try {
    const username = params.username;
    const password = params.password;
    
    if (!username || !password) {
      return {
        success: false,
        message: 'กรุณาใส่ชื่อผู้ใช้และรหัสผ่าน'
      };
    }
    
    // Get user data from Users sheet
    const usersSheet = getSheet(CONFIG.SHEETS.USERS);
    const userData = usersSheet.getDataRange().getValues();
    
    // Skip header row and find matching user
    for (let i = 1; i < userData.length; i++) {
      const row = userData[i];
      const [id, storedUsername, storedPassword, role, groupId, status, created, lastLogin] = row;
      
      // Clean stored values (remove leading ' if exists)
      const cleanUsername = String(storedUsername).replace(/^'/, '');
      const cleanPassword = String(storedPassword).replace(/^'/, '');
      
      if (cleanUsername === username && status === 'active') {
        if (cleanPassword === password) {
          // Update last login time
          updateLastLogin(username);
          
          // Get user full name based on role
          let fullName = username;
          if (role === 'farmer') {
            // Get farmer name from Farmers sheet
            const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
            const farmersData = farmersSheet.getDataRange().getValues();
            
            for (let j = 1; j < farmersData.length; j++) {
              const farmerRow = farmersData[j];
              // Clean farmer username (remove leading ' if exists)
              const farmerUsername = String(farmerRow[8]).replace(/^'/, '');
              if (farmerUsername === username) { // Username column (index 8)
                fullName = farmerRow[4]; // FullName column
                break;
              }
            }
          } else if (role === 'group') {
            // Get group name
            const groupsSheet = getSheet(CONFIG.SHEETS.GROUPS);
            const groupsData = groupsSheet.getDataRange().getValues();
            
            for (let j = 1; j < groupsData.length; j++) {
              const groupRow = groupsData[j];
              if (groupRow[0] === groupId) { // GroupID column
                fullName = `ผู้จัดการกลุ่ม ${groupRow[2]}`; // GroupName column
                break;
              }
            }
          } else if (role === 'admin') {
            fullName = 'ผู้ดูแลระบบ';
          }
          
          return {
            success: true,
            user: {
              id: id,
              username: username,
              role: role,
              groupId: groupId,
              fullName: fullName
            },
            token: generateAuthToken(),
            message: 'เข้าสู่ระบบสำเร็จ'
          };
        } else {
          return {
            success: false,
            message: 'รหัสผ่านไม่ถูกต้อง'
          };
        }
      }
    }
    
    return {
      success: false,
      message: 'ไม่พบผู้ใช้หรือบัญชีถูกปิดใช้งาน'
    };
    
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ'
    };
  }
}

/**
 * Handle change password
 */
function handleChangePassword(params) {
  try {
    const { username, oldPassword, newPassword } = params;
    
    if (!username || !oldPassword || !newPassword) {
      return {
        success: false,
        message: 'กรุณาใส่ข้อมูลให้ครบถ้วน'
      };
    }
    
    if (newPassword.length < 6) {
      return {
        success: false,
        message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'
      };
    }
    
    const usersSheet = getSheet(CONFIG.SHEETS.USERS);
    const userData = usersSheet.getDataRange().getValues();
    
    // Find and update user password
    for (let i = 1; i < userData.length; i++) {
      const row = userData[i];
      // Clean stored values (remove leading ' if exists)
      const storedUsername = String(row[1]).replace(/^'/, '');
      const storedPassword = String(row[2]).replace(/^'/, '');
      if (storedUsername === username && storedPassword === oldPassword && row[5] === 'active') {
        usersSheet.getRange(i + 1, 3).setValue("'" + newPassword); // Update password column with ' prefix
        return {
          success: true,
          message: 'เปลี่ยนรหัスผ่านสำเร็จ'
        };
      }
    }
    
    return {
      success: false,
      message: 'รหัสผ่านเก่าไม่ถูกต้อง'
    };
    
  } catch (error) {
    console.error('Change password error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน'
    };
  }
}

/**
 * Generate authentication token
 */
function generateAuthToken() {
  return 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
}

/**
 * Handle getFarmerByUsername API call
 */
function handleGetFarmerByUsername(params) {
  try {
    console.log('handleGetFarmerByUsername called with params:', params);
    
    const username = params.username;
    if (!username) {
      return { success: false, message: 'Username จำเป็นต้องระบุ' };
    }
    
    // เรียกใช้ function จาก farmer-functions.gs แทน
    const result = getFarmerByUsername(username);
    
    // farmer-functions.gs return {success: true/false, data: ...} อยู่แล้ว
    return result;
    
  } catch (error) {
    console.error('Error in handleGetFarmerByUsername:', error);
    return { 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเกษตรกร',
      error: error.toString()
    };
  }
}

/**
 * Test function to check folder mapping data
 */
function debugFolderMapping() {
  try {
    console.log('🔍 Debugging FOLDER_MAPPING sheet...');
    
    const sheet = getSheet(CONFIG.SHEETS.FOLDER_MAPPING);
    const data = sheet.getDataRange().getValues();
    
    console.log('📊 Total rows:', data.length);
    console.log('📋 Headers:', data[0]);
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      console.log(`Row ${i}:`, {
        type: row[0],
        groupId: row[1], 
        farmerId: row[2],
        farmerFolderId: row[6],
        farmerName: row[14]
      });
    }
    
    return {
      success: true,
      totalRows: data.length - 1,
      data: data.slice(1).map(row => ({
        farmerId: row[2],
        farmerFolderId: row[6], 
        farmerName: row[14]
      }))
    };
    
  } catch (error) {
    console.error('❌ Error in debugFolderMapping:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Test function to check QR_FILES sheet
 */
function debugQRFiles() {
  try {
    console.log('🔍 Debugging QR_FILES sheet...');
    
    const sheet = getSheet(CONFIG.SHEETS.QR_FILES);
    const data = sheet.getDataRange().getValues();
    
    console.log('📊 Total rows:', data.length);
    console.log('📋 Headers:', data[0]);
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      console.log(`Row ${i}:`, {
        qrCode: row[0],
        farmerId: row[1],
        fileName: row[3],
        createdAt: row[4]
      });
    }
    
    return {
      success: true,
      totalRows: data.length - 1,
      data: data.slice(1)
    };
    
  } catch (error) {
    console.error('❌ Error in debugQRFiles:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Create test folder mapping for farmer VtHUy98q
 */
function createTestFolderMapping() {
  try {
    console.log('🔧 Creating test folder mapping...');
    
    // สร้าง test folder ใน Google Drive
    const mainFolder = DriveApp.getRootFolder().createFolder('TEST-Farmer-VtHUy98q');
    const farmPhotoFolder = mainFolder.createFolder('รูปภาพแปลงปลูก');
    const certificateFolder = mainFolder.createFolder('เอกสารการรับรอง');
    const productPhotoFolder = mainFolder.createFolder('รูปภาพผลิตภัณฑ์');
    
    console.log('✅ Created test folders in Google Drive');
    
    // เพิ่มข้อมูลใน FolderMapping sheet
    const sheet = getSheet(CONFIG.SHEETS.FOLDER_MAPPING);
    
    const testData = [
      'TEST001',              // MappingID
      'farmer',               // Type
      'qAUaJkYL',            // GroupID (from user data)  
      'VtHUy98q',            // FarmerID (from user data) - แก้ไขให้ตรงกับ user จริง
      mainFolder.getId(),     // GroupFolderId
      mainFolder.getId(),     // DocumentsFolderId
      mainFolder.getId(),     // FarmersFolderId
      mainFolder.getId(),     // FarmerFolderId ⭐ สำคัญ!
      farmPhotoFolder.getId(), // FarmPhotoFolderId
      certificateFolder.getId(), // CertificateFolderId
      productPhotoFolder.getId(), // ProductPhotoFolderId
      new Date().toISOString(), // CreatedAt
      'TEST',                 // GroupCode
      'กลุ่มทดสอบ',             // GroupName
      '12345678901234567',    // PlotNumber (from user data)
      'อภิชญา เลิศวงษ์สิน'      // FarmerName (from user data)
    ];
    
    sheet.appendRow(testData);
    
    console.log('✅ Added test data to FolderMapping sheet');
    console.log('📁 Main folder ID:', mainFolder.getId());
    console.log('🔗 Folder URL:', mainFolder.getUrl());
    
    return {
      success: true,
      mainFolderId: mainFolder.getId(),
      folderUrl: mainFolder.getUrl(),
      message: 'Test folder mapping created successfully'
    };
    
  } catch (error) {
    console.error('❌ Error creating test folder mapping:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Test generate QR Stickers directly
 */
function testGenerateQRStickers() {
  try {
    console.log('🧪 Testing QR Sticker generation...');
    
    const testData = {
      qrCode: 'qAUaJkYL-12345678901234567',
      farmerId: 'VtHUy98q', 
      saveToDrive: true
    };
    
    console.log('📋 Test data:', testData);
    
    // เรียก generateQRStickerPDF โดยตรง
    const result = generateQRStickerPDF(testData);
    
    console.log('✅ Test result:', result);
    
    return {
      success: true,
      testData: testData,
      result: result
    };
    
  } catch (error) {
    console.error('❌ Test error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Get logo file IDs from Google Drive folder
 */
function getLogoFileIds() {
  try {
    console.log('🔍 Getting logo files from Google Drive folder...');
    
    const logoFolderId = '1rpljv0oygYgvJHgkpNu6GAHk1MlpQTyL';
    const logoFolder = DriveApp.getFolderById(logoFolderId);
    
    const logoFiles = {};
    const files = logoFolder.getFiles();
    
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      const fileId = file.getId();
      
      console.log(`📁 Found file: ${fileName} (ID: ${fileId})`);
      
      logoFiles[fileName] = {
        id: fileId,
        name: fileName,
        downloadUrl: `https://drive.google.com/uc?id=${fileId}`,
        viewUrl: `https://drive.google.com/file/d/${fileId}/view`
      };
    }
    
    console.log('📋 All logo files:', logoFiles);
    
    return {
      success: true,
      logoFiles: logoFiles
    };
    
  } catch (error) {
    console.error('❌ Error getting logo files:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Fix existing FOLDER_MAPPING data
 */
function fixFolderMapping() {
  try {
    console.log('🔧 Fixing FOLDER_MAPPING data...');
    
    const sheet = getSheet(CONFIG.SHEETS.FOLDER_MAPPING);
    const data = sheet.getDataRange().getValues();
    
    console.log('📊 Current data:', data);
    
    // ปรับแก้ข้อมูลแถวที่ 2 (index 1)
    if (data.length > 1) {
      // เปลี่ยน farmerId จาก 'qAUaJkYL' เป็น 'VtHUy98q'
      sheet.getRange(2, 4).setValue('VtHUy98q'); // Column D = FarmerID
      console.log('✅ Updated farmerId to VtHUy98q');
    }
    
    return {
      success: true,
      message: 'FOLDER_MAPPING fixed successfully'
    };
    
  } catch (error) {
    console.error('❌ Error fixing FOLDER_MAPPING:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Test function to setup the system
 */
function setupSystem() {
  return initializeSheets();
}


/**
 * Get harvest data by farmer and optionally by production ID
 */
function getHarvestDataByFarmer(farmerID, productionID = null) {
  try {
    const harvestSheet = getSheet(CONFIG.SHEETS.HARVEST_DATA);
    const harvestData = harvestSheet.getDataRange().getValues();
    const harvestHeaders = harvestData[0];
    
    const results = [];
    
    for (let i = 1; i < harvestData.length; i++) {
      const row = harvestData[i];
      const rowFarmerID = row[1]; // FarmerID is in column 1
      const rowProductionID = row[2]; // ProductionID is in column 2
      
      // Check if this row matches our criteria
      const farmerMatch = rowFarmerID === farmerID;
      const productionMatch = !productionID || rowProductionID === productionID;
      
      if (farmerMatch && productionMatch) {
        const harvestRecord = {};
        harvestHeaders.forEach((header, index) => {
          harvestRecord[header] = row[index];
        });
        results.push(harvestRecord);
      }
    }
    
    return results;
  } catch (error) {
    console.error('getHarvestDataByFarmer error:', error);
    return [];
  }
}

/**
 * Get transport data by farmer and optionally by production ID
 */
function getTransportDataByFarmer(farmerID, productionID = null) {
  try {
    const transportSheet = getSheet(CONFIG.SHEETS.TRANSPORT_DATA);
    const transportData = transportSheet.getDataRange().getValues();
    const transportHeaders = transportData[0];
    
    const results = [];
    
    for (let i = 1; i < transportData.length; i++) {
      const row = transportData[i];
      const rowFarmerID = row[1]; // FarmerID is in column 1
      const rowProductionID = row[2]; // ProductionID is in column 2
      
      // Check if this row matches our criteria
      const farmerMatch = rowFarmerID === farmerID;
      const productionMatch = !productionID || rowProductionID === productionID;
      
      if (farmerMatch && productionMatch) {
        const transportRecord = {};
        transportHeaders.forEach((header, index) => {
          transportRecord[header] = row[index];
        });
        results.push(transportRecord);
      }
    }
    
    return results;
  } catch (error) {
    console.error('getTransportDataByFarmer error:', error);
    return [];
  }
}

/**
 * Get additional info by farmer and optionally by production ID
 */
function getAdditionalInfoByFarmer(farmerID, productionID = null) {
  try {
    const additionalSheet = getSheet(CONFIG.SHEETS.ADDITIONAL_INFO);
    const additionalData = additionalSheet.getDataRange().getValues();
    const additionalHeaders = additionalData[0];
    
    const results = [];
    
    for (let i = 1; i < additionalData.length; i++) {
      const row = additionalData[i];
      const rowFarmerID = row[1]; // FarmerID is in column 1
      const rowProductionID = row[2]; // ProductionID is in column 2
      
      // Check if this row matches our criteria
      const farmerMatch = rowFarmerID === farmerID;
      const productionMatch = !productionID || rowProductionID === productionID;
      
      if (farmerMatch && productionMatch) {
        const additionalRecord = {};
        additionalHeaders.forEach((header, index) => {
          additionalRecord[header] = row[index];
        });
        results.push(additionalRecord);
      }
    }
    
    return results;
  } catch (error) {
    console.error('getAdditionalInfoByFarmer error:', error);
    return [];
  }
}

/**
 * Get file records by production ID
 */
function getFileRecordsByProductionId(productionID) {
  try {
    const fileRecordsSheet = getSheet(CONFIG.SHEETS.FILE_RECORDS);
    const fileRecordsData = fileRecordsSheet.getDataRange().getValues();
    const fileRecordsHeaders = fileRecordsData[0];
    
    const results = [];
    
    for (let i = 1; i < fileRecordsData.length; i++) {
      const row = fileRecordsData[i];
      const rowProductionID = row[5]; // productionId is in column 5
      const rowStatus = row[11]; // status is in column 11
      
      // Only return active files for the specified production ID
      if (rowProductionID === productionID && rowStatus === 'Active') {
        const fileRecord = {};
        fileRecordsHeaders.forEach((header, index) => {
          fileRecord[header] = row[index];
        });
        
        // Add additional properties for easier use
        fileRecord.fileUrl = row[2]; // fileUrl
        fileRecord.downloadUrl = row[3]; // downloadUrl
        fileRecord.fileName = row[1]; // fileName
        fileRecord.fileType = row[6]; // fileType
        fileRecord.mimeType = row[8]; // mimeType
        
        results.push(fileRecord);
      }
    }
    
    return results;
  } catch (error) {
    console.error('getFileRecordsByProductionId error:', error);
    return [];
  }
}