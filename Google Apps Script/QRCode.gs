/**
 * ระบบสอบย้อนกลับผักอุดร - QR Code Functions
 * ============================================
 */

/**
 * Get or create QR PNG image and save to farmer folder
 */
function getOrCreateQrPng(qrText, farmerId, groupId, phone) {
  try {
    // Ensure farmer folder exists (lazy creation)
    const folderResult = ensureFarmerFolderExists(farmerId, groupId, phone);
    
    if (!folderResult.success) {
      console.error('Cannot ensure farmer folder for QR PNG:', folderResult.message);
      return { success: false, message: folderResult.message };
    }
    
    // Check if QR image already exists
    const folder = DriveApp.getFolderById(folderResult.folderId);
    const files = folder.getFilesByName(`QR_${qrText}.png`);
    
    if (files.hasNext()) {
      const existingFile = files.next();
      return {
        success: true,
        fileId: existingFile.getId(),
        publicUrl: `https://drive.google.com/uc?id=${existingFile.getId()}`,
        base64: null // Could generate base64 if needed
      };
    }
    
    // Generate QR code image using external service or create placeholder
    // For now, create a simple text file as placeholder
    const qrContent = `QR Code: ${qrText}\nGenerated: ${new Date().toISOString()}`;
    const blob = Utilities.newBlob(qrContent, 'text/plain', `QR_${qrText}.txt`);
    const file = folder.createFile(blob);
    
    return {
      success: true,
      fileId: file.getId(),
      publicUrl: `https://drive.google.com/uc?id=${file.getId()}`,
      base64: null
    };
    
  } catch (error) {
    console.error('Get or create QR PNG error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้าง QR Code' };
  }
}

/**
 * Handle QR Code search for public access - Updated for new requirements
 */
function handleSearchQRCode(params) {
  try {
    const qrCode = params.qrCode || params.qr;
    
    if (!qrCode) {
      return { success: false, message: 'ไม่พบรหัส QR Code' };
    }
    
    console.log('Searching for QR Code:', qrCode);
    
    // Parse QR Code format: XX-XXXXXXXXXXXXXXXXX (02-12345678901234567)
    const qrPattern = /^(\d{2})-(\d{17})$/;
    const match = qrCode.match(qrPattern);
    
    if (!match) {
      return { success: false, message: 'รูปแบบ QR Code ไม่ถูกต้อง (ต้องเป็น XX-XXXXXXXXXXXXXXXXX)' };
    }
    
    const groupCode = match[1];
    const plotNumber = match[2];
    
    console.log('Parsed QR Code - GroupCode:', groupCode, 'PlotNumber:', plotNumber);
    
    // Find farmer by QR Code in QR_Codes table first
    const qrSheet = getSheet(CONFIG.SHEETS.QR_CODES);
    const qrData = qrSheet.getDataRange().getValues();
    let foundFarmerId = null;
    
    for (let i = 1; i < qrData.length; i++) {
      const row = qrData[i];
      if (row[1] === qrCode && row[5] === 'active') { // QRCode column and Status column
        foundFarmerId = row[4]; // FarmerID column
        console.log('Found FarmerID from QR_Codes:', foundFarmerId);
        break;
      }
    }
    
    if (!foundFarmerId) {
      // Fallback: Try to find by group code and plot number
      const farmerData = findFarmerByQRCode(groupCode, plotNumber);
      if (farmerData) {
        foundFarmerId = farmerData.farmerId;
      } else {
        return { success: false, message: 'ไม่พบข้อมูลสำหรับ QR Code นี้' };
      }
    }
    
    // Get farmer information
    const farmerData = getFarmerById(foundFarmerId);
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    console.log('Found farmer data:', farmerData);
    
    // Get group information - Fixed property name case sensitivity
    const groupData = getGroupById(farmerData.GroupID || farmerData.groupId);
    if (!groupData) {
      return { success: false, message: 'ไม่พบข้อมูลกลุ่มเกษตรกร' };
    }
    
    // Get available search codes for this QR Code
    const availableSearchCodes = [];
    const searchSheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const searchData = searchSheet.getDataRange().getValues();
    
    for (let i = 1; i < searchData.length; i++) {
      const row = searchData[i];
      if (row[3] === qrCode && row[8] === 'Active') { // QRCode column and Status column
        availableSearchCodes.push({
          searchCode: row[1],
          shipDate: row[2],
          productionId: row[5],
          distributorCode: row[6]
        });
      }
    }
    
    console.log(`Found ${availableSearchCodes.length} search codes for QR Code: ${qrCode}`);
    
    // Prepare response data for farmer basic info - Use exact property names from database headers
    const responseData = {
      qrCode: qrCode,
      groupCode: groupCode,
      plotNumber: farmerData.PlotNumber,
      groupName: groupData.GroupName,
      farmerName: farmerData.FullName,
      address: farmerData.Address,
      area: farmerData.Area,
      phone: farmerData.Phone,
      hasSearchCodes: availableSearchCodes.length > 0,
      searchCodesCount: availableSearchCodes.length,
      availableSearchCodes: availableSearchCodes
    };
    
    console.log('Farmer data from sheet:', farmerData);
    console.log('Group data from sheet:', groupData);
    console.log('Response data:', responseData);
    
    return {
      success: true,
      message: 'พบข้อมูลเกษตรกรสำเร็จ',
      data: responseData
    };
    
  } catch (error) {
    console.error('QR search error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการค้นหา QR Code: ' + error.toString() };
  }
}

/**
 * Handle deep search by search code - Updated for new requirements  
 */
function handleDeepSearch(params) {
  try {
    const searchCode = params.searchCode;
    
    if (!searchCode) {
      return { success: false, message: 'ไม่พบรหัสค้นหา' };
    }
    
    console.log('Deep search for SearchCode:', searchCode);
    
    // Validate search code format: YYYYMMDD-XXX
    const searchPattern = /^(\d{8})-(\d{3})$/;
    const match = searchCode.match(searchPattern);
    
    if (!match) {
      return { success: false, message: 'รูปแบบรหัสค้นหาไม่ถูกต้อง (ต้องเป็น YYYYMMDD-XXX)' };
    }
    
    // Find search code record in Search_Codes table
    const searchSheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const searchData = searchSheet.getDataRange().getValues();
    
    let searchRecord = null;
    for (let i = 1; i < searchData.length; i++) {
      if (searchData[i][1] === searchCode) { // SearchCode column
        searchRecord = {
          searchId: searchData[i][0],      // SearchID
          searchCode: searchData[i][1],    // SearchCode
          shipDate: searchData[i][2],      // ShipDate
          qrCode: searchData[i][3],        // QRCode
          farmerId: searchData[i][4],      // FarmerID
          productionId: searchData[i][5],  // ProductionID
          distributorCode: searchData[i][6], // DistributorCode
          lotCode: searchData[i][7],       // LotCode
          status: searchData[i][8]         // Status
        };
        break;
      }
    }
    
    if (!searchRecord) {
      return { success: false, message: 'ไม่พบข้อมูล โปรดตรวจสอบและลองอีกครั้ง' };
    }
    
    // Validate that search code is active
    if (searchRecord.status !== 'Active') {
      return { success: false, message: 'ไม่พบข้อมูล โปรดตรวจสอบและลองอีกครั้ง' };
    }
    
    console.log('Found search record:', searchRecord);
    
    // Get farmer data
    const farmerData = getFarmerById(searchRecord.farmerId);
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูล โปรดตรวจสอบและลองอีกครั้ง' };
    }
    
    // Validate that QRCode exists and matches the farmer
    if (!searchRecord.qrCode) {
      return { success: false, message: 'ไม่พบข้อมูล โปรดตรวจสอบและลองอีกครั้ง' };
    }
    
    // Get group data for farmer - Fixed property name case sensitivity
    const groupData = getGroupById(farmerData.GroupID || farmerData.groupId);
    
    // Get production data (filter by ProductionID if available)
    const productions = getProductionDataByFarmer(searchRecord.farmerId, searchRecord.productionId);
    
    // Get harvest data (filter by ProductionID if available)
    const harvests = getHarvestDataByFarmer(searchRecord.farmerId, searchRecord.productionId);
    
    // Get transport data (filter by ProductionID if available)
    const transports = getTransportDataByFarmer(searchRecord.farmerId, searchRecord.productionId);
    
    // Get additional info (filter by ProductionID if available)
    const additionalInfo = getAdditionalInfoByFarmer(searchRecord.farmerId, searchRecord.productionId);
    
    // Get file records for this production cycle
    console.log('🔍 Searching files for ProductionID:', searchRecord.productionId);
    const fileRecords = getFileRecordsByProductionId(searchRecord.productionId);
    console.log('📁 Retrieved file records count:', fileRecords.length);
    
    return {
      success: true,
      data: {
        searchCode: searchCode,
        farmer: {
          FullName: farmerData.FullName || farmerData.fullName,
          PlotNumber: farmerData.PlotNumber || farmerData.plotNumber,
          GroupName: groupData?.GroupName || groupData?.groupName || '',
          Address: farmerData.Address || farmerData.address,
          Area: farmerData.Area || farmerData.area,
          Phone: farmerData.Phone || farmerData.phone
        },
        productions: productions,
        harvests: harvests,
        transports: transports,
        additionalInfo: additionalInfo,
        fileRecords: fileRecords
      }
    };
    
  } catch (error) {
    console.error('Deep search error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการค้นหาเชิงลึก: ' + error.toString() };
  }
}
function handleSearchDeepCode(params) {
  try {
    const searchCode = params.searchCode;
    const dateCode = params.dateCode;
    const sequenceCode = params.sequenceCode;
    
    if (!searchCode || !dateCode || !sequenceCode) {
      return { success: false, message: 'รหัสค้นหาไม่ครบถ้วน' };
    }
    
    // Find search code in database
    const searchData = findSearchCode(searchCode);
    if (!searchData) {
      return { success: false, message: 'ไม่พบรหัสค้นหานี้ในระบบ' };
    }
    
    // Get farmer data
    const farmerData = getFarmerById(searchData.farmerId);
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    // Get all sections data (2-6)
    const allData = getAllFarmerData(farmerData.farmerId);
    
    // Remove sensitive information (distributor company)
    if (allData.transportData) {
      delete allData.transportData.distributorCode;
    }
    
    return {
      success: true,
      message: 'พบข้อมูลเชิงลึกสำเร็จ',
      data: {
        searchCode: searchCode,
        qrCode: searchRecord.qrCode, // Add QR Code for validation
        farmer: {
          name: farmerData.fullName,
          plotNumber: farmerData.plotNumber
        },
        sections: allData
      }
    };
    
  } catch (error) {
    console.error('Deep search error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการค้นหาเชิงลึก' };
  }
}

/**
 * Generate QR Code for farmer
 */
function handleGenerateQRCode(params) {
  try {
    const farmerId = params.farmerId;
    
    if (!farmerId) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    const farmerData = getFarmerById(farmerId);
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    // ✅ ตรวจสอบ PlotNumber ก่อนสร้าง QR Code
    if (!farmerData.PlotNumber || String(farmerData.PlotNumber).trim() === '') {
      console.log('PlotNumber is empty for farmer:', farmerId);
      return { 
        success: false, 
        message: 'เกษตรกรยังไม่ได้กรอกหมายเลขแปลง ไม่สามารถสร้าง QR Code ได้',
        requiresPlotNumber: true 
      };
    }
    
    // ✅ ตรวจสอบ PlotNumber ต้องเป็น 17 หลัก
    if (String(farmerData.PlotNumber).length !== 17) {
      console.log('PlotNumber length is not 17 for farmer:', farmerId, 'PlotNumber:', farmerData.PlotNumber);
      return { 
        success: false, 
        message: 'หมายเลขแปลงต้องเป็นตัวเลข 17 หลัก',
        currentLength: String(farmerData.PlotNumber).length,
        plotNumber: farmerData.PlotNumber
      };
    }
    
    const groupData = getGroupById(farmerData.GroupID || farmerData.groupId);
    if (!groupData) {
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม' };
    }
    
    // ✅ ตรวจสอบ GroupCode ต้องเป็น 2 หลัก
    if (!groupData.groupCode || String(groupData.groupCode).length !== 2) {
      console.log('GroupCode length is not 2 for farmer:', farmerId, 'GroupCode:', groupData.groupCode);
      return { 
        success: false, 
        message: 'รหัสกลุ่มต้องเป็นตัวเลข 2 หลัก',
        currentGroupCode: groupData.groupCode
      };
    }
    
    // Generate QR Code: GroupCode-PlotNumber
    const qrCode = `${groupData.groupCode}-${farmerData.PlotNumber}`;
    
    // ✅ ตรวจสอบรูปแบบ QR Code สุดท้าย
    const qrPattern = /^(\d{2})-(\d{17})$/;
    if (!qrPattern.test(qrCode)) {
      console.error('Invalid QR Code format:', qrCode);
      return { 
        success: false, 
        message: 'รูปแบบ QR Code ไม่ถูกต้อง',
        generatedQRCode: qrCode,
        groupCode: groupData.groupCode,
        plotNumber: farmerData.PlotNumber
      };
    }
    
    // Save QR Code to database
    const qrResult = saveQRCode(qrCode, groupData.groupCode, farmerData.PlotNumber, farmerId);
    if (!qrResult.success) {
      return qrResult;
    }
    
    return {
      success: true,
      message: 'สร้าง QR Code สำเร็จ',
      qrCode: qrCode,
      qrId: qrResult.qrId
    };
    
  } catch (error) {
    console.error('Generate QR Code error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้าง QR Code: ' + error.toString() };
  }
}

/**
 * Generate search code for deep search
 */
function generateSearchCode(farmerId, shipDate) {
  try {
    // Convert ship date to format YYYYMMDD
    const date = new Date(shipDate);
    const year = (date.getFullYear() + 543).toString(); // Convert to Buddhist year
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateCode = year + month + day;
    
    // Get sequence number for this date
    const sequenceNumber = getNextSequenceNumber(dateCode);
    const sequenceCode = sequenceNumber.toString().padStart(3, '0');
    
    // Combine to create search code
    const searchCode = `${dateCode}-${sequenceCode}`;
    
    // Get farmer's QR Code
    const farmerData = getFarmerById(farmerId);
    const groupData = getGroupById(farmerData.GroupID || farmerData.groupId);
    const qrCode = `${groupData.groupCode}-${farmerData.plotNumber}`;
    
    // Save search code to database
    const searchResult = saveSearchCode(searchCode, shipDate, qrCode, farmerId);
    if (!searchResult.success) {
      return searchResult;
    }
    
    return {
      success: true,
      message: 'สร้างรหัสค้นหาสำเร็จ',
      searchCode: searchCode,
      searchId: searchResult.searchId
    };
    
  } catch (error) {
    console.error('Generate search code error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างรหัสค้นหา' };
  }
}

/**
 * Find farmer by QR Code components
 */
function findFarmerByQRCode(groupCode, plotNumber) {
  try {
    // First find group by group code
    const groupsSheet = getSheet(CONFIG.SHEETS.GROUPS);
    const groupsData = groupsSheet.getDataRange().getValues();
    let groupId = null;
    
    for (let i = 1; i < groupsData.length; i++) {
      if (groupsData[i][1] === groupCode) { // GroupCode is in column 2
        groupId = groupsData[i][0]; // GroupID is in column 1
        break;
      }
    }
    
    if (!groupId) {
      return null;
    }
    
    // Find farmer by group ID and plot number
    const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
    const farmersData = farmersSheet.getDataRange().getValues();
    
    for (let i = 1; i < farmersData.length; i++) {
      const row = farmersData[i];
      if (row[1] === groupId && row[2] === plotNumber) { // GroupID and PlotNumber
        return {
          farmerId: row[0],
          groupId: row[1],
          plotNumber: row[2],
          idCard: row[3],
          fullName: row[4],
          address: row[5],
          area: row[6],
          phone: row[7],
          created: row[8],
          username: row[9]
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Find farmer by QR error:', error);
    return null;
  }
}

/**
 * Find search code data
 */
function findSearchCode(searchCode) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === searchCode) {
        return {
          searchCode: row[0],
          shipDate: row[1],
          qrCode: row[2],
          farmerId: row[3],
          status: row[4],
          created: row[5]
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Find search code error:', error);
    return null;
  }
}

/**
 * Save QR Code to database
 */
function saveQRCode(qrCode, groupCode, plotNumber, farmerId) {
  try {
    // ✅ ตรวจสอบข้อมูลก่อนบันทึก
    if (!qrCode || !groupCode || !plotNumber || !farmerId) {
      console.error('Missing required data for QR Code:', { qrCode, groupCode, plotNumber, farmerId });
      return { success: false, message: 'ข้อมูลไม่ครบถ้วนสำหรับการสร้าง QR Code' };
    }
    
    // ✅ ตรวจสอบรูปแบบ QR Code
    const qrPattern = /^(\d{2})-(\d{17})$/;
    if (!qrPattern.test(qrCode)) {
      console.error('Invalid QR Code format before save:', qrCode);
      return { success: false, message: 'รูปแบบ QR Code ไม่ถูกต้อง (ต้องเป็น XX-XXXXXXXXXXXXXXXXX)' };
    }
    
    const sheet = getSheet(CONFIG.SHEETS.QR_CODES);
    
    // Check if QR Code already exists
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === qrCode) { // QRCode column (index 1)
        console.log('QR Code already exists:', qrCode);
        return { success: true, message: 'QR Code นี้มีอยู่ในระบบแล้ว', qrCode: qrCode };
      }
    }
    
    // Add new QR Code (match current sheet structure: QRID, QRCode, GroupCode, PlotNumber, FarmerID, Status, Created, ViewCount, LastViewed)
    const qrID = generateId();
    const qrData = [
      qrID,                   // QRID
      qrCode,                 // QRCode  
      groupCode,              // GroupCode (ไม่ใส่ ' เพื่อให้เป็น number)
      plotNumber,             // PlotNumber
      farmerId,               // FarmerID
      'active',               // Status
      getCurrentTimestamp(),  // Created
      0,                      // ViewCount
      ''                      // LastViewed
    ];
    
    sheet.appendRow(qrData);
    
    console.log('✅ QR Code saved successfully:', qrCode);
    
    return {
      success: true,
      message: 'บันทึก QR Code สำเร็จ',
      qrId: qrID,
      qrCode: qrCode
    };
    
  } catch (error) {
    console.error('Save QR Code error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึก QR Code: ' + error.toString() };
  }
}

/**
 * Save search code to database
 */
function saveSearchCode(searchCode, shipDate, qrCode, farmerId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    
    // Check if search code already exists
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === searchCode) {
        return { success: false, message: 'รหัสค้นหานี้มีอยู่ในระบบแล้ว' };
      }
    }
    
    // Add new search code
    const searchData = [
      searchCode,
      shipDate,
      qrCode,
      farmerId,
      'active',
      getCurrentTimestamp()
    ];
    
    sheet.appendRow(searchData);
    
    return {
      success: true,
      message: 'บันทึกรหัสค้นหาสำเร็จ',
      searchId: searchCode
    };
    
  } catch (error) {
    console.error('Save search code error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกรหัสค้นหา' };
  }
}

/**
 * Get next sequence number for a given date
 */
function getNextSequenceNumber(dateCode) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const data = sheet.getDataRange().getValues();
    
    let maxSequence = 0;
    
    for (let i = 1; i < data.length; i++) {
      const searchCode = data[i][0];
      if (searchCode && searchCode.startsWith(dateCode + '-')) {
        const parts = searchCode.split('-');
        if (parts.length === 2) {
          const sequence = parseInt(parts[1]);
          if (sequence > maxSequence) {
            maxSequence = sequence;
          }
        }
      }
    }
    
    return maxSequence + 1;
  } catch (error) {
    console.error('Get next sequence error:', error);
    return 1;
  }
}

/**
 * Check if farmer has deep search data
 */
function hasDeepSearchData(farmerId) {
  try {
    // Check if farmer has data in sections 2-6
    const sections = [
      CONFIG.SHEETS.PRODUCTION_DATA,
      CONFIG.SHEETS.HARVEST_DATA,
      CONFIG.SHEETS.TRANSPORT_DATA,
      CONFIG.SHEETS.DOCUMENTS,
      CONFIG.SHEETS.ADDITIONAL_INFO
    ];
    
    for (const sheetName of sections) {
      const sheet = getSheet(sheetName);
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === farmerId) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Check deep search data error:', error);
    return false;
  }
}

/**
 * Get all farmer data (sections 2-6)
 */
function getAllFarmerData(farmerId) {
  try {
    const allData = {};
    
    // Section 2: Production Data
    allData.productionData = getFarmerSectionData(CONFIG.SHEETS.PRODUCTION_DATA, farmerId);
    
    // Section 3: Harvest Data
    allData.harvestData = getFarmerSectionData(CONFIG.SHEETS.HARVEST_DATA, farmerId);
    
    // Section 4: Transport Data
    allData.transportData = getFarmerSectionData(CONFIG.SHEETS.TRANSPORT_DATA, farmerId);
    
    // Section 5: Documents
    allData.documents = getFarmerDocuments(farmerId);
    
    // Section 6: Additional Info
    allData.additionalInfo = getFarmerSectionData(CONFIG.SHEETS.ADDITIONAL_INFO, farmerId);
    
    return allData;
  } catch (error) {
    console.error('Get all farmer data error:', error);
    return {};
  }
}

/**
 * Get production data by farmer and optionally by production ID
 */
function getProductionDataByFarmer(farmerId, productionId = null) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowFarmerId = row[1]; // FarmerID column
      const rowProductionId = row[0]; // ProductionID column
      
      if (rowFarmerId === farmerId) {
        if (!productionId || rowProductionId === productionId) {
          const rowData = {};
          for (let j = 0; j < headers.length; j++) {
            rowData[headers[j]] = row[j];
          }
          results.push(rowData);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('Get production data error:', error);
    return [];
  }
}

/**
 * Get harvest data by farmer and optionally by production ID
 */
function getHarvestDataByFarmer(farmerId, productionId = null) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.HARVEST_DATA);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowFarmerId = row[1]; // FarmerID column
      const rowProductionId = row[2]; // ProductionID column
      
      if (rowFarmerId === farmerId) {
        if (!productionId || rowProductionId === productionId) {
          const rowData = {};
          for (let j = 0; j < headers.length; j++) {
            rowData[headers[j]] = row[j];
          }
          results.push(rowData);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('Get harvest data error:', error);
    return [];
  }
}

/**
 * Get transport data by farmer and optionally by production ID
 */
function getTransportDataByFarmer(farmerId, productionId = null) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.TRANSPORT_DATA);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowFarmerId = row[1]; // FarmerID column
      const rowProductionId = row[2]; // ProductionID column
      
      if (rowFarmerId === farmerId) {
        if (!productionId || rowProductionId === productionId) {
          const rowData = {};
          for (let j = 0; j < headers.length; j++) {
            rowData[headers[j]] = row[j];
          }
          results.push(rowData);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('Get transport data error:', error);
    return [];
  }
}

/**
 * Get additional info by farmer and optionally by production ID
 */
function getAdditionalInfoByFarmer(farmerId, productionId = null) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.ADDITIONAL_INFO);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowFarmerId = row[1]; // FarmerID column
      const rowProductionId = row[2]; // ProductionID column
      
      if (rowFarmerId === farmerId) {
        if (!productionId || rowProductionId === productionId) {
          const rowData = {};
          for (let j = 0; j < headers.length; j++) {
            rowData[headers[j]] = row[j];
          }
          results.push(rowData);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('Get additional info error:', error);
    return [];
  }
}

/**
 * Get farmer section data (legacy function for backward compatibility)
 */
function getFarmerSectionData(sheetName, farmerId) {
  try {
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === farmerId) { // FarmerID is usually in column 1 (index 1)
        const headers = data[0];
        const rowData = {};
        
        for (let j = 0; j < headers.length; j++) {
          rowData[headers[j]] = data[i][j];
        }
        
        return rowData;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Get farmer section data error:', error);
    return null;
  }
}

/**
 * Get farmer documents
 */
function getFarmerDocuments(farmerId) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.DOCUMENTS);
    const data = sheet.getDataRange().getValues();
    const documents = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === farmerId) {
        documents.push({
          farmerId: data[i][0],
          plotNumber: data[i][1],
          fileType: data[i][2],
          fileName: data[i][3],
          fileUrl: data[i][4],
          fileId: data[i][5],
          uploadDate: data[i][6]
        });
      }
    }
    
    return documents;
  } catch (error) {
    console.error('Get farmer documents error:', error);
    return [];
  }
}

/**
 * Get file records by production ID
 */
function getFileRecordsByProductionId(productionId) {
  try {
    if (!productionId) {
      console.log('❌ No productionId provided');
      return [];
    }
    
    console.log('🔍 Looking for files with ProductionID:', productionId);
    
    const sheet = getSheet(CONFIG.SHEETS.FILE_RECORDS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const results = [];
    
    console.log('📋 FileRecords headers:', headers);
    console.log('📊 Total FileRecords rows:', data.length - 1);
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowProductionId = row[5]; // productionId column (index 5)
      const rowStatus = row[11]; // status column (index 11)
      
      console.log(`📄 Row ${i}: ProductionID="${rowProductionId}", Status="${rowStatus}", FileType="${row[6]}"`);
      
      if (rowProductionId === productionId && rowStatus === 'Active') {
        const fileRecord = {};
        for (let j = 0; j < headers.length; j++) {
          fileRecord[headers[j]] = row[j];
        }
        results.push(fileRecord);
        console.log('✅ File matched:', fileRecord.FileName, 'Type:', fileRecord.FileType);
      }
    }
    
    console.log(`🎯 Found ${results.length} files for ProductionID: ${productionId}`);
    return results;
  } catch (error) {
    console.error('Get file records error:', error);
    return [];
  }
}

/**
 * Check if QR Code has search codes
 */
function handleCheckSearchCodes(params) {
  try {
    const qrCode = params.qrCode;
    
    if (!qrCode) {
      return { success: false, message: 'ไม่พบรหัส QR Code' };
    }
    
    console.log('🔍 Checking search codes for QR Code:', qrCode);
    
    const sheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const data = sheet.getDataRange().getValues();
    const searchCodes = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[3] === qrCode && row[8] === 'Active') { // QRCode column and Status column
        searchCodes.push({
          searchId: row[0],
          searchCode: row[1],
          shipDate: row[2],
          qrCode: row[3],
          farmerId: row[4],
          productionId: row[5],
          distributorCode: row[6],
          lotCode: row[7]
        });
      }
    }
    
    console.log(`📊 Found ${searchCodes.length} search codes for QR Code: ${qrCode}`);
    
    return {
      success: true,
      hasSearchCodes: searchCodes.length > 0,
      count: searchCodes.length,
      searchCodes: searchCodes
    };
    
  } catch (error) {
    console.error('Check search codes error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูลรอบการผลิต' };
  }
}

/**
 * Get farmer's QR Code
 */
function handleGetFarmerQRCode(params) {
  try {
    const farmerId = params.farmerId;
    
    if (!farmerId) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    const sheet = getSheet(CONFIG.SHEETS.QR_CODES);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][4] === farmerId && data[i][5] === 'active') {
        return {
          success: true,
          qrId: data[i][0],          // QRID
          qrCode: data[i][1],        // QRCode
          groupCode: data[i][2],     // GroupCode
          plotNumber: data[i][3],    // PlotNumber
          created: data[i][6]        // Created
        };
      }
    }
    
    return { success: false, message: 'ไม่พบ QR Code สำหรับเกษตรกรนี้' };
    
  } catch (error) {
    console.error('Get farmer QR Code error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึง QR Code' };
  }
}