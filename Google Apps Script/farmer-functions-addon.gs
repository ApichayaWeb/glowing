/**
 * สร้างข้อมูลการผลิตใหม่
 * เพิ่มในไฟล์แยก เพื่อป้องกันความเสียหายต่อไฟล์หลัก
 */
function addProductionRecord(productionData) {
  try {
    console.log('🔄 Creating new production record...');
    const sheet = getSheet(CONFIG.SHEETS.PRODUCTION_DATA);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Generate new ProductionID
    const productionID = generateId();
    const currentTime = new Date();
    
    console.log('Generated ProductionID:', productionID);
    
    // Create new row data according to sheet structure
    const newRow = [
      productionID,                                    // ProductionID
      productionData.farmerID || '',                   // FarmerID  
      '',                                              // SeasonID
      productionData.cropType || '',                   // CropType
      productionData.cropVariety || '',                // CropVariety
      productionData.plantingMethod || '',             // PlantingMethod
      productionData.plantingMethodOther || '',        // PlantingMethodOther
      productionData.fertilizer || '',                 // Fertilizer
      productionData.pesticide || '',                  // Pesticide
      productionData.plantDate || '',                  // PlantDate
      productionData.harvestDate || '',                // HarvestDate
      productionData.recordMethod || '',               // RecordMethod
      '',                                              // MaintenanceRecord
      productionData.pestControl || '',                // PestControl
      productionData.waterSourceType || '',            // WaterSource (legacy)
      productionData.waterManagement || '',            // WaterManagement
      productionData.waterSourceType || '',            // WaterSourceType
      'Active',                                        // Status
      currentTime,                                     // Created
      currentTime                                      // UpdatedAt
    ];
    
    console.log('New production row to add:', newRow);
    console.log('Sheet headers:', headers);
    console.log('Expected columns:', headers.length, 'vs Provided:', newRow.length);
    
    // Add the new row
    sheet.appendRow(newRow);
    console.log('✅ Production record created successfully');
    
    return { 
      success: true, 
      productionID: productionID,
      created: true 
    };
    
  } catch (error) {
    console.error('Error creating production record:', error);
    throw error;
  }
}