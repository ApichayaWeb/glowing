/**
 * ระบบสอบย้อนกลับผักอุดร - Group Reports JavaScript
 * =======================================================
 * Group Manager specific reporting and analytics
 */

/**
 * Group Reports Manager Class
 */
class GroupReportsManager {
    constructor() {
        this.charts = {};
        this.currentGroupId = this.getCurrentGroupId();
        this.currentFilters = {};
        this.exportManager = new GroupExportManager();
        this.memberData = [];
        this.groupData = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadGroupData();
        this.initializeCharts();
    }

    /**
     * Get current group ID from session or URL
     */
    getCurrentGroupId() {
        // In real implementation, this would come from session or URL params
        return 'group01'; // Mock group ID
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Filter form submission
        const filterForm = document.getElementById('filterForm');
        if (filterForm) {
            filterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.applyFilters();
            });
        }

        // Filter changes
        const filters = ['memberStatusFilter', 'cropTypeFilter'];
        filters.forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => {
                    this.applyFilters();
                });
            }
        });
    }

    /**
     * Apply filters and reload data
     */
    applyFilters() {
        const filters = {
            dateRange: document.getElementById('dateRange')?.value || '',
            memberStatus: document.getElementById('memberStatusFilter')?.value || '',
            cropType: document.getElementById('cropTypeFilter')?.value || ''
        };

        this.currentFilters = filters;
        this.loadGroupData(filters);
    }

    /**
     * Load group data from API
     */
    async loadGroupData(filters = {}) {
        try {
            Utils.showLoading('กำลังโหลดข้อมูลกลุ่ม...');
            
            // Simulate API call with mock data
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Generate mock data based on filters
            this.groupData = this.generateMockGroupData(filters);
            this.memberData = this.generateMockMemberData(filters);
            
            // Update UI components
            this.updateQuickStats();
            this.updateCharts();
            this.updateMemberStatusDashboard();
            this.updateMemberTable();
            this.updateMemberProgressList();
            this.updateRecentActivities();
            
            Utils.hideLoading();
            
        } catch (error) {
            console.error('Error loading group data:', error);
            Utils.hideLoading();
            
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถโหลดข้อมูลกลุ่มได้ กรุณาลองใหม่อีกครั้ง',
                confirmButtonColor: '#198754'
            });
        }
    }

    /**
     * Generate mock group data
     */
    generateMockGroupData(filters = {}) {
        const totalMembers = 24;
        const completedMembers = filters.memberStatus === 'incomplete' ? 0 : 
                                filters.memberStatus === 'not_started' ? 0 : 18;
        const incompleteMembers = filters.memberStatus === 'completed' ? 0 : 
                                 filters.memberStatus === 'not_started' ? 0 : 4;
        const notStartedMembers = filters.memberStatus === 'completed' ? 0 : 
                                 filters.memberStatus === 'incomplete' ? 0 : 2;

        return {
            groupId: this.currentGroupId,
            groupName: 'เกษตรกรผักปลอดภัย',
            totalMembers: totalMembers,
            completedMembers: completedMembers,
            incompleteMembers: incompleteMembers,
            notStartedMembers: notStartedMembers,
            totalQRCodes: 156,
            totalProducts: 89,
            dataCompleteness: {
                completed: Math.round((completedMembers / totalMembers) * 100),
                incomplete: Math.round((incompleteMembers / totalMembers) * 100),
                notStarted: Math.round((notStartedMembers / totalMembers) * 100)
            },
            qrCodesByMonth: [12, 18, 25, 31, 28, 22, 35, 29, 33, 27, 24, 19],
            productExports: [45, 52, 38, 61, 47, 55, 43, 58, 39, 62, 48, 54],
            cropTypes: {
                leafy: 35,
                fruit: 28,
                root: 15,
                herb: 11
            }
        };
    }

    /**
     * Generate mock member data
     */
    generateMockMemberData(filters = {}) {
        const members = [
            { id: 1, name: 'นายสมชาย ใจดี', plotNumber: 'A001', status: 'completed', qrCodes: 8, products: 5, registrationDate: '2024-01-15', progress: 100, cropType: 'leafy' },
            { id: 2, name: 'นางสาวมาลี รักษ์ดี', plotNumber: 'A002', status: 'completed', qrCodes: 6, products: 4, registrationDate: '2024-01-16', progress: 100, cropType: 'fruit' },
            { id: 3, name: 'นายประยุทธ สร้างสุข', plotNumber: 'A003', status: 'incomplete', qrCodes: 3, products: 2, registrationDate: '2024-01-18', progress: 65, cropType: 'leafy' },
            { id: 4, name: 'นางวิมล ทำดี', plotNumber: 'A004', status: 'completed', qrCodes: 7, products: 4, registrationDate: '2024-01-20', progress: 100, cropType: 'herb' },
            { id: 5, name: 'นายธีระ มั่นคง', plotNumber: 'A005', status: 'not_started', qrCodes: 0, products: 0, registrationDate: '2024-02-01', progress: 0, cropType: 'root' },
            { id: 6, name: 'นางสุดา ขยันงาน', plotNumber: 'A006', status: 'completed', qrCodes: 9, products: 6, registrationDate: '2024-01-25', progress: 100, cropType: 'leafy' },
            { id: 7, name: 'นายอนุชา เพียรพยายาม', plotNumber: 'A007', status: 'incomplete', qrCodes: 2, products: 1, registrationDate: '2024-02-05', progress: 45, cropType: 'fruit' },
            { id: 8, name: 'นางปราณี รอบรู้', plotNumber: 'A008', status: 'completed', qrCodes: 5, products: 3, registrationDate: '2024-01-30', progress: 100, cropType: 'herb' }
        ];

        // Apply filters
        return members.filter(member => {
            if (filters.memberStatus && member.status !== filters.memberStatus) return false;
            if (filters.cropType && member.cropType !== filters.cropType) return false;
            return true;
        });
    }

    /**
     * Update quick stats cards
     */
    updateQuickStats() {
        const stats = this.groupData;
        
        // Update stat numbers
        const statElements = {
            totalMembers: stats.totalMembers,
            completedMembers: stats.completedMembers,
            totalQRCodes: stats.totalQRCodes,
            totalProducts: stats.totalProducts
        };

        Object.entries(statElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                this.animateNumber(element, parseInt(element.textContent) || 0, value);
            }
        });
    }

    /**
     * Animate number changes
     */
    animateNumber(element, from, to, duration = 1000) {
        const start = Date.now();
        const update = () => {
            const progress = Math.min((Date.now() - start) / duration, 1);
            const current = Math.round(from + (to - from) * progress);
            element.textContent = current.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        update();
    }

    /**
     * Initialize charts
     */
    initializeCharts() {
        this.initDataCompletenessChart();
        this.initQRCodeChart();
        this.initProductExportChart();
        this.initCropStatsChart();
    }

    /**
     * Update all charts
     */
    updateCharts() {
        this.updateDataCompletenessChart();
        this.updateQRCodeChart();
        this.updateProductExportChart();
        this.updateCropStatsChart();
    }

    /**
     * Initialize Data Completeness Chart
     */
    initDataCompletenessChart() {
        const ctx = document.getElementById('dataCompletenessChart');
        if (!ctx) return;

        this.charts.dataCompleteness = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['กรอกข้อมูลครบ', 'กรอกข้อมูลไม่ครบ', 'ยังไม่เริ่มกรอก'],
                datasets: [{
                    data: [75, 17, 8],
                    backgroundColor: ['#198754', '#ffc107', '#dc3545'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    /**
     * Update Data Completeness Chart
     */
    updateDataCompletenessChart() {
        if (!this.charts.dataCompleteness) return;
        
        const data = this.groupData.dataCompleteness;
        this.charts.dataCompleteness.data.datasets[0].data = [
            data.completed,
            data.incomplete,
            data.notStarted
        ];
        this.charts.dataCompleteness.update();
    }

    /**
     * Initialize QR Code Chart
     */
    initQRCodeChart() {
        const ctx = document.getElementById('qrCodeChart');
        if (!ctx) return;

        this.charts.qrCode = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
                datasets: [{
                    label: 'QR Code ที่สร้าง',
                    data: [12, 18, 25, 31, 28, 22, 35, 29, 33, 27, 24, 19],
                    backgroundColor: '#198754',
                    borderColor: '#198754',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    /**
     * Update QR Code Chart
     */
    updateQRCodeChart() {
        if (!this.charts.qrCode) return;
        
        this.charts.qrCode.data.datasets[0].data = this.groupData.qrCodesByMonth;
        this.charts.qrCode.update();
    }

    /**
     * Initialize Product Export Chart
     */
    initProductExportChart() {
        const ctx = document.getElementById('productExportChart');
        if (!ctx) return;

        this.charts.productExport = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
                datasets: [{
                    label: 'ผลิตภัณฑ์ส่งออก',
                    data: [45, 52, 38, 61, 47, 55, 43, 58, 39, 62, 48, 54],
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#ffc107',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    /**
     * Update Product Export Chart
     */
    updateProductExportChart() {
        if (!this.charts.productExport) return;
        
        this.charts.productExport.data.datasets[0].data = this.groupData.productExports;
        this.charts.productExport.update();
    }

    /**
     * Initialize Crop Stats Chart
     */
    initCropStatsChart() {
        const ctx = document.getElementById('cropStatsChart');
        if (!ctx) return;

        this.charts.cropStats = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['ผักใบ', 'ผักผล', 'ผักราก', 'สมุนไพร'],
                datasets: [{
                    data: [35, 28, 15, 11],
                    backgroundColor: ['#198754', '#0dcaf0', '#fd7e14', '#6f42c1'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + ' ผลิตภัณฑ์';
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Update Crop Stats Chart
     */
    updateCropStatsChart() {
        if (!this.charts.cropStats) return;
        
        const data = this.groupData.cropTypes;
        this.charts.cropStats.data.datasets[0].data = [
            data.leafy,
            data.fruit,
            data.root,
            data.herb
        ];
        this.charts.cropStats.update();
    }

    /**
     * Update Member Status Dashboard
     */
    updateMemberStatusDashboard() {
        const data = this.groupData;
        const total = data.totalMembers;

        // Update counts and percentages
        const updates = [
            {
                countId: 'completedCount',
                progressId: 'completedProgress',
                value: data.completedMembers,
                percentage: Math.round((data.completedMembers / total) * 100)
            },
            {
                countId: 'incompleteCount',
                progressId: 'incompleteProgress',
                value: data.incompleteMembers,
                percentage: Math.round((data.incompleteMembers / total) * 100)
            },
            {
                countId: 'notStartedCount',
                progressId: 'notStartedProgress',
                value: data.notStartedMembers,
                percentage: Math.round((data.notStartedMembers / total) * 100)
            }
        ];

        updates.forEach(update => {
            // Update count
            const countElement = document.getElementById(update.countId);
            if (countElement) {
                countElement.textContent = update.value;
            }

            // Update progress bar
            const progressElement = document.getElementById(update.progressId);
            if (progressElement) {
                progressElement.style.width = update.percentage + '%';
            }

            // Update percentage text
            const statusItem = countElement?.closest('.status-item');
            const percentageText = statusItem?.querySelector('.text-muted');
            if (percentageText) {
                percentageText.textContent = `${update.percentage}% ของสมาชิกทั้งหมด`;
            }
        });
    }

    /**
     * Update member table
     */
    updateMemberTable() {
        const tbody = document.getElementById('membersTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        this.memberData.forEach((member, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="member-avatar bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px; font-size: 14px;">
                            ${member.name.split(' ')[0].charAt(0)}${member.name.split(' ')[1]?.charAt(0) || ''}
                        </div>
                        <div>
                            <div class="fw-medium">${member.name}</div>
                            <small class="text-muted">แปลง ${member.plotNumber}</small>
                        </div>
                    </div>
                </td>
                <td><span class="badge bg-secondary">${member.plotNumber}</span></td>
                <td>${this.getStatusBadge(member.status)}</td>
                <td>
                    <span class="badge bg-info">${member.qrCodes}</span>
                    <small class="text-muted">รายการ</small>
                </td>
                <td>
                    <span class="badge bg-success">${member.products}</span>
                    <small class="text-muted">ผลิตภัณฑ์</small>
                </td>
                <td>${this.formatDate(member.registrationDate)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="viewMemberDetails(${member.id})" title="ดูรายละเอียด">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="exportMemberReport(${member.id})" title="ส่งออกรายงาน">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Update pagination if needed
        this.updatePagination();
    }

    /**
     * Get status badge HTML
     */
    getStatusBadge(status) {
        const badges = {
            completed: '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>ครบถ้วน</span>',
            incomplete: '<span class="badge bg-warning"><i class="fas fa-exclamation-triangle me-1"></i>ไม่ครบ</span>',
            not_started: '<span class="badge bg-danger"><i class="fas fa-times-circle me-1"></i>ยังไม่เริ่ม</span>'
        };
        return badges[status] || badges.not_started;
    }

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Update pagination
     */
    updatePagination() {
        const pagination = document.getElementById('membersPagination');
        if (!pagination) return;

        // Simple pagination for demo
        pagination.innerHTML = `
            <li class="page-item">
                <a class="page-link" href="#" aria-label="Previous">
                    <span aria-hidden="true">&laquo;</span>
                </a>
            </li>
            <li class="page-item active"><a class="page-link" href="#">1</a></li>
            <li class="page-item"><a class="page-link" href="#">2</a></li>
            <li class="page-item"><a class="page-link" href="#">3</a></li>
            <li class="page-item">
                <a class="page-link" href="#" aria-label="Next">
                    <span aria-hidden="true">&raquo;</span>
                </a>
            </li>
        `;
    }

    /**
     * Update member progress list
     */
    updateMemberProgressList() {
        const container = document.getElementById('memberProgressList');
        if (!container) return;

        container.innerHTML = '';

        // Show top 5 members with incomplete progress
        const incompleteMembers = this.memberData
            .filter(member => member.progress < 100)
            .sort((a, b) => b.progress - a.progress)
            .slice(0, 5);

        if (incompleteMembers.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-check-circle fa-2x mb-2 text-success"></i>
                    <p class="mb-0">สมาชิกทุกคนกรอกข้อมูลครบถ้วนแล้ว</p>
                </div>
            `;
            return;
        }

        incompleteMembers.forEach(member => {
            const progressItem = document.createElement('div');
            progressItem.className = 'member-progress-item mb-3';
            progressItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div class="member-info">
                        <div class="fw-medium">${member.name}</div>
                        <small class="text-muted">แปลง ${member.plotNumber}</small>
                    </div>
                    <span class="progress-percentage ${member.progress < 50 ? 'text-danger' : 'text-warning'} fw-bold">
                        ${member.progress}%
                    </span>
                </div>
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar ${member.progress < 50 ? 'bg-danger' : 'bg-warning'}" 
                         style="width: ${member.progress}%"></div>
                </div>
            `;
            container.appendChild(progressItem);
        });
    }

    /**
     * Update recent activities
     */
    updateRecentActivities() {
        const container = document.getElementById('recentActivities');
        if (!container) return;

        const activities = [
            {
                icon: 'fas fa-user-plus text-success',
                text: 'นายสมชาย ใจดี เพิ่มผลิตภัณฑ์ใหม่',
                time: '2 ชั่วโมงที่แล้ว'
            },
            {
                icon: 'fas fa-qrcode text-primary',
                text: 'นางมาลี รักษ์ดี สร้าง QR Code',
                time: '4 ชั่วโมงที่แล้ว'
            },
            {
                icon: 'fas fa-edit text-warning',
                text: 'นายประยุทธ สร้างสุข อัปเดตข้อมูล',
                time: '6 ชั่วโมงที่แล้ว'
            },
            {
                icon: 'fas fa-upload text-info',
                text: 'นางวิมล ทำดี อัปโหลดใบรับรอง',
                time: '8 ชั่วโมงที่แล้ว'
            },
            {
                icon: 'fas fa-check-circle text-success',
                text: 'นายธีระ มั่นคง ลงทะเบียนเสร็จสิ้น',
                time: '1 วันที่แล้ว'
            }
        ];

        container.innerHTML = '';

        activities.forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item d-flex align-items-start mb-3';
            activityItem.innerHTML = `
                <div class="activity-icon me-3">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content flex-grow-1">
                    <div class="activity-text">${activity.text}</div>
                    <small class="text-muted">${activity.time}</small>
                </div>
            `;
            container.appendChild(activityItem);
        });
    }
}

/**
 * Group Export Manager Class
 */
class GroupExportManager {
    constructor() {
        this.groupData = null;
        this.memberData = null;
    }

    /**
     * Set data for export
     */
    setData(groupData, memberData) {
        this.groupData = groupData;
        this.memberData = memberData;
    }

    /**
     * Export member data in specified format
     */
    exportMemberData(format) {
        if (!this.memberData) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่มีข้อมูล',
                text: 'ไม่พบข้อมูลสมาชิกสำหรับส่งออก',
                confirmButtonColor: '#198754'
            });
            return;
        }

        switch (format) {
            case 'pdf':
                this.exportMemberPDF();
                break;
            case 'excel':
                this.exportMemberExcel();
                break;
            case 'csv':
                this.exportMemberCSV();
                break;
            default:
                console.error('Unsupported export format:', format);
        }
    }

    /**
     * Export member data as PDF
     */
    exportMemberPDF() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Add Thai font support (simplified)
            doc.setFont('helvetica');
            
            // Title
            doc.setFontSize(18);
            doc.text('รายชื่อสมาชิกกลุ่มเกษตรกร', 20, 20);
            
            // Group info
            doc.setFontSize(12);
            doc.text(`กลุ่ม: ${this.groupData?.groupName || 'ไม่ระบุ'}`, 20, 35);
            doc.text(`วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}`, 20, 45);
            
            // Table headers
            const headers = ['ลำดับ', 'ชื่อ-นามสกุล', 'แปลงที่', 'สถานะ', 'QR Code', 'ผลิตภัณฑ์'];
            let y = 65;
            
            doc.setFontSize(10);
            headers.forEach((header, index) => {
                doc.text(header, 20 + (index * 30), y);
            });
            
            // Table data
            y += 10;
            this.memberData.forEach((member, index) => {
                const row = [
                    (index + 1).toString(),
                    member.name,
                    member.plotNumber,
                    this.getStatusText(member.status),
                    member.qrCodes.toString(),
                    member.products.toString()
                ];
                
                row.forEach((cell, cellIndex) => {
                    doc.text(cell, 20 + (cellIndex * 30), y);
                });
                y += 8;
                
                // Add new page if needed
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
            });
            
            // Save PDF
            doc.save(`รายชื่อสมาชิก_${this.groupData?.groupId || 'group'}.pdf`);
            
            this.showExportSuccess('PDF');
            
        } catch (error) {
            console.error('PDF export error:', error);
            this.showExportError();
        }
    }

    /**
     * Export member data as Excel
     */
    exportMemberExcel() {
        try {
            const XLSX = window.XLSX;
            
            // Prepare data
            const data = [
                ['รายชื่อสมาชิกกลุ่มเกษตรกร'],
                [`กลุ่ม: ${this.groupData?.groupName || 'ไม่ระบุ'}`],
                [`วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}`],
                [],
                ['ลำดับ', 'ชื่อ-นามสกุล', 'แปลงที่', 'สถานะ', 'QR Code', 'ผลิตภัณฑ์', 'วันที่ลงทะเบียน']
            ];
            
            // Add member data
            this.memberData.forEach((member, index) => {
                data.push([
                    index + 1,
                    member.name,
                    member.plotNumber,
                    this.getStatusText(member.status),
                    member.qrCodes,
                    member.products,
                    member.registrationDate
                ]);
            });
            
            // Create worksheet
            const ws = XLSX.utils.aoa_to_sheet(data);
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'สมาชิกกลุ่ม');
            
            // Save Excel file
            XLSX.writeFile(wb, `รายชื่อสมาชิก_${this.groupData?.groupId || 'group'}.xlsx`);
            
            this.showExportSuccess('Excel');
            
        } catch (error) {
            console.error('Excel export error:', error);
            this.showExportError();
        }
    }

    /**
     * Export member data as CSV
     */
    exportMemberCSV() {
        try {
            const headers = ['ลำดับ', 'ชื่อ-นามสกุล', 'แปลงที่', 'สถานะ', 'QR Code', 'ผลิตภัณฑ์', 'วันที่ลงทะเบียน'];
            
            let csvContent = '\uFEFF'; // BOM for UTF-8
            csvContent += headers.join(',') + '\n';
            
            this.memberData.forEach((member, index) => {
                const row = [
                    index + 1,
                    `"${member.name}"`,
                    member.plotNumber,
                    `"${this.getStatusText(member.status)}"`,
                    member.qrCodes,
                    member.products,
                    member.registrationDate
                ];
                csvContent += row.join(',') + '\n';
            });
            
            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `รายชื่อสมาชิก_${this.groupData?.groupId || 'group'}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showExportSuccess('CSV');
            
        } catch (error) {
            console.error('CSV export error:', error);
            this.showExportError();
        }
    }

    /**
     * Execute group export based on modal form
     */
    executeGroupExport() {
        const exportType = document.querySelector('input[name="exportType"]:checked')?.value;
        const sections = Array.from(document.querySelectorAll('.report-sections input:checked'))
                             .map(input => input.value);

        if (!exportType) {
            Swal.fire({
                icon: 'warning',
                title: 'กรุณาเลือกประเภทการส่งออก',
                confirmButtonColor: '#198754'
            });
            return;
        }

        // Show loading
        const exportBtn = document.querySelector('[onclick="executeGroupExport()"]');
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังส่งออก...';
        }

        // Simulate export process
        setTimeout(() => {
            this.performGroupExport(exportType, sections);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('exportModal'));
            if (modal) {
                modal.hide();
            }
            
            // Reset button
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.innerHTML = '<i class="fas fa-download me-2"></i>ส่งออก';
            }
        }, 2000);
    }

    /**
     * Perform group export
     */
    performGroupExport(format, sections) {
        switch (format) {
            case 'pdf':
                this.exportGroupPDF(sections);
                break;
            case 'excel':
                this.exportGroupExcel(sections);
                break;
            case 'csv':
                this.exportGroupCSV(sections);
                break;
            default:
                this.showExportError();
        }
    }

    /**
     * Export group report as PDF
     */
    exportGroupPDF(sections) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Title page
            doc.setFontSize(20);
            doc.text('รายงานกลุ่มเกษตรกร', 20, 30);
            
            doc.setFontSize(14);
            doc.text(`กลุ่ม: ${this.groupData?.groupName || 'ไม่ระบุ'}`, 20, 50);
            doc.text(`วันที่ออกรายงาน: ${new Date().toLocaleDateString('th-TH')}`, 20, 65);

            let y = 90;

            // Add sections based on selection
            if (sections.includes('overview')) {
                doc.setFontSize(16);
                doc.text('ภาพรวมกลุ่ม', 20, y);
                y += 20;
                
                doc.setFontSize(12);
                doc.text(`จำนวนสมาชิกทั้งหมด: ${this.groupData?.totalMembers || 0}`, 25, y);
                y += 10;
                doc.text(`สมาชิกที่กรอกข้อมูลครบ: ${this.groupData?.completedMembers || 0}`, 25, y);
                y += 10;
                doc.text(`QR Code ที่สร้างแล้ว: ${this.groupData?.totalQRCodes || 0}`, 25, y);
                y += 10;
                doc.text(`ผลิตภัณฑ์ที่ลงทะเบียน: ${this.groupData?.totalProducts || 0}`, 25, y);
                y += 20;
            }

            if (sections.includes('members') && this.memberData) {
                if (y > 200) {
                    doc.addPage();
                    y = 20;
                }
                
                doc.setFontSize(16);
                doc.text('รายชื่อสมาชิก', 20, y);
                y += 20;
                
                this.memberData.forEach((member, index) => {
                    if (y > 270) {
                        doc.addPage();
                        y = 20;
                    }
                    
                    doc.setFontSize(12);
                    doc.text(`${index + 1}. ${member.name} (${member.plotNumber})`, 25, y);
                    y += 8;
                });
            }

            doc.save(`รายงานกลุ่ม_${this.groupData?.groupId || 'group'}.pdf`);
            this.showExportSuccess('PDF');
            
        } catch (error) {
            console.error('Group PDF export error:', error);
            this.showExportError();
        }
    }

    /**
     * Export group report as Excel
     */
    exportGroupExcel(sections) {
        try {
            const XLSX = window.XLSX;
            const wb = XLSX.utils.book_new();

            // Overview sheet
            if (sections.includes('overview')) {
                const overviewData = [
                    ['รายงานกลุ่มเกษตรกร'],
                    [`กลุ่ม: ${this.groupData?.groupName || 'ไม่ระบุ'}`],
                    [`วันที่: ${new Date().toLocaleDateString('th-TH')}`],
                    [],
                    ['รายการ', 'จำนวน'],
                    ['สมาชิกทั้งหมด', this.groupData?.totalMembers || 0],
                    ['กรอกข้อมูลครบ', this.groupData?.completedMembers || 0],
                    ['QR Code', this.groupData?.totalQRCodes || 0],
                    ['ผลิตภัณฑ์', this.groupData?.totalProducts || 0]
                ];
                
                const ws = XLSX.utils.aoa_to_sheet(overviewData);
                XLSX.utils.book_append_sheet(wb, ws, 'ภาพรวม');
            }

            // Members sheet
            if (sections.includes('members') && this.memberData) {
                const memberData = [
                    ['ลำดับ', 'ชื่อ-นามสกุล', 'แปลงที่', 'สถานะ', 'QR Code', 'ผลิตภัณฑ์', 'วันที่ลงทะเบียน']
                ];
                
                this.memberData.forEach((member, index) => {
                    memberData.push([
                        index + 1,
                        member.name,
                        member.plotNumber,
                        this.getStatusText(member.status),
                        member.qrCodes,
                        member.products,
                        member.registrationDate
                    ]);
                });
                
                const ws = XLSX.utils.aoa_to_sheet(memberData);
                XLSX.utils.book_append_sheet(wb, ws, 'สมาชิก');
            }

            XLSX.writeFile(wb, `รายงานกลุ่ม_${this.groupData?.groupId || 'group'}.xlsx`);
            this.showExportSuccess('Excel');
            
        } catch (error) {
            console.error('Group Excel export error:', error);
            this.showExportError();
        }
    }

    /**
     * Export group report as CSV
     */
    exportGroupCSV(sections) {
        try {
            // Export members list as CSV
            if (sections.includes('members') && this.memberData) {
                this.exportMemberCSV();
            } else {
                Swal.fire({
                    icon: 'info',
                    title: 'CSV Export',
                    text: 'การส่งออก CSV รองรับเฉพาะรายชื่อสมาชิก',
                    confirmButtonColor: '#198754'
                });
            }
        } catch (error) {
            console.error('Group CSV export error:', error);
            this.showExportError();
        }
    }

    /**
     * Get status text
     */
    getStatusText(status) {
        const statusMap = {
            completed: 'กรอกข้อมูลครบ',
            incomplete: 'กรอกข้อมูลไม่ครบ',
            not_started: 'ยังไม่เริ่มกรอก'
        };
        return statusMap[status] || 'ไม่ระบุ';
    }

    /**
     * Show export success message
     */
    showExportSuccess(format) {
        Swal.fire({
            icon: 'success',
            title: 'ส่งออกสำเร็จ',
            text: `ส่งออกไฟล์ ${format} เรียบร้อยแล้ว`,
            confirmButtonColor: '#198754'
        });
    }

    /**
     * Show export error message
     */
    showExportError() {
        Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: 'ไม่สามารถส่งออกไฟล์ได้ กรุณาลองใหม่อีกครั้ง',
            confirmButtonColor: '#198754'
        });
    }
}

// Global functions for button onclick events
function viewMemberDetails(memberId) {
    Swal.fire({
        icon: 'info',
        title: 'ดูรายละเอียดสมาชิก',
        text: `รายละเอียดสมาชิก ID: ${memberId}`,
        confirmButtonColor: '#198754'
    });
}

function exportMemberReport(memberId) {
    Swal.fire({
        icon: 'info',
        title: 'ส่งออกรายงานสมาชิก',
        text: `ส่งออกรายงานสมาชิก ID: ${memberId}`,
        confirmButtonColor: '#198754'
    });
}

// Export functions for global access
window.exportMemberData = function(format) {
    if (window.groupReportsManager && window.groupReportsManager.exportManager) {
        window.groupReportsManager.exportManager.setData(
            window.groupReportsManager.groupData,
            window.groupReportsManager.memberData
        );
        window.groupReportsManager.exportManager.exportMemberData(format);
    }
};

window.executeGroupExport = function() {
    if (window.groupReportsManager && window.groupReportsManager.exportManager) {
        window.groupReportsManager.exportManager.setData(
            window.groupReportsManager.groupData,
            window.groupReportsManager.memberData
        );
        window.groupReportsManager.exportManager.executeGroupExport();
    }
};