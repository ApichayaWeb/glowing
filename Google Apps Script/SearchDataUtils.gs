/**
 * ระบบสอบย้อนกลับผักอุดร - Search Data Utilities
 * ===================================================
 * ฟังก์ชันเฉพาะสำหรับระบบค้นหา (search.html)
 * เพื่อไม่ให้กระทบต่อระบบอื่น ๆ
 */

/**
 * Get farmer data by ID specifically for search functionality
 * Uses dynamic column mapping to ensure correct field display
 */
function getFarmerByIdForSearch(farmerId) {
  try {
    console.log('🔍 [SEARCH] getFarmerByIdForSearch called with farmerId:', farmerId);
    
    const sheet = getSheet(CONFIG.SHEETS.FARMERS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    console.log('📋 [SEARCH] Farmers sheet headers:', headers);
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === farmerId) {
        console.log('✅ [SEARCH] Found farmer at row', i, ':', row);
        
        // Use dynamic mapping to ensure correct field names
        const farmerData = {};
        for (let j = 0; j < headers.length; j++) {
          farmerData[headers[j]] = row[j];
        }
        
        console.log('📦 [SEARCH] Mapped farmer data:', farmerData);
        return farmerData;
      }
    }
    
    console.log('❌ [SEARCH] Farmer not found with ID:', farmerId);
    return null;
  } catch (error) {
    console.error('❌ [SEARCH] Get farmer by ID error:', error);
    return null;
  }
}

/**
 * Get farmer section data specifically for search functionality
 * Uses dynamic column mapping to match Google Sheets headers exactly
 */
function getFarmerSectionDataForSearch(sheetName, farmerId) {
  try {
    console.log('🔍 [SEARCH] getFarmerSectionDataForSearch called:', { sheetName, farmerId });
    
    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const results = [];
    
    console.log('📋 [SEARCH] Sheet headers for', sheetName, ':', headers);
    
    // Find all records for this farmer (skip header row)
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === farmerId) { // FarmerID is in column B (index 1)
        const rowData = {};
        
        // Use DYNAMIC mapping - match Google Sheets headers exactly
        for (let j = 0; j < headers.length; j++) {
          rowData[headers[j]] = data[i][j];
        }
        
        console.log('📝 [SEARCH] Mapped row data:', rowData);
        results.push(rowData);
      }
    }
    
    console.log('📊 [SEARCH] Total records found:', results.length);
    return results;
  } catch (error) {
    console.error('❌ [SEARCH] Get farmer section data error:', error);
    return [];
  }
}

/**
 * Get all farmer sections data specifically for search functionality
 * Combines production, harvest, transport, and additional info data with dynamic mapping
 */
function getAllFarmerSectionsDataForSearch(farmerId) {
  try {
    console.log('🔍 [SEARCH] getAllFarmerSectionsDataForSearch called with farmerId:', farmerId);
    
    const result = {
      productionData: getFarmerSectionDataForSearch(CONFIG.SHEETS.PRODUCTION_DATA, farmerId),
      harvestData: getFarmerSectionDataForSearch(CONFIG.SHEETS.HARVEST_DATA, farmerId),
      transportData: getFarmerSectionDataForSearch(CONFIG.SHEETS.TRANSPORT_DATA, farmerId),
      additionalInfoData: getFarmerSectionDataForSearch(CONFIG.SHEETS.ADDITIONAL_INFO, farmerId)
    };
    
    console.log('📦 [SEARCH] Combined farmer sections data:', result);
    return result;
  } catch (error) {
    console.error('❌ [SEARCH] Get all farmer sections data error:', error);
    return {
      productionData: [],
      harvestData: [],
      transportData: [],
      additionalInfoData: []
    };
  }
}

/**
 * Handle search deep code specifically for search functionality
 * Uses search-specific functions to ensure correct data mapping
 * Enhanced with crop validation support
 */
function handleSearchDeepCodeForSearch(params) {
  try {
    console.log('🔍 [SEARCH] handleSearchDeepCodeForSearch called with params:', params);
    
    const searchCode = params.searchCode || params.code;
    const expectedCropType = params.expectedCropType;
    const expectedCropVariety = params.expectedCropVariety;
    
    if (!searchCode) {
      return { success: false, message: 'ไม่พบรหัสค้นหา' };
    }
    
    console.log('🔍 [SEARCH] Searching for SearchCode:', searchCode);
    console.log('🌱 [SEARCH] Expected crop validation:', { expectedCropType, expectedCropVariety });
    
    // Find in Search_Codes table
    const searchData = findSearchCodeForSearch(searchCode);
    if (!searchData) {
      return { success: false, message: 'ไม่พบรหัสค้นหานี้ในระบบ' };
    }
    
    console.log('✅ [SEARCH] Found search data:', searchData);
    
    // Get farmer data using search-specific function
    const farmerData = getFarmerByIdForSearch(searchData.FarmerID);
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    console.log('✅ [SEARCH] Found farmer data:', farmerData);
    
    // Get all sections data using search-specific function
    const allData = getAllFarmerSectionsDataForSearch(searchData.FarmerID);
    
    // Get file records for this production cycle
    const fileRecords = getFileRecordsByProductionIdForSearch(searchData.ProductionID);
    
    // Filter additionalInfo to match the specific ProductionID from SearchCode
    const filteredAdditionalInfo = (allData.additionalInfoData || []).filter(info => 
      info.ProductionID === searchData.ProductionID
    );
    
    console.log('📊 [SEARCH] All sections data:', allData);
    console.log('📁 [SEARCH] File records:', fileRecords);
    console.log('💬 [SEARCH] Filtered additional info for ProductionID', searchData.ProductionID, ':', filteredAdditionalInfo);
    
    // 🌱 Perform crop validation if crop data is provided
    let cropValidationResult = null;
    if (expectedCropType && expectedCropVariety) {
      cropValidationResult = validateCropInGoogleSheets(searchData.ProductionID, expectedCropType, expectedCropVariety);
      console.log('🌱 [SEARCH] Crop validation result:', cropValidationResult);
    }
    
    const result = {
      success: true,
      message: 'ค้นหาข้อมูลสำเร็จ',
      // 🌱 Add crop validation results to response
      isValidCrop: cropValidationResult ? cropValidationResult.isValid : null,
      actualCropType: cropValidationResult ? cropValidationResult.actualCropType : null,
      actualCropVariety: cropValidationResult ? cropValidationResult.actualCropVariety : null,
      expectedCropType: expectedCropType || null,
      expectedCropVariety: expectedCropVariety || null,
      matchedProductionID: cropValidationResult ? cropValidationResult.matchedProductionID : null,
      data: {
        searchCode: searchData.SearchCode,           // ✅ ส่งแค่ string
        qrCode: searchData.QRCode,                   // ✅ เพิ่ม qrCode ที่ search.html ต้องการ
        farmer: farmerData,
        productions: allData.productionData || [],   // ✅ เปลี่ยนชื่อให้ตรง
        harvests: allData.harvestData || [],         // ✅ เปลี่ยนชื่อให้ตรง
        transports: allData.transportData || [],     // ✅ เปลี่ยนชื่อให้ตรง
        fileRecords: fileRecords || [],              // ✅ ใช้ไฟล์จริงจาก FileRecords table
        additionalInfo: filteredAdditionalInfo || [] // ✅ ใช้ additionalInfo ที่ตรงกับ ProductionID เท่านั้น
      }
    };
    
    console.log('✅ [SEARCH] Final result with crop validation:', result);
    return result;
    
  } catch (error) {
    console.error('❌ [SEARCH] Search deep code error:', error);
    return { 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการค้นหา: ' + error.message 
    };
  }
}

/**
 * Get file records by production ID specifically for search functionality
 * Uses dynamic column mapping and detailed logging
 */
function getFileRecordsByProductionIdForSearch(productionId) {
  try {
    console.log('📁 [SEARCH] getFileRecordsByProductionIdForSearch called with:', productionId);
    
    if (!productionId) {
      console.log('❌ [SEARCH] No productionId provided');
      return [];
    }
    
    const sheet = getSheet(CONFIG.SHEETS.FILE_RECORDS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const results = [];
    
    console.log('📋 [SEARCH] FileRecords headers:', headers);
    console.log('📊 [SEARCH] Total FileRecords rows:', data.length - 1);
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowProductionId = row[5]; // ProductionID column (index 5)
      const rowStatus = row[11]; // Status column (index 11)
      
      console.log(`📄 [SEARCH] Row ${i}: ProductionID="${rowProductionId}", Status="${rowStatus}", FileType="${row[6]}"`);
      
      if (rowProductionId === productionId && rowStatus === 'Active') {
        const fileRecord = {};
        for (let j = 0; j < headers.length; j++) {
          fileRecord[headers[j]] = row[j];
        }
        results.push(fileRecord);
        console.log('✅ [SEARCH] File matched:', fileRecord.FileName, 'Type:', fileRecord.FileType);
      }
    }
    
    console.log(`🎯 [SEARCH] Found ${results.length} files for ProductionID: ${productionId}`);
    return results;
  } catch (error) {
    console.error('❌ [SEARCH] Get file records error:', error);
    return [];
  }
}

/**
 * Find search code specifically for search functionality
 * Fixed to search in correct column (index 1, not 0)
 */
function findSearchCodeForSearch(searchCode) {
  try {
    console.log('🔍 [SEARCH] findSearchCodeForSearch called with:', searchCode);
    
    const sheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    console.log('📋 [SEARCH] Search_Codes headers:', headers);
    console.log('🔍 [SEARCH] Looking for SearchCode in column 1 (SearchCode column)');
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      console.log(`🔍 [SEARCH] Row ${i}: SearchCode="${row[1]}" vs target="${searchCode}"`);
      
      if (row[1] === searchCode) { // SearchCode is in column 1
        console.log('✅ [SEARCH] Found matching SearchCode at row', i);
        
        // Use dynamic mapping
        const searchData = {};
        for (let j = 0; j < headers.length; j++) {
          searchData[headers[j]] = row[j];
        }
        
        console.log('📦 [SEARCH] Mapped search data:', searchData);
        return searchData;
      }
    }
    
    console.log('❌ [SEARCH] SearchCode not found:', searchCode);
    return null;
  } catch (error) {
    console.error('❌ [SEARCH] Find search code error:', error);
    return null;
  }
}

/**
 * Validate crop type and variety in Google Sheets
 * Finds the latest production record and compares with expected values
 */
function validateCropInGoogleSheets(productionId, expectedCropType, expectedCropVariety) {
  try {
    console.log('🌱 [SEARCH] validateCropInGoogleSheets called:', { productionId, expectedCropType, expectedCropVariety });
    
    if (!productionId || !expectedCropType || !expectedCropVariety) {
      console.log('❌ [SEARCH] Missing required parameters for crop validation');
      return { 
        isValid: false, 
        error: 'ข้อมูลไม่ครบถ้วนสำหรับการตรวจสอบ',
        actualCropType: null,
        actualCropVariety: null
      };
    }
    
    // Get Production_Data sheet
    const sheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    console.log('📋 [SEARCH] Production_Data headers:', headers);
    
    // Find all production records with matching ProductionID
    const matchingRecords = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === productionId) { // ProductionID is in column 0
        const record = {};
        for (let j = 0; j < headers.length; j++) {
          record[headers[j]] = row[j];
        }
        matchingRecords.push(record);
        console.log('📝 [SEARCH] Found matching production record:', record);
      }
    }
    
    if (matchingRecords.length === 0) {
      console.log('❌ [SEARCH] No production records found for ProductionID:', productionId);
      return { 
        isValid: false, 
        error: 'ไม่พบข้อมูลการปลูกสำหรับรหัสนี้',
        actualCropType: null,
        actualCropVariety: null
      };
    }
    
    // Select the latest record (by UpdatedAt or Created)
    let latestRecord = matchingRecords[0];
    if (matchingRecords.length > 1) {
      latestRecord = matchingRecords.reduce((latest, current) => {
        const latestDate = new Date(latest.UpdatedAt || latest.Created);
        const currentDate = new Date(current.UpdatedAt || current.Created);
        return currentDate > latestDate ? current : latest;
      });
      console.log('🔍 [SEARCH] Multiple records found, using latest:', latestRecord);
    }
    
    const actualCropType = latestRecord.CropType || '';
    const actualCropVariety = latestRecord.CropVariety || '';
    
    console.log('🌱 [SEARCH] Crop comparison:', {
      expected: { type: expectedCropType, variety: expectedCropVariety },
      actual: { type: actualCropType, variety: actualCropVariety }
    });
    
    // Validate crop type and variety
    const isCropTypeMatch = actualCropType === expectedCropType;
    const isCropVarietyMatch = actualCropVariety === expectedCropVariety;
    const isValid = isCropTypeMatch && isCropVarietyMatch;
    
    let errorMessage = null;
    if (!isCropTypeMatch) {
      errorMessage = 'ชนิดผักไม่ตรงกัน';
    } else if (!isCropVarietyMatch) {
      errorMessage = 'สายพันธุ์ไม่ตรงกัน';
    }
    
    const result = {
      isValid: isValid,
      actualCropType: actualCropType,
      actualCropVariety: actualCropVariety,
      matchedProductionID: productionId,
      error: errorMessage
    };
    
    console.log('✅ [SEARCH] Crop validation completed:', result);
    return result;
    
  } catch (error) {
    console.error('❌ [SEARCH] Crop validation error:', error);
    return { 
      isValid: false, 
      error: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูลผัก: ' + error.message,
      actualCropType: null,
      actualCropVariety: null
    };
  }
}