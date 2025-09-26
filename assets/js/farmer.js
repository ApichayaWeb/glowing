/**
 * ระบบสอบย้อนกลับผักอุดร - Farmer Functions
 * ===============================================
 * ฟังก์ชันเฉพาะสำหรับเกษตรกร
 */

/**
 * Farmer Data Manager Class
 */
class FarmerDataManager {
    constructor() {
        this.sectionNames = [
            'ข้อมูลพื้นฐานแปลง',
            'การเตรียมดิน',
            'การปลูก',
            'การดูแลรักษา',
            'การเก็บเกี่ยว',
            'หลังการเก็บเกี่ยว'
        ];
        
        this.sectionIcons = [
            'map',
            'tractor',
            'seedling',
            'tools',
            'cut',
            'shipping-fast'
        ];
        
        this.currentData = {};
        this.autoSaveEnabled = true;
    }

    /**
     * โหลดข้อมูลเกษตรกร
     * @param {string} farmerId - ID เกษตรกร
     * @return {Promise<Object>} ข้อมูลเกษตรกร
     */
    async loadFarmerData(farmerId) {
        try {
            const result = await FarmerAPI.getFarmerData(farmerId);
            
            if (result.success) {
                this.currentData = result.data;
                return this.currentData;
            } else {
                throw new Error(result.message || 'ไม่สามารถโหลดข้อมูลได้');
            }
        } catch (error) {
            console.error('Load farmer data error:', error);
            throw error;
        }
    }

    /**
     * บันทึกข้อมูลส่วนหนึ่ง
     * @param {string} farmerId - ID เกษตรกร
     * @param {number} sectionNumber - หมายเลขส่วน (1-6)
     * @param {Object} sectionData - ข้อมูลส่วน
     * @param {boolean} completed - เสร็จสิ้นหรือไม่
     * @return {Promise<Object>} ผลการบันทึก
     */
    async saveSectionData(farmerId, sectionNumber, sectionData, completed = false) {
        try {
            // คำนวณ progress
            const progress = completed ? 100 : this.calculateSectionProgress(sectionData);
            
            const dataToSave = {
                ...sectionData,
                completed: completed,
                progress: progress,
                lastUpdate: new Date().toISOString()
            };
            
            const result = await FarmerAPI.saveFarmerSection(farmerId, sectionNumber, dataToSave);
            
            if (result.success) {
                // อัปเดตข้อมูลใน cache
                if (!this.currentData.sections) {
                    this.currentData.sections = {};
                }
                this.currentData.sections[`section${sectionNumber}`] = dataToSave;
                
                return result;
            } else {
                throw new Error(result.message || 'ไม่สามารถบันทึกข้อมูลได้');
            }
        } catch (error) {
            console.error('Save section data error:', error);
            throw error;
        }
    }

    /**
     * คำนวณ progress ของส่วนข้อมูล
     * @param {Object} sectionData - ข้อมูลส่วน
     * @return {number} เปอร์เซ็นต์ความสมบูรณ์
     */
    calculateSectionProgress(sectionData) {
        const fields = Object.keys(sectionData).filter(key => 
            !['completed', 'progress', 'lastUpdate'].includes(key)
        );
        
        const filledFields = fields.filter(key => {
            const value = sectionData[key];
            return value !== null && value !== undefined && value !== '';
        });
        
        return fields.length > 0 ? Math.round((filledFields.length / fields.length) * 100) : 0;
    }

    /**
     * คำนวณ progress โดยรวม
     * @return {number} เปอร์เซ็นต์ความสมบูรณ์โดยรวม
     */
    calculateOverallProgress() {
        if (!this.currentData.sections) return 0;
        
        let totalProgress = 0;
        let sectionCount = 0;
        
        for (let i = 1; i <= 6; i++) {
            const section = this.currentData.sections[`section${i}`];
            if (section) {
                totalProgress += (section.progress || 0);
                sectionCount++;
            }
        }
        
        return sectionCount > 0 ? Math.round(totalProgress / 6) : 0;
    }

    /**
     * ตรวจสอบว่าส่วนใดเสร็จสิ้นแล้ว
     * @return {Array} รายการส่วนที่เสร็จสิ้น
     */
    getCompletedSections() {
        if (!this.currentData.sections) return [];
        
        const completed = [];
        for (let i = 1; i <= 6; i++) {
            const section = this.currentData.sections[`section${i}`];
            if (section && section.completed) {
                completed.push(i);
            }
        }
        
        return completed;
    }

    /**
     * ตรวจสอบว่าข้อมูลครบถ้วนหรือไม่
     * @return {boolean} ครบถ้วนหรือไม่
     */
    isDataComplete() {
        return this.getCompletedSections().length === 6;
    }

    /**
     * สร้างรายงานสรุปข้อมูล
     * @return {Object} รายงานสรุป
     */
    generateSummaryReport() {
        const completedSections = this.getCompletedSections();
        const overallProgress = this.calculateOverallProgress();
        
        const report = {
            farmerInfo: {
                name: this.currentData.farmerName || '-',
                plotCode: this.currentData.plotCode || '-',
                groupName: this.currentData.groupName || '-'
            },
            progress: {
                overall: overallProgress,
                completedSections: completedSections.length,
                totalSections: 6
            },
            sections: []
        };
        
        for (let i = 1; i <= 6; i++) {
            const section = this.currentData.sections?.[`section${i}`];
            report.sections.push({
                number: i,
                name: this.sectionNames[i - 1],
                icon: this.sectionIcons[i - 1],
                completed: section?.completed || false,
                progress: section?.progress || 0,
                lastUpdate: section?.lastUpdate || null
            });
        }
        
        return report;
    }

    /**
     * ส่งออกข้อมูลเป็น JSON
     * @return {string} ข้อมูลในรูปแบบ JSON
     */
    exportData() {
        return JSON.stringify(this.currentData, null, 2);
    }
}

/**
 * Section Progress Tracker Class
 */
class SectionProgressTracker {
    constructor() {
        this.progressElements = {};
        this.callbacks = {};
    }

    /**
     * เริ่มต้นการติดตาม progress
     * @param {string} containerId - ID ของ container
     */
    initialize(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        this.createProgressElements(container);
        this.bindEvents();
    }

    /**
     * สร้าง elements สำหรับแสดง progress
     * @param {HTMLElement} container - container element
     */
    createProgressElements(container) {
        const farmerDataManager = new FarmerDataManager();
        
        let html = '';
        
        for (let i = 1; i <= 6; i++) {
            html += `
                <div class="section-progress-item mb-3" data-section="${i}">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <div class="d-flex align-items-center">
                            <div class="section-number me-3">
                                <div class="rounded-circle bg-light d-flex align-items-center justify-content-center" 
                                     style="width: 40px; height: 40px;">
                                    <i class="fas fa-${farmerDataManager.sectionIcons[i-1]} text-muted"></i>
                                </div>
                            </div>
                            <div>
                                <h6 class="mb-0">ส่วนที่ ${i}</h6>
                                <small class="text-muted">${farmerDataManager.sectionNames[i-1]}</small>
                            </div>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-secondary" id="section${i}Badge">0%</span>
                        </div>
                    </div>
                    <div class="progress" style="height: 8px;">
                        <div class="progress-bar" id="section${i}Progress" style="width: 0%"></div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // เก็บ reference ของ elements
        for (let i = 1; i <= 6; i++) {
            this.progressElements[i] = {
                badge: document.getElementById(`section${i}Badge`),
                progress: document.getElementById(`section${i}Progress`),
                item: container.querySelector(`[data-section="${i}"]`)
            };
        }
    }

    /**
     * ผูก event handlers
     */
    bindEvents() {
        // คลิกที่ section เพื่อไปยังหน้ากรอกข้อมูล
        Object.keys(this.progressElements).forEach(sectionNumber => {
            const item = this.progressElements[sectionNumber].item;
            
            item.addEventListener('click', () => {
                if (this.callbacks.onSectionClick) {
                    this.callbacks.onSectionClick(parseInt(sectionNumber));
                }
            });
            
            item.style.cursor = 'pointer';
        });
    }

    /**
     * อัปเดต progress ของส่วนหนึ่ง
     * @param {number} sectionNumber - หมายเลขส่วน
     * @param {number} progress - ความคืบหน้า (0-100)
     * @param {boolean} completed - เสร็จสิ้นหรือไม่
     */
    updateSectionProgress(sectionNumber, progress, completed = false) {
        const elements = this.progressElements[sectionNumber];
        if (!elements) return;
        
        const percentage = Math.max(0, Math.min(100, progress));
        
        // อัปเดต progress bar
        elements.progress.style.width = percentage + '%';
        
        // อัปเดต badge
        if (completed) {
            elements.badge.className = 'badge bg-success';
            elements.badge.innerHTML = '<i class="fas fa-check"></i>';
            elements.progress.className = 'progress-bar bg-success';
        } else if (percentage > 0) {
            elements.badge.className = 'badge bg-warning';
            elements.badge.textContent = percentage + '%';
            elements.progress.className = 'progress-bar bg-warning';
        } else {
            elements.badge.className = 'badge bg-secondary';
            elements.badge.textContent = '0%';
            elements.progress.className = 'progress-bar bg-secondary';
        }
        
        // อัปเดต icon
        const icon = elements.item.querySelector('.fa');
        if (completed) {
            icon.className = 'fas fa-check-circle text-success';
        } else if (percentage > 0) {
            icon.className = `fas fa-${new FarmerDataManager().sectionIcons[sectionNumber-1]} text-warning`;
        } else {
            icon.className = `fas fa-${new FarmerDataManager().sectionIcons[sectionNumber-1]} text-muted`;
        }
    }

    /**
     * อัปเดต progress ทั้งหมด
     * @param {Object} sectionsData - ข้อมูลทุกส่วน
     */
    updateAllProgress(sectionsData) {
        for (let i = 1; i <= 6; i++) {
            const section = sectionsData[`section${i}`];
            if (section) {
                this.updateSectionProgress(i, section.progress || 0, section.completed || false);
            } else {
                this.updateSectionProgress(i, 0, false);
            }
        }
    }

    /**
     * ตั้งค่า callback functions
     * @param {Object} callbacks - callback functions
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }
}

/**
 * QR Code Manager Class
 */
class QRCodeManager {
    constructor() {
        this.qrCodeCache = new Map();
    }

    /**
     * สร้าง QR Code สำหรับเกษตรกร
     * @param {string} farmerId - ID เกษตรกร
     * @param {Object} farmerInfo - ข้อมูลเกษตรกร
     * @return {Promise<string>} URL ของ QR Code
     */
    async generateFarmerQRCode(farmerId, farmerInfo) {
        try {
            const cacheKey = `farmer_${farmerId}`;
            
            // ตรวจสอบ cache ก่อน
            if (this.qrCodeCache.has(cacheKey)) {
                return this.qrCodeCache.get(cacheKey);
            }
            
            const result = await FarmerAPI.getFarmerQRCode(farmerId);
            
            if (result.success) {
                this.qrCodeCache.set(cacheKey, result.qrCodeUrl);
                return result.qrCodeUrl;
            } else {
                throw new Error(result.message || 'ไม่สามารถสร้าง QR Code ได้');
            }
        } catch (error) {
            console.error('Generate QR Code error:', error);
            throw error;
        }
    }

    /**
     * สร้างรหัสค้นหา
     * @param {string} farmerId - ID เกษตรกร
     * @param {string} shipDate - วันที่จัดส่ง
     * @return {Promise<string>} รหัสค้นหา
     */
    async generateSearchCode(farmerId, shipDate) {
        try {
            const result = await FarmerAPI.generateSearchCode(farmerId, shipDate);
            
            if (result.success) {
                return result.searchCode;
            } else {
                throw new Error(result.message || 'ไม่สามารถสร้างรหัสค้นหาได้');
            }
        } catch (error) {
            console.error('Generate search code error:', error);
            throw error;
        }
    }

    /**
     * แสดง QR Code ใน modal
     * @param {string} qrCodeUrl - URL ของ QR Code
     * @param {string} title - หัวข้อ modal
     */
    showQRCodeModal(qrCodeUrl, title = 'QR Code') {
        const modalHtml = `
            <div class="modal fade" id="qrCodeModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-qrcode me-2"></i>${title}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center">
                            <img src="${qrCodeUrl}" alt="QR Code" class="img-fluid" style="max-width: 300px;">
                            <p class="mt-3 text-muted">สแกน QR Code นี้เพื่อตรวจสอบข้อมูลผลผลิต</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="downloadQRCode('${qrCodeUrl}')">
                                <i class="fas fa-download me-1"></i>ดาวน์โหลด
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">ปิด</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // ลบ modal เก่า (ถ้ามี)
        const existingModal = document.getElementById('qrCodeModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // เพิ่ม modal ใหม่
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // แสดง modal
        const modal = new bootstrap.Modal(document.getElementById('qrCodeModal'));
        modal.show();
        
        // ลบ modal เมื่อปิด
        document.getElementById('qrCodeModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
}

/**
 * Activity Logger Class
 */
class ActivityLogger {
    constructor() {
        this.activities = [];
        this.maxActivities = 50; // เก็บกิจกรรมสูงสุด 50 รายการ
    }

    /**
     * บันทึกกิจกรรม
     * @param {string} action - การกระทำ
     * @param {string} details - รายละเอียด
     * @param {Object} metadata - ข้อมูลเพิ่มเติม
     */
    log(action, details, metadata = {}) {
        const activity = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            action: action,
            details: details,
            metadata: metadata
        };
        
        this.activities.unshift(activity);
        
        // จำกัดจำนวนกิจกรรม
        if (this.activities.length > this.maxActivities) {
            this.activities = this.activities.slice(0, this.maxActivities);
        }
        
        // บันทึกลง localStorage
        this.saveToStorage();
        
        console.log('Activity logged:', activity);
    }

    /**
     * ดึงกิจกรรมล่าสุด
     * @param {number} limit - จำนวนกิจกรรมที่จะดึง
     * @return {Array} รายการกิจกรรม
     */
    getRecentActivities(limit = 10) {
        return this.activities.slice(0, limit);
    }

    /**
     * บันทึกลง localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem('farmer_activities', JSON.stringify(this.activities));
        } catch (error) {
            console.error('Failed to save activities to storage:', error);
        }
    }

    /**
     * โหลดจาก localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('farmer_activities');
            if (stored) {
                this.activities = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load activities from storage:', error);
            this.activities = [];
        }
    }

    /**
     * ล้างกิจกรรมทั้งหมด
     */
    clear() {
        this.activities = [];
        this.saveToStorage();
    }
}

// สร้าง instances หลัก
const farmerDataManager = new FarmerDataManager();
const sectionProgressTracker = new SectionProgressTracker();
const qrCodeManager = new QRCodeManager();
const activityLogger = new ActivityLogger();

// โหลดกิจกรรมจาก storage เมื่อเริ่มต้น
activityLogger.loadFromStorage();

/**
 * Helper Functions สำหรับใช้งานทั่วไป
 */

/**
 * ดาวน์โหลด QR Code
 * @param {string} qrCodeUrl - URL ของ QR Code
 */
function downloadQRCode(qrCodeUrl) {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `QRCode_${AuthAPI.getCurrentUser()?.plotCode || 'farmer'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * สร้างและแสดงรายงานสรุป
 * @param {string} containerId - ID ของ container สำหรับแสดงรายงาน
 */
async function generateAndShowSummaryReport(containerId) {
    try {
        const user = AuthAPI.getCurrentUser();
        if (!user || user.role !== 'farmer') return;
        
        await farmerDataManager.loadFarmerData(user.farmerId);
        const report = farmerDataManager.generateSummaryReport();
        
        const container = document.getElementById(containerId);
        if (!container) return;
        
        let html = `
            <div class="summary-report">
                <div class="row mb-4">
                    <div class="col-md-6">
                        <h5 class="border-bottom pb-2">ข้อมูลเกษตรกร</h5>
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <tr><th>ชื่อ:</th><td>${report.farmerInfo.name}</td></tr>
                                <tr><th>รหัสแปลง:</th><td>${report.farmerInfo.plotCode}</td></tr>
                                <tr><th>กลุ่ม:</th><td>${report.farmerInfo.groupName}</td></tr>
                            </table>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <h5 class="border-bottom pb-2">ความคืบหน้า</h5>
                        <div class="text-center">
                            <div class="display-4 text-primary">${report.progress.overall}%</div>
                            <p class="text-muted">ความสมบูรณ์โดยรวม</p>
                            <p>เสร็จสิ้น ${report.progress.completedSections}/${report.progress.totalSections} ส่วน</p>
                        </div>
                    </div>
                </div>
                
                <h5 class="border-bottom pb-2">รายละเอียดแต่ละส่วน</h5>
                <div class="row">
        `;
        
        report.sections.forEach(section => {
            const statusClass = section.completed ? 'text-success' : section.progress > 0 ? 'text-warning' : 'text-muted';
            const statusIcon = section.completed ? 'check-circle' : section.progress > 0 ? 'clock' : 'circle';
            const statusText = section.completed ? 'เสร็จสิ้น' : section.progress > 0 ? `${section.progress}%` : 'ยังไม่เริ่ม';
            
            html += `
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex align-items-center">
                                <div class="me-3">
                                    <i class="fas fa-${section.icon} fa-2x text-primary"></i>
                                </div>
                                <div class="flex-grow-1">
                                    <h6 class="mb-1">ส่วนที่ ${section.number}: ${section.name}</h6>
                                    <div class="${statusClass}">
                                        <i class="fas fa-${statusIcon} me-1"></i>
                                        ${statusText}
                                    </div>
                                    ${section.lastUpdate ? `<small class="text-muted">อัปเดต: ${new Date(section.lastUpdate).toLocaleDateString('th-TH')}</small>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Generate summary report error:', error);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '<div class="alert alert-danger">ไม่สามารถสร้างรายงานสรุปได้</div>';
        }
    }
}

/**
 * เริ่มต้น auto-save สำหรับ form กรอกข้อมูล
 * @param {HTMLFormElement} form - form ที่จะเปิด auto-save
 * @param {number} sectionNumber - หมายเลขส่วนข้อมูล
 */
function initializeFarmerAutoSave(form, sectionNumber) {
    const user = AuthAPI.getCurrentUser();
    if (!user || user.role !== 'farmer') return;
    
    const saveCallback = async (formData) => {
        try {
            await farmerDataManager.saveSectionData(
                user.farmerId, 
                sectionNumber, 
                formData, 
                false // ไม่ mark เป็น completed ใน auto-save
            );
            
            activityLogger.log(
                'auto_save',
                `บันทึกข้อมูลส่วนที่ ${sectionNumber} อัตโนมัติ`,
                { sectionNumber, formData }
            );
            
        } catch (error) {
            console.error('Auto-save error:', error);
            throw error;
        }
    };
    
    autoSaveHandler.enable(form, saveCallback);
}

/**
 * สร้าง activity timeline
 * @param {string} containerId - ID ของ container
 */
function renderActivityTimeline(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const activities = activityLogger.getRecentActivities(20);
    
    if (activities.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">ยังไม่มีกิจกรรม</div>';
        return;
    }
    
    let html = '<div class="activity-timeline">';
    
    activities.forEach(activity => {
        const date = new Date(activity.timestamp);
        const timeAgo = Utils.getTimeAgo ? Utils.getTimeAgo(date) : date.toLocaleString('th-TH');
        
        html += `
            <div class="activity-item d-flex mb-3">
                <div class="activity-time flex-shrink-0 me-3">
                    <small class="text-muted">${timeAgo}</small>
                </div>
                <div class="activity-content flex-grow-1">
                    <div class="activity-action fw-medium">${activity.action}</div>
                    <div class="activity-details text-muted small">${activity.details}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    container.innerHTML = html;
}

// Export สำหรับใช้งานในหน้าอื่น
window.FarmerDataManager = FarmerDataManager;
window.SectionProgressTracker = SectionProgressTracker;
window.QRCodeManager = QRCodeManager;
window.ActivityLogger = ActivityLogger;
window.farmerDataManager = farmerDataManager;
window.sectionProgressTracker = sectionProgressTracker;
window.qrCodeManager = qrCodeManager;
window.activityLogger = activityLogger;
window.downloadQRCode = downloadQRCode;
window.generateAndShowSummaryReport = generateAndShowSummaryReport;
window.initializeFarmerAutoSave = initializeFarmerAutoSave;
window.renderActivityTimeline = renderActivityTimeline;