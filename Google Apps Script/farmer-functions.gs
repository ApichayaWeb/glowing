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
    
    // อัพเดต QR Code หากมีการเปลี่ยน PlotNumber
    try {
      const currentFarmerData = getFarmerByUsername(username || '').data;
      if (currentFarmerData && currentFarmerData.PlotNumber) {
        // อัพเดต QR Code ในตาราง QR_Codes
        const updateQRResult = updateQRCodeForFarmer(farmerID, currentFarmerData.PlotNumber, currentFarmerData.GroupID);
        console.log('QR Code update result:', updateQRResult);
      }
    } catch (qrError) {
      console.warn('Could not update QR Code:', qrError);
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
 * อัพเดต QR Code สำหรับเกษตรกร (เมื่อ PlotNumber เปลี่ยน)
 */
function updateQRCodeForFarmer(farmerID, newPlotNumber, groupID) {
  try {
    console.log('updateQRCodeForFarmer called with:', { farmerID, newPlotNumber, groupID });
    
    // ดึงข้อมูลกลุ่มเพื่อหา GroupCode
    const groupsSheet = getSheet(CONFIG.SHEETS.GROUPS);
    const groupsData = groupsSheet.getDataRange().getValues();
    const groupsHeaders = groupsData[0];
    
    let groupCode = '';
    for (let i = 1; i < groupsData.length; i++) {
      const row = groupsData[i];
      if (row[groupsHeaders.indexOf('GroupID')] === groupID) {
        groupCode = row[groupsHeaders.indexOf('GroupCode')];
        break;
      }
    }
    
    if (!groupCode) {
      return { success: false, message: 'ไม่พบรหัสกลุ่ม' };
    }
    
    // สร้าง QR Code ใหม่
    const newQRCode = groupCode + '-' + newPlotNumber;
    console.log('New QR Code:', newQRCode);
    
    // อัพเดต QR Code ในตาราง QR_Codes
    const qrCodesSheet = getSheet(CONFIG.SHEETS.QR_CODES);
    const qrData = qrCodesSheet.getDataRange().getValues();
    const qrHeaders = qrData[0];
    
    let qrUpdated = false;
    
    // หา QR Code เดิมของเกษตรกรนี้และอัพเดต
    for (let i = 1; i < qrData.length; i++) {
      const row = qrData[i];
      if (row[qrHeaders.indexOf('FarmerID')] === farmerID && row[qrHeaders.indexOf('Status')] === 'active') {
        // อัพเดต QR Code, GroupCode, และ PlotNumber
        qrCodesSheet.getRange(i + 1, qrHeaders.indexOf('QRCode') + 1).setValue(newQRCode);
        qrCodesSheet.getRange(i + 1, qrHeaders.indexOf('GroupCode') + 1).setValue("'" + groupCode);
        qrCodesSheet.getRange(i + 1, qrHeaders.indexOf('PlotNumber') + 1).setValue(newPlotNumber);
        
        qrUpdated = true;
        console.log('Updated existing QR Code at row:', i + 1);
        break;
      }
    }
    
    // หากไม่มี QR Code เดิม ให้สร้างใหม่
    if (!qrUpdated) {
      const qrID = generateId();
      const qrData = [
        qrID,                   // QRID
        newQRCode,              // QRCode  
        "'" + groupCode,        // GroupCode - บังคับให้เป็น text
        newPlotNumber,          // PlotNumber
        farmerID,               // FarmerID
        'active',               // Status
        getCurrentTimestamp(),  // Created
        0,                      // ViewCount
        ''                      // LastViewed
      ];
      
      qrCodesSheet.appendRow(qrData);
      console.log('Created new QR Code');
    }
    
    return {
      success: true,
      message: 'อัพเดต QR Code เรียบร้อยแล้ว',
      qrCode: newQRCode
    };
    
  } catch (error) {
    console.error('Error updating QR Code for farmer:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัพเดต QR Code: ' + error.message
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
      // Map camelCase to PascalCase for sheet compatibility
      if (data.production.plantDate) flatData.PlantDate = data.production.plantDate;
      if (data.production.harvestDate) flatData.HarvestDate = data.production.harvestDate;
    }
    
    // Harvest data - รวมถึง shipDate 
    if (data.harvest) {
      Object.assign(flatData, data.harvest);
    }
    
    // Transport data - รวมถึง farmShipDate
    if (data.transport) {
      Object.assign(flatData, data.transport);
      // Map camelCase to PascalCase for sheet compatibility
      if (data.transport.distributorCode) flatData.DistributorCode = data.transport.distributorCode;
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
    
    // ใช้ flatData สำหรับการอัปเดต แต่ไม่เขียนทับ data เดิม
    // เก็บข้อมูลสำคัญจาก data เดิม
    const originalProductionId = data.productionId;
    const originalFarmerID = data.farmerID;
    const originalFilesToDelete = data.filesToDelete;
    
    // Clean farmerID from potential text format prefix
    console.log('Raw farmerID from originalFarmerID:', originalFarmerID);
    const farmerID = String(originalFarmerID || '').replace(/^'/, '');
    console.log('Using cleaned farmerID:', farmerID);
    
    if (!farmerID) {
      console.error('CRITICAL: No farmerID provided!', { 
        rawFarmerID: originalFarmerID,
        originalData: { productionId: originalProductionId, farmerID: originalFarmerID },
        flatData: flatData
      });
      return { success: false, message: 'ไม่พบข้อมูล Farmer ID' };
    }
    
    console.log('✓ FarmerID validation passed, proceeding...');
    
    // Ensure farmer folder exists - FIX for folder creation
    console.log("🗂️ Ensuring farmer folder exists for:", farmerID);
    try {
      // Get farmer data for groupId and phone
      const farmersSheet = getSheet(CONFIG.SHEETS.FARMERS);
      const farmersData = farmersSheet.getDataRange().getValues();
      let groupId = null, phone = null;
      
      for (let i = 1; i < farmersData.length; i++) {
        if (farmersData[i][0] === farmerID) {
          groupId = farmersData[i][1]; // GroupID
          phone = farmersData[i][7];   // Phone
          break;
        }
      }
      
      if (groupId && phone) {
        const folderResult = ensureFarmerFolderExists(farmerID, groupId, phone);
        console.log("📁 Farmer folder result:", folderResult);
        if (!folderResult.success) {
          console.warn("⚠️ Could not create farmer folder:", folderResult.message);
        }
      } else {
        console.warn("⚠️ Could not find farmer groupId or phone for folder creation");
      }
    } catch (folderError) {
      console.warn("⚠️ Error ensuring farmer folder:", folderError);
    }

    // Use existing Production ID for update
    const currentTime = getCurrentTimestamp();
    
    // บันทึกข้อมูลการผลิต (Production_Data)
    console.log('Getting Production_Data sheet...');
    const productionSheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    if (!productionSheet) {
      console.error('❌ Cannot access Production_Data sheet');
      return { success: false, message: 'ไม่สามารถเข้าถึง Production_Data sheet ได้' };
    }
    console.log('✓ Production_Data sheet accessed:', productionSheet.getName());
    
    // Debug: Check if sheet headers match our data
    console.log('🔍 Sheet headers check:');
    // Get Production_Data sheet headers - FIX for productionHeaders error
    const productionData = productionSheet.getDataRange().getValues();
    const productionHeaders = productionData.length > 0 ? productionData[0] : [];
    console.log("✓ Production_Data headers loaded:", productionHeaders);
    console.log('Available headers:', productionHeaders);
    const requiredFields = ['CropType', 'PlantDate', 'HarvestDate', 'MaintenanceRecord'];
    requiredFields.forEach(field => {
      const index = productionHeaders.indexOf(field);
      console.log(`- ${field}: column ${index + 1} ${index >= 0 ? '✅' : '❌'}`);
    });
    
    // Create or Update Production_Data with enhanced error handling
    console.log('🔄 Processing Production_Data...');
    let productionResult;
    
    if (originalProductionId) {
      // Update existing production record
      console.log('Updating existing production record:', originalProductionId);
      productionResult = updateProductionRecord(originalProductionId, flatData);
    } else {
      // Create new production record
      console.log('Creating new production record');
      productionResult = addProductionRecord(flatData);
    }
    
    console.log('Production result:', productionResult);
    if (!productionResult.success) {
      console.error('❌ Production_Data operation failed');
      return productionResult;
    }
    console.log('✅ Production_Data processed successfully');
    
    // Extract ProductionID from the result
    const productionID = productionResult.productionID || originalProductionId;
    
    if (!productionID) {
      console.error('❌ ProductionID is undefined after production operation');
      return { success: false, message: 'ไม่สามารถระบุ ProductionID ได้' };
    }
    
    console.log('Using ProductionID:', productionID);
    
    // สร้าง LotCode (พ.ศ.:เดือน:วันที่ของวันที่เก็บเกี่ยว)
    let lotCode = '';
    if (data.production?.harvestDate) {
      const harvestDate = new Date(data.production?.harvestDate);
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
    console.log('flatData.shipDate (วันที่จัดส่ง):', flatData.shipDate);
    console.log('flatData.harvestMethod:', flatData.harvestMethod);
    console.log('flatData.packagingCompany:', flatData.packagingCompany);
    console.log('====================================');
    
    const harvestData = [
      generateId(),
      farmerID,
      productionID,
      flatData.shipDate || '', // วันที่จัดส่ง จาก Harvest_Data.ShipDate
      flatData.harvestMethod || '',
      flatData.packagingCompany || '',
      flatData.packagingLocation || '',
      '', // PackagingProvince - จะเพิ่มใน form
      flatData.responsiblePerson || '',
      lotCode,
      flatData.quantity || '',
      flatData.unit === 'อื่น ๆ ระบุ' ? flatData.unitOther : flatData.unit || '',
      currentTime,
      currentTime
    ];
    
    // Insert harvest data to sheet
    harvestSheet.appendRow(harvestData);
    console.log('✅ Harvest data inserted successfully:', harvestData);
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
    console.log('flatData.farmShipDate (วันที่ส่งจากฟาร์ม):', flatData.farmShipDate);
    console.log('flatData.transportChannel:', flatData.transportChannel);
    console.log('flatData.transportMethod:', flatData.transportMethod);
    console.log('flatData.distributorCode:', flatData.distributorCode);
    console.log('======================================');
    
    const transportData = [
      generateId(),                                           // TransportID
      farmerID,                                              // FarmerID
      productionID,                                          // ProductionID
      flatData.farmShipDate || '', // ShipDate - ใช้เฉพาะ farmShipDate สำหรับ Transport_Data
      flatData.transportChannel || '',                           // TransportChannel
      flatData.transportMethod === 'อื่น ๆ ระบุ' ? flatData.transportMethodOther || '' : '', // TransportMethodOther
      flatData.transportMethod || '',                            // TransportMethod
      flatData.transportCompany || '',                           // TransportCompany
      flatData.distributorCode ? "'" + flatData.distributorCode : '',  // DistributorCode (with text format)
      'Active',                                              // Status
      currentTime,                                           // Created
      currentTime                                            // UpdatedAt
    ];
    
    // Insert transport data to sheet
    transportSheet.appendRow(transportData);
    console.log('✅ Transport data inserted successfully:', transportData);
    // บันทึกข้อมูลเพิ่มเติม (Additional_Info) 
    if (flatData.story && flatData.story.trim() !== '') {
      const additionalSheet = getSheet(CONFIG.SHEETS.ADDITIONAL_INFO);
      const additionalData = [
        generateId(),
        farmerID,
        productionID,
        flatData.story || '', // Story
        currentTime // LastUpdate
      ];
      // Insert additional data to sheet
      additionalSheet.appendRow(additionalData);
      console.log('✅ Additional data inserted successfully:', additionalData);
    
    }
    // สร้าง Search Code - ใช้ plantDate จาก Production_Data สำหรับการค้นหา
    console.log('=== DEBUG: Search Code Generation ===');
    console.log('Available data for search code:');
    console.log('- data.production?.plantDate (Production_Data):', data.production?.plantDate);
    console.log('- flatData.distributorCode:', flatData.distributorCode);
    
    // ใช้ plantDate จาก Production_Data สำหรับ Search Code
    const plantDate = flatData.PlantDate || '';
    const distributorCode = flatData.DistributorCode || '';
    
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
      flatData.shipDate || '', // ShipDate from harvest
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
    // Insert search codes to sheet
    searchSheet.appendRow(searchData);
    console.log('✅ Search codes inserted successfully:', searchData);
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
      fileID,                        // 0: fileId
      finalFileName,                 // 1: fileName
      uploadedFile.getUrl(),         // 2: fileUrl
      uploadedFile.getDownloadUrl(), // 3: downloadUrl
      farmer.FarmerID,               // 4: farmerId
      productionID || '',            // 5: productionId ← MOVED TO CORRECT POSITION
      fileType,                      // 6: fileType
      subFolderName,                 // 7: folderName
      mimeType,                      // 8: mimeType
      fileSize || 0,                 // 9: fileSize
      uploadTime,                    // 10: uploadedAt
      'Active',                      // 11: status
      uploadTime                     // 12: updatedAt
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
            qrCode: qrData[i][1],  // QRCode อยู่ที่ column 1
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
 * ฟังก์ชันทดสอบการเขียนข้อมูลลง Google Sheets
 */
function debugUpdateTest(data) {
  try {
    console.log('=== DEBUG UPDATE TEST ===');
    
    const productionId = data.productionId || 'RWamfFYs'; // Use provided or test ID
    const testData = {
      cropType: 'TEST_CROP_' + new Date().getTime(),
      plantDate: '2025-01-01',
      harvestDate: '2025-01-15'
    };
    
    console.log('Testing with ProductionID:', productionId);
    
    // Test 1: Get sheet
    const productionSheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    const productionData = productionSheet.getDataRange().getValues();
    const productionHeaders = productionData[0];
    
    console.log('Headers:', productionHeaders);
    
    // Find row for productionId
    let rowIndex = -1;
    for (let i = 1; i < productionData.length; i++) {
      if (productionData[i][0] === productionId) {
        rowIndex = i + 1; // 1-based for sheet
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { success: false, message: 'ProductionID not found: ' + productionId };
    }
    
    console.log('Found row:', rowIndex);
    
    // Test 2: Try direct update
    const cropTypeColumn = productionHeaders.indexOf('CropType') + 1;
    const plantDateColumn = productionHeaders.indexOf('PlantDate') + 1;
    
    if (cropTypeColumn > 0) {
      console.log('Updating CropType at row', rowIndex, 'col', cropTypeColumn);
      const originalCrop = productionSheet.getRange(rowIndex, cropTypeColumn).getValue();
      console.log('Original value:', originalCrop);
      
      productionSheet.getRange(rowIndex, cropTypeColumn).setValue(testData.cropType);
      SpreadsheetApp.flush();
      
      const newValue = productionSheet.getRange(rowIndex, cropTypeColumn).getValue();
      console.log('New value:', newValue);
      
      if (newValue === testData.cropType) {
        console.log('✅ UPDATE SUCCESS!');
        // Restore original
        productionSheet.getRange(rowIndex, cropTypeColumn).setValue(originalCrop);
        SpreadsheetApp.flush();
        
        return { 
          success: true, 
          message: 'การทดสอบอัปเดตสำเร็จ! Google Sheets สามารถเขียนได้',
          details: {
            productionId: productionId,
            rowIndex: rowIndex,
            columnIndex: cropTypeColumn,
            originalValue: originalCrop,
            testValue: testData.cropType,
            finalValue: newValue
          }
        };
      } else {
        return { 
          success: false, 
          message: 'การเขียนข้อมูลล้มเหลว - ค่าไม่เปลี่ยน',
          details: { expected: testData.cropType, actual: newValue }
        };
      }
    } else {
      return { success: false, message: 'ไม่พบ CropType column' };
    }
    
  } catch (error) {
    console.error('Debug test error:', error);
    return { success: false, message: 'Debug test failed: ' + error.message };
  }
}

// ===================================================================================
// START: NEW CODE BLOCK FOR HANDLING PRODUCTION DATA UPDATES FROM EDIT FORM
// This new `updateProductionData` function replaces the old/legacy one.
// ===================================================================================

/**
 * Main entry point for updating a production cycle from the edit form.
 * Handles nested data for production, harvest, transport, and additional info.
 * Also processes file uploads and deletions in a single transaction.
 * @param {Object} payload The complete form data object from the client.
 * - {string} productionId The ID of the production cycle.
 * - {string} farmerId The ID of the farmer.
 * - {Object} production Key-value pairs for the Production_Data sheet.
 * - {Object} harvest Key-value pairs for the Harvest_Data sheet.
 * - {Object} transport Key-value pairs for the Transport_Data sheet.
 * - {Object} additionalInfo Key-value pairs for the Additional_Info sheet.
 * - {Array<Object>} newFiles New files to be uploaded.
 * - {Array<Object>} filesToDelete Existing files to be deleted, e.g., [{ fileId: '...' }].
 * @returns {Object} A result object with success status and a message.
 */

/**
 * 🎯 ฟังก์ชัน updateProductionData (ฉบับแก้ไขใหม่ทั้งหมด) 🎯
 * - แก้ปัญหา "ss is not defined"
 * - รองรับการอัปเดตข้อมูลทุกส่วน
 * - จัดการการลบไฟล์
 */
function updateProductionData(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // รอได้สูงสุด 30 วินาที

  try {
    console.log("🔄 Received payload for update:", payload);
    
    // 1. ตรวจสอบข้อมูลเบื้องต้น
    if (!payload || !payload.productionId || !payload.farmerId) {
      throw new Error("ข้อมูลไม่ถูกต้อง: 'productionId' และ 'farmerId' เป็นค่าที่จำเป็น");
    }
    
    const { productionId, farmerId } = payload;
    console.log(`🔄 Processing update for ProductionID: ${productionId}, FarmerID: ${farmerId}`);
    
    // 2. 🔧 FIX: รับข้อมูลแบบ flat structure แทน JSON strings
    let production, harvest, transport, additionalInfo, filesToDelete;
    
    // ตรวจสอบว่าข้อมูลมาแบบ JSON strings หรือ flat structure
    if (typeof payload.production === 'string') {
      // แบบเก่า - JSON strings
      production = JSON.parse(payload.production || '{}');
      harvest = JSON.parse(payload.harvest || '{}');
      transport = JSON.parse(payload.transport || '{}');
      additionalInfo = JSON.parse(payload.additionalInfo || '{}');
      filesToDelete = JSON.parse(payload.filesToDelete || '[]');
    } else {
      // แบบใหม่ - flat structure 
      production = {
        CropType: payload.cropType,
        CropVariety: payload.cropVariety,
        PlantDate: payload.plantDate,
        HarvestDate: payload.harvestDate,
        PlantingMethod: payload.plantingMethod,
        PlantingMethodOther: payload.plantingMethodOther,
        Fertilizer: payload.fertilizer,
        Pesticide: payload.pesticide,
        WaterSourceType: payload.waterSourceType,
        WaterManagement: payload.waterManagement,
        RecordMethod: payload.recordMethod,
        PestControl: payload.pestControl,
        UpdatedAt: new Date()
      };
      
      harvest = {
        ShipDate: payload.shipDate,
        HarvestMethod: payload.harvestMethod,
        Quantity: payload.quantity,
        Unit: payload.unit,
        UnitOther: payload.unitOther,
        PackagingCompany: payload.packagingCompany,
        PackagingLocation: payload.packagingLocation,
        ResponsiblePerson: payload.responsiblePerson,
        UpdatedAt: new Date()
      };
      
      transport = {
        ShipDate: payload.farmShipDate,
        TransportChannel: payload.transportChannel,
        TransportMethod: payload.transportMethod,
        TransportMethodOther: payload.transportMethodOther,
        TransportCompany: payload.transportCompany,
        DistributorCode: payload.distributorCode,
        UpdatedAt: new Date()
      };
      
      additionalInfo = {
        Story: payload.story,
        UpdatedAt: new Date()
      };
      
      filesToDelete = typeof payload.filesToDelete === 'string' ? 
        JSON.parse(payload.filesToDelete || '[]') : 
        (payload.filesToDelete || []);
    }

    console.log("🔄 Mapped data:");
    console.log("- Production:", production);
    console.log("- Harvest:", harvest);
    console.log("- Transport:", transport);
    console.log("- Additional Info:", additionalInfo);

    // 3. อัปเดตข้อมูลในแต่ละ Sheet
    console.log("🔄 Updating Production sheet...");
    upsertRecord(CONFIG.SHEETS.PRODUCTION_DATA, 'ProductionID', productionId, production);
    
    console.log("🔄 Updating Harvest sheet...");
    upsertRecord(CONFIG.SHEETS.HARVEST_DATA, 'ProductionID', productionId, harvest, { FarmerID: farmerId });
    
    console.log("🔄 Updating Transport sheet...");
    upsertRecord(CONFIG.SHEETS.TRANSPORT_DATA, 'ProductionID', productionId, transport, { FarmerID: farmerId });
    
    console.log("🔄 Updating Additional Info sheet...");
    upsertRecord(CONFIG.SHEETS.ADDITIONAL_INFO, 'ProductionID', productionId, additionalInfo, { FarmerID: farmerId });

    // 4. จัดการการลบไฟล์
    if (filesToDelete && filesToDelete.length > 0) {
      console.log(`🔄 Deleting ${filesToDelete.length} files...`);
      deleteFiles(filesToDelete);
    }

    console.log("✅ Update completed successfully");
    return { success: true, message: "อัปเดตข้อมูลรอบการผลิตสำเร็จ" };

  } catch (e) {
    console.error(`❌ Error in updateProductionData: ${e.message}\nStack: ${e.stack}`);
    return { success: false, message: `เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์: ${e.message}` };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ฟังก์ชันเสริม: อัปเดตหรือเพิ่มข้อมูลในชีต
 * @param {string} sheetName - ชื่อชีต
 * @param {string} primaryKey - ชื่อคอลัมน์ที่เป็น Key หลัก
 * @param {string} primaryKeyValue - ค่าของ Key ที่ต้องการค้นหา
 * @param {object} recordData - ข้อมูลที่ต้องการอัปเดต
 * @param {object} defaultValues - ค่าเริ่มต้นสำหรับแถวใหม่ (ถ้ามี)
 */
function upsertRecord(sheetName, primaryKey, primaryKeyValue, recordData, defaultValues = {}) {
  console.log(`🔄 upsertRecord: ${sheetName}, Key: ${primaryKey}=${primaryKeyValue}`);
  console.log(`🔄 Record data:`, recordData);
  
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIndex = headers.indexOf(primaryKey);

  console.log(`🔄 Headers in ${sheetName}:`, headers);
  console.log(`🔄 Key '${primaryKey}' found at index: ${keyIndex}`);

  if (keyIndex === -1) {
    throw new Error(`ไม่พบคอลัมน์ Key '${primaryKey}' ในชีต '${sheetName}'`);
  }

  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][keyIndex] == primaryKeyValue) {
      rowIndex = i + 1; // 1-based index
      console.log(`🔄 Found existing record at row ${rowIndex}`);
      break;
    }
  }

  if (rowIndex !== -1) { // อัปเดตแถวเดิม
    console.log(`🔄 Updating sheet '${sheetName}' for ID '${primaryKeyValue}' at row ${rowIndex}`);
    let updatedFields = 0;
    headers.forEach((header, index) => {
      if (recordData.hasOwnProperty(header)) {
        const oldValue = data[rowIndex - 1][index];
        const newValue = recordData[header];
        console.log(`🔄 Updating field '${header}': "${oldValue}" → "${newValue}"`);
        sheet.getRange(rowIndex, index + 1).setValue(newValue);
        updatedFields++;
      }
    });
    console.log(`✅ Updated ${updatedFields} fields in ${sheetName}`);
  } else { // เพิ่มแถวใหม่ (กรณีไม่เจอ)
    console.log(`🔄 Inserting new record in '${sheetName}' for ID '${primaryKeyValue}'`);
    const newRow = headers.map(header => {
      if (header === primaryKey) return primaryKeyValue;
      if (recordData.hasOwnProperty(header)) return recordData[header];
      if (defaultValues.hasOwnProperty(header)) return defaultValues[header];
      if (header === 'Created' || header === 'UpdatedAt') return new Date();
      return '';
    });
    console.log(`🔄 New row data:`, newRow);
    sheet.appendRow(newRow);
    console.log(`✅ Inserted new record in ${sheetName}`);
  }
}

/**
 * ฟังก์ชันเสริม: จัดการการลบไฟล์
 * @param {Array} filesInfo - Array ของ object ที่มี fileId
 */
function deleteFiles(filesInfo) {
    console.log('🔥 deleteFiles called with:', filesInfo);
    
    const fileRecordSheet = getSheet(CONFIG.SHEETS.FILE_RECORDS);
    const data = fileRecordSheet.getDataRange().getValues();
    const headers = data[0];
    
    console.log('📋 FileRecords headers:', headers);
    
    // 🔧 FIX: Use correct column names (FileID, FileUrl - uppercase)
    const fileIdCol = headers.indexOf('FileID');
    const fileUrlCol = headers.indexOf('FileUrl');

    console.log('📊 Column indices - FileID:', fileIdCol, 'FileUrl:', fileUrlCol);

    if (fileIdCol === -1) {
        console.error('Column "FileID" not found in "FileRecords". Available columns:', headers);
        return;
    }

    let deletedCount = 0;
    
    filesInfo.forEach(fileToDelete => {
        console.log('🗑️ Processing file deletion:', fileToDelete);
        
        for (let i = data.length - 1; i > 0; i--) {
            if (data[i][fileIdCol] == fileToDelete.fileId) {
                const fileUrl = data[i][fileUrlCol];
                console.log(`📁 Found file record at row ${i+1}:`, {fileId: fileToDelete.fileId, fileUrl});
                
                try {
                    if (fileUrl && fileUrl.includes('id=')) {
                        const driveFileId = fileUrl.match(/id=([^&]+)/)[1];
                        DriveApp.getFileById(driveFileId).setTrashed(true);
                        console.log(`✅ Trashed file in Drive: ${driveFileId}`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Could not trash file from Drive (may already be deleted): ${fileUrl}. Error: ${e.toString()}`);
                }
                
                fileRecordSheet.deleteRow(i + 1);
                deletedCount++;
                console.log(`✅ Deleted file record from sheet for fileId: ${fileToDelete.fileId}`);
                break; 
            }
        }
    });
    
    console.log(`🎉 Completed file deletion process. Deleted ${deletedCount}/${filesInfo.length} files`);
}


/**
 * Deletes a single file from Drive and its record from the sheet using the FileID.
 * @param {string} fileId The unique ID of the file from the 'FileRecords' sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} fileRecordSheet The 'FileRecords' sheet object.
 */
function deleteFileAndRecordByFileId(fileId, fileRecordSheet) {
  const data = fileRecordSheet.getDataRange().getValues();
  const headers = data[0].map(h => h.trim());
  const fileIdCol = headers.indexOf('FileID');
  const fileUrlCol = headers.indexOf('FileUrl');

  if (fileIdCol === -1) {
    Logger.log('Column "FileID" not found in "FileRecords". Cannot delete file.');
    return;
  }

  for (let i = data.length - 1; i > 0; i--) {
    if (data[i][fileIdCol] == fileId) {
      const fileUrl = data[i][fileUrlCol];
      try {
        if (fileUrl && fileUrl.includes('id=')) {
          const driveFileId = fileUrl.match(/id=([^&]+)/)[1];
          DriveApp.getFileById(driveFileId).setTrashed(true);
        }
      } catch (e) {
        Logger.log(`Could not delete file from Drive (it may have been already deleted): ${fileUrl}. Error: ${e.toString()}`);
      }
      fileRecordSheet.deleteRow(i + 1);
      break; 
    }
  }
}

/**
 * Handles uploading new files to Drive and creating records in the sheet.
 * @param {string} farmerId The farmer's ID.
 * @param {string} productionId The production cycle's ID.
 * @param {Array<Object>} files Array of file objects from the client.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} fileRecordSheet The sheet object for 'FileRecords'.
 */
function handleFileUploads(farmerId, productionId, files, fileRecordSheet) {
  const farmerData = getRecordById('Farmers', farmerId, 'FarmerID');
  if (!farmerData || !farmerData.FolderID) {
    throw new Error(`Farmer with ID ${farmerId} or their main folder not found.`);
  }
  const mainFarmerFolder = DriveApp.getFolderById(farmerData.FolderID);

  files.forEach(file => {
    const fileData = Utilities.base64Decode(file.data, Utilities.Charset.UTF_8);
    const blob = Utilities.newBlob(fileData, file.mimeType, file.name);
    const folderName = getFolderNameFromFileType(file.field);

    if (!folderName) {
      Logger.log(`Skipping file with unknown field type: ${file.field}`);
      return;
    }

    const targetFolder = getOrCreateFolder(mainFarmerFolder, folderName);
    const newFile = targetFolder.createFile(blob);

    fileRecordSheet.appendRow([
      Utilities.getUuid(), newFile.getName(), newFile.getUrl(), newFile.getDownloadUrl(),
      farmerId, productionId, file.field, folderName, file.mimeType,
      newFile.getSize(), new Date(), 'Active', new Date()
    ]);
  });
}

/**
 * Maps a file input name ('field') to the correct Thai folder name in Google Drive.
 * @param {string} fileType The 'field' property from the file object.
 * @returns {string|null} The Thai folder name or null if not found.
 */
function getFolderNameFromFileType(fileType) {
  switch (fileType) {
    case 'PlotImages': return 'รูปแปลงปลูก';
    case 'ProductImages': return 'รูปสินค้า';
    case 'ActivityImages': return 'รูปกิจกรรมการปลูก';
    case 'CertificationDocs': return 'เอกสารการรับรอง';
    case 'PlantingMethodImages': return 'วิธีการปลูก';
    case 'CareRecordImages': return 'การบำรุงรักษา';
    default: return null;
  }
}

// ===================================================================================
// END: NEW CODE BLOCK
// ===================================================================================


/**
 * Helper functions for updateProductionData
 */

function updateProductionRecord(productionId, productionData) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find the row with this productionId
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === productionId) {
        rowIndex = i + 1; // Sheet row number (1-based)
        break;
      }
    }
    
    if (rowIndex === -1) {
      throw new Error(`ไม่พบข้อมูลการผลิต ProductionID: ${productionId}`);
    }
    
    // Map fields to columns and update
    const fieldMapping = {
      'cropType': 'CropType',
      'cropVariety': 'CropVariety', 
      'plantDate': 'PlantDate',
      'harvestDate': 'HarvestDate',
      'plantingMethod': 'PlantingMethod',
      'plantingMethodOther': 'PlantingMethodOther',
      'fertilizer': 'Fertilizer',
      'pesticide': 'Pesticide',
      'waterSourceType': 'WaterSourceType',
      'waterManagement': 'WaterManagement',
      'recordMethod': 'RecordMethod',
      'pestControl': 'PestControl'
    };
    
    console.log('🔍 Production data to update:', productionData);
    console.log('🔍 Available headers:', headers);
    console.log('🔍 Found ProductionID at row:', rowIndex);
    console.log('🔍 Sheet name:', sheet.getName());
    console.log('🔍 Total rows in sheet:', data.length);
    
    for (const [fieldKey, columnName] of Object.entries(fieldMapping)) {
      if (productionData[fieldKey] !== undefined) {
        const colIndex = headers.indexOf(columnName);
        if (colIndex !== -1) {
          try {
            const oldValue = sheet.getRange(rowIndex, colIndex + 1).getValue();
            sheet.getRange(rowIndex, colIndex + 1).setValue(productionData[fieldKey]);
            console.log(`✓ Updated ${columnName} (col ${colIndex}): "${oldValue}" → "${productionData[fieldKey]}"`);
            
            // Verify the update was successful
            const newValue = sheet.getRange(rowIndex, colIndex + 1).getValue();
            console.log(`🔍 Verification - Value after update: "${newValue}"`);
          } catch (updateError) {
            console.error(`❌ Error updating ${columnName}:`, updateError);
          }
        } else {
          console.log(`❌ Column not found: ${columnName}`);
        }
      } else {
        console.log(`⚠️ Field ${fieldKey} is undefined or empty`);
      }
    }
    
    return { success: true, updated: Object.keys(productionData).length, productionID: productionId };
    
  } catch (error) {
    console.error('Error updating production record:', error);
    throw error;
  }
}

function updateHarvestRecord(productionId, harvestData) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.HARVEST_DATA);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find the row with this productionId (ProductionID is in column 2 for HARVEST_DATA)
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === productionId) {
        rowIndex = i + 1; // Sheet row number (1-based)
        break;
      }
    }
    
    if (rowIndex === -1) {
      throw new Error(`ไม่พบข้อมูลการเก็บเกี่ยว ProductionID: ${productionId}`);
    }
    
    console.log('🔍 Harvest data to update:', harvestData);
    console.log('🔍 Found harvest record at row:', rowIndex);
    console.log('🔍 Available headers:', headers);
    
    // Map fields to columns and update (fixed to match actual schema)
    const fieldMapping = {
      'shipDate': 'ShipDate',
      'harvestMethod': 'HarvestMethod',
      'quantity': 'Quantity',
      'unit': 'Unit',
      'packagingCompany': 'PackagingCompany', 
      'packagingLocation': 'PackagingLocation',
      'packagingProvince': 'PackagingProvince',
      'lotCode': 'LotCode',
      'responsiblePerson': 'ResponsiblePerson'
    };
    
    for (const [fieldKey, columnName] of Object.entries(fieldMapping)) {
      if (harvestData[fieldKey] !== undefined) {
        const colIndex = headers.indexOf(columnName);
        if (colIndex !== -1) {
          const oldValue = sheet.getRange(rowIndex, colIndex + 1).getValue();
          sheet.getRange(rowIndex, colIndex + 1).setValue(harvestData[fieldKey]);
          console.log(`✓ Updated ${columnName} (col ${colIndex}): "${oldValue}" → "${harvestData[fieldKey]}"`);
        } else {
          console.log(`❌ Column not found: ${columnName}`);
        }
      } else {
        console.log(`⚠️ Field ${fieldKey} is undefined or empty`);
      }
    }
    
    return { success: true, updated: Object.keys(harvestData).length };
    
  } catch (error) {
    console.error('Error updating harvest record:', error);
    throw error;
  }
}

function updateTransportRecord(productionId, transportData) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.TRANSPORT_DATA);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find the row with this productionId (ProductionID is in column 2 for TRANSPORT_DATA)
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === productionId) {
        rowIndex = i + 1; // Sheet row number (1-based)
        break;
      }
    }
    
    if (rowIndex === -1) {
      throw new Error(`ไม่พบข้อมูลการขนส่ง ProductionID: ${productionId}`);
    }
    
    console.log('🔍 Transport data to update:', transportData);
    console.log('🔍 Found transport record at row:', rowIndex);
    console.log('🔍 Available headers:', headers);
    
    // Map fields to columns and update
    const fieldMapping = {
      'farmShipDate': 'ShipDate',
      'transportChannel': 'TransportChannel',
      'transportMethod': 'TransportMethod',
      'transportMethodOther': 'TransportMethodOther',
      'transportCompany': 'TransportCompany',
      'distributorCode': 'DistributorCode'
    };
    
    for (const [fieldKey, columnName] of Object.entries(fieldMapping)) {
      if (transportData[fieldKey] !== undefined) {
        const colIndex = headers.indexOf(columnName);
        if (colIndex !== -1) {
          const oldValue = sheet.getRange(rowIndex, colIndex + 1).getValue();
          sheet.getRange(rowIndex, colIndex + 1).setValue(transportData[fieldKey]);
          console.log(`✓ Updated ${columnName} (col ${colIndex}): "${oldValue}" → "${transportData[fieldKey]}"`);
        } else {
          console.log(`❌ Column not found: ${columnName}`);
        }
      } else {
        console.log(`⚠️ Field ${fieldKey} is undefined or empty`);
      }
    }
    
    return { success: true, updated: Object.keys(transportData).length };
    
  } catch (error) {
    console.error('Error updating transport record:', error);
    throw error;
  }
}

function updateAdditionalRecord(productionId, additionalInfo) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.ADDITIONAL_INFO);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Find the row with this productionId (ProductionID is in column 2 for ADDITIONAL_INFO)
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === productionId) {
        rowIndex = i + 1; // Sheet row number (1-based)
        break;
      }
    }
    
    if (rowIndex === -1) {
      throw new Error(`ไม่พบข้อมูลเพิ่มเติม ProductionID: ${productionId}`);
    }
    
    // Map fields to columns and update (fixed to match actual schema)
    const fieldMapping = {
      'story': 'Story',
      'philosophy': 'Philosophy', 
      'highlights': 'Highlights'
    };
    
    console.log('🔍 Additional info data to update:', additionalInfo);
    console.log('🔍 Available headers:', headers);
    
    for (const [fieldKey, columnName] of Object.entries(fieldMapping)) {
      if (additionalInfo[fieldKey] !== undefined) {
        const colIndex = headers.indexOf(columnName);
        if (colIndex !== -1) {
          const oldValue = sheet.getRange(rowIndex, colIndex + 1).getValue();
          sheet.getRange(rowIndex, colIndex + 1).setValue(additionalInfo[fieldKey]);
          console.log(`✓ Updated ${columnName} (col ${colIndex}): "${oldValue}" → "${additionalInfo[fieldKey]}"`);
        } else {
          console.log(`❌ Column not found: ${columnName}`);
        }
      } else {
        console.log(`⚠️ Field ${fieldKey} is undefined or empty`);
      }
    }
    
    return { success: true, updated: 1 };
    
  } catch (error) {
    console.error('Error updating additional record:', error);
    throw error;
  }
}

/**
 * Delete file record function
 */
function deleteFileRecord(data) {
  try {
    console.log('🗑️ deleteFileRecord called with:', data);
    
    const fileId = data.fileId;
    const productionId = data.productionId;
    
    if (!fileId || !productionId) {
      return { 
        success: false, 
        message: 'ไม่พบข้อมูล fileId หรือ productionId' 
      };
    }
    
    const sheet = getSheet(CONFIG.SHEETS.FILE_RECORDS);
    const fileData = sheet.getDataRange().getValues();
    const headers = fileData[0];
    
    // Find the row with this fileId and productionId
    let rowIndex = -1;
    for (let i = 1; i < fileData.length; i++) {
      const row = fileData[i];
      const rowFileId = row[headers.indexOf('FileID')] || row[headers.indexOf('FileName')];
      const rowProductionId = row[headers.indexOf('ProductionID')];
      
      if (rowFileId === fileId && rowProductionId === productionId) {
        rowIndex = i + 1; // Sheet row number (1-based)
        break;
      }
    }
    
    if (rowIndex === -1) {
      console.log(`❌ File record not found: ${fileId} for production ${productionId}`);
      return { 
        success: false, 
        message: `ไม่พบไฟล์ ${fileId} ในระบบ` 
      };
    }
    
    // Delete the row
    sheet.deleteRow(rowIndex);
    console.log(`✅ Deleted file record: ${fileId} from row ${rowIndex}`);
    
    return {
      success: true,
      message: `ลบไฟล์ ${fileId} เรียบร้อยแล้ว`
    };
    
  } catch (error) {
    console.error('❌ Error deleting file record:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบไฟล์: ' + error.message
    };
  }
}

/**
 * Manual test function to debug update issues
 */
function testUpdateFunction() {
  console.log('🧪 Starting manual test...');
  
  try {
    // Test data
    const testData = {
      production: {
        cropType: 'มะเขือเทศ',
        cropVariety: 'ราชินี',
        plantDate: '2025-09-07',
        harvestDate: '2025-09-21',
        recordMethod: 'ไม่มี'
      },
      harvest: {
        shipDate: '2025-09-21',
        responsiblePerson: 'Test Person'
      },
      transport: {
        distributorCode: '002'
      },
      additionalInfo: 'Test update',
      productionId: 'yPDYkloq',
      farmerID: 'VtHUy98q'
    };
    
    console.log('🔍 Test data:', testData);
    
    // Call the update function
    const result = updateProductionData(testData);
    console.log('🔍 Update result:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Test error:', error);
    return {
      success: false,
      message: 'Test failed: ' + error.message,
      error: error.toString()
    };
  }
}

/**
 * Test sheet access function
 */
function testSheetAccess() {
  console.log('🧪 Testing sheet access...');
  
  try {
    // Test Production Data sheet
    const prodSheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    const prodData = prodSheet.getDataRange().getValues();
    console.log('📊 Production sheet rows:', prodData.length);
    console.log('📊 Production headers:', prodData[0]);
    
    // Find test ProductionID
    let foundRow = -1;
    for (let i = 1; i < prodData.length; i++) {
      if (prodData[i][0] === 'yPDYkloq') {
        foundRow = i + 1;
        console.log('✅ Found ProductionID at row:', foundRow);
        console.log('📊 Row data:', prodData[i]);
        break;
      }
    }
    
    if (foundRow === -1) {
      console.log('❌ ProductionID not found in Production sheet');
    }
    
    // Test Harvest Data sheet
    const harvestSheet = getSheet(CONFIG.SHEETS.HARVEST_DATA);
    const harvestData = harvestSheet.getDataRange().getValues();
    console.log('🌾 Harvest sheet rows:', harvestData.length);
    console.log('🌾 Harvest headers:', harvestData[0]);
    
    // Find test ProductionID in harvest sheet
    foundRow = -1;
    for (let i = 1; i < harvestData.length; i++) {
      if (harvestData[i][2] === 'yPDYkloq') { // ProductionID in column 2
        foundRow = i + 1;
        console.log('✅ Found ProductionID in Harvest at row:', foundRow);
        console.log('🌾 Harvest row data:', harvestData[i]);
        break;
      }
    }
    
    if (foundRow === -1) {
      console.log('❌ ProductionID not found in Harvest sheet');
    }
    
    return {
      success: true,
      message: 'Sheet access test completed',
      details: {
        productionRows: prodData.length,
        harvestRows: harvestData.length
      }
    };
    
  } catch (error) {
    console.error('❌ Sheet access error:', error);
    return {
      success: false,
      message: 'Sheet access failed: ' + error.message,
      error: error.toString()
    };
  }
}

