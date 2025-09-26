/**
 * ระบบสอบย้อนกลับผักอุดร - Group Management Functions
 * ========================================================
 * ฟังก์ชันเฉพาะสำหรับผู้จัดการกลุ่ม
 */

/**
 * Group Data Manager Class
 */
class GroupDataManager {
    constructor() {
        this.currentGroupData = {};
        this.farmersData = [];
        this.documentsData = [];
        this.statisticsData = {};
    }

    /**
     * โหลดข้อมูลกลุ่ม
     * @param {string} groupId - ID กลุ่ม
     * @return {Promise<Object>} ข้อมูลกลุ่ม
     */
    async loadGroupData(groupId) {
        try {
            const result = await GroupAPI.getGroupData(groupId);
            
            if (result.success) {
                this.currentGroupData = result.data;
                return this.currentGroupData;
            } else {
                throw new Error(result.message || 'ไม่สามารถโหลดข้อมูลกลุ่มได้');
            }
        } catch (error) {
            console.error('Load group data error:', error);
            throw error;
        }
    }

    /**
     * โหลดรายการเกษตรกรในกลุ่ม
     * @param {string} groupId - ID กลุ่ม
     * @return {Promise<Array>} รายการเกษตรกร
     */
    async loadGroupFarmers(groupId) {
        try {
            const result = await GroupAPI.getGroupFarmers(groupId);
            
            if (result.success) {
                this.farmersData = result.data || [];
                return this.farmersData;
            } else {
                throw new Error(result.message || 'ไม่สามารถโหลดรายการเกษตรกรได้');
            }
        } catch (error) {
            console.error('Load group farmers error:', error);
            throw error;
        }
    }

    /**
     * โหลดสถิติของกลุ่ม
     * @param {string} groupId - ID กลุ่ม
     * @return {Promise<Object>} สถิติกลุ่ม
     */
    async loadGroupStatistics(groupId) {
        try {
            const result = await GroupAPI.getGroupStats(groupId);
            
            if (result.success) {
                this.statisticsData = result.data;
                return this.statisticsData;
            } else {
                throw new Error(result.message || 'ไม่สามารถโหลดสถิติกลุ่มได้');
            }
        } catch (error) {
            console.error('Load group statistics error:', error);
            throw error;
        }
    }

    /**
     * เพิ่มเกษตรกรใหม่
     * @param {Object} farmerData - ข้อมูลเกษตรกร
     * @return {Promise<Object>} ผลการเพิ่มเกษตรกร
     */
    async addFarmer(farmerData) {
        try {
            const result = await GroupAPI.addFarmer(farmerData);
            
            if (result.success) {
                // อัปเดตรายการเกษตรกรใน cache
                const newFarmer = {
                    ...farmerData,
                    id: result.farmerId,
                    createdAt: new Date().toISOString(),
                    status: 'active',
                    dataCompletion: 0
                };
                
                this.farmersData.push(newFarmer);
                
                return result;
            } else {
                throw new Error(result.message || 'ไม่สามารถเพิ่มเกษตรกรได้');
            }
        } catch (error) {
            console.error('Add farmer error:', error);
            throw error;
        }
    }

    /**
     * อัปเดตข้อมูลเกษตรกร
     * @param {string} farmerId - ID เกษตรกร
     * @param {Object} farmerData - ข้อมูลเกษตรกรที่จะอัปเดต
     * @return {Promise<Object>} ผลการอัปเดต
     */
    async updateFarmer(farmerId, farmerData) {
        try {
            const result = await GroupAPI.updateFarmer(farmerId, farmerData);
            
            if (result.success) {
                // อัปเดตข้อมูลใน cache
                const index = this.farmersData.findIndex(f => f.id === farmerId);
                if (index !== -1) {
                    this.farmersData[index] = { ...this.farmersData[index], ...farmerData };
                }
                
                return result;
            } else {
                throw new Error(result.message || 'ไม่สามารถอัปเดตข้อมูลเกษตรกรได้');
            }
        } catch (error) {
            console.error('Update farmer error:', error);
            throw error;
        }
    }

    /**
     * ลบเกษตรกร
     * @param {string} farmerId - ID เกษตรกร
     * @return {Promise<Object>} ผลการลบ
     */
    async deleteFarmer(farmerId) {
        try {
            const result = await GroupAPI.deleteFarmer(farmerId);
            
            if (result.success) {
                // ลบออกจาก cache
                this.farmersData = this.farmersData.filter(f => f.id !== farmerId);
                
                return result;
            } else {
                throw new Error(result.message || 'ไม่สามารถลบเกษตรกรได้');
            }
        } catch (error) {
            console.error('Delete farmer error:', error);
            throw error;
        }
    }

    /**
     * อัปโหลดเอกสารกลุ่ม
     * @param {File} file - ไฟล์เอกสาร
     * @param {string} documentType - ประเภทเอกสาร
     * @return {Promise<Object>} ผลการอัปโหลด
     */
    async uploadDocument(file, documentType) {
        try {
            const result = await GroupAPI.uploadGroupDocument(file, documentType);
            
            if (result.success) {
                // เพิ่มเอกสารใหม่ใน cache
                const newDocument = {
                    id: result.documentId,
                    name: file.name,
                    type: documentType,
                    fileSize: file.size,
                    uploadDate: new Date().toISOString(),
                    url: result.fileUrl
                };
                
                this.documentsData.push(newDocument);
                
                return result;
            } else {
                throw new Error(result.message || 'ไม่สามารถอัปโหลดเอกสารได้');
            }
        } catch (error) {
            console.error('Upload document error:', error);
            throw error;
        }
    }

    /**
     * คำนวณสถิติของกลุ่ม
     * @return {Object} สถิติที่คำนวณแล้ว
     */
    calculateGroupStatistics() {
        const totalFarmers = this.farmersData.length;
        const activeFarmers = this.farmersData.filter(f => f.status === 'active').length;
        const inactiveFarmers = this.farmersData.filter(f => f.status === 'inactive').length;
        
        let totalCompletion = 0;
        let completedDataCount = 0;
        
        this.farmersData.forEach(farmer => {
            const completion = farmer.dataCompletion || 0;
            totalCompletion += completion;
            
            if (completion === 100) {
                completedDataCount++;
            }
        });
        
        const avgCompletion = totalFarmers > 0 ? Math.round(totalCompletion / totalFarmers) : 0;
        const totalPlots = this.farmersData.reduce((sum, farmer) => {
            return sum + (farmer.plots ? farmer.plots.length : 1);
        }, 0);
        
        return {
            totalFarmers,
            activeFarmers,
            inactiveFarmers,
            avgCompletion,
            completedDataCount,
            totalPlots,
            totalDocuments: this.documentsData.length
        };
    }

    /**
     * ค้นหาเกษตรกร
     * @param {string} searchTerm - คำค้นหา
     * @param {Object} filters - ตัวกรอง
     * @return {Array} รายการเกษตรกรที่ค้นพบ
     */
    searchFarmers(searchTerm = '', filters = {}) {
        let filtered = [...this.farmersData];
        
        // ค้นหาตามคำ
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(farmer => 
                farmer.fullName.toLowerCase().includes(term) ||
                farmer.phone.includes(term) ||
                farmer.plotCode.toLowerCase().includes(term) ||
                (farmer.address && farmer.address.toLowerCase().includes(term))
            );
        }
        
        // กรองตามสถานะ
        if (filters.status) {
            filtered = filtered.filter(farmer => farmer.status === filters.status);
        }
        
        // กรองตามความสมบูรณ์ข้อมูล
        if (filters.completion !== undefined) {
            const completion = parseInt(filters.completion);
            filtered = filtered.filter(farmer => {
                const farmerCompletion = farmer.dataCompletion || 0;
                
                switch (completion) {
                    case 100:
                        return farmerCompletion === 100;
                    case 75:
                        return farmerCompletion > 75;
                    case 50:
                        return farmerCompletion > 50;
                    case 25:
                        return farmerCompletion > 25;
                    case 0:
                        return farmerCompletion === 0;
                    default:
                        return true;
                }
            });
        }
        
        return filtered;
    }

    /**
     * เรียงลำดับเกษตรกร
     * @param {Array} farmers - รายการเกษตรกร
     * @param {string} sortBy - เรียงตาม
     * @return {Array} รายการเกษตรกรที่เรียงแล้ว
     */
    sortFarmers(farmers, sortBy) {
        const sorted = [...farmers];
        
        switch (sortBy) {
            case 'name':
                return sorted.sort((a, b) => a.fullName.localeCompare(b.fullName, 'th'));
            case 'name_desc':
                return sorted.sort((a, b) => b.fullName.localeCompare(a.fullName, 'th'));
            case 'completion_desc':
                return sorted.sort((a, b) => (b.dataCompletion || 0) - (a.dataCompletion || 0));
            case 'completion':
                return sorted.sort((a, b) => (a.dataCompletion || 0) - (b.dataCompletion || 0));
            case 'date_desc':
                return sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            case 'date':
                return sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
            default:
                return sorted;
        }
    }
}

/**
 * Farmer Cards Renderer Class
 */
class FarmerCardsRenderer {
    constructor() {
        this.selectedFarmers = new Set();
        this.onSelectionChange = null;
        this.onFarmerAction = null;
    }

    /**
     * เรนเดอร์ cards ของเกษตรกร
     * @param {Array} farmers - รายการเกษตรกร
     * @param {string} containerId - ID ของ container
     */
    renderFarmerCards(farmers, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (farmers.length === 0) {
            container.innerHTML = this.getEmptyState();
            return;
        }
        
        let html = '';
        farmers.forEach(farmer => {
            html += this.createFarmerCard(farmer);
        });
        
        container.innerHTML = html;
        this.bindCardEvents();
    }

    /**
     * สร้าง card ของเกษตรกร
     * @param {Object} farmer - ข้อมูลเกษตรกร
     * @return {string} HTML ของ card
     */
    createFarmerCard(farmer) {
        const statusClass = farmer.status === 'active' ? 'active' : 
                           farmer.status === 'inactive' ? 'inactive' : 'pending';
        
        const statusBadge = farmer.status === 'active' ? 'bg-success' :
                           farmer.status === 'inactive' ? 'bg-danger' : 'bg-warning';
        
        const statusText = farmer.status === 'active' ? 'ใช้งาน' :
                          farmer.status === 'inactive' ? 'ไม่ใช้งาน' : 'รอยืนยัน';
        
        const completion = farmer.dataCompletion || 0;
        const completionColor = completion >= 75 ? '#28a745' : 
                               completion >= 50 ? '#ffc107' : '#dc3545';
        
        const initials = farmer.fullName.split(' ').map(n => n[0]).join('').toUpperCase();
        
        // สร้าง progress indicators สำหรับ 6 ส่วน
        let sectionsHtml = '';
        for (let i = 1; i <= 6; i++) {
            const section = farmer.sections?.[`section${i}`];
            const sectionClass = section?.completed ? 'completed' : 
                               section?.progress > 0 ? 'partial' : '';
            sectionsHtml += `<div class="section-indicator ${sectionClass}"></div>`;
        }
        
        return `
            <div class="col-xl-4 col-lg-6 mb-4">
                <div class="card farmer-card ${statusClass} border-0 shadow-sm position-relative" 
                     data-farmer-id="${farmer.id}">
                    <div class="status-badge">
                        <span class="badge ${statusBadge}">${statusText}</span>
                    </div>
                    
                    <div class="card-body">
                        <div class="d-flex align-items-start mb-3">
                            <div class="farmer-avatar me-3">
                                ${initials}
                            </div>
                            <div class="flex-grow-1">
                                <h6 class="mb-1">${farmer.fullName}</h6>
                                <div class="small text-muted">
                                    <i class="fas fa-phone me-1"></i>${farmer.phone}
                                </div>
                                <div class="small text-muted">
                                    <i class="fas fa-map-marker-alt me-1"></i>แปลง: ${farmer.plotCode}
                                </div>
                                ${farmer.plotSize ? `<div class="small text-muted"><i class="fas fa-expand-arrows-alt me-1"></i>${farmer.plotSize} ไร่</div>` : ''}
                            </div>
                            <div class="flex-shrink-0">
                                <input type="checkbox" class="form-check-input farmer-checkbox" 
                                       value="${farmer.id}" ${this.selectedFarmers.has(farmer.id) ? 'checked' : ''}>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <small class="text-muted">ความสมบูรณ์ข้อมูล</small>
                                <small class="fw-medium">${completion}%</small>
                            </div>
                            <div class="progress" style="height: 6px;">
                                <div class="progress-bar" 
                                     style="width: ${completion}%; background-color: ${completionColor}"></div>
                            </div>
                            <div class="data-sections-progress mt-2">
                                ${sectionsHtml}
                            </div>
                        </div>
                        
                        ${farmer.lastActive ? `
                            <div class="small text-muted mb-3">
                                <i class="fas fa-clock me-1"></i>
                                เข้าใช้ล่าสุด: ${new Date(farmer.lastActive).toLocaleDateString('th-TH')}
                            </div>
                        ` : ''}
                        
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="btn-group" role="group">
                                <button class="btn btn-outline-info btn-sm" 
                                        onclick="showFarmerDetails('${farmer.id}')" title="ดูรายละเอียด">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-outline-success btn-sm" 
                                        onclick="generateFarmerReport('${farmer.id}')" title="รายงาน">
                                    <i class="fas fa-file-alt"></i>
                                </button>
                            </div>
                            <div class="btn-group" role="group">
                                <button class="btn btn-outline-warning btn-sm" 
                                        onclick="toggleFarmerStatus('${farmer.id}', '${farmer.status}')" 
                                        title="${farmer.status === 'active' ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}">
                                    <i class="fas fa-${farmer.status === 'active' ? 'user-times' : 'user-check'}"></i>
                                </button>
                                ${!farmer.plotCode || farmer.plotCode.trim() === '' ? `
                                <button class="btn btn-outline-danger btn-sm" 
                                        onclick="deleteFarmer('${farmer.id}', '${farmer.fullName}')" title="ลบ">
                                    <i class="fas fa-trash"></i>
                                </button>
                                ` : `
                                <button class="btn btn-outline-secondary btn-sm" 
                                        disabled title="ไม่สามารถลบได้ เนื่องจากมีข้อมูลแปลง ${farmer.plotCode} แล้ว">
                                    <i class="fas fa-shield-alt"></i>
                                </button>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * สร้าง empty state HTML
     * @return {string} HTML ของ empty state
     */
    getEmptyState() {
        return `
            <div class="col-12 text-center py-5">
                <i class="fas fa-users fs-1 text-muted mb-3"></i>
                <h5 class="text-muted">ไม่พบสมาชิกที่ตรงกับเงื่อนไขการค้นหา</h5>
                <button class="btn btn-primary mt-3" onclick="showAddFarmerModal()">
                    <i class="fas fa-user-plus me-2"></i>เพิ่มสมาชิกใหม่
                </button>
            </div>
        `;
    }

    /**
     * ผูก event handlers กับ cards
     */
    bindCardEvents() {
        // Checkbox selection
        document.querySelectorAll('.farmer-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const farmerId = e.target.value;
                
                if (e.target.checked) {
                    this.selectedFarmers.add(farmerId);
                } else {
                    this.selectedFarmers.delete(farmerId);
                }
                
                if (this.onSelectionChange) {
                    this.onSelectionChange(Array.from(this.selectedFarmers));
                }
            });
        });
        
        // Card click for details
        document.querySelectorAll('.farmer-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // ไม่เรียก event ถ้าคลิกที่ checkbox หรือ button
                if (e.target.matches('input, button, .btn, .btn *')) {
                    return;
                }
                
                const farmerId = card.getAttribute('data-farmer-id');
                if (farmerId && this.onFarmerAction) {
                    this.onFarmerAction('view', farmerId);
                }
            });
        });
    }

    /**
     * ล้างการเลือกทั้งหมด
     */
    clearSelection() {
        this.selectedFarmers.clear();
        document.querySelectorAll('.farmer-checkbox').forEach(cb => {
            cb.checked = false;
        });
        
        if (this.onSelectionChange) {
            this.onSelectionChange([]);
        }
    }

    /**
     * เลือกทั้งหมด
     * @param {Array} farmerIds - รายการ ID เกษตรกร
     */
    selectAll(farmerIds) {
        this.selectedFarmers.clear();
        farmerIds.forEach(id => this.selectedFarmers.add(id));
        
        document.querySelectorAll('.farmer-checkbox').forEach(cb => {
            cb.checked = farmerIds.includes(cb.value);
        });
        
        if (this.onSelectionChange) {
            this.onSelectionChange(Array.from(this.selectedFarmers));
        }
    }

    /**
     * ตั้งค่า callback functions
     * @param {Object} callbacks - callback functions
     */
    setCallbacks(callbacks) {
        this.onSelectionChange = callbacks.onSelectionChange;
        this.onFarmerAction = callbacks.onFarmerAction;
    }
}

/**
 * Document Manager Class
 */
class DocumentManager {
    constructor() {
        this.documentTypes = {
            certification: 'ใบรับรองมาตรฐาน',
            license: 'ใบอนุญาต',
            registration: 'ทะเบียนกลุ่ม',
            map: 'แผนที่แปลง',
            contract: 'สัญญาซื้อขาย',
            other: 'เอกสารอื่นๆ'
        };
        
        this.allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png'
        ];
        
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
    }

    /**
     * ตรวจสอบไฟล์
     * @param {File} file - ไฟล์ที่จะตรวจสอบ
     * @return {Object} ผลการตรวจสอบ
     */
    validateFile(file) {
        // ตรวจสอบประเภทไฟล์
        if (!this.allowedTypes.includes(file.type)) {
            return {
                isValid: false,
                message: 'ประเภทไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ PDF, DOC, DOCX, JPG หรือ PNG'
            };
        }
        
        // ตรวจสอบขนาดไฟล์
        if (file.size > this.maxFileSize) {
            return {
                isValid: false,
                message: `ขนาดไฟล์เกิน ${this.formatFileSize(this.maxFileSize)}`
            };
        }
        
        return { isValid: true };
    }

    /**
     * แปลงขนาดไฟล์เป็นรูปแบบที่อ่านง่าย
     * @param {number} bytes - ขนาดไฟล์ในหน่วย bytes
     * @return {string} ขนาดไฟล์ที่อ่านง่าย
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * สร้าง preview ของเอกสาร
     * @param {File} file - ไฟล์เอกสาร
     * @param {HTMLElement} container - container สำหรับแสดง preview
     */
    createDocumentPreview(file, container) {
        const preview = document.createElement('div');
        preview.className = 'document-preview alert alert-info';
        
        let iconClass = 'fas fa-file';
        if (file.type.includes('pdf')) {
            iconClass = 'fas fa-file-pdf text-danger';
        } else if (file.type.includes('word')) {
            iconClass = 'fas fa-file-word text-primary';
        } else if (file.type.includes('image')) {
            iconClass = 'fas fa-file-image text-success';
        }
        
        preview.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="${iconClass} fs-3 me-3"></i>
                <div class="flex-grow-1">
                    <div class="fw-medium">${file.name}</div>
                    <div class="small text-muted">
                        ขนาด: ${this.formatFileSize(file.size)} | 
                        ประเภท: ${file.type}
                    </div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // สำหรับรูปภาพ แสดง thumbnail
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'img-thumbnail mt-2';
                img.style.maxWidth = '200px';
                img.style.maxHeight = '150px';
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
        
        container.appendChild(preview);
    }

    /**
     * เรนเดอร์รายการเอกสารที่อัปโหลดแล้ว
     * @param {Array} documents - รายการเอกสาร
     * @param {string} containerId - ID ของ container
     */
    renderDocumentsList(documents, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (documents.length === 0) {
            container.innerHTML = '<div class="text-center p-4 text-muted">ยังไม่มีเอกสารที่อัปโหลด</div>';
            return;
        }
        
        let html = '';
        documents.forEach(doc => {
            const uploadDate = new Date(doc.uploadDate).toLocaleDateString('th-TH');
            const fileSize = doc.fileSize ? this.formatFileSize(doc.fileSize) : '-';
            
            let iconClass = 'fas fa-file';
            if (doc.url && doc.url.includes('.pdf')) {
                iconClass = 'fas fa-file-pdf text-danger';
            } else if (doc.url && (doc.url.includes('.doc') || doc.url.includes('.docx'))) {
                iconClass = 'fas fa-file-word text-primary';
            } else if (doc.url && (doc.url.includes('.jpg') || doc.url.includes('.png'))) {
                iconClass = 'fas fa-file-image text-success';
            }
            
            html += `
                <div class="document-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center">
                                <i class="${iconClass} me-3 fs-4"></i>
                                <div>
                                    <h6 class="mb-1">${doc.name}</h6>
                                    <div class="small text-muted">
                                        <span class="badge bg-secondary me-2">${this.documentTypes[doc.type] || doc.type}</span>
                                        อัปโหลดเมื่อ: ${uploadDate} | ขนาด: ${fileSize}
                                    </div>
                                    ${doc.description ? `<div class="small text-muted mt-1">${doc.description}</div>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex-shrink-0">
                            <button class="btn btn-outline-primary btn-sm me-1" 
                                    onclick="viewDocument('${doc.id}', '${doc.name}', '${doc.url}')" title="ดู">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-outline-success btn-sm me-1" 
                                    onclick="downloadDocument('${doc.url}', '${doc.name}')" title="ดาวน์โหลด">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm" 
                                    onclick="deleteDocument('${doc.id}', '${doc.name}')" title="ลบ">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
}

/**
 * Group Statistics Manager Class
 */
class GroupStatisticsManager {
    constructor() {
        this.charts = {};
    }

    /**
     * อัปเดตสถิติในหน้า dashboard
     * @param {Object} statistics - ข้อมูลสถิติ
     */
    updateDashboardStats(statistics) {
        const elements = {
            totalFarmers: document.getElementById('totalFarmers'),
            activeFarmers: document.getElementById('activeFarmers'),
            avgCompletion: document.getElementById('avgDataCompletion'),
            totalPlots: document.getElementById('totalPlots'),
            totalDocuments: document.getElementById('totalDocuments')
        };
        
        Object.keys(elements).forEach(key => {
            if (elements[key] && statistics[key] !== undefined) {
                elements[key].textContent = statistics[key] + (key === 'avgCompletion' ? '%' : '');
            }
        });
    }

    /**
     * สร้างกราฟความคืบหน้าข้อมูล
     * @param {string} canvasId - ID ของ canvas
     * @param {Object} data - ข้อมูลสำหรับกราฟ
     */
    createProgressChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['เสร็จสิ้น', 'กำลังดำเนินการ', 'ยังไม่เริ่ม'],
                datasets: [{
                    data: [
                        data.completed || 0,
                        data.inProgress || 0,
                        data.notStarted || 0
                    ],
                    backgroundColor: ['#28a745', '#ffc107', '#dee2e6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    /**
     * สร้างกราฟแสดงแนวโน้มข้อมูล
     * @param {string} canvasId - ID ของ canvas
     * @param {Object} data - ข้อมูลสำหรับกราฟ
     */
    createTrendChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: 'จำนวนเกษตรกร',
                    data: data.farmerCount || [],
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    tension: 0.4
                }, {
                    label: 'ความสมบูรณ์เฉลี่ย (%)',
                    data: data.avgCompletion || [],
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                        max: 100
                    }
                }
            }
        });
    }
}

// สร้าง instances หลัก
const groupDataManager = new GroupDataManager();
const farmerCardsRenderer = new FarmerCardsRenderer();
const documentManager = new DocumentManager();
const groupStatisticsManager = new GroupStatisticsManager();

/**
 * Helper Functions สำหรับใช้งานทั่วไป
 */

/**
 * เริ่มต้นหน้า dashboard กลุ่ม
 * @param {string} groupId - ID กลุ่ม
 */
async function initializeGroupDashboard(groupId) {
    try {
        // โหลดข้อมูลกลุ่ม
        const groupData = await groupDataManager.loadGroupData(groupId);
        
        // โหลดเกษตรกร
        const farmers = await groupDataManager.loadGroupFarmers(groupId);
        
        // โหลดสถิติ
        const statistics = await groupDataManager.loadGroupStatistics(groupId);
        
        // อัปเดต UI
        updateGroupInfo(groupData);
        groupStatisticsManager.updateDashboardStats(statistics);
        
        return { groupData, farmers, statistics };
        
    } catch (error) {
        console.error('Initialize group dashboard error:', error);
        Utils.showError('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลกลุ่มได้');
    }
}

/**
 * อัปเดตข้อมูลกลุ่มใน UI
 * @param {Object} groupData - ข้อมูลกลุ่ม
 */
function updateGroupInfo(groupData) {
    const elements = {
        groupNameHeader: document.getElementById('groupNameHeader'),
        managerNameHeader: document.getElementById('managerNameHeader'),
        managerPhoneHeader: document.getElementById('managerPhoneHeader')
    };
    
    Object.keys(elements).forEach(key => {
        if (elements[key] && groupData[key.replace('Header', '')]) {
            elements[key].textContent = groupData[key.replace('Header', '')];
        }
    });
}

/**
 * เริ่มต้นระบบจัดการเกษตรกร
 * @param {string} groupId - ID กลุ่ม
 * @param {string} containerId - ID ของ container สำหรับแสดง cards
 */
async function initializeFarmersManagement(groupId, containerId) {
    try {
        const farmers = await groupDataManager.loadGroupFarmers(groupId);
        
        // ตั้งค่า callbacks
        farmerCardsRenderer.setCallbacks({
            onSelectionChange: (selectedIds) => {
                updateBulkActionsVisibility(selectedIds.length > 0);
                updateSelectedCount(selectedIds.length);
            },
            onFarmerAction: (action, farmerId) => {
                if (action === 'view') {
                    showFarmerDetails(farmerId);
                }
            }
        });
        
        // เรนเดอร์ cards
        farmerCardsRenderer.renderFarmerCards(farmers, containerId);
        
        return farmers;
        
    } catch (error) {
        console.error('Initialize farmers management error:', error);
        Utils.showError('ข้อผิดพลาด', 'ไม่สามารถโหลดรายการเกษตรกรได้');
    }
}

/**
 * อัปเดตการแสดงผลของ bulk actions
 * @param {boolean} show - แสดงหรือซ่อน
 */
function updateBulkActionsVisibility(show) {
    const bulkActions = document.getElementById('bulkActions');
    if (bulkActions) {
        if (show) {
            bulkActions.classList.add('show');
        } else {
            bulkActions.classList.remove('show');
        }
    }
}

/**
 * อัปเดตจำนวนรายการที่เลือก
 * @param {number} count - จำนวนรายการที่เลือก
 */
function updateSelectedCount(count) {
    const selectedCount = document.getElementById('selectedCount');
    if (selectedCount) {
        selectedCount.textContent = count;
    }
}

/**
 * ค้นหาและกรองเกษตรกร
 * @param {string} searchTerm - คำค้นหา
 * @param {Object} filters - ตัวกรอง
 * @param {string} sortBy - เรียงตาม
 * @param {string} containerId - ID ของ container
 */
function searchAndFilterFarmers(searchTerm, filters, sortBy, containerId) {
    let filtered = groupDataManager.searchFarmers(searchTerm, filters);
    filtered = groupDataManager.sortFarmers(filtered, sortBy);
    
    farmerCardsRenderer.renderFarmerCards(filtered, containerId);
}

/**
 * ดาวน์โหลดเอกสาร
 * @param {string} url - URL ของเอกสาร
 * @param {string} name - ชื่อไฟล์
 */
function downloadDocument(url, name) {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export สำหรับใช้งานในหน้าอื่น
window.GroupDataManager = GroupDataManager;
window.FarmerCardsRenderer = FarmerCardsRenderer;
window.DocumentManager = DocumentManager;
window.GroupStatisticsManager = GroupStatisticsManager;
window.groupDataManager = groupDataManager;
window.farmerCardsRenderer = farmerCardsRenderer;
window.documentManager = documentManager;
window.groupStatisticsManager = groupStatisticsManager;
window.initializeGroupDashboard = initializeGroupDashboard;
window.initializeFarmersManagement = initializeFarmersManagement;
window.searchAndFilterFarmers = searchAndFilterFarmers;
window.downloadDocument = downloadDocument;