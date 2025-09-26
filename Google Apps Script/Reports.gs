/**
 * ระบบสอบย้อนกลับผักอุดร - Reports.gs
 * =======================================
 * Google Apps Script functions for generating comprehensive reports
 */

/**
 * Generate System Overview Report
 * @param {Object} filters - Filter criteria
 * @returns {Object} System report data
 */
function generateSystemReport(filters = {}) {
  try {
    Logger.log('Generating system report with filters:', filters);
    
    const startTime = new Date();
    
    // Get all sheets
    const groupsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.GROUPS);
    const farmersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.FARMERS);
    const qrCodesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.QR_CODES);
    const activitySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ACTIVITY_LOG);
    
    // Apply date filter if provided
    const dateFilter = parseFilterDates(filters.dateRange);
    
    // Get basic counts
    const totalGroups = getFilteredGroupsCount(groupsSheet, filters);
    const totalFarmers = getFilteredFarmersCount(farmersSheet, filters);
    const totalQRCodes = getFilteredQRCodesCount(qrCodesSheet, filters, dateFilter);
    const totalScans = getTotalScansCount(qrCodesSheet, dateFilter);
    
    // Get growth data (monthly statistics)
    const growthData = generateGrowthData(farmersSheet, qrCodesSheet, dateFilter);
    
    // Get activity data
    const activityData = generateActivityData(activitySheet, dateFilter);
    
    // Get top performing groups
    const topGroups = getTopPerformingGroups(groupsSheet, farmersSheet, qrCodesSheet, 5);
    
    // Get crop type distribution
    const cropDistribution = getCropTypeDistribution(farmersSheet, filters);
    
    const executionTime = new Date() - startTime;
    Logger.log(`System report generated in ${executionTime}ms`);
    
    return {
      success: true,
      data: {
        overview: {
          totalGroups,
          totalFarmers,
          totalQRCodes,
          totalScans,
          dataCompleteness: calculateSystemDataCompleteness(farmersSheet)
        },
        growthData,
        activityData,
        topGroups,
        cropDistribution,
        generatedAt: new Date().toISOString(),
        filters: filters,
        executionTime
      }
    };
    
  } catch (error) {
    Logger.log('Error in generateSystemReport:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Generate Groups Report
 * @param {Object} filters - Filter criteria
 * @returns {Object} Groups report data
 */
function generateGroupsReport(filters = {}) {
  try {
    Logger.log('Generating groups report with filters:', filters);
    
    const groupsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.GROUPS);
    const farmersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.FARMERS);
    const qrCodesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.QR_CODES);
    
    // Get all groups data
    const groupsData = getGroupsData(groupsSheet);
    const dateFilter = parseFilterDates(filters.dateRange);
    
    // Process each group
    const groups = groupsData.map(group => {
      const groupId = group.id;
      
      // Get farmers count for this group
      const farmersCount = getFarmersCountByGroup(farmersSheet, groupId);
      
      // Get QR codes count for this group
      const qrCodesCount = getQRCodesCountByGroup(qrCodesSheet, groupId, dateFilter);
      
      // Get data completeness for this group
      const dataCompleteness = getGroupDataCompleteness(farmersSheet, groupId);
      
      // Get crop types for this group
      const cropTypes = getGroupCropTypes(farmersSheet, groupId);
      
      return {
        ...group,
        farmersCount,
        qrCodesCount,
        dataCompleteness,
        cropTypes,
        performance: calculateGroupPerformance(farmersCount, qrCodesCount, dataCompleteness.percentage)
      };
    });
    
    // Apply filters
    const filteredGroups = applyGroupFilters(groups, filters);
    
    // Generate statistics
    const statistics = {
      totalGroups: filteredGroups.length,
      averageFarmersPerGroup: Math.round(filteredGroups.reduce((sum, group) => sum + group.farmersCount, 0) / filteredGroups.length || 0),
      averageQRCodesPerGroup: Math.round(filteredGroups.reduce((sum, group) => sum + group.qrCodesCount, 0) / filteredGroups.length || 0),
      averageDataCompleteness: Math.round(filteredGroups.reduce((sum, group) => sum + group.dataCompleteness.percentage, 0) / filteredGroups.length || 0),
      topPerformingGroup: filteredGroups.sort((a, b) => b.performance - a.performance)[0] || null
    };
    
    // Generate chart data
    const charts = {
      groupSizes: filteredGroups.map(group => ({
        name: group.name,
        value: group.farmersCount
      })),
      qrCodesByGroup: filteredGroups.map(group => ({
        name: group.name,
        value: group.qrCodesCount
      })),
      dataCompletenessChart: filteredGroups.map(group => ({
        name: group.name,
        completed: group.dataCompleteness.completed,
        incomplete: group.dataCompleteness.incomplete,
        notStarted: group.dataCompleteness.notStarted
      }))
    };
    
    return {
      success: true,
      data: {
        groups: filteredGroups,
        statistics,
        charts,
        generatedAt: new Date().toISOString(),
        filters: filters
      }
    };
    
  } catch (error) {
    Logger.log('Error in generateGroupsReport:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Generate Farmers Report
 * @param {Object} filters - Filter criteria
 * @returns {Object} Farmers report data
 */
function generateFarmersReport(filters = {}) {
  try {
    Logger.log('Generating farmers report with filters:', filters);
    
    const farmersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.FARMERS);
    const qrCodesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.QR_CODES);
    const groupsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.GROUPS);
    
    // Get all farmers data
    const farmersData = getFarmersData(farmersSheet);
    const groupsData = getGroupsData(groupsSheet);
    const dateFilter = parseFilterDates(filters.dateRange);
    
    // Create groups lookup
    const groupsLookup = {};
    groupsData.forEach(group => {
      groupsLookup[group.id] = group.name;
    });
    
    // Process each farmer
    const farmers = farmersData.map(farmer => {
      // Get QR codes count for this farmer
      const qrCodesCount = getQRCodesCountByFarmer(qrCodesSheet, farmer.id, dateFilter);
      
      // Calculate data completeness
      const dataCompleteness = calculateFarmerDataCompleteness(farmer);
      
      // Get crop types
      const cropTypes = farmer.cropTypes || [];
      
      return {
        ...farmer,
        groupName: groupsLookup[farmer.groupId] || 'ไม่ระบุกลุ่ม',
        qrCodesCount,
        dataCompleteness,
        cropTypes,
        registrationDate: farmer.createdAt || farmer.registrationDate
      };
    });
    
    // Apply filters
    const filteredFarmers = applyFarmerFilters(farmers, filters);
    
    // Calculate overall data completeness
    const overallDataCompleteness = {
      total: filteredFarmers.length,
      completed: filteredFarmers.filter(f => f.dataCompleteness.percentage >= 100).length,
      incomplete: filteredFarmers.filter(f => f.dataCompleteness.percentage > 0 && f.dataCompleteness.percentage < 100).length,
      notStarted: filteredFarmers.filter(f => f.dataCompleteness.percentage === 0).length
    };
    
    overallDataCompleteness.completedPercentage = Math.round((overallDataCompleteness.completed / overallDataCompleteness.total) * 100) || 0;
    
    // Calculate crop types distribution
    const cropTypesDistribution = {};
    filteredFarmers.forEach(farmer => {
      farmer.cropTypes.forEach(cropType => {
        cropTypesDistribution[cropType] = (cropTypesDistribution[cropType] || 0) + 1;
      });
    });
    
    // Generate charts data
    const charts = {
      dataCompleteness: [
        { name: 'กรอกข้อมูลครบ', value: overallDataCompleteness.completed },
        { name: 'กรอกข้อมูลไม่ครบ', value: overallDataCompleteness.incomplete },
        { name: 'ยังไม่เริ่มกรอก', value: overallDataCompleteness.notStarted }
      ],
      cropTypes: Object.entries(cropTypesDistribution).map(([type, count]) => ({
        name: getCropTypeDisplayName(type),
        value: count
      })),
      registrationTrend: generateRegistrationTrend(filteredFarmers, dateFilter)
    };
    
    return {
      success: true,
      data: {
        farmers: filteredFarmers,
        dataCompleteness: overallDataCompleteness,
        cropTypes: cropTypesDistribution,
        charts,
        statistics: {
          totalFarmers: filteredFarmers.length,
          averageQRCodes: Math.round(filteredFarmers.reduce((sum, f) => sum + f.qrCodesCount, 0) / filteredFarmers.length || 0),
          averageDataCompleteness: Math.round(filteredFarmers.reduce((sum, f) => sum + f.dataCompleteness.percentage, 0) / filteredFarmers.length || 0)
        },
        generatedAt: new Date().toISOString(),
        filters: filters
      }
    };
    
  } catch (error) {
    Logger.log('Error in generateFarmersReport:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Generate QR Codes Report
 * @param {Object} filters - Filter criteria
 * @returns {Object} QR codes report data
 */
function generateQRCodesReport(filters = {}) {
  try {
    Logger.log('Generating QR codes report with filters:', filters);
    
    const qrCodesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.QR_CODES);
    const farmersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.FARMERS);
    const scansSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.SCAN_LOGS);
    
    // Get all QR codes data
    const qrCodesData = getQRCodesData(qrCodesSheet);
    const farmersData = getFarmersData(farmersSheet);
    const dateFilter = parseFilterDates(filters.dateRange);
    
    // Create farmers lookup
    const farmersLookup = {};
    farmersData.forEach(farmer => {
      farmersLookup[farmer.id] = farmer;
    });
    
    // Process each QR code
    const qrCodes = qrCodesData.map(qrCode => {
      const farmer = farmersLookup[qrCode.farmerId];
      
      // Get scan statistics for this QR code
      const scanStats = getQRCodeScanStats(scansSheet, qrCode.code, dateFilter);
      
      return {
        ...qrCode,
        farmerName: farmer ? farmer.name : 'ไม่ระบุ',
        farmerPlotNumber: farmer ? farmer.plotNumber : '',
        groupId: farmer ? farmer.groupId : '',
        scanCount: scanStats.totalScans,
        lastScanned: scanStats.lastScanned,
        scanTrend: scanStats.trend
      };
    });
    
    // Apply filters
    const filteredQRCodes = applyQRCodeFilters(qrCodes, filters, dateFilter);
    
    // Calculate scan statistics
    const scanStatistics = {
      totalQRCodes: filteredQRCodes.length,
      totalScans: filteredQRCodes.reduce((sum, qr) => sum + qr.scanCount, 0),
      averageScansPerQR: Math.round(filteredQRCodes.reduce((sum, qr) => sum + qr.scanCount, 0) / filteredQRCodes.length || 0),
      mostScannedQR: filteredQRCodes.sort((a, b) => b.scanCount - a.scanCount)[0] || null,
      qrCodesWithScans: filteredQRCodes.filter(qr => qr.scanCount > 0).length,
      qrCodesWithoutScans: filteredQRCodes.filter(qr => qr.scanCount === 0).length
    };
    
    // Get popular products
    const popularProducts = getPopularProducts(filteredQRCodes, 10);
    
    // Generate charts data
    const charts = {
      qrCodesByDate: generateQRCodesByDateChart(filteredQRCodes, dateFilter),
      scansByQRCode: filteredQRCodes
        .sort((a, b) => b.scanCount - a.scanCount)
        .slice(0, 10)
        .map(qr => ({
          name: `${qr.farmerName} (${qr.productName})`,
          value: qr.scanCount
        })),
      productTypes: generateProductTypesChart(filteredQRCodes)
    };
    
    return {
      success: true,
      data: {
        qrCodes: filteredQRCodes,
        scanStatistics,
        popularProducts,
        charts,
        generatedAt: new Date().toISOString(),
        filters: filters
      }
    };
    
  } catch (error) {
    Logger.log('Error in generateQRCodesReport:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Generate Usage Analytics Report
 * @param {Object} filters - Filter criteria
 * @returns {Object} Usage analytics data
 */
function generateUsageAnalytics(filters = {}) {
  try {
    Logger.log('Generating usage analytics with filters:', filters);
    
    const activitySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ACTIVITY_LOG);
    const loginSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.LOGIN_LOGS);
    
    const dateFilter = parseFilterDates(filters.dateRange);
    
    // Get user login data
    const userLogins = getUserLoginAnalytics(loginSheet, dateFilter);
    
    // Get page view data
    const pageViews = getPageViewAnalytics(activitySheet, dateFilter);
    
    // Get feature usage data
    const featureUsage = getFeatureUsageAnalytics(activitySheet, dateFilter);
    
    // Get device analytics
    const deviceAnalytics = getDeviceAnalytics(loginSheet, activitySheet, dateFilter);
    
    // Generate trend data
    const trends = {
      dailyLogins: generateDailyLoginTrend(userLogins, dateFilter),
      dailyPageViews: generateDailyPageViewTrend(pageViews, dateFilter),
      featurePopularity: generateFeaturePopularityTrend(featureUsage, dateFilter)
    };
    
    return {
      success: true,
      data: {
        userLogins,
        pageViews,
        featureUsage,
        deviceAnalytics,
        trends,
        generatedAt: new Date().toISOString(),
        filters: filters
      }
    };
    
  } catch (error) {
    Logger.log('Error in generateUsageAnalytics:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Generate Scan Analytics Report
 * @param {Object} filters - Filter criteria
 * @returns {Object} Scan analytics data
 */
function generateScanAnalytics(filters = {}) {
  try {
    Logger.log('Generating scan analytics with filters:', filters);
    
    const scansSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.SCAN_LOGS);
    const qrCodesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.QR_CODES);
    
    const dateFilter = parseFilterDates(filters.dateRange);
    
    // Get scan counts
    const scanCounts = getScanCounts(scansSheet, dateFilter);
    
    // Get popular scan times
    const popularTimes = getPopularScanTimes(scansSheet, dateFilter);
    
    // Get device types
    const deviceTypes = getScanDeviceTypes(scansSheet, dateFilter);
    
    // Get geographic data
    const geographicData = getScanGeographicData(scansSheet, dateFilter);
    
    // Get scan success rates
    const successRates = getScanSuccessRates(scansSheet, dateFilter);
    
    // Generate trend data
    const trends = {
      dailyScans: generateDailyScanTrend(scanCounts, dateFilter),
      hourlyDistribution: generateHourlyScanDistribution(popularTimes),
      weeklyPattern: generateWeeklyScanPattern(scanCounts, dateFilter)
    };
    
    return {
      success: true,
      data: {
        scanCounts,
        popularTimes,
        deviceTypes,
        geographicData,
        successRates,
        trends,
        generatedAt: new Date().toISOString(),
        filters: filters
      }
    };
    
  } catch (error) {
    Logger.log('Error in generateScanAnalytics:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export report to PDF
 * @param {Object} reportData - Report data to export
 * @param {string} reportType - Type of report
 * @returns {Object} Export result
 */
function exportToPDF(reportData, reportType) {
  try {
    Logger.log(`Exporting ${reportType} report to PDF`);
    
    // Create a new Google Doc for the report
    const doc = DocumentApp.create(`รายงาน${getReportTypeDisplayName(reportType)}_${Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss')}`);
    const body = doc.getBody();
    
    // Add title
    const title = body.appendParagraph(`รายงาน${getReportTypeDisplayName(reportType)}`);
    title.setHeading(DocumentApp.ParagraphHeading.TITLE);
    title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    
    // Add generation info
    body.appendParagraph(`วันที่สร้างรายงาน: ${Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss น.')}`);
    body.appendParagraph(''); // Empty line
    
    // Add content based on report type
    switch (reportType) {
      case 'system':
        addSystemReportContent(body, reportData);
        break;
      case 'groups':
        addGroupsReportContent(body, reportData);
        break;
      case 'farmers':
        addFarmersReportContent(body, reportData);
        break;
      case 'qrcodes':
        addQRCodesReportContent(body, reportData);
        break;
      case 'usage':
        addUsageReportContent(body, reportData);
        break;
      case 'scans':
        addScansReportContent(body, reportData);
        break;
    }
    
    // Save and get URL
    doc.saveAndClose();
    const fileId = doc.getId();
    const file = DriveApp.getFileById(fileId);
    
    // Convert to PDF
    const pdfBlob = file.getAs('application/pdf');
    const pdfFile = DriveApp.createFile(pdfBlob);
    pdfFile.setName(`รายงาน${getReportTypeDisplayName(reportType)}_${Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss')}.pdf`);
    
    // Move to reports folder if exists
    const reportsFolder = getOrCreateReportsFolder();
    if (reportsFolder) {
      pdfFile.moveTo(reportsFolder);
    }
    
    // Delete the temporary doc
    DriveApp.getFileById(fileId).setTrashed(true);
    
    return {
      success: true,
      fileId: pdfFile.getId(),
      fileName: pdfFile.getName(),
      downloadUrl: pdfFile.getDownloadUrl()
    };
    
  } catch (error) {
    Logger.log('Error in exportToPDF:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Export report to Excel
 * @param {Object} reportData - Report data to export
 * @param {string} reportType - Type of report
 * @returns {Object} Export result
 */
function exportToExcel(reportData, reportType) {
  try {
    Logger.log(`Exporting ${reportType} report to Excel`);
    
    // Create a new spreadsheet
    const spreadsheet = SpreadsheetApp.create(`รายงาน${getReportTypeDisplayName(reportType)}_${Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss')}`);
    
    // Add sheets based on report type
    switch (reportType) {
      case 'system':
        createSystemExcelSheets(spreadsheet, reportData);
        break;
      case 'groups':
        createGroupsExcelSheets(spreadsheet, reportData);
        break;
      case 'farmers':
        createFarmersExcelSheets(spreadsheet, reportData);
        break;
      case 'qrcodes':
        createQRCodesExcelSheets(spreadsheet, reportData);
        break;
      case 'usage':
        createUsageExcelSheets(spreadsheet, reportData);
        break;
      case 'scans':
        createScansExcelSheets(spreadsheet, reportData);
        break;
    }
    
    // Remove default sheet if it exists and is empty
    const sheets = spreadsheet.getSheets();
    if (sheets.length > 1 && sheets[0].getName() === 'Sheet1') {
      spreadsheet.deleteSheet(sheets[0]);
    }
    
    // Move to reports folder if exists
    const file = DriveApp.getFileById(spreadsheet.getId());
    const reportsFolder = getOrCreateReportsFolder();
    if (reportsFolder) {
      file.moveTo(reportsFolder);
    }
    
    return {
      success: true,
      fileId: spreadsheet.getId(),
      fileName: file.getName(),
      downloadUrl: file.getDownloadUrl()
    };
    
  } catch (error) {
    Logger.log('Error in exportToExcel:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Export report to CSV
 * @param {Object} reportData - Report data to export
 * @returns {Object} Export result
 */
function exportToCSV(reportData) {
  try {
    Logger.log('Exporting report to CSV');
    
    // Determine the main data array based on report structure
    let csvData = [];
    let headers = [];
    let fileName = 'รายงาน';
    
    if (reportData.groups) {
      // Groups report
      headers = ['ลำดับ', 'ชื่อกลุ่ม', 'รหัสกลุ่ม', 'จำนวนสมาชิก', 'QR Code', 'ความสมบูรณ์ข้อมูล', 'วันที่สร้าง'];
      csvData = reportData.groups.map((group, index) => [
        index + 1,
        group.name,
        group.id,
        group.farmersCount,
        group.qrCodesCount,
        group.dataCompleteness.percentage + '%',
        formatDateForCSV(group.createdAt)
      ]);
      fileName = 'รายงานกลุ่มเกษตรกร';
      
    } else if (reportData.farmers) {
      // Farmers report
      headers = ['ลำดับ', 'ชื่อ-นามสกุล', 'แปลงที่', 'กลุ่ม', 'QR Code', 'ความสมบูรณ์ข้อมูล', 'ประเภทพืช', 'วันที่ลงทะเบียน'];
      csvData = reportData.farmers.map((farmer, index) => [
        index + 1,
        farmer.name,
        farmer.plotNumber,
        farmer.groupName,
        farmer.qrCodesCount,
        farmer.dataCompleteness.percentage + '%',
        farmer.cropTypes.join(', '),
        formatDateForCSV(farmer.registrationDate)
      ]);
      fileName = 'รายงานเกษตรกร';
      
    } else if (reportData.qrCodes) {
      // QR Codes report
      headers = ['ลำดับ', 'รหัส QR', 'ชื่อเกษตรกร', 'ชื่อผลิตภัณฑ์', 'จำนวนการสแกน', 'สแกนล่าสุด', 'วันที่สร้าง'];
      csvData = reportData.qrCodes.map((qr, index) => [
        index + 1,
        qr.code,
        qr.farmerName,
        qr.productName,
        qr.scanCount,
        formatDateForCSV(qr.lastScanned),
        formatDateForCSV(qr.createdAt)
      ]);
      fileName = 'รายงาน_QR_Code';
    }
    
    // Create CSV content
    let csvContent = '\uFEFF'; // BOM for UTF-8
    csvContent += headers.join(',') + '\n';
    
    csvData.forEach(row => {
      const escapedRow = row.map(cell => {
        if (cell === null || cell === undefined) return '';
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      });
      csvContent += escapedRow.join(',') + '\n';
    });
    
    // Create file
    const blob = Utilities.newBlob(csvContent, 'text/csv', `${fileName}_${Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss')}.csv`);
    const file = DriveApp.createFile(blob);
    
    // Move to reports folder if exists
    const reportsFolder = getOrCreateReportsFolder();
    if (reportsFolder) {
      file.moveTo(reportsFolder);
    }
    
    return {
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      downloadUrl: file.getDownloadUrl()
    };
    
  } catch (error) {
    Logger.log('Error in exportToCSV:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Email report to recipients
 * @param {Object} reportData - Report data to email
 * @param {Array} recipients - Email recipients
 * @param {Object} options - Email options
 * @returns {Object} Email result
 */
function emailReport(reportData, recipients, options = {}) {
  try {
    Logger.log('Emailing report to:', recipients);
    
    const subject = options.subject || `รายงานระบบสอบย้อนกลับผักอุดร - ${Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy')}`;
    
    // Create HTML email body
    let emailBody = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Sarabun', Arial, sans-serif; }
            .header { background-color: #198754; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .summary-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .summary-table th, .summary-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            .summary-table th { background-color: #f8f9fa; }
            .footer { background-color: #f8f9fa; padding: 15px; text-align: center; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🌱 ระบบสอบย้อนกลับผักอุดร</h1>
            <p>รายงานประจำวันที่ ${Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy')}</p>
          </div>
          
          <div class="content">
            <h2>สรุปข้อมูล</h2>
    `;
    
    // Add summary based on report type
    if (reportData.overview) {
      emailBody += `
        <table class="summary-table">
          <tr><th>รายการ</th><th>จำนวน</th></tr>
          <tr><td>กลุ่มเกษตรกรทั้งหมด</td><td>${reportData.overview.totalGroups}</td></tr>
          <tr><td>เกษตรกรทั้งหมด</td><td>${reportData.overview.totalFarmers}</td></tr>
          <tr><td>QR Code ที่สร้างแล้ว</td><td>${reportData.overview.totalQRCodes}</td></tr>
          <tr><td>การสแกนทั้งหมด</td><td>${reportData.overview.totalScans}</td></tr>
        </table>
      `;
    }
    
    emailBody += `
            <p>${options.message || 'กรุณาตรวจสอบรายงานในไฟล์แนบ'}</p>
            
            <p>หากมีข้อสงสัยหรือต้องการข้อมูลเพิ่มเติม กรุณาติดต่อผู้ดูแลระบบ</p>
          </div>
          
          <div class="footer">
            <p>รายงานนี้สร้างโดยอัตโนมัติจากระบบสอบย้อนกลับผักอุดร</p>
            <p>วันที่สร้าง: ${Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss น.')}</p>
          </div>
        </body>
      </html>
    `;
    
    // Create PDF attachment if data is available
    let attachments = [];
    if (options.includePDF && reportData) {
      const pdfResult = exportToPDF(reportData, options.reportType || 'system');
      if (pdfResult.success) {
        const pdfFile = DriveApp.getFileById(pdfResult.fileId);
        attachments.push(pdfFile.getBlob());
      }
    }
    
    // Send email to each recipient
    recipients.forEach(recipient => {
      try {
        GmailApp.sendEmail(
          recipient,
          subject,
          '', // Plain text body (empty since we're using HTML)
          {
            htmlBody: emailBody,
            attachments: attachments
          }
        );
        Logger.log(`Report emailed successfully to: ${recipient}`);
      } catch (emailError) {
        Logger.log(`Failed to send email to ${recipient}:`, emailError);
      }
    });
    
    return {
      success: true,
      message: `รายงานส่งทางอีเมลเรียบร้อยแล้ว (${recipients.length} ผู้รับ)`
    };
    
  } catch (error) {
    Logger.log('Error in emailReport:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse filter dates from string
 */
function parseFilterDates(dateRangeString) {
  if (!dateRangeString) return null;
  
  try {
    const parts = dateRangeString.split(' - ');
    if (parts.length !== 2) return null;
    
    const startDate = new Date(parts[0]);
    const endDate = new Date(parts[1]);
    
    return {
      start: startDate,
      end: endDate
    };
  } catch (error) {
    Logger.log('Error parsing filter dates:', error);
    return null;
  }
}

/**
 * Get or create reports folder
 */
function getOrCreateReportsFolder() {
  try {
    const folders = DriveApp.getFoldersByName('รายงานระบบ');
    if (folders.hasNext()) {
      return folders.next();
    } else {
      return DriveApp.createFolder('รายงานระบบ');
    }
  } catch (error) {
    Logger.log('Error getting/creating reports folder:', error);
    return null;
  }
}

/**
 * Get report type display name
 */
function getReportTypeDisplayName(reportType) {
  const displayNames = {
    'system': 'สรุประบบ',
    'groups': 'กลุ่มเกษตรกร',
    'farmers': 'เกษตรกร',
    'qrcodes': 'QR Code',
    'usage': 'การใช้งาน',
    'scans': 'การสแกน'
  };
  return displayNames[reportType] || 'ไม่ระบุ';
}

/**
 * Format date for CSV export
 */
function formatDateForCSV(dateValue) {
  if (!dateValue) return '';
  
  try {
    const date = new Date(dateValue);
    return Utilities.formatDate(date, 'Asia/Bangkok', 'dd/MM/yyyy');
  } catch (error) {
    return String(dateValue);
  }
}

/**
 * Get crop type display name
 */
function getCropTypeDisplayName(cropType) {
  const displayNames = {
    'leafy': 'ผักใบ',
    'fruit': 'ผักผล',
    'root': 'ผักราก',
    'herb': 'สมุนไพร'
  };
  return displayNames[cropType] || cropType;
}

/**
 * Export QR Sticker PDF using sticker-template.html
 */
function exportQrStickerPdf(params) {
  try {
    const { harvestBE, shipBE, copies = 1, farmerID } = params;
    
    if (!harvestBE || !shipBE || !farmerID) {
      return { success: false, message: 'ข้อมูลไม่ครบถ้วนสำหรับการสร้างสติ๊กเกอร์' };
    }
    
    // Get farmer data for QR code
    const farmerData = getFarmerById(farmerID);
    if (!farmerData) {
      return { success: false, message: 'ไม่พบข้อมูลเกษตรกร' };
    }
    
    const groupData = getGroupById(farmerData.groupId);
    if (!groupData) {
      return { success: false, message: 'ไม่พบข้อมูลกลุ่ม' };
    }
    
    const qrCode = groupData.groupCode + '-' + farmerData.plotNumber;
    
    // Generate sticker HTML with QR code and search URL
    const searchUrl = `https://www.udtrace.com/search.html?code=${qrCode}`;
    const htmlContent = generateStickerHTML(qrCode, harvestBE, shipBE, parseInt(copies), searchUrl);
    
    // Convert HTML to PDF
    const pdfBlob = Utilities.newBlob(htmlContent, 'text/html', 'temp.html')
                            .getAs('application/pdf');
    
    // Create filename
    const fileName = `สติ๊กเกอร์-QR-${qrCode}-${shipBE}.pdf`;
    
    // Ensure farmer folder exists (lazy creation)
    const folderResult = ensureFarmerFolderExists(farmerID, farmerData.groupId, farmerData.phone);
    
    if (!folderResult.success) {
      return { success: false, message: 'ไม่สามารถสร้างโฟลเดอร์เกษตรกรได้: ' + folderResult.message };
    }
    
    // Save to farmer folder
    const farmerFolder = DriveApp.getFolderById(folderResult.folderId);
    const pdfFile = farmerFolder.createFile(pdfBlob.setName(fileName));
    
    // Save to FileRecords if needed
    const fileRecord = createDocument({
      FarmerID: farmerID,
      DocumentType: 'sticker',
      FileName: fileName,
      FileID: pdfFile.getId(),
      FileURL: pdfFile.getUrl(),
      FolderName: 'สติ๊กเกอร์'
    });
    
    return {
      success: true,
      message: 'สร้างสติ๊กเกอร์ QR สำเร็จ',
      fileUrl: pdfFile.getUrl(),
      fileId: pdfFile.getId(),
      fileName: fileName
    };
    
  } catch (error) {
    console.error('Export QR Sticker PDF error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างสติ๊กเกอร์ PDF' };
  }
}

/**
 * Generate HTML for QR code stickers with search URL
 */
function generateStickerHTML(qrCode, harvestDate, shipDate, copies, searchUrl) {
  let stickersHTML = '';
  
  for (let i = 0; i < copies; i++) {
    stickersHTML += `
      <div class="sticker">
        <div class="header-text">ระบบตรวจสอบย้อนกลับผักอุดร</div>
        
        <div class="content-row">
          <div class="qr-code-section">
            <div class="qr-placeholder">
              QR CODE<br>
              <small>สแกนเพื่อตรวจสอบ</small>
            </div>
          </div>
          
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">วันที่เก็บเกี่ยว:</span>
              <span class="info-value">${harvestDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">วันที่จัดส่ง:</span>
              <span class="info-value">${shipDate}</span>
            </div>
          </div>
        </div>
        
        <div class="qr-text-bottom">
          <div class="qr-code-text">${searchUrl}</div>
        </div>
        
        <div class="footer-text">www.udtrace.com</div>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>QR Code Stickers</title>
    <style>
        @page {
            size: A4;
            margin: 0.5cm;
        }
        
        body {
            font-family: 'Noto Sans Thai', Arial, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 12px;
        }
        
        .sticker-page {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            padding: 10px;
        }
        
        .sticker {
            width: 8.5cm;
            height: 5.5cm;
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 1cm;
            padding: 8px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            text-align: center;
            break-inside: avoid;
            background: #fff;
        }
        
        .content-row {
            display: flex;
            flex: 1;
            align-items: center;
            justify-content: space-between;
            margin: 8px 0;
        }
        
        .qr-code-section {
            flex: 0 0 40%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        
        .qr-placeholder {
            width: 120px;
            height: 120px;
            border: 2px dashed #10b981;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #10b981;
            margin-bottom: 8px;
            background: #f0fdf4;
        }
        
        .qr-code-text {
            font-weight: bold;
            font-size: 9px;
            color: #10b981;
            word-break: break-all;
            line-height: 1.1;
        }
        
        .qr-text-bottom {
            margin-top: 4px;
            text-align: left;
            padding: 0 4px;
        }
        
        .info-section {
            flex: 0 0 55%;
            padding: 6px;
            text-align: left;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: 10px;
        }
        
        .info-label {
            color: #6b7280;
        }
        
        .info-value {
            font-weight: bold;
            color: #111827;
        }
        
        .header-text {
            font-size: 11px;
            color: #10b981;
            font-weight: bold;
            margin-bottom: 8px;
            text-align: center;
        }
        
        .footer-text {
            font-size: 8px;
            color: #9ca3af;
            margin-top: 4px;
        }
        
        @media print {
            .sticker {
                break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="sticker-page">
        ${stickersHTML}
    </div>
</body>
</html>
  `;
}