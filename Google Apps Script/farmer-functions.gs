/**
 * Farmer Functions - ระบบสอบย้อนกลับผักอุดร
 * ===========================================
 */

/**
 * ดึงสถานะ Dashboard ของเกษตรกร
 */
function getFarmerDashboardState(data) {
  try {
    console.log('getFarmerDashboardState called with data:', data);
    
    const farmerID = data.farmerID;
    const username = data.username;
    
    if (!farmerID && !username) {
      console.log('Missing farmerID and username');
      return { success: false, message: 'ไม่พบข้อมูล Farmer ID หรือ Username' };
    }
    
    // ใช้ getSheet() function ที่มีอยู่แล้วในระบบ
    const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
    const farmersData = farmersSheet.getDataRange().getValues();
    const farmersHeaders = farmersData[0];
    
    let farmer = null;
    
    // หาเกษตรกรจาก FarmerID หรือ Username
    for (let i = 1; i < farmersData.length; i++) {
      const row = farmersData[i];
      const rowData = {};
      
      farmersHeaders.forEach((header, index) => {
        rowData[header] = row[index];
      });
      
      // Clean username by removing text format prefix
      const cleanUsername = String(rowData.Username || '').replace(/^'/, '');
      
      console.log(`Checking farmer row ${i}: FarmerID="${rowData.FarmerID}", Username="${cleanUsername}" vs input username="${username}"`);
      
      if ((farmerID && rowData.FarmerID === farmerID) ||
          (username && cleanUsername === username)) {
        farmer = rowData;
        farmer.Username = cleanUsername; // Use cleaned username
        console.log('Found matching farmer:', farmer);
        break;
      }
    }
    
    if (!farmer) {
      console.log('No matching farmer found in database');
      console.log('Total farmers in sheet:', farmersData.length - 1);
      
      // Log all farmers for debugging
      for (let i = 1; i < Math.min(farmersData.length, 6); i++) { // Show max 5 farmers
        const row = farmersData[i];
        const debugUsername = String(row[farmersHeaders.indexOf('Username')] || '').replace(/^'/, '');
        console.log(`Farmer ${i}: FarmerID="${row[0]}", Username="${debugUsername}"`);
      }
      
      return {
        success: true,
        part1Complete: false,
        farmer: {
          Username: username || '',
          FullName: '',
          IDCard: '',
          PlotNumber: '',
          Phone: username || '',
          Address: '',
          Area: ''
        },
        message: 'ไม่พบข้อมูลเกษตรกร กรุณากรอกข้อมูลเกษตรกรก่อน'
      };
    }
    
    // Clean all text fields
    Object.keys(farmer).forEach(key => {
      if (typeof farmer[key] === 'string') {
        farmer[key] = farmer[key].replace(/^'/, '');
      }
    });
    
    // ดึงชื่อกลุ่มจาก Groups sheet
    if (farmer.GroupID) {
      try {
        const groupsSheet = getSheet(CONFIG.SHEETS.GROUPS);
        const groupsData = groupsSheet.getDataRange().getValues();
        const groupsHeaders = groupsData[0];
        
        for (let i = 1; i < groupsData.length; i++) {
          const groupRow = groupsData[i];
          const groupData = {};
          
          groupsHeaders.forEach((header, index) => {
            groupData[header] = groupRow[index];
          });
          
          if (groupData.GroupID === farmer.GroupID) {
            farmer.GroupName = groupData.GroupName || '';
            console.log('Found group name:', farmer.GroupName);
            break;
          }
        }
      } catch (groupError) {
        console.warn('Error fetching group name:', groupError);
        farmer.GroupName = '';
      }
    } else {
      farmer.GroupName = '';
    }
    
    // ตรวจสอบว่ากรอกข้อมูลส่วนที่ 1 ครับหรือไม่
    const part1Complete = farmer.FullName && farmer.IDCard && farmer.PlotNumber && farmer.Address && farmer.Area;
    
    // ถ้าข้อมูลครบถ้วนแล้ว ให้ดึงข้อมูลเพิ่มเติม
    let productionRecords = [];
    let qrCode = null;
    
    if (part1Complete) {
      console.log('Part1 complete, fetching additional data for farmer:', farmer.FarmerID);
      
      // ดึงประวัติการผลิต
      try {
        const productionResult = getLatestProductionRecords(farmer.FarmerID, 50);
        console.log('Production records result:', productionResult);
        if (productionResult.success && productionResult.records) {
          productionRecords = productionResult.records;
        }
      } catch (prodError) {
        console.warn('Error fetching production records:', prodError);
      }
      
      // ดึง QR Code
      try {
        const qrResult = getOrCreateQRCode(farmer.FarmerID);
        console.log('QR Code result:', qrResult);
        if (qrResult.success && qrResult.qrCode) {
          // สร้าง QR Code URL จาก Google Charts API
          const qrCodeText = encodeURIComponent(qrResult.qrCode);
          const qrCodeUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${qrCodeText}&choe=UTF-8`;
          
          qrCode = {
            qrCodeUrl: qrCodeUrl,
            qrCode: qrResult.qrCode
          };
          console.log('QR Code prepared for response:', qrCode);
        }
      } catch (qrError) {
        console.warn('Error fetching QR code:', qrError);
      }
    }
    
    return {
      success: true,
      part1Complete: part1Complete,
      farmer: farmer,
      productionRecords: productionRecords,
      qrCode: qrCode,
      message: part1Complete ? 'ข้อมูลเกษตรกรครบถ้วน' : 'ข้อมูลเกษตรกรยังไม่ครบถ้วน'
    };
    
  } catch (error) {
    console.error('getFarmerDashboardState error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเกษตรกร: ' + error.message
    };
  }
}

/**
 * อัปเดตข้อมูลเกษตรกร (ส่วนที่ 1)
 */
function updateFarmerProfile(data) {
  try {
    console.log('updateFarmerProfile called with:', data);
    
    const farmerID = data.farmerID;
    const username = data.username;
    
    if (!farmerID && !username) {
      return { success: false, message: 'ไม่พบข้อมูล Farmer ID หรือ Username' };
    }
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!data.fullName || !data.idCard || !data.phone || !data.plotNumber || !data.address || !data.area) {
      return { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' };
    }
    
    // Validate phone number
    const phoneStr = String(data.phone).replace(/[^\d]/g, '');
    if (!/^0[89][0-9]{8}$/.test(phoneStr)) {
      return { success: false, message: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง' };
    }
    
    // Validate plot number
    const plotStr = String(data.plotNumber).replace(/[^\d]/g, '');
    if (plotStr.length !== 17) {
      return { success: false, message: 'เลขประจำแปลงต้องเป็นตัวเลข 17 หลัก' };
    }
    
    // Validate ID Card (required)
    const idCardStr = String(data.idCard).replace(/[^\d]/g, '');
    if (idCardStr.length !== 13) {
      return { success: false, message: 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก' };
    }
    
    const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
    const farmersData = farmersSheet.getDataRange().getValues();
    
    if (farmersData.length < 2) {
      return { success: false, message: 'ไม่พบข้อมูลในตาราง' };
    }
    
    const headers = farmersData[0];
    
    // หาแถวของเกษตรกร
    let farmerRowIndex = -1;
    for (let i = 1; i < farmersData.length; i++) {
      const row = farmersData[i];
      const rowUsername = String(row[headers.indexOf('Username')] || '').replace(/^'/, '');
      
      console.log(`Checking row ${i}: FarmerID="${row[0]}" vs "${farmerID}", Username="${rowUsername}" vs "${username}"`);
      
      if ((farmerID && row[0] === farmerID) ||
          (username && rowUsername === username)) {
        farmerRowIndex = i;
        console.log(`Found farmer at row ${i}`);
        break;
      }
    }
    
    if (farmerRowIndex === -1) {
      console.log('No farmer found for update, showing available farmers:');
      for (let i = 1; i < Math.min(farmersData.length, 6); i++) {
        const row = farmersData[i];
        const debugUsername = String(row[headers.indexOf('Username')] || '').replace(/^'/, '');
        console.log(`Row ${i}: FarmerID="${row[0]}", Username="${debugUsername}"`);
      }
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร - ตรวจสอบ console สำหรับ debug info' };
    }
    
    // อัปเดตข้อมูลใช้ toText() เพื่อให้เป็น text format
    const updates = {
      'FullName': toText(data.fullName),
      'IDCard': toText(data.idCard),
      'Address': toText(data.address),
      'Area': toText(data.area),
      'Phone': toText(data.phone),
      'PlotNumber': toText(data.plotNumber)
    };
    
    Object.keys(updates).forEach(field => {
      const colIndex = headers.indexOf(field);
      if (colIndex !== -1 && updates[field]) {
        farmersSheet.getRange(farmerRowIndex + 1, colIndex + 1).setValue(updates[field]);
      }
    });
    
    console.log('Farmer profile updated successfully');
    
    // สร้าง QR Code หากยังไม่มี
    try {
      const qrResponse = getOrCreateQRCode(farmerID);
      console.log('QR Code creation result:', qrResponse);
    } catch (qrError) {
      console.warn('Could not create QR Code:', qrError);
    }
    
    return {
      success: true,
      message: 'อัปเดตข้อมูลเกษตรกรเรียบร้อยแล้ว'
    };
    
  } catch (error) {
    console.error('Error in updateFarmerProfile:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล: ' + error.message
    };
  }
}

/**
 * ดึงข้อมูลเกษตรกรจาก Username
 */
function getFarmerByUsername(username) {
  try {
    console.log('getFarmerByUsername called with:', username);
    
    const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
    const farmersData = farmersSheet.getDataRange().getValues();
    
    if (farmersData.length < 2) {
      console.log('No farmer data in sheet');
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    const headers = farmersData[0];
    const usernameCol = headers.indexOf('Username');
    
    if (usernameCol === -1) {
      console.error('Username column not found');
      return { success: false, message: 'โครงสร้างฐานข้อมูลไม่ถูกต้อง' };
    }
    
    for (let i = 1; i < farmersData.length; i++) {
      const row = farmersData[i];
      const rowUsername = String(row[usernameCol] || '').replace(/^'/, '');
      
      console.log(`Row ${i}: comparing "${rowUsername}" with "${username}"`);
      
      if (rowUsername === username) {
        const farmer = {};
        headers.forEach((header, index) => {
          farmer[header] = row[index];
          // Clean text fields
          if (typeof farmer[header] === 'string') {
            farmer[header] = farmer[header].replace(/^'/, '');
          }
        });
        
        // Add FarmerID field for compatibility
        farmer.FarmerID = farmer.FarmerID || row[0];
        
        // ดึงชื่อกลุ่มจาก Groups sheet
        if (farmer.GroupID) {
          try {
            const groupsSheet = getSheet(CONFIG.SHEETS.GROUPS);
            const groupsData = groupsSheet.getDataRange().getValues();
            const groupsHeaders = groupsData[0];
            
            for (let i = 1; i < groupsData.length; i++) {
              const groupRow = groupsData[i];
              const groupData = {};
              
              groupsHeaders.forEach((header, index) => {
                groupData[header] = groupRow[index];
              });
              
              if (groupData.GroupID === farmer.GroupID) {
                farmer.GroupName = groupData.GroupName || '';
                console.log('Found group name:', farmer.GroupName);
                break;
              }
            }
          } catch (groupError) {
            console.warn('Error fetching group name:', groupError);
            farmer.GroupName = '';
          }
        } else {
          farmer.GroupName = '';
        }
        
        console.log('Found farmer:', farmer);
        return { success: true, data: farmer };
      }
    }
    
    console.log('No matching farmer found');
    return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    
  } catch (error) {
    console.error('getFarmerByUsername error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' };
  }
}

/**
 * ตรวจสอบว่ามี toText function หรือไม่ และใช้ fallback
 */
function toText(value) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return '';
  }
  
  // Simple implementation without recursion
  return "'" + String(value);
}

/**
 * สร้างรอบการผลิต (Form Data Version) - รองรับ form-encoded data
 * ใช้แก้ปัญหา CORS โดยไม่กระทบฟังก์ชันเดิม
 */
function createProductionCycleFormData(data) {
  console.log('=== createProductionCycleFormData started ===');
  console.log('Received form data:', data);
  
  try {
    // แปลง flatten form data กลับเป็น nested structure
    const nestedData = {
      farmerID: data.farmerID,
      production: {},
      harvest: {},
      transport: {},
      story: data.story || ''
    };
    
    // แยกข้อมูลตาม prefix
    Object.keys(data).forEach(key => {
      if (key.startsWith('production_')) {
        const fieldName = key.replace('production_', '');
        nestedData.production[fieldName] = data[key];
      } else if (key.startsWith('harvest_')) {
        const fieldName = key.replace('harvest_', '');
        nestedData.harvest[fieldName] = data[key];
      } else if (key.startsWith('transport_')) {
        const fieldName = key.replace('transport_', '');
        nestedData.transport[fieldName] = data[key];
      }
    });
    
    console.log('Converted to nested structure:', JSON.stringify(nestedData, null, 2));
    
    // เรียกใช้ฟังก์ชันเดิม
    return createProductionCycle(nestedData);
    
  } catch (error) {
    console.error('Error in createProductionCycleFormData:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างรอบการผลิต: ' + error.message
    };
  }
}

/**
 * สร้างรอบการผลิตใหม่
 * 
 * Fixed: แยกวันที่ให้ตรงตามตาราง
 * - วันที่เก็บเกี่ยว → Production_Data.HarvestDate
 * - วันที่จัดส่ง → Harvest_Data.ShipDate  
 * - วันที่ส่งออกจากฟาร์ม → Transport_Data.ShipDate
 */
function createProductionCycle(data) {
  console.log('=== DEBUG: Raw data received ===');
  console.log('data:', JSON.stringify(data, null, 2));
  console.log('=== TESTING ACCESS ===');
  console.log('data.cropType:', data.cropType);
  console.log('data.production:', data.production);
  console.log('data.production?.cropType:', data.production?.cropType);
  try {
    console.log('createProductionCycle called with:', data);
    
    // แปลงข้อมูลจาก nested objects เป็น flat structure และแยกวันที่ตามตาราง
    const flatData = {};
    
    // Production data - รวมถึง harvestDate
    if (data.production) {
      Object.assign(flatData, data.production);
    }
    
    // Harvest data - รวมถึง shipDate 
    if (data.harvest) {
      Object.assign(flatData, data.harvest);
    }
    
    // Transport data - รวมถึง farmShipDate
    if (data.transport) {
      Object.assign(flatData, data.transport);
    }
    
    // Additional data
    if (data.additionalInfo) {
      Object.assign(flatData, data.additionalInfo);
    }
    
    // Documents (keep as is since they're handled separately)
    if (data.documents) {
      flatData.documents = data.documents;
    }
    
    // Copy top-level properties
    Object.assign(flatData, data);
    
    console.log('=== DEBUG: Flattened data structure ===');
    console.log('flatData.harvestDate (from production):', flatData.harvestDate);
    console.log('flatData.shipDate (from harvest):', flatData.shipDate);
    console.log('flatData.farmShipDate (from transport):', flatData.farmShipDate);
    console.log('=== วันที่แยกตามตาราง ===');
    console.log('วันที่เก็บเกี่ยว → Production_Data.HarvestDate:', flatData.harvestDate);
    console.log('วันที่จัดส่ง → Harvest_Data.ShipDate:', flatData.shipDate);
    console.log('วันที่ส่งออกจากฟาร์ม → Transport_Data.ShipDate:', flatData.farmShipDate);
    
    // ใช้ flatData แทน data สำหรับการประมวลผลต่อไป
    data = flatData;
    
    // Clean farmerID from potential text format prefix
    console.log('Raw farmerID from data:', data.farmerID);
    const farmerID = String(data.farmerID || '').replace(/^'/, '');
    console.log('Using cleaned farmerID:', farmerID);
    
    if (!farmerID) {
      console.error('CRITICAL: No farmerID provided!', { 
        rawFarmerID: data.farmerID,
        dataKeys: Object.keys(data),
        fullData: data 
      });
      return { success: false, message: 'ไม่พบข้อมูล Farmer ID' };
    }
    
    console.log('✓ FarmerID validation passed, proceeding...');
    
    // สร้าง Production ID ใหม่
    const productionID = generateId();
    const currentTime = getCurrentTimestamp();
    
    // บันทึกข้อมูลการผลิต (Production_Data)
    console.log('Getting Production_Data sheet...');
    const productionSheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    if (!productionSheet) {
      console.error('❌ Cannot access Production_Data sheet');
      return { success: false, message: 'ไม่สามารถเข้าถึง Production_Data sheet ได้' };
    }
    console.log('✓ Production_Data sheet accessed:', productionSheet.getName());
    const productionData = [
      productionID,                                    // ProductionID
      farmerID,                                        // FarmerID
      '',                                             // SeasonID
      data.cropType || '',                            // CropType
      data.cropVariety || '',                         // CropVariety
      data.plantingMethod || '',                      // PlantingMethod
      data.plantingMethodOther || '',                 // PlantingMethodOther
      data.fertilizer || '',                          // Fertilizer
      data.pesticide || '',                           // Pesticide
      data.plantDate || '',                           // PlantDate
      data.harvestDate || '',                         // HarvestDate
      data.recordMethod || 'manual',                  // RecordMethod
      '',                                             // MaintenanceRecord
      data.pestControl || '',                         // PestControl
      data.waterSourceType || '',                     // WaterSource
      data.waterManagement || '',                     // WaterManagement
      data.waterSourceType || '',                     // WaterSourceType
      'Active',                                        // Status
      currentTime,                                     // Created
      currentTime                                      // UpdatedAt
    ];
    
    console.log('About to insert Production_Data:', productionData);
    try {
      productionSheet.appendRow(productionData);
      console.log('✓ Production_Data inserted successfully');
    } catch (prodError) {
      console.error('❌ Failed to insert Production_Data:', prodError);
      throw prodError;
    }
    
    // สร้าง LotCode (พ.ศ.:เดือน:วันที่ของวันที่เก็บเกี่ยว)
    let lotCode = '';
    if (data.harvestDate) {
      const harvestDate = new Date(data.harvestDate);
      const buddhistYear = harvestDate.getFullYear() + 543;
      const month = (harvestDate.getMonth() + 1).toString().padStart(2, '0');
      const day = harvestDate.getDate().toString().padStart(2, '0');
      lotCode = `${buddhistYear}${month}${day}`;
    }
    
    // บันทึกข้อมูลการเก็บเกี่ยว (Harvest_Data)
    console.log('Getting Harvest_Data sheet...');
    const harvestSheet = getSheet(CONFIG.SHEETS.HARVEST_DATA);
    if (!harvestSheet) {
      console.error('❌ Cannot access Harvest_Data sheet');
      return { success: false, message: 'ไม่สามารถเข้าถึง Harvest_Data sheet ได้' };
    }
    console.log('✓ Harvest_Data sheet accessed:', harvestSheet.getName());
    
    // Debug: ตรวจสอบข้อมูลที่จะบันทึกลง Harvest_Data
    console.log('=== DEBUG: Harvest_Data บันทึก ===');
    console.log('data.shipDate (วันที่จัดส่ง):', data.shipDate);
    console.log('data.harvestMethod:', data.harvestMethod);
    console.log('data.packagingCompany:', data.packagingCompany);
    console.log('====================================');
    
    const harvestData = [
      generateId(),
      farmerID,
      productionID,
      data.shipDate || '', // วันที่จัดส่ง จาก Harvest_Data.ShipDate
      data.harvestMethod || '',
      data.packagingCompany || '',
      data.packagingLocation || '',
      data.packagingProvince || '', // PackagingProvince - รับจาก form field packagingLocation
      data.responsiblePerson || '',
      lotCode,
      data.quantity || '',
      data.unit === 'อื่น ๆ ระบุ' ? data.unitOther : data.unit || '',
      currentTime,
      currentTime
    ];
    
    console.log('About to insert Harvest_Data:', harvestData);
    try {
      harvestSheet.appendRow(harvestData);
      console.log('✓ Harvest_Data inserted successfully');
    } catch (harvestError) {
      console.error('❌ Failed to insert Harvest_Data:', harvestError);
      throw harvestError;
    }
    
    // บันทึกข้อมูลการขนส่ง (Transport_Data)  
    console.log('Getting Transport_Data sheet...');
    const transportSheet = getSheet(CONFIG.SHEETS.TRANSPORT_DATA);
    if (!transportSheet) {
      console.error('❌ Cannot access Transport_Data sheet');
      return { success: false, message: 'ไม่สามารถเข้าถึง Transport_Data sheet ได้' };
    }
    console.log('✓ Transport_Data sheet accessed:', transportSheet.getName());
    
    // Debug: ตรวจสอบข้อมูลที่จะบันทึกลง Transport_Data
    console.log('=== DEBUG: Transport_Data บันทึก ===');
    console.log('data.farmShipDate (วันที่ส่งจากฟาร์ม):', data.farmShipDate);
    console.log('data.transportChannel:', data.transportChannel);
    console.log('data.transportMethod:', data.transportMethod);
    console.log('data.distributorCode:', data.distributorCode);
    console.log('======================================');
    
    const transportData = [
      generateId(),                                           // TransportID
      farmerID,                                              // FarmerID
      productionID,                                          // ProductionID
      data.farmShipDate || '', // ShipDate - ใช้เฉพาะ farmShipDate สำหรับ Transport_Data
      data.transportChannel || '',                           // TransportChannel
      data.transportMethod === 'อื่น ๆ ระบุ' ? data.transportMethodOther || '' : '', // TransportMethodOther
      data.transportMethod || '',                            // TransportMethod
      data.transportCompany || '',                           // TransportCompany
      data.distributorCode ? "'" + data.distributorCode : '',  // DistributorCode (with text format)
      'Active',                                              // Status
      currentTime,                                           // Created
      currentTime                                            // UpdatedAt
    ];
    
    console.log('About to insert Transport_Data:', transportData);
    try {
      transportSheet.appendRow(transportData);
      console.log('✓ Transport_Data inserted successfully');
    } catch (transportError) {
      console.error('❌ Failed to insert Transport_Data:', transportError);
      throw transportError;
    }
    
    // บันทึกข้อมูลเพิ่มเติม (Additional_Info) - รองรับทั้ง comments และ story
    const storyData = data.comments || data.story || '';
    if (storyData && storyData.trim() !== '') {
      console.log('✅ Saving story data to Additional_Info:', storyData);
      const additionalSheet = getSheet(CONFIG.SHEETS.ADDITIONAL_INFO);
      const additionalData = [
        generateId(),        // InfoID
        farmerID,           // FarmerID
        productionID,       // ProductionID
        storyData,          // Story
        currentTime         // LastUpdate
      ];
      additionalSheet.appendRow(additionalData);
      console.log('✅ Additional_Info saved successfully');
    } else {
      console.log('ℹ️ No story/comments data to save');
    }
    
    // สร้าง Search Code - ใช้ plantDate จาก Production_Data สำหรับการค้นหา
    console.log('=== DEBUG: Search Code Generation ===');
    console.log('Available data for search code:');
    console.log('- data.plantDate (Production_Data):', data.plantDate);
    console.log('- data.distributorCode:', data.distributorCode);
    
    // ใช้ plantDate จาก Production_Data สำหรับ Search Code
    const plantDate = data.plantDate || '';
    const distributorCode = data.distributorCode || '';
    
    console.log('Final values for search code:');
    console.log('- plantDate (final):', plantDate);
    console.log('- distributorCode (final):', distributorCode);
    console.log('- plantDate isEmpty?', !plantDate);
    console.log('- distributorCode isEmpty?', !distributorCode);
    
    if (!plantDate || !distributorCode) {
      console.error('Missing required data for SearchCode generation:', {
        plantDate: plantDate,
        distributorCode: distributorCode
      });
      return { 
        success: false, 
        message: `ไม่สามารถสร้างรหัสค้นหาได้ - ข้อมูลไม่ครบ: ${!plantDate ? 'วันที่เพาะปลูก (Production_Data)' : ''} ${!distributorCode ? 'รหัสผู้กระจายสินค้า' : ''}`
      };
    }
    
    const searchCode = generateSearchCode(plantDate, distributorCode);
    
    // หา QRCode จาก QR_Codes ตาราง หรือสร้างใหม่
    const qrCode = getOrCreateFarmerQRCode(farmerID);
    const qrCodeValue = qrCode.success ? qrCode.qrCode : '';
    console.log('Found/Created QRCode for farmer:', qrCodeValue);
    
    // บันทึก Search Code
    const searchSheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const searchData = [
      generateId(),
      searchCode,
      plantDate, // เปลี่ยนจาก shipDate เป็น plantDate
      qrCodeValue, // QRCode - ได้จาก QR_Codes ตาราง
      farmerID,
      productionID,
      distributorCode ? "'" + distributorCode : '', // DistributorCode (with text format)
      lotCode, // LotCode
      'Active',
      currentTime,
      0, // ViewCount
      null // LastViewed
    ];
    console.log('About to insert Search_Codes:', searchData);
    try {
      searchSheet.appendRow(searchData);
      console.log('✓ Search_Codes inserted successfully');
    } catch (searchError) {
      console.error('❌ Failed to insert Search_Codes:', searchError);
      throw searchError;
    }
    
    console.log('🎉 ALL DATA INSERTED SUCCESSFULLY!');
    console.log('Production cycle created:', {
      productionID: productionID,
      farmerID: farmerID,
      searchCode: searchCode
    });
    
    // อัปเดตไฟล์เดิมที่ไม่มี ProductionID
    console.log('Updating existing file records with ProductionID...');
    try {
      const updateResult = updateExistingFileRecords(farmerID, productionID);
      console.log('File update result:', updateResult);
      if (updateResult.success && updateResult.updatedCount > 0) {
        console.log(`✓ Updated ${updateResult.updatedCount} existing file records with ProductionID`);
      }
    } catch (updateError) {
      console.warn('Warning: Could not update existing file records:', updateError);
      // ไม่ให้ error นี้ทำให้การสร้างรอบการผลิตล้มเหลว
    }
    
    return {
      success: true,
      data: {
        productionID: productionID,
        searchCode: searchCode
      },
      message: 'สร้างรอบการผลิตสำเร็จ'
    };
    
  } catch (error) {
    console.error('createProductionCycle error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างรอบการผลิต: ' + error.message
    };
  }
}

/**
 * สร้าง Search Code รูปแบบ พ.ศ.(4หลัก)+เดือน+วัน-รหัสบริษัท (ใช้วันที่เพาะปลูก)
 */
function generateSearchCode(plantDate, distributorCode) {
  if (!plantDate || !distributorCode) {
    console.error('Missing plantDate or distributorCode for search code generation');
    return 'INVALID-CODE';
  }
  
  const date = new Date(plantDate);
  
  // แปลง ค.ศ. เป็น พ.ศ. (4 หลัก)
  const buddhistYear = date.getFullYear() + 543;
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // สร้างรหัส: พ.ศ.(4หลัก)+เดือน+วัน-รหัสบริษัท
  const searchCode = `${buddhistYear}${month}${day}-${distributorCode}`;
  
  console.log(`Generated search code: ${searchCode} (from plantDate: ${plantDate}, distributor: ${distributorCode})`);
  
  return searchCode;
}

/**
 * อัปโหลดเอกสารของเกษตรกร
 */
function uploadFarmerDocument(data) {
  try {
    console.log('uploadFarmerDocument called with:', data);
    console.log('ProductionID received:', data.productionID);
    
    const { farmerID, productionID, fileType, fileName, fileContent, mimeType, fileSize } = data;
    
    if (!farmerID || !fileName || !fileContent) {
      return { success: false, message: 'ข้อมูลไม่ครบถ้วนสำหรับการอัปโหลด' };
    }
    
    console.log('Processing upload with ProductionID:', productionID);
    
    // ดึงข้อมูลเกษตรกรเพื่อหา GroupID
    const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
    const farmersData = farmersSheet.getDataRange().getValues();
    const farmersHeaders = farmersData[0];
    
    let farmer = null;
    for (let i = 1; i < farmersData.length; i++) {
      const row = farmersData[i];
      const rowFarmerID = String(row[0] || '').replace(/^'/, '');
      const cleanFarmerID = String(farmerID || '').replace(/^'/, '');
      
      console.log(`Checking farmer row ${i}: FarmerID="${rowFarmerID}" vs input "${cleanFarmerID}"`);
      
      if (rowFarmerID === cleanFarmerID) {
        farmer = {};
        farmersHeaders.forEach((header, index) => {
          farmer[header] = row[index];
          // Clean text format prefix
          if (typeof farmer[header] === 'string') {
            farmer[header] = farmer[header].replace(/^'/, '');
          }
        });
        console.log('Found farmer for upload:', farmer);
        break;
      }
    }
    
    if (!farmer) {
      console.error('ไม่พบข้อมูลเกษตรกร farmerID:', farmerID);
      console.log('Available farmers:');
      for (let i = 1; i < Math.min(farmersData.length, 4); i++) {
        console.log(`Row ${i}: FarmerID="${String(farmersData[i][0] || '').replace(/^'/, '')}"`);
      }
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    // Ensure farmer folder exists (lazy creation)
    const folderResult = ensureFarmerFolderExists(farmer.FarmerID, farmer.GroupID, farmer.Phone);
    
    if (!folderResult.success) {
      console.error('Cannot ensure farmer folder exists:', folderResult.message);
      return { success: false, message: folderResult.message };
    }
    
    console.log('Using FolderID:', folderResult.folderId);
    
    // ใช้โฟลเดอร์ที่มีอยู่แล้วหรือสร้างใหม่
    let farmerFolder;
    try {
      farmerFolder = DriveApp.getFolderById(folderResult.folderId);
      console.log('Using farmer folder ID:', folderResult.folderId);
    } catch (folderError) {
      console.error('Cannot access folder with ID:', folderResult.folderId, 'Error:', folderError);
      return { success: false, message: 'ไม่สามารถเข้าถึงโฟลเดอร์เกษตรกรได้' };
    }
    
    // กำหนดโฟลเดอร์ย่อยตามประเภทไฟล์
    console.log('=== DEBUG FILE TYPE ===');
    console.log('Processing fileType:', fileType, 'Type:', typeof fileType);
    console.log('fileType length:', fileType ? fileType.length : 'null');
    console.log('fileType JSON:', JSON.stringify(fileType));
    console.log('======================');
    
    let subFolderName = '';
    switch (fileType) {
      case 'รูปแปลงปลูก':
        subFolderName = 'รูปแปลงปลูก';
        break;
      case 'รูปกิจกรรมการปลูก':
        subFolderName = 'รูปกิจกรรมการปลูก';
        break;
      case 'เอกสารการรับรอง':
        subFolderName = 'เอกสารการรับรอง';
        break;
      case 'รูปสินค้า':
        subFolderName = 'รูปสินค้า';
        break;
      case 'วิธีการปลูก':
        subFolderName = 'วิธีการปลูก';
        break;
      case 'การบำรุงรักษา':
        subFolderName = 'การบำรุงรักษา';
        break;
      default:
        console.warn('Unknown fileType:', fileType, '- using เอกสารอื่นๆ folder');
        subFolderName = 'เอกสารอื่นๆ';
    }
    
    // หาหรือสร้างโฟลเดอร์ย่อย
    let targetFolder;
    const subFolders = farmerFolder.getFoldersByName(subFolderName);
    if (subFolders.hasNext()) {
      targetFolder = subFolders.next();
      console.log('Found existing subfolder:', subFolderName, 'ID:', targetFolder.getId());
    } else {
      targetFolder = farmerFolder.createFolder(subFolderName);
      console.log('Created new subfolder:', subFolderName, 'ID:', targetFolder.getId());
    }
    
    console.log('Final upload path:', 
      farmer.FolderID, '→', subFolderName, '→', fileName);
    
    // เปลี่ยนชื่อไฟล์ให้รวม ProductionID
    let finalFileName = fileName;
    if (productionID && productionID.trim() !== '') {
      const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
      const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
      finalFileName = `${productionID}_${fileNameWithoutExt}${fileExtension}`;
      console.log('Renamed file with ProductionID:', finalFileName);
    }
    
    // สร้างไฟล์
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileContent),
      mimeType,
      finalFileName
    );
    
    const uploadedFile = targetFolder.createFile(blob);
    
    // บันทึกข้อมูลไฟล์ลง FileRecords
    const fileRecordsSheet = getSheet(CONFIG.SHEETS.FILE_RECORDS);
    const fileID = generateId();
    const uploadTime = getCurrentTimestamp();
    
    // FIXED: Correct column order matching FileRecords headers
    // ['fileId', 'fileName', 'fileUrl', 'downloadUrl', 'farmerId', 'productionId', 'fileType', 'folderName', 'mimeType', 'fileSize', 'uploadedAt', 'status', 'updatedAt']
    const fileRecord = [
      fileID,                        // 0: fileId
      finalFileName,                 // 1: fileName
      uploadedFile.getUrl(),         // 2: fileUrl
      uploadedFile.getDownloadUrl(), // 3: downloadUrl
      farmer.FarmerID,               // 4: farmerId
      productionID || '',            // 5: productionId ← MOVED TO CORRECT POSITION
      fileType,                      // 6: fileType
      subFolderName,                 // 7: folderName
      mimeType,                      // 8: mimeType
      fileSize || 0,                 // 9: fileSize
      uploadTime,                    // 10: uploadedAt
      'Active',                      // 11: status
      uploadTime                     // 12: updatedAt
    ];
    
    fileRecordsSheet.appendRow(fileRecord);
    
    return {
      success: true,
      data: {
        fileID: fileID,
        fileName: finalFileName, // ส่งคืนชื่อไฟล์ใหม่
        originalFileName: fileName, // เก็บชื่อไฟล์เดิมไว้ด้วย
        fileUrl: uploadedFile.getUrl(),
        downloadUrl: uploadedFile.getDownloadUrl(),
        folderId: targetFolder.getId(),
        productionID: productionID || null
      },
      message: 'อัปโหลดไฟล์สำเร็จ'
    };
    
  } catch (error) {
    console.error('uploadFarmerDocument error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์: ' + error.message
    };
  }
}

/**
 * อัปเดตข้อมูลไฟล์เดิมให้มี ProductionID
 */
function updateExistingFileRecords(farmerID, productionID) {
  try {
    console.log('updateExistingFileRecords called with farmerID:', farmerID, 'productionID:', productionID);
    
    if (!farmerID || !productionID) {
      return { success: false, message: 'ข้อมูลไม่ครบถ้วน' };
    }
    
    const fileRecordsSheet = getSheet(CONFIG.SHEETS.FILE_RECORDS);
    const fileRecordsData = fileRecordsSheet.getDataRange().getValues();
    const fileRecordsHeaders = fileRecordsData[0];
    
    // หา index ของคอลัมน์ที่ต้องการ
    const farmerIDIndex = fileRecordsHeaders.indexOf('FarmerID');
    const productionIDIndex = fileRecordsHeaders.indexOf('ProductionID');
    const fileNameIndex = fileRecordsHeaders.indexOf('FileName');
    
    if (farmerIDIndex === -1 || productionIDIndex === -1) {
      return { success: false, message: 'ไม่พบคอลัมน์ที่ต้องการในตาราง FileRecords' };
    }
    
    let updatedCount = 0;
    const updatedFiles = [];
    
    // วนลูปค้นหาไฟล์ของเกษตรกรที่ไม่มี ProductionID
    for (let i = 1; i < fileRecordsData.length; i++) {
      const row = fileRecordsData[i];
      const rowFarmerID = String(row[farmerIDIndex] || '');
      const rowProductionID = String(row[productionIDIndex] || '');
      const rowFileName = String(row[fileNameIndex] || '');
      
      // ถ้าเป็นของเกษตรกรคนนี้และยังไม่มี ProductionID
      if (rowFarmerID === farmerID && (!rowProductionID || rowProductionID.trim() === '')) {
        // อัปเดต ProductionID
        fileRecordsSheet.getRange(i + 1, productionIDIndex + 1).setValue(productionID);
        
        // อัปเดตชื่อไฟล์ให้มี ProductionID
        if (rowFileName && !rowFileName.startsWith(productionID + '_')) {
          const fileExtension = rowFileName.substring(rowFileName.lastIndexOf('.'));
          const fileNameWithoutExt = rowFileName.substring(0, rowFileName.lastIndexOf('.'));
          const newFileName = `${productionID}_${fileNameWithoutExt}${fileExtension}`;
          
          fileRecordsSheet.getRange(i + 1, fileNameIndex + 1).setValue(newFileName);
          
          updatedFiles.push({
            oldName: rowFileName,
            newName: newFileName
          });
        }
        
        updatedCount++;
        console.log(`Updated file record row ${i + 1}: Added ProductionID ${productionID}`);
      }
    }
    
    return {
      success: true,
      updatedCount: updatedCount,
      updatedFiles: updatedFiles,
      message: `อัปเดตข้อมูลไฟล์เรียบร้อย ${updatedCount} รายการ`
    };
    
  } catch (error) {
    console.error('updateExistingFileRecords error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลไฟล์: ' + error.message
    };
  }
}

/**
 * ดึงประวัติการผลิตล่าสุดของเกษตรกร
 */
function getLatestProductionRecords(farmerID, limit = 5) {
  try {
    console.log('getLatestProductionRecords called with farmerID:', farmerID, 'limit:', limit);
    
    if (!farmerID) {
      return { success: false, message: 'ไม่พบข้อมูล Farmer ID' };
    }
    
    // ดึงข้อมูลจาก Production_Data
    const productionSheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    const productionData = productionSheet.getDataRange().getValues();
    const productionHeaders = productionData[0];
    
    // ดึงข้อมูลจาก Harvest_Data
    const harvestSheet = getSheet(CONFIG.SHEETS.HARVEST_DATA);
    const harvestData = harvestSheet.getDataRange().getValues();
    const harvestHeaders = harvestData[0];
    
    // ดึงข้อมูลจาก Transport_Data
    const transportSheet = getSheet(CONFIG.SHEETS.TRANSPORT_DATA);
    const transportData = transportSheet.getDataRange().getValues();
    const transportHeaders = transportData[0];
    
    // ดึงข้อมูลจาก Search_Codes
    const searchSheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const searchData = searchSheet.getDataRange().getValues();
    const searchHeaders = searchData[0];
    
    // หาข้อมูลการผลิตของเกษตรกรคนนี้
    const productions = [];
    
    for (let i = 1; i < productionData.length; i++) {
      const row = productionData[i];
      
      // ตรวจสอบว่าเป็นของเกษตรกรคนนี้หรือไม่
      if (row[1] === farmerID) { // FarmerID อยู่ในคอลัมน์ที่ 1
        const production = {};
        productionHeaders.forEach((header, index) => {
          production[header] = row[index];
        });
        
        // หาข้อมูล Harvest ที่เกี่ยวข้อง (สำหรับ ShipDate)
        console.log('=== DEBUG: Harvest_Data Headers ===');
        console.log('Harvest headers:', harvestHeaders);
        console.log('Looking for ShipDate index:', harvestHeaders.indexOf('ShipDate'));
        console.log('Available harvest columns:', harvestHeaders.map((h, i) => `${i}: ${h}`));
        
        for (let j = 1; j < harvestData.length; j++) {
          const harvestRow = harvestData[j];
          if (harvestRow[2] === production.ProductionID) { // ProductionID อยู่ในคอลัมน์ที่ 2 ของ Harvest
            console.log('Found matching Harvest row:', harvestRow);
            
            harvestHeaders.forEach((header, index) => {
              production[`Harvest_${header}`] = harvestRow[index];
            });
            
            // Map specific harvest fields to production object with null checks
            const harvestDateIndex = harvestHeaders.indexOf('HarvestDate');
            const shipDateIndex = harvestHeaders.indexOf('ShipDate');
            const farmShipDateIndex = harvestHeaders.indexOf('FarmShipDate');
            
            console.log('Harvest field indices:', {
              harvestDateIndex,
              shipDateIndex, 
              farmShipDateIndex
            });
            
            if (harvestDateIndex !== -1 && harvestRow[harvestDateIndex]) {
              production.HarvestDate = harvestRow[harvestDateIndex];
              console.log('Set HarvestDate to:', production.HarvestDate);
            }
            if (shipDateIndex !== -1 && harvestRow[shipDateIndex]) {
              production.ShipDate = harvestRow[shipDateIndex];
              console.log('Set ShipDate to:', production.ShipDate);
            } else {
              console.log('ShipDate not found or empty in Harvest_Data');
            }
            if (farmShipDateIndex !== -1 && harvestRow[farmShipDateIndex]) {
              production.FarmShipDate = harvestRow[farmShipDateIndex];
              console.log('Set FarmShipDate from Harvest to:', production.FarmShipDate);
            }
            break;
          }
        }
        
        // หาข้อมูล Transport ที่เกี่ยวข้อง (สำหรับ FarmShipDate)
        console.log('=== DEBUG: Transport_Data Headers ===');
        console.log('Transport headers:', transportHeaders);
        console.log('Looking for ShipDate index:', transportHeaders.indexOf('ShipDate'));
        console.log('Available columns:', transportHeaders.map((h, i) => `${i}: ${h}`));
        
        for (let k = 1; k < transportData.length; k++) {
          const transportRow = transportData[k];
          if (transportRow[2] === production.ProductionID) { // ProductionID อยู่ในคอลัมน์ที่ 2 ของ Transport_Data
            console.log('Found matching Transport row:', transportRow);
            
            // Map ShipDate จาก Transport_Data เป็น FarmShipDate
            const transportShipDateIndex = transportHeaders.indexOf('ShipDate');
            console.log('ShipDate column index:', transportShipDateIndex);
            
            if (transportShipDateIndex !== -1 && transportRow[transportShipDateIndex]) {
              production.FarmShipDate = transportRow[transportShipDateIndex];
              console.log('Set FarmShipDate to:', production.FarmShipDate);
            } else {
              console.log('ShipDate not found or empty in Transport_Data');
              // ลองหา column อื่นๆ ที่อาจเป็น FarmShipDate
              const altColumns = ['FarmShipDate', 'farmShipDate', 'TransportDate'];
              for (const colName of altColumns) {
                const altIndex = transportHeaders.indexOf(colName);
                if (altIndex !== -1 && transportRow[altIndex]) {
                  production.FarmShipDate = transportRow[altIndex];
                  console.log(`Found alternative column ${colName}:`, production.FarmShipDate);
                  break;
                }
              }
            }
            break;
          }
        }
        
        // หาข้อมูล Search Code ที่เกี่ยวข้อง
        for (let k = 1; k < searchData.length; k++) {
          const searchRow = searchData[k];
          if (searchRow[5] === production.ProductionID) { // ProductionID อยู่ในคอลัมน์ที่ 5 ของ Search_Codes
            production.SearchCode = searchRow[1]; // SearchCode อยู่ในคอลัมน์ที่ 1
            break;
          }
        }
        
        // กำหนดสถานะ
        if (!production.Status) {
          production.Status = 'completed'; // Default status
        }
        
        productions.push(production);
      }
    }
    
    // เรียงลำดับตามวันที่สร้าง (ล่าสุดก่อน)
    productions.sort((a, b) => {
      const dateA = new Date(a.Created || 0);
      const dateB = new Date(b.Created || 0);
      return dateB - dateA;
    });
    
    // จำกัดจำนวนตามที่ร้องขอ
    const limitedRecords = productions.slice(0, limit);
    
    console.log(`Found ${productions.length} production records for farmer ${farmerID}, returning ${limitedRecords.length} records`);
    
    return {
      success: true,
      records: limitedRecords,
      total: productions.length,
      message: `พบประวัติการผลิต ${productions.length} รายการ`
    };
    
  } catch (error) {
    console.error('getLatestProductionRecords error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงประวัติการผลิต: ' + error.message
    };
  }
}

/**
 * ดึง QR Code หรือสร้างใหม่หากยังไม่มี
 */
function getOrCreateQRCode(farmerID) {
  try {
    console.log('getOrCreateQRCode called with farmerID:', farmerID);
    
    // ดึงข้อมูลเกษตรกร
    const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
    const farmersData = farmersSheet.getDataRange().getValues();
    const farmersHeaders = farmersData[0];
    
    let farmer = null;
    for (let i = 1; i < farmersData.length; i++) {
      if (farmersData[i][farmersHeaders.indexOf('FarmerID')] === farmerID) {
        farmer = {
          farmerID: farmersData[i][farmersHeaders.indexOf('FarmerID')],
          GroupID: farmersData[i][farmersHeaders.indexOf('GroupID')],
          PlotNumber: farmersData[i][farmersHeaders.indexOf('PlotNumber')]
        };
        break;
      }
    }
    
    if (!farmer) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    // ดึงข้อมูลกลุ่ม
    const groupsSheet = getSheet(CONFIG.SHEETS.GROUPS);
    const groupsData = groupsSheet.getDataRange().getValues();
    const groupsHeaders = groupsData[0];
    
    let groupCode = '';
    for (let i = 1; i < groupsData.length; i++) {
      if (groupsData[i][groupsHeaders.indexOf('GroupID')] === farmer.GroupID) {
        groupCode = groupsData[i][groupsHeaders.indexOf('GroupCode')];
        break;
      }
    }
    
    if (!groupCode) {
      return { success: false, message: 'ไม่พบรหัสกลุ่ม' };
    }
    
    // ตรวจสอบว่ามี QR Code อยู่แล้วหรือไม่ และหาอันล่าสุด
    const qrCodesSheet = getSheet(CONFIG.SHEETS.QR_CODES);
    const qrData = qrCodesSheet.getDataRange().getValues();
    
    let latestQR = null;
    let latestDate = null;
    
    for (let i = 1; i < qrData.length; i++) {
      if (qrData[i][4] === farmerID && qrData[i][5] === 'active') {
        const createdDate = new Date(qrData[i][6]); // Created column
        
        if (!latestDate || createdDate > latestDate) {
          latestDate = createdDate;
          latestQR = {
            qrCode: qrData[i][1],  // QRCode อยู่ที่ column 1
            created: createdDate
          };
        }
      }
    }
    
    if (latestQR) {
      console.log('Found latest QR Code:', latestQR.qrCode, 'created:', latestQR.created);
      return {
        success: true,
        message: 'QR Code มีอยู่แล้ว',
        qrCode: latestQR.qrCode
      };
    }
    
    // สร้าง QR Code ใหม่
    const qrCode = `${groupCode}-${farmer.PlotNumber}`;
    const qrResult = saveQRCode(qrCode, groupCode, farmer.PlotNumber, farmerID);
    
    return qrResult;
    
  } catch (error) {
    console.error('Error in getOrCreateQRCode:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้าง QR Code' };
  }
}

/**
 * ดึงข้อมูลรายละเอียดการผลิตตาม ProductionID
 */
function getProductionDetail(data) {
  try {
    console.log('getProductionDetail called with data:', data);
    
    let productionId = data.productionId || data.productionID;
    const farmerID = data.farmerID; // Optional - for ownership verification
    
    // Clean productionId - remove quotes and trim whitespace
    if (typeof productionId === 'string') {
      productionId = productionId.replace(/^['"`]|['"`]$/g, '').trim();
    }
    
    console.log('Cleaned ProductionID:', productionId, 'Type:', typeof productionId);
    
    if (!productionId) {
      return { success: false, message: 'ไม่พบข้อมูล ProductionID' };
    }
    
    // Find the production record first to get FarmerID
    const productionSheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    const productionData = productionSheet.getDataRange().getValues();
    const productionHeaders = productionData[0];
    
    console.log('Production sheet headers:', productionHeaders);
    console.log('Production sheet has', productionData.length - 1, 'data rows');
    
    let foundFarmerID = null;
    let productionRecord = null;
    
    for (let i = 1; i < productionData.length; i++) {
      const row = productionData[i];
      // Convert both to string for comparison to handle type mismatches
      const rowProductionId = String(row[0] || '').trim();
      const searchProductionId = String(productionId || '').trim();
      
      console.log(`Comparing row ${i}: "${rowProductionId}" vs "${searchProductionId}" (lengths: ${rowProductionId.length} vs ${searchProductionId.length})`);
      
      if (rowProductionId === searchProductionId) { // ProductionID is in column 0
        foundFarmerID = row[1]; // FarmerID is in column 1
        
        // Build production record object
        productionRecord = {};
        productionHeaders.forEach((header, index) => {
          productionRecord[header] = row[index];
        });
        
        console.log('Found matching production record:', productionRecord);
        break;
      }
    }
    
    if (!foundFarmerID || !productionRecord) {
      console.log('Production record not found. Searched through', productionData.length - 1, 'rows');
      console.log('Available ProductionIDs in first 5 rows:');
      for (let i = 1; i < Math.min(6, productionData.length); i++) {
        console.log(`Row ${i}: "${productionData[i][0]}" (type: ${typeof productionData[i][0]})`);
      }
      return { success: false, message: 'ไม่พบข้อมูลการผลิตสำหรับ ProductionID นี้' };
    }
    
    console.log('Found production record for FarmerID:', foundFarmerID);
    
    // Optional: Verify ownership if farmerID is provided
    if (farmerID && farmerID !== foundFarmerID) {
      return { success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลการผลิตนี้' };
    }
    
    // Get farmer information
    const farmerData = getFarmerById(foundFarmerID);
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    // Get group information
    const groupData = getGroupById(farmerData.GroupID || farmerData.groupId);
    if (groupData) {
      farmerData.GroupName = groupData.groupName || groupData.GroupName;
    }
    
    // Get related data using existing functions
    const productions = [productionRecord]; // Already have the production record
    const harvests = getHarvestDataByFarmer(foundFarmerID, productionId);
    const transports = getTransportDataByFarmer(foundFarmerID, productionId);
    const additionalInfo = getAdditionalInfoByFarmer(foundFarmerID, productionId);
    const fileRecords = getFileRecordsByProductionId(productionId);
    
    console.log('Production detail data compiled successfully');
    
    return {
      success: true,
      data: {
        productionId: productionId,
        farmer: {
          FarmerID: farmerData.FarmerID,
          FullName: farmerData.FullName,
          PlotNumber: farmerData.PlotNumber,
          GroupName: farmerData.GroupName || '',
          Address: farmerData.Address,
          Area: farmerData.Area,
          Phone: farmerData.Phone
        },
        productions: productions,
        harvests: harvests,
        transports: transports,
        additionalInfo: additionalInfo,
        fileRecords: fileRecords
      },
      message: 'ดึงข้อมูลรายละเอียดการผลิตสำเร็จ'
    };
    
  } catch (error) {
    console.error('getProductionDetail error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดการผลิต: ' + error.message
    };
  }
}

/**
 * 🔧 VALIDATION: ตรวจสอบข้อมูลสำหรับการอัปเดต
 */
function validateUpdateData(data) {
  const errors = [];
  
  // ตรวจสอบ ProductionID
  if (!data.productionId && !data.productionID) {
    errors.push('ไม่พบ ProductionID');
  }
  
  // ตรวจสอบ Production data
  if (data.production) {
    if (!data.production.cropType) {
      errors.push('ไม่พบชนิดพืชผัก');
    }
    
    if (!data.production.plantDate) {
      errors.push('ไม่พบวันที่เริ่มปลูก');
    }
    
    if (!data.production.harvestDate) {
      errors.push('ไม่พบวันที่เก็บเกี่ยว');
    }
    
    // ตรวจสอบลำดับวันที่
    if (data.production.plantDate && data.production.harvestDate) {
      const plantDate = new Date(data.production.plantDate);
      const harvestDate = new Date(data.production.harvestDate);
      
      if (harvestDate <= plantDate) {
        errors.push('วันที่เก็บเกี่ยวต้องมาหลังวันที่เริ่มปลูก');
      }
    }
  }
  
  // ตรวจสอบ Transport data
  if (data.transport && data.transport.distributorCode) {
    const validDistributorCodes = ['001', '002', '003'];
    if (!validDistributorCodes.includes(data.transport.distributorCode)) {
      errors.push('รหัสผู้กระจายสินค้าไม่ถูกต้อง');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * อัปเดตข้อมูลการผลิตทั้งหมด
 */
function updateProductionData(data) {
  try {
    console.log('=== DEBUG: updateProductionData called ===');
    console.log('Full data object:', JSON.stringify(data, null, 2));
    console.log('data.productionId:', data.productionId);
    console.log('data.production:', data.production);
    console.log('data.harvest:', data.harvest);
    console.log('data.transport:', data.transport);
    console.log('=====================================');
    
    // 🔧 VALIDATION: ตรวจสอบข้อมูลพื้นฐาน
    const validation = validateUpdateData(data);
    if (!validation.isValid) {
      console.error('❌ Validation failed:', validation.errors);
      return { 
        success: false, 
        message: 'ข้อมูลไม่ถูกต้อง: ' + validation.errors.join(', '),
        errors: validation.errors
      };
    }
    
    let productionId = data.productionId || data.productionID;
    const farmerID = data.farmerID; // Optional - for ownership verification
    
    // Clean productionId - remove quotes and trim whitespace (same as getProductionDetail)
    if (typeof productionId === 'string') {
      productionId = productionId.replace(/^['"`]|['"`]$/g, '').trim();
    }
    
    console.log('Cleaned ProductionID for update:', productionId, 'Type:', typeof productionId);
    
    if (!productionId) {
      return { success: false, message: 'ไม่พบข้อมูล ProductionID' };
    }
    
    // Verify ownership first
    const productionSheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    const productionData = productionSheet.getDataRange().getValues();
    const productionHeaders = productionData[0];
    
    let foundFarmerID = null;
    let productionRowIndex = -1;
    
    for (let i = 1; i < productionData.length; i++) {
      const row = productionData[i];
      // Convert both to string for comparison to handle type mismatches (same as getProductionDetail)
      const rowProductionId = String(row[0] || '').trim();
      const searchProductionId = String(productionId || '').trim();
      
      console.log(`Update: Comparing row ${i}: "${rowProductionId}" vs "${searchProductionId}" (lengths: ${rowProductionId.length} vs ${searchProductionId.length})`);
      
      if (rowProductionId === searchProductionId) { // ProductionID is in column 0
        foundFarmerID = row[1]; // FarmerID is in column 1
        productionRowIndex = i + 1; // Sheet row number (1-based)
        break;
      }
    }
    
    if (!foundFarmerID || productionRowIndex === -1) {
      return { success: false, message: 'ไม่พบข้อมูลการผลิตสำหรับ ProductionID นี้' };
    }
    
    // Optional: Verify ownership if farmerID is provided
    if (farmerID && farmerID !== foundFarmerID) {
      return { success: false, message: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลการผลิตนี้' };
    }
    
    console.log('Found production record at row:', productionRowIndex, 'for FarmerID:', foundFarmerID);
    
    // 🔧 UNIVERSAL FIX: รองรับทั้ง nested และ flat structure
    const flatData = {};
    
    // ตรวจสอบว่าข้อมูลเป็นแบบ nested หรือ flat
    const hasNestedStructure = data.production || data.harvest || data.transport || data.additionalInfo;
    
    if (hasNestedStructure) {
      console.log('📦 Processing NESTED structure data (from edit-production.html)');
      
      // Nested structure processing
      if (data.production) {
        Object.assign(flatData, data.production);
        console.log('✅ Merged production data:', data.production);
      }
      
      if (data.harvest) {
        Object.assign(flatData, data.harvest);
        console.log('✅ Merged harvest data:', data.harvest);
      }
      
      if (data.transport) {
        Object.assign(flatData, data.transport);
        console.log('✅ Merged transport data:', data.transport);
      }
      
      if (data.additionalInfo) {
        Object.assign(flatData, data.additionalInfo);
        console.log('✅ Merged additionalInfo data:', data.additionalInfo);
      }
      
      // Copy top-level properties (but avoid overwriting nested data)
      const topLevelProps = { ...data };
      delete topLevelProps.production;
      delete topLevelProps.harvest;
      delete topLevelProps.transport;
      delete topLevelProps.additionalInfo;
      Object.assign(flatData, topLevelProps);
      
    } else {
      console.log('📄 Processing FLAT structure data (from farmer-api.js)');
      
      // Flat structure processing - ใช้ข้อมูลโดยตรง
      Object.assign(flatData, data);
    }
    
    console.log('📋 Final flattened data for update:', JSON.stringify(flatData, null, 2));
    
    // Update Production_Data
    console.log('🔄 Starting Production_Data update...');
    const productionUpdateResult = updateProductionRecord(productionSheet, productionHeaders, productionRowIndex, flatData);
    console.log('📊 Production update result:', productionUpdateResult);
    if (!productionUpdateResult.success) {
      console.error('❌ Production update failed:', productionUpdateResult);
      return productionUpdateResult;
    }
    
    // Update Harvest_Data
    console.log('🔄 Starting Harvest_Data update...');
    const harvestUpdateResult = updateHarvestRecord(productionId, foundFarmerID, flatData);
    console.log('📊 Harvest update result:', harvestUpdateResult);
    if (!harvestUpdateResult.success) {
      console.error('❌ Harvest update failed:', harvestUpdateResult);
      return harvestUpdateResult;
    }
    
    // Update Transport_Data
    console.log('🔄 Starting Transport_Data update...');
    const transportUpdateResult = updateTransportRecord(productionId, foundFarmerID, flatData);
    console.log('📊 Transport update result:', transportUpdateResult);
    if (!transportUpdateResult.success) {
      console.error('❌ Transport update failed:', transportUpdateResult);
      return transportUpdateResult;
    }
    
    // Update Additional_Info
    console.log('🔄 Starting Additional_Info update...');
    const additionalUpdateResult = updateAdditionalRecord(productionId, foundFarmerID, flatData);
    console.log('📊 Additional update result:', additionalUpdateResult);
    if (!additionalUpdateResult.success) {
      console.error('❌ Additional update failed:', additionalUpdateResult);
      return additionalUpdateResult;
    }
    
    console.log('✅ All production data updates completed successfully!');
    
    // Handle filesToDelete if provided
    console.log('Checking for files to delete...');
    console.log('Received filesToDelete:', data.filesToDelete);
    
    if (data.filesToDelete) {
      try {
        let filesToDelete;
        
        // Parse filesToDelete if it's a string
        if (typeof data.filesToDelete === 'string') {
          filesToDelete = JSON.parse(data.filesToDelete);
        } else {
          filesToDelete = data.filesToDelete;
        }
        
        console.log('Parsed filesToDelete:', filesToDelete);
        
        if (Array.isArray(filesToDelete) && filesToDelete.length > 0) {
          console.log(`Processing ${filesToDelete.length} files for deletion`);
          
          // Process file deletions
          for (const fileInfo of filesToDelete) {
            try {
              console.log(`Attempting to delete file: ${fileInfo.fileId} (category: ${fileInfo.category})`);
              
              // Delete file from Google Drive
              const deleteResult = deleteFileFromDrive(fileInfo.fileId);
              
              if (deleteResult.success) {
                console.log(`✅ Successfully deleted file: ${fileInfo.fileId}`);
              } else {
                console.warn(`⚠️ Failed to delete file: ${fileInfo.fileId} - ${deleteResult.message}`);
              }
            } catch (fileError) {
              console.error(`❌ Error deleting file ${fileInfo.fileId}:`, fileError);
              // Continue with other files even if one fails
            }
          }
          
          console.log('File deletion process completed');
        } else {
          console.log('No files to delete or invalid filesToDelete format');
        }
      } catch (parseError) {
        console.error('Error parsing or processing filesToDelete:', parseError);
        // Don't fail the entire update because of file deletion issues
      }
    } else {
      console.log('No filesToDelete parameter provided');
    }
    
    return {
      success: true,
      message: 'อัปเดตข้อมูลการผลิตเรียบร้อยแล้ว',
      debug: {
        productionUpdated: productionUpdateResult.success,
        harvestUpdated: harvestUpdateResult.success,
        transportUpdated: transportUpdateResult.success,
        additionalUpdated: additionalUpdateResult.success,
        filesProcessed: data.filesToDelete ? 'Yes' : 'No'
      }
    };
    
  } catch (error) {
    console.error('updateProductionData error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลการผลิต: ' + error.message
    };
  }
}

/**
 * ลบไฟล์จาก Google Drive
 */
function deleteFileFromDrive(fileId) {
  try {
    console.log(`🗑️ Attempting to delete file with ID: ${fileId}`);
    
    if (!fileId) {
      return { success: false, message: 'ไม่พบ File ID' };
    }
    
    // ตรวจสอบว่าไฟล์มีอยู่จริง
    try {
      const file = DriveApp.getFileById(fileId);
      console.log(`📄 Found file: ${file.getName()}`);
      
      // ลบไฟล์
      file.setTrashed(true); // ส่งไปขยะแทนการลบถาวร
      console.log(`✅ File ${fileId} moved to trash successfully`);
      
      return { success: true, message: 'ลบไฟล์สำเร็จ' };
      
    } catch (fileError) {
      console.warn(`⚠️ File ${fileId} not found or already deleted:`, fileError.message);
      // ถือว่าสำเร็จถ้าไฟล์ไม่มีอยู่แล้ว
      return { success: true, message: 'ไฟล์ไม่มีอยู่หรือถูกลบไปแล้ว' };
    }
    
  } catch (error) {
    console.error(`❌ Error deleting file ${fileId}:`, error);
    return { 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการลบไฟล์: ' + error.message 
    };
  }
}

/**
 * อัปเดต Production_Data record
 */
function updateProductionRecord(productionSheet, headers, rowIndex, data) {
  try {
    console.log('=== DEBUG: updateProductionRecord ===');
    console.log('Headers:', headers);
    console.log('Row index:', rowIndex);
    console.log('Data received:', data);
    
    // Map data to sheet columns
    const columnMapping = {
      'SeasonID': data.seasonId,       // เพิ่ม SeasonID mapping
      'PlantDate': data.plantDate,
      'HarvestDate': data.harvestDate, // เพิ่ม HarvestDate
      'CropType': data.cropType,
      'CropVariety': data.cropVariety,
      'PlantingMethod': data.plantingMethod,
      'PlantingMethodOther': data.plantingMethodOther,
      'Fertilizer': data.fertilizer,
      'Pesticide': data.pesticide,
      'WaterSourceType': data.waterSourceType,
      'WaterManagement': data.waterManagement,
      'PestControl': data.pestControl,
      'RecordMethod': data.recordMethod, // เพิ่ม RecordMethod
      'MaintenanceRecord': data.maintenanceRecord,
      'UpdatedAt': getCurrentTimestamp()
    };
    
    console.log('Column mapping:', columnMapping);
    
    // Update each column
    let updatedFields = 0;
    let skippedFields = 0;
    
    Object.keys(columnMapping).forEach(columnName => {
      const columnIndex = headers.indexOf(columnName);
      const value = columnMapping[columnName];
      console.log(`Column "${columnName}": index=${columnIndex}, value="${value}"`);
      
      if (columnIndex !== -1 && value !== undefined && value !== null) {
        try {
          productionSheet.getRange(rowIndex, columnIndex + 1).setValue(value);
          console.log(`✓ Updated ${columnName} at column ${columnIndex + 1} with value: "${value}"`);
          updatedFields++;
        } catch (cellError) {
          console.error(`❌ Error updating ${columnName}:`, cellError.message);
        }
      } else {
        console.log(`✗ Skipped ${columnName} (not found or undefined/null)`);
        skippedFields++;
      }
    });
    
    console.log(`📊 Production update summary: ${updatedFields} updated, ${skippedFields} skipped`);
    
    return { success: true };
  } catch (error) {
    console.error('updateProductionRecord error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลการผลิต' };
  }
}

/**
 * อัปเดต Harvest_Data record
 */
function updateHarvestRecord(productionId, farmerID, data) {
  try {
    console.log('=== DEBUG: updateHarvestRecord ===');
    console.log('ProductionID:', productionId);
    console.log('FarmerID:', farmerID);
    console.log('Data received:', data);
    
    const harvestSheet = getSheet(CONFIG.SHEETS.HARVEST_DATA);
    const harvestData = harvestSheet.getDataRange().getValues();
    const harvestHeaders = harvestData[0];
    
    console.log('Harvest sheet headers:', harvestHeaders);
    
    let harvestRowIndex = -1;
    
    // Find existing harvest record
    for (let i = 1; i < harvestData.length; i++) {
      const row = harvestData[i];
      if (row[2] === productionId) { // ProductionID is in column 2
        harvestRowIndex = i + 1; // Sheet row number (1-based)
        console.log(`Found existing harvest record at row ${harvestRowIndex}`);
        break;
      }
    }
    
    if (harvestRowIndex === -1) {
      console.log('No existing harvest record found, will create new one');
    }
    
    // Column mapping for harvest data
    const columnMapping = {
      'HarvestDate': data.harvestDate,
      'Quantity': data.quantity,              // แก้ไขจาก harvestQuantity
      'Unit': data.unit,                      // แก้ไขจาก harvestUnit
      'UnitOther': data.unitOther,            // เพิ่มฟิลด์ที่หายไป
      'ShipDate': data.shipDate,
      'HarvestMethod': data.harvestMethod,    // เพิ่มฟิลด์ที่หายไป
      'PackagingCompany': data.packagingCompany,    // เพิ่มฟิลด์ที่หายไป
      'PackagingLocation': data.packagingLocation,  // เพิ่มฟิลด์ที่หายไป
      'ResponsiblePerson': data.responsiblePerson,  // เพิ่มฟิลด์ที่หายไป
      'UpdatedAt': getCurrentTimestamp()
    };
    
    if (harvestRowIndex !== -1) {
      // Update existing record
      Object.keys(columnMapping).forEach(columnName => {
        const columnIndex = harvestHeaders.indexOf(columnName);
        if (columnIndex !== -1 && columnMapping[columnName] !== undefined) {
          harvestSheet.getRange(harvestRowIndex, columnIndex + 1).setValue(columnMapping[columnName]);
        }
      });
    } else {
      // Create new harvest record if it doesn't exist
      const harvestID = generateId();
      const newHarvestRow = [
        harvestID,              // HarvestID
        farmerID,               // FarmerID
        productionId,           // ProductionID
        data.harvestDate || '', // HarvestDate
        data.quantity || '',    // Quantity (แก้ไขจาก harvestQuantity)
        data.unit || '',        // Unit (แก้ไขจาก harvestUnit)
        data.unitOther || '',   // UnitOther (เพิ่มฟิลด์ที่หายไป)
        data.shipDate || '',    // ShipDate
        data.harvestMethod || '', // HarvestMethod (เพิ่มฟิลด์ที่หายไป)
        data.packagingCompany || '', // PackagingCompany (เพิ่มฟิลด์ที่หายไป)
        data.packagingLocation || '', // PackagingLocation (เพิ่มฟิลด์ที่หายไป)
        data.responsiblePerson || '', // ResponsiblePerson (เพิ่มฟิลด์ที่หายไป)
        'Active',               // Status
        getCurrentTimestamp(),  // Created
        getCurrentTimestamp()   // UpdatedAt
      ];
      
      harvestSheet.appendRow(newHarvestRow);
    }
    
    return { success: true };
  } catch (error) {
    console.error('updateHarvestRecord error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลการเก็บเกี่ยว' };
  }
}

/**
 * อัปเดต Transport_Data record
 */
function updateTransportRecord(productionId, farmerID, data) {
  try {
    console.log('=== DEBUG: updateTransportRecord ===');
    console.log('ProductionID:', productionId);
    console.log('FarmerID:', farmerID);
    console.log('Data received:', data);
    console.log('data.farmShipDate:', data.farmShipDate);
    
    const transportSheet = getSheet(CONFIG.SHEETS.TRANSPORT_DATA);
    const transportData = transportSheet.getDataRange().getValues();
    const transportHeaders = transportData[0];
    
    console.log('Transport sheet headers:', transportHeaders);
    
    let transportRowIndex = -1;
    
    // Find existing transport record
    for (let i = 1; i < transportData.length; i++) {
      const row = transportData[i];
      if (row[2] === productionId) { // ProductionID is in column 2
        transportRowIndex = i + 1; // Sheet row number (1-based)
        console.log(`Found existing transport record at row ${transportRowIndex}`);
        break;
      }
    }
    
    if (transportRowIndex === -1) {
      console.log('No existing transport record found, will create new one');
    }
    
    // Column mapping for transport data
    const columnMapping = {
      'ShipDate': data.farmShipDate,                    // เพิ่มฟิลด์ที่หายไป
      'TransportChannel': data.transportChannel,        // เพิ่มฟิลด์ที่หายไป
      'TransportMethod': data.transportMethod,
      'TransportMethodOther': data.transportMethodOther, // เพิ่มฟิลด์ที่หายไป
      'TransportCompany': data.transportCompany,        // เพิ่มฟิลด์ที่หายไป
      'DistributorCode': data.distributorCode,          // เพิ่มฟิลด์ที่หายไป
      'UpdatedAt': getCurrentTimestamp()
    };
    
    console.log('Transport column mapping:', columnMapping);
    
    if (transportRowIndex !== -1) {
      // Update existing record
      let updatedFields = 0;
      let skippedFields = 0;
      
      Object.keys(columnMapping).forEach(columnName => {
        const columnIndex = transportHeaders.indexOf(columnName);
        const value = columnMapping[columnName];
        console.log(`Transport column "${columnName}": index=${columnIndex}, value="${value}"`);
        
        if (columnIndex !== -1 && value !== undefined && value !== null) {
          try {
            transportSheet.getRange(transportRowIndex, columnIndex + 1).setValue(value);
            console.log(`✓ Updated ${columnName} at column ${columnIndex + 1} with value: "${value}"`);
            updatedFields++;
          } catch (cellError) {
            console.error(`❌ Error updating ${columnName}:`, cellError.message);
          }
        } else {
          console.log(`✗ Skipped ${columnName} (not found or undefined/null)`);
          skippedFields++;
        }
      });
      
      console.log(`📊 Transport update summary: ${updatedFields} updated, ${skippedFields} skipped`);
    } else {
      // Create new transport record if it doesn't exist
      const transportID = generateId();
      const newTransportRow = [
        transportID,                      // TransportID
        farmerID,                        // FarmerID
        productionId,                    // ProductionID
        data.farmShipDate || '',         // ShipDate (เพิ่มฟิลด์ที่หายไป)
        data.transportChannel || '',     // TransportChannel (เพิ่มฟิลด์ที่หายไป)
        data.transportMethod || '',      // TransportMethod
        data.transportMethodOther || '', // TransportMethodOther (เพิ่มฟิลด์ที่หายไป)
        data.transportCompany || '',     // TransportCompany (เพิ่มฟิลด์ที่หายไป)
        data.distributorCode || '',      // DistributorCode (เพิ่มฟิลด์ที่หายไป)
        'Active',                        // Status
        getCurrentTimestamp(),           // Created
        getCurrentTimestamp()            // UpdatedAt
      ];
      
      transportSheet.appendRow(newTransportRow);
    }
    
    return { success: true };
  } catch (error) {
    console.error('updateTransportRecord error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลการขนส่ง' };
  }
}

/**
 * อัปเดต Additional_Info record
 */
function updateAdditionalRecord(productionId, farmerID, data) {
  try {
    const additionalSheet = getSheet(CONFIG.SHEETS.ADDITIONAL_INFO);
    const additionalData = additionalSheet.getDataRange().getValues();
    const additionalHeaders = additionalData[0];
    
    let additionalRowIndex = -1;
    
    // Find existing additional record
    for (let i = 1; i < additionalData.length; i++) {
      const row = additionalData[i];
      if (row[2] === productionId) { // ProductionID is in column 2
        additionalRowIndex = i + 1; // Sheet row number (1-based)
        break;
      }
    }
    
    // Column mapping for additional data
    const columnMapping = {
      'Story': data.story,           // แก้ไขจาก additionalStory
      'UpdatedAt': getCurrentTimestamp()
    };
    
    if (additionalRowIndex !== -1) {
      // Update existing record
      Object.keys(columnMapping).forEach(columnName => {
        const columnIndex = additionalHeaders.indexOf(columnName);
        if (columnIndex !== -1 && columnMapping[columnName] !== undefined) {
          additionalSheet.getRange(additionalRowIndex, columnIndex + 1).setValue(columnMapping[columnName]);
        }
      });
    } else {
      // Create new additional record if it doesn't exist
      const additionalID = generateId();
      const newAdditionalRow = [
        additionalID,              // AdditionalID
        farmerID,                  // FarmerID
        productionId,              // ProductionID
        data.story || '',          // Story (แก้ไขจาก additionalStory)
        'Active',                  // Status
        getCurrentTimestamp(),     // Created
        getCurrentTimestamp()      // UpdatedAt
      ];
      
      additionalSheet.appendRow(newAdditionalRow);
    }
    
    return { success: true };
  } catch (error) {
    console.error('updateAdditionalRecord error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลเพิ่มเติม' };
  }
}

/**
 * ลบไฟล์ (soft delete)
 */
function deleteFileRecord(data) {
  try {
    console.log('deleteFileRecord called with data:', data);
    
    const fileId = data.fileId;
    const farmerID = data.farmerID; // Optional - for ownership verification
    
    if (!fileId) {
      return { success: false, message: 'ไม่พบข้อมูล File ID' };
    }
    
    const fileRecordsSheet = getSheet(CONFIG.SHEETS.FILE_RECORDS);
    const fileRecordsData = fileRecordsSheet.getDataRange().getValues();
    const fileRecordsHeaders = fileRecordsData[0];
    
    let fileRowIndex = -1;
    let foundFarmerID = null;
    
    // Find file record
    for (let i = 1; i < fileRecordsData.length; i++) {
      const row = fileRecordsData[i];
      if (row[0] === fileId) { // fileId is in column 0
        foundFarmerID = row[4]; // farmerId is in column 4
        fileRowIndex = i + 1; // Sheet row number (1-based)
        break;
      }
    }
    
    if (fileRowIndex === -1) {
      return { success: false, message: 'ไม่พบไฟล์ที่ต้องการลบ' };
    }
    
    // Optional: Verify ownership if farmerID is provided
    if (farmerID && farmerID !== foundFarmerID) {
      return { success: false, message: 'คุณไม่มีสิทธิ์ลบไฟล์นี้' };
    }
    
    // Soft delete - change status to 'Deleted'
    const statusColumnIndex = fileRecordsHeaders.indexOf('status');
    const updatedAtColumnIndex = fileRecordsHeaders.indexOf('updatedAt');
    
    if (statusColumnIndex !== -1) {
      fileRecordsSheet.getRange(fileRowIndex, statusColumnIndex + 1).setValue('Deleted');
    }
    
    if (updatedAtColumnIndex !== -1) {
      fileRecordsSheet.getRange(fileRowIndex, updatedAtColumnIndex + 1).setValue(getCurrentTimestamp());
    }
    
    console.log('File record soft deleted successfully:', fileId);
    
    return {
      success: true,
      message: 'ลบไฟล์เรียบร้อยแล้ว'
    };
    
  } catch (error) {
    console.error('deleteFileRecord error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบไฟล์: ' + error.message
    };
  }
}

/**
 * Helper function: ดึงข้อมูลเกษตรกรตาม ID
 */
function getFarmerById(farmerId) {
  try {
    const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
    const farmersData = farmersSheet.getDataRange().getValues();
    const farmersHeaders = farmersData[0];
    
    for (let i = 1; i < farmersData.length; i++) {
      const row = farmersData[i];
      if (String(row[0]).trim() === String(farmerId).trim()) { // FarmerID is in column 0
        const farmerData = {};
        farmersHeaders.forEach((header, index) => {
          farmerData[header] = row[index];
          
          // Add compatibility aliases for common property names
          if (header === 'FarmerID') farmerData['farmerId'] = row[index];
          if (header === 'GroupID') farmerData['groupId'] = row[index];
          if (header === 'PlotNumber') farmerData['plotNumber'] = row[index];
          if (header === 'FullName') farmerData['fullName'] = row[index];
        });
        return farmerData;
      }
    }
    
    return null;
  } catch (error) {
    console.error('getFarmerById error:', error);
    return null;
  }
}

/**
 * Helper function: ดึงข้อมูลกลุ่มตาม ID
 */
function getGroupById(groupId) {
  try {
    const groupsSheet = getSheet(CONFIG.SHEETS.GROUPS);
    const groupsData = groupsSheet.getDataRange().getValues();
    const groupsHeaders = groupsData[0];
    
    for (let i = 1; i < groupsData.length; i++) {
      const row = groupsData[i];
      if (String(row[0]).trim() === String(groupId).trim()) { // GroupID is in column 0
        const groupData = {};
        groupsHeaders.forEach((header, index) => {
          groupData[header] = row[index];
        });
        return groupData;
      }
    }
    
    return null;
  } catch (error) {
    console.error('getGroupById error:', error);
    return null;
  }
}

/**
 * สร้าง PDF สติ๊กเกอร์ QR Code
 * 
 * ฟังก์ชันนี้ถูกย้ายไปไฟล์ simple-qr-generator.gs แล้ว
 * เพื่อแก้ปัญหา Layout และ QR Code ไม่แสดง
 */

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
    
    console.log('🔍 DEBUG: getTransportDataByFarmer headers:', transportHeaders);
    
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
        
        // 🔧 FIX: แปลง ShipDate ให้เป็น FarmShipDate เพื่อให้ frontend ใช้ได้
        if (transportRecord.ShipDate) {
          transportRecord.FarmShipDate = transportRecord.ShipDate;
        }
        
        console.log('🔍 DEBUG: transport record:', transportRecord);
        results.push(transportRecord);
      }
    }
    
    console.log(`🔍 DEBUG: Found ${results.length} transport records for farmer ${farmerID}, production ${productionID}`);
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
      const rowProductionID = String(row[5] || '').replace(/^['"]|['"]$/g, '').trim(); // productionId is in column 5
      const rowStatus = row[11]; // status is in column 11
      
      // Clean input productionID for comparison
      const cleanProductionID = String(productionID || '').replace(/^['"]|['"]$/g, '').trim();
      
      // Only return active files for the specified production ID
      if (rowProductionID === cleanProductionID && rowStatus === 'Active') {
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

/**
 * ลบรอบการผลิตและข้อมูลที่เกี่ยวข้องทั้งหมด
 */
function deleteProductionCycle(data) {
  try {
    console.log('🗑️ deleteProductionCycle called with:', data);
    
    // Clean and validate ProductionID
    let productionID = data.productionID;
    if (!productionID) {
      return { success: false, message: 'ไม่พบข้อมูล Production ID' };
    }
    
    // Clean ProductionID - remove quotes, trim whitespace, handle different formats
    productionID = String(productionID)
      .replace(/^['"]|['"]$/g, '') // Remove leading/trailing quotes
      .trim(); // Remove whitespace
    
    console.log(`📋 Cleaned ProductionID: "${productionID}" (length: ${productionID.length})`);
    
    if (!productionID) {
      return { success: false, message: 'Production ID ไม่ถูกต้องหลังการทำความสะอาด' };
    }
    
    // Find production record and verify ownership
    const productionSheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    const productionData = productionSheet.getDataRange().getValues();
    
    let productionRowIndex = -1;
    let farmerID = null;
    
    for (let i = 1; i < productionData.length; i++) {
      // Clean the ProductionID from sheet for comparison
      const sheetProductionID = String(productionData[i][0] || '')
        .replace(/^['"]|['"]$/g, '')
        .trim();
      
      console.log(`🔍 Comparing: "${productionID}" === "${sheetProductionID}"`);
      
      if (sheetProductionID === productionID) { // ProductionID in column 0
        farmerID = productionData[i][1]; // FarmerID in column 1
        productionRowIndex = i + 1; // +1 for sheet row number
        console.log(`✅ Found match at row ${productionRowIndex}, FarmerID: ${farmerID}`);
        break;
      }
    }
    
    if (productionRowIndex === -1) {
      return { success: false, message: 'ไม่พบข้อมูลการผลิตที่ต้องการลบ' };
    }
    
    console.log(`📋 Found production record: ID=${productionID}, FarmerID=${farmerID}, Row=${productionRowIndex}`);
    
    // Track deleted records
    const deletedRecords = {
      production: 0,
      harvest: 0,
      transport: 0,
      searchCodes: 0,
      additionalInfo: 0,
      files: 0
    };
    
    // Get file records to delete before deleting from FileRecords table
    const fileRecords = getFileRecordsByProductionId(productionID);
    console.log(`📄 Found ${fileRecords.length} files to delete`);
    
    // Delete files from Google Drive first
    for (const fileRecord of fileRecords) {
      try {
        const fileId = fileRecord.fileId;
        if (fileId) {
          const deleteResult = deleteFileFromDrive(fileId);
          if (deleteResult.success) {
            console.log(`✅ Deleted file: ${fileId}`);
            deletedRecords.files++;
          } else {
            console.warn(`⚠️ Failed to delete file: ${fileId} - ${deleteResult.message}`);
          }
        }
      } catch (fileError) {
        console.error(`❌ Error deleting file ${fileRecord.fileId}:`, fileError);
      }
    }
    
    // 1. Delete from Production_Data
    productionSheet.deleteRow(productionRowIndex);
    deletedRecords.production = 1;
    console.log('✅ Deleted from Production_Data');
    
    // 2. Delete from Harvest_Data
    const harvestSheet = getSheet(CONFIG.SHEETS.HARVEST_DATA);
    const harvestData = harvestSheet.getDataRange().getValues();
    for (let i = harvestData.length - 1; i >= 1; i--) {
      const sheetProductionID = String(harvestData[i][2] || '').replace(/^['"]|['"]$/g, '').trim();
      if (sheetProductionID === productionID) { // ProductionID in column 2
        harvestSheet.deleteRow(i + 1);
        deletedRecords.harvest++;
      }
    }
    console.log(`✅ Deleted ${deletedRecords.harvest} records from Harvest_Data`);
    
    // 3. Delete from Transport_Data
    const transportSheet = getSheet(CONFIG.SHEETS.TRANSPORT_DATA);
    const transportData = transportSheet.getDataRange().getValues();
    for (let i = transportData.length - 1; i >= 1; i--) {
      const sheetProductionID = String(transportData[i][2] || '').replace(/^['"]|['"]$/g, '').trim();
      if (sheetProductionID === productionID) { // ProductionID in column 2
        transportSheet.deleteRow(i + 1);
        deletedRecords.transport++;
      }
    }
    console.log(`✅ Deleted ${deletedRecords.transport} records from Transport_Data`);
    
    // 4. Delete from Search_Codes
    const searchSheet = getSheet(CONFIG.SHEETS.SEARCH_CODES);
    const searchData = searchSheet.getDataRange().getValues();
    for (let i = searchData.length - 1; i >= 1; i--) {
      const sheetProductionID = String(searchData[i][5] || '').replace(/^['"]|['"]$/g, '').trim();
      if (sheetProductionID === productionID) { // ProductionID in column 5
        searchSheet.deleteRow(i + 1);
        deletedRecords.searchCodes++;
      }
    }
    console.log(`✅ Deleted ${deletedRecords.searchCodes} records from Search_Codes`);
    
    // 5. Delete from Additional_Info
    const additionalSheet = getSheet(CONFIG.SHEETS.ADDITIONAL_INFO);
    const additionalData = additionalSheet.getDataRange().getValues();
    for (let i = additionalData.length - 1; i >= 1; i--) {
      const sheetProductionID = String(additionalData[i][2] || '').replace(/^['"]|['"]$/g, '').trim();
      if (sheetProductionID === productionID) { // ProductionID in column 2
        additionalSheet.deleteRow(i + 1);
        deletedRecords.additionalInfo++;
      }
    }
    console.log(`✅ Deleted ${deletedRecords.additionalInfo} records from Additional_Info`);
    
    // 6. Delete from File_Records
    const filesSheet = getSheet(CONFIG.SHEETS.FILE_RECORDS);
    const filesData = filesSheet.getDataRange().getValues();
    for (let i = filesData.length - 1; i >= 1; i--) {
      const sheetProductionID = String(filesData[i][5] || '').replace(/^['"]|['"]$/g, '').trim();
      if (sheetProductionID === productionID) { // ProductionID in column 5
        filesSheet.deleteRow(i + 1);
      }
    }
    console.log('✅ Deleted records from File_Records');
    
    // 7. Delete from QR_Files (if exists)
    try {
      const qrFilesSheet = getSheet(CONFIG.SHEETS.QR_FILES);
      const qrFilesData = qrFilesSheet.getDataRange().getValues();
      for (let i = qrFilesData.length - 1; i >= 1; i--) {
        const sheetProductionID = String(qrFilesData[i][1] || '').replace(/^['"]|['"]$/g, '').trim();
        if (sheetProductionID === productionID) { // ProductionID in column 1
          qrFilesSheet.deleteRow(i + 1);
        }
      }
      console.log('✅ Deleted records from QR_Files');
    } catch (qrError) {
      console.log('⚠️ QR_Files sheet not found or error:', qrError.message);
    }
    
    console.log('🎉 Production cycle deleted successfully:', {
      productionID: productionID,
      farmerID: farmerID,
      deletedRecords: deletedRecords
    });
    
    return {
      success: true,
      message: 'ลบข้อมูลการผลิตและไฟล์ที่เกี่ยวข้องเรียบร้อยแล้ว',
      data: {
        productionID: productionID,
        farmerID: farmerID,
        deletedRecords: deletedRecords
      }
    };
    
  } catch (error) {
    console.error('deleteProductionCycle error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบข้อมูลการผลิต: ' + error.message,
      error: error.message
    };
  }
}

