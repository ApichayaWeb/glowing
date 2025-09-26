/**
 * ระบบสอบย้อนกลับผักอุดร - Admin Reports JavaScript
 * ======================================================
 * Chart management, data visualization, and export functions
 */

/**
 * Chart Manager Class
 */
class ReportsManager {
    constructor() {
        this.charts = {};
        this.currentReportType = 'system';
        this.currentFilters = {};
        this.exportManager = new ExportManager();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadMockData();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Report category selection
        document.querySelectorAll('.report-category-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectReportCategory(card.dataset.report);
            });
        });

        // Filter form submission
        const filterForm = document.getElementById('filterForm');
        if (filterForm) {
            filterForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.applyFilters();
            });
        }

        // Export type selection
        document.querySelectorAll('input[name="exportType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleEmailOptions(e.target.value === 'email');
            });
        });
    }

    /**
     * Select report category
     */
    selectReportCategory(reportType) {
        // Update active state
        document.querySelectorAll('.report-category-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-report="${reportType}"]`).classList.add('active');

        this.currentReportType = reportType;
        this.loadReportData(reportType);
    }

    /**
     * Apply filters
     */
    applyFilters() {
        const filters = {
            dateRange: document.getElementById('dateRange').value,
            groupFilter: document.getElementById('groupFilter').value,
            statusFilter: document.getElementById('statusFilter').value,
            cropFilter: document.getElementById('cropFilter').value
        };

        this.currentFilters = filters;
        this.loadReportData(this.currentReportType, filters);
    }

    /**
     * Load report data
     */
    async loadReportData(reportType, filters = {}) {
        try {
            Utils.showLoading('กำลังโหลดข้อมูลรายงาน...');
            
            // Simulate API call with mock data
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const data = this.getMockDataForReport(reportType, filters);
            
            this.updateCharts(data);
            this.updateTable(data.tableData);
            this.updateQuickStats(data.stats);
            this.updateRecentActivity(data.activity);
            this.updateTopGroups(data.topGroups);
            
            Utils.hideLoading();
            
        } catch (error) {
            console.error('Error loading report data:', error);
            Utils.hideLoading();
            Utils.showError('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลรายงานได้');
        }
    }

    /**
     * Load mock data
     */
    loadMockData() {
        const mockData = this.getMockDataForReport('system');
        this.updateQuickStats(mockData.stats);
        this.updateRecentActivity(mockData.activity);
        this.updateTopGroups(mockData.topGroups);
    }

    /**
     * Get mock data for report type
     */
    getMockDataForReport(reportType, filters = {}) {
        const baseData = {
            stats: {
                totalGroups: 12,
                totalFarmers: 248,
                totalQRCodes: 186,
                totalScans: 1245
            },
            activity: [
                {
                    type: 'scan',
                    description: 'สแกน QR Code โดย นายสมชาย ใจดี',
                    time: '2 นาทีที่แล้ว',
                    icon: 'fas fa-qrcode',
                    color: 'text-primary'
                },
                {
                    type: 'farmer_add',
                    description: 'เพิ่มเกษตรกรใหม่ในกลุ่มที่ 3',
                    time: '15 นาทีที่แล้ว',
                    icon: 'fas fa-user-plus',
                    color: 'text-success'
                },
                {
                    type: 'qr_generate',
                    description: 'สร้าง QR Code สำหรับแปลงที่ 045',
                    time: '1 ชั่วโมงที่แล้ว',
                    icon: 'fas fa-plus-circle',
                    color: 'text-info'
                },
                {
                    type: 'login',
                    description: 'ผู้จัดการกลุ่มที่ 2 เข้าสู่ระบบ',
                    time: '2 ชั่วโมงที่แล้ว',
                    icon: 'fas fa-sign-in-alt',
                    color: 'text-secondary'
                }
            ],
            topGroups: [
                {
                    name: 'กลุ่มเกษตรกรผักปลอดภัย',
                    code: '01',
                    farmers: 32,
                    scans: 156,
                    percentage: 85
                },
                {
                    name: 'กลุ่มเกษตรกรอินทรีย์',
                    code: '02',
                    farmers: 28,
                    scans: 134,
                    percentage: 78
                },
                {
                    name: 'กลุ่มเกษตรกรเศรษฐกิจพอเพียง',
                    code: '03',
                    farmers: 24,
                    scans: 98,
                    percentage: 65
                }
            ],
            tableData: [
                {
                    id: 1,
                    groupName: 'กลุ่มเกษตรกรผักปลอดภัย',
                    farmers: 32,
                    qrCodes: 28,
                    scans: 156,
                    status: 'active',
                    created: '2024-01-15'
                },
                {
                    id: 2,
                    groupName: 'กลุ่มเกษตรกรอินทรีย์',
                    farmers: 28,
                    qrCodes: 25,
                    scans: 134,
                    status: 'active',
                    created: '2024-01-20'
                },
                {
                    id: 3,
                    groupName: 'กลุ่มเกษตรกรเศรษฐกิจพอเพียง',
                    farmers: 24,
                    qrCodes: 20,
                    scans: 98,
                    status: 'active',
                    created: '2024-02-01'
                }
            ]
        };

        // Modify data based on report type
        switch (reportType) {
            case 'groups':
                baseData.chartData = this.getGroupsChartData();
                break;
            case 'farmers':
                baseData.chartData = this.getFarmersChartData();
                break;
            case 'qrcodes':
                baseData.chartData = this.getQRCodesChartData();
                break;
            case 'usage':
                baseData.chartData = this.getUsageChartData();
                break;
            case 'scans':
                baseData.chartData = this.getScansChartData();
                break;
            default:
                baseData.chartData = this.getSystemChartData();
        }

        return baseData;
    }

    /**
     * Get chart data for different report types
     */
    getSystemChartData() {
        return {
            groups: {
                labels: ['กลุ่มที่ 1', 'กลุ่มที่ 2', 'กลุ่มที่ 3', 'กลุ่มที่ 4', 'กลุ่มที่ 5'],
                data: [32, 28, 24, 18, 15]
            },
            growth: {
                labels: ['มค', 'กพ', 'มีค', 'เมย', 'พค', 'มิย'],
                data: [10, 15, 25, 35, 42, 48]
            },
            cropTypes: {
                labels: ['ผักใบ', 'ผักผล', 'ผักราก', 'สมุนไพร'],
                data: [40, 30, 20, 10]
            },
            scanStats: {
                labels: ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'],
                data: [45, 52, 38, 62, 48, 35, 28]
            }
        };
    }

    getGroupsChartData() {
        return {
            groups: {
                labels: ['เปิดใช้งาน', 'ปิดใช้งาน', 'รอการอนุมัติ'],
                data: [12, 2, 3]
            },
            growth: {
                labels: ['มค', 'กพ', 'มีค', 'เมย', 'พค', 'มิย'],
                data: [8, 10, 12, 12, 12, 12]
            },
            cropTypes: {
                labels: ['GAP', 'อินทรีย์', 'ปลอดภัย', 'ทั่วไป'],
                data: [35, 25, 30, 10]
            },
            scanStats: {
                labels: ['กลุ่มที่ 1', 'กลุ่มที่ 2', 'กลุ่มที่ 3', 'กลุ่มที่ 4'],
                data: [156, 134, 98, 87]
            }
        };
    }

    getFarmersChartData() {
        return {
            groups: {
                labels: ['ใหม่', 'ปกติ', 'ไม่ใช้งาน'],
                data: [45, 180, 23]
            },
            growth: {
                labels: ['มค', 'กพ', 'มีค', 'เมย', 'พค', 'มิย'],
                data: [150, 170, 190, 220, 235, 248]
            },
            cropTypes: {
                labels: ['ผักใบเขียว', 'ผักสลัด', 'ผักจีน', 'สมุนไพร'],
                data: [85, 62, 48, 33]
            },
            scanStats: {
                labels: ['< 18 ปี', '18-35 ปี', '36-50 ปี', '> 50 ปี'],
                data: [12, 78, 105, 53]
            }
        };
    }

    getQRCodesChartData() {
        return {
            groups: {
                labels: ['ใช้งานแล้ว', 'ยังไม่ใช้', 'หมดอายุ'],
                data: [156, 30, 8]
            },
            growth: {
                labels: ['มค', 'กพ', 'มีค', 'เมย', 'พค', 'มิย'],
                data: [45, 78, 102, 134, 156, 186]
            },
            cropTypes: {
                labels: ['QR แปลงปลูก', 'QR ผลิตภัณฑ์', 'QR ใบรับรอง'],
                data: [60, 35, 5]
            },
            scanStats: {
                labels: ['สัปดาห์ 1', 'สัปดาห์ 2', 'สัปดาห์ 3', 'สัปดาห์ 4'],
                data: [245, 312, 278, 356]
            }
        };
    }

    getUsageChartData() {
        return {
            groups: {
                labels: ['ผู้ดูแลระบบ', 'ผู้จัดการกลุ่ม', 'เกษตรกร', 'ผู้บริโภค'],
                data: [5, 12, 248, 1547]
            },
            growth: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                data: [23, 12, 45, 67, 89, 56]
            },
            cropTypes: {
                labels: ['เว็บไซต์', 'มือถือ', 'แท็บเล็ต'],
                data: [45, 85, 15]
            },
            scanStats: {
                labels: ['เข้าสู่ระบบ', 'เพิ่มข้อมูล', 'สแกน QR', 'ดาวน์โหลด'],
                data: [456, 123, 789, 234]
            }
        };
    }

    getScansChartData() {
        return {
            groups: {
                labels: ['สำเร็จ', 'ล้มเหลว', 'ข้อมูลไม่พบ'],
                data: [1125, 85, 35]
            },
            growth: {
                labels: ['มค', 'กพ', 'มีค', 'เมย', 'พค', 'มิย'],
                data: [156, 234, 345, 456, 678, 789]
            },
            cropTypes: {
                labels: ['แอปมือถือ', 'เว็บไซต์', 'QR Reader'],
                data: [70, 25, 5]
            },
            scanStats: {
                labels: ['เช้า', 'สาย', 'บ่าย', 'เย็น', 'ค่ำ'],
                data: [145, 234, 189, 267, 156]
            }
        };
    }

    /**
     * Update charts with new data
     */
    updateCharts(data) {
        if (data.chartData) {
            this.updateGroupsChart(data.chartData.groups);
            this.updateGrowthChart(data.chartData.growth);
            this.updateCropTypesChart(data.chartData.cropTypes);
            this.updateScanStatsChart(data.chartData.scanStats);
        }
    }

    /**
     * Update individual charts
     */
    updateGroupsChart(data) {
        const ctx = document.getElementById('groupsChart');
        if (!ctx) return;

        if (this.charts.groupsChart) {
            this.charts.groupsChart.destroy();
        }

        this.charts.groupsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'จำนวน',
                    data: data.data,
                    backgroundColor: [
                        'rgba(25, 135, 84, 0.8)',
                        'rgba(13, 110, 253, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(220, 53, 69, 0.8)',
                        'rgba(111, 66, 193, 0.8)'
                    ],
                    borderColor: [
                        'rgba(25, 135, 84, 1)',
                        'rgba(13, 110, 253, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(220, 53, 69, 1)',
                        'rgba(111, 66, 193, 1)'
                    ],
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            stepSize: 5
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

    updateGrowthChart(data) {
        const ctx = document.getElementById('growthChart');
        if (!ctx) return;

        if (this.charts.growthChart) {
            this.charts.growthChart.destroy();
        }

        this.charts.growthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'การเติบโต',
                    data: data.data,
                    borderColor: 'rgba(25, 135, 84, 1)',
                    backgroundColor: 'rgba(25, 135, 84, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgba(25, 135, 84, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
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

    updateCropTypesChart(data) {
        const ctx = document.getElementById('cropTypesChart');
        if (!ctx) return;

        if (this.charts.cropTypesChart) {
            this.charts.cropTypesChart.destroy();
        }

        this.charts.cropTypesChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.data,
                    backgroundColor: [
                        'rgba(25, 135, 84, 0.8)',
                        'rgba(13, 110, 253, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(220, 53, 69, 0.8)'
                    ],
                    borderColor: [
                        'rgba(25, 135, 84, 1)',
                        'rgba(13, 110, 253, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(220, 53, 69, 1)'
                    ],
                    borderWidth: 2,
                    hoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    updateScanStatsChart(data) {
        const ctx = document.getElementById('scanStatsChart');
        if (!ctx) return;

        if (this.charts.scanStatsChart) {
            this.charts.scanStatsChart.destroy();
        }

        this.charts.scanStatsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'จำนวนการสแกน',
                    data: data.data,
                    backgroundColor: 'rgba(13, 110, 253, 0.8)',
                    borderColor: 'rgba(13, 110, 253, 1)',
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
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
     * Update data table
     */
    updateTable(tableData) {
        const tbody = document.getElementById('reportTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        tableData.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${row.groupName}</td>
                <td>${row.farmers}</td>
                <td>${row.qrCodes}</td>
                <td>${row.scans}</td>
                <td>
                    <span class="badge ${row.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                        ${row.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                </td>
                <td>${Utils.formatDate(row.created)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="viewDetails(${row.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="exportRow(${row.id})">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        this.updatePagination(tableData.length);
    }

    /**
     * Update pagination
     */
    updatePagination(totalItems, currentPage = 1, itemsPerPage = 10) {
        const pagination = document.getElementById('tablePagination');
        if (!pagination) return;

        const totalPages = Math.ceil(totalItems / itemsPerPage);
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // Previous button
        paginationHTML += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === currentPage) {
                paginationHTML += `
                    <li class="page-item active">
                        <span class="page-link">${i}</span>
                    </li>
                `;
            } else if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                paginationHTML += `
                    <li class="page-item">
                        <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
                    </li>
                `;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                paginationHTML += `
                    <li class="page-item disabled">
                        <span class="page-link">...</span>
                    </li>
                `;
            }
        }

        // Next button
        paginationHTML += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;

        pagination.innerHTML = paginationHTML;
    }

    /**
     * Update quick stats
     */
    updateQuickStats(stats) {
        const elements = {
            totalGroups: document.getElementById('totalGroups'),
            totalFarmers: document.getElementById('totalFarmers'),
            totalQRCodes: document.getElementById('totalQRCodes'),
            totalScans: document.getElementById('totalScans')
        };

        Object.keys(elements).forEach(key => {
            if (elements[key]) {
                this.animateNumber(elements[key], stats[key]);
            }
        });
    }

    /**
     * Animate number counter
     */
    animateNumber(element, targetValue) {
        const startValue = parseInt(element.textContent.replace(/,/g, '')) || 0;
        const duration = 1000;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
            element.textContent = currentValue.toLocaleString();

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Update recent activity
     */
    updateRecentActivity(activities) {
        const container = document.getElementById('recentActivity');
        if (!container) return;

        container.innerHTML = '';

        activities.forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item d-flex align-items-center mb-3';
            activityItem.innerHTML = `
                <div class="activity-icon me-3">
                    <i class="${activity.icon} ${activity.color}"></i>
                </div>
                <div class="activity-content flex-grow-1">
                    <div class="activity-description">${activity.description}</div>
                    <small class="text-muted">${activity.time}</small>
                </div>
            `;
            container.appendChild(activityItem);
        });
    }

    /**
     * Update top groups
     */
    updateTopGroups(groups) {
        const container = document.getElementById('topGroups');
        if (!container) return;

        container.innerHTML = '';

        groups.forEach((group, index) => {
            const groupItem = document.createElement('div');
            groupItem.className = 'top-group-item mb-3';
            groupItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div class="group-info">
                        <strong>${group.name}</strong>
                        <small class="text-muted d-block">${group.farmers} เกษตรกร • ${group.scans} การสแกน</small>
                    </div>
                    <span class="badge bg-primary">#${index + 1}</span>
                </div>
                <div class="progress" style="height: 6px;">
                    <div class="progress-bar bg-success" style="width: ${group.percentage}%"></div>
                </div>
                <small class="text-muted">${group.percentage}% ประสิทธิภาพ</small>
            `;
            container.appendChild(groupItem);
        });
    }

    /**
     * Toggle email options
     */
    toggleEmailOptions(show) {
        const emailOptions = document.getElementById('emailOptions');
        if (emailOptions) {
            emailOptions.style.display = show ? 'block' : 'none';
        }
    }
}

/**
 * Export Manager Class
 */
class ExportManager {
    constructor() {
        this.currentData = null;
    }

    /**
     * Execute export based on selected type
     */
    async executeExport() {
        const exportType = document.querySelector('input[name="exportType"]:checked').value;
        const selectedSections = this.getSelectedSections();

        try {
            Utils.showLoading('กำลังสร้างรายงาน...');

            switch (exportType) {
                case 'pdf':
                    await this.exportToPDF(selectedSections);
                    break;
                case 'excel':
                    await this.exportToExcel(selectedSections);
                    break;
                case 'csv':
                    await this.exportToCSV(selectedSections);
                    break;
                case 'email':
                    await this.sendByEmail(selectedSections);
                    break;
            }

            Utils.hideLoading();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('exportModal'));
            if (modal) modal.hide();

            // Show success message
            Swal.fire({
                icon: 'success',
                title: 'ส่งออกสำเร็จ',
                text: 'รายงานถูกส่งออกเรียบร้อยแล้ว',
                confirmButtonColor: '#198754'
            });

        } catch (error) {
            console.error('Export error:', error);
            Utils.hideLoading();
            Utils.showError('เกิดข้อผิดพลาด', 'ไม่สามารถส่งออกรายงานได้');
        }
    }

    /**
     * Get selected report sections
     */
    getSelectedSections() {
        const sections = [];
        document.querySelectorAll('.report-sections input[type="checkbox"]:checked').forEach(checkbox => {
            sections.push(checkbox.value);
        });
        return sections;
    }

    /**
     * Export to PDF
     */
    async exportToPDF(sections) {
        if (typeof jsPDF === 'undefined') {
            throw new Error('jsPDF library not loaded');
        }

        // Simulate PDF generation
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Add content to PDF
        doc.setFontSize(20);
        doc.text('รายงานระบบสอบย้อนกลับผักอุดร', 20, 30);

        doc.setFontSize(12);
        doc.text(`วันที่สร้างรายงาน: ${new Date().toLocaleDateString('th-TH')}`, 20, 50);

        let yPosition = 70;

        sections.forEach(section => {
            doc.setFontSize(16);
            doc.text(this.getSectionTitle(section), 20, yPosition);
            yPosition += 20;

            doc.setFontSize(12);
            doc.text('ข้อมูลตัวอย่างสำหรับ ' + this.getSectionTitle(section), 20, yPosition);
            yPosition += 30;
        });

        // Save PDF
        doc.save('รายงานระบบสอบย้อนกลับผักอุดร.pdf');
    }

    /**
     * Export to Excel
     */
    async exportToExcel(sections) {
        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded');
        }

        // Simulate Excel generation
        await new Promise(resolve => setTimeout(resolve, 2000));

        const workbook = XLSX.utils.book_new();

        sections.forEach(section => {
            const data = this.getSectionData(section);
            const worksheet = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, this.getSectionTitle(section));
        });

        // Save Excel file
        XLSX.writeFile(workbook, 'รายงานระบบสอบย้อนกลับผักอุดร.xlsx');
    }

    /**
     * Export to CSV
     */
    async exportToCSV(sections) {
        // Simulate CSV generation
        await new Promise(resolve => setTimeout(resolve, 1500));

        sections.forEach(section => {
            const data = this.getSectionData(section);
            const csv = this.convertToCSV(data);
            this.downloadCSV(csv, `${this.getSectionTitle(section)}.csv`);
        });
    }

    /**
     * Send by email
     */
    async sendByEmail(sections) {
        const recipientEmail = document.getElementById('recipientEmail').value;
        const emailSubject = document.getElementById('emailSubject').value;
        const emailMessage = document.getElementById('emailMessage').value;

        if (!recipientEmail) {
            throw new Error('กรุณาระบุอีเมลผู้รับ');
        }

        // Simulate email sending
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('Sending email to:', recipientEmail);
        console.log('Subject:', emailSubject);
        console.log('Message:', emailMessage);
        console.log('Sections:', sections);

        // In real implementation, this would call an API to send email
    }

    /**
     * Get section title
     */
    getSectionTitle(section) {
        const titles = {
            overview: 'ภาพรวมระบบ',
            groups: 'ข้อมูลกลุ่มเกษตรกร',
            farmers: 'ข้อมูลเกษตรกร',
            qrcodes: 'สถิติ QR Code',
            analytics: 'การวิเคราะห์'
        };
        return titles[section] || section;
    }

    /**
     * Get section data
     */
    getSectionData(section) {
        // Mock data for different sections
        const mockData = {
            overview: [
                { รายการ: 'กลุ่มเกษตรกร', จำนวน: 12 },
                { รายการ: 'เกษตรกร', จำนวน: 248 },
                { รายการ: 'QR Codes', จำนวน: 186 },
                { รายการ: 'การสแกน', จำนวน: 1245 }
            ],
            groups: [
                { รหัส: '01', ชื่อกลุ่ม: 'เกษตรกรผักปลอดภัย', เกษตรกร: 32, QRCode: 28, การสแกน: 156 },
                { รหัส: '02', ชื่อกลุ่ม: 'เกษตรกรอินทรีย์', เกษตรกร: 28, QRCode: 25, การสแกน: 134 },
                { รหัส: '03', ชื่อกลุ่ม: 'เกษตรกรเศรษฐกิจพอเพียง', เกษตรกร: 24, QRCode: 20, การสแกน: 98 }
            ],
            farmers: [
                { ชื่อ: 'นายสมชาย ใจดี', กลุ่ม: '01', แปลง: '01001', โทรศัพท์: '081-234-5678' },
                { ชื่อ: 'นางสมศรี ใจงาม', กลุ่ม: '01', แปลง: '01002', โทรศัพท์: '081-234-5679' },
                { ชื่อ: 'นายสมปอง ดีใจ', กลุ่ม: '02', แปลง: '02001', โทรศัพท์: '081-234-5680' }
            ],
            qrcodes: [
                { รหัส: '01-001', กลุ่ม: '01', แปลง: '01001', สถานะ: 'ใช้งาน', การสแกน: 45 },
                { รหัส: '01-002', กลุ่ม: '01', แปลง: '01002', สถานะ: 'ใช้งาน', การสแกน: 38 },
                { รหัส: '02-001', กลุ่ม: '02', แปลง: '02001', สถานะ: 'ใช้งาน', การสแกน: 52 }
            ],
            analytics: [
                { เดือน: 'มกราคม', เกษตรกรใหม่: 15, QRใหม่: 12, การสแกน: 234 },
                { เดือน: 'กุมภาพันธ์', เกษตรกรใหม่: 18, QRใหม่: 15, การสแกน: 289 },
                { เดือน: 'มีนาคม', เกษตรกรใหม่: 22, QRใหม่: 18, การสแกน: 345 }
            ]
        };

        return mockData[section] || [];
    }

    /**
     * Convert data to CSV format
     */
    convertToCSV(data) {
        if (!data.length) return '';

        const headers = Object.keys(data[0]);
        const csvHeaders = headers.join(',');
        
        const csvRows = data.map(row => {
            return headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
            }).join(',');
        });

        return [csvHeaders, ...csvRows].join('\n');
    }

    /**
     * Download CSV file
     */
    downloadCSV(csv, filename) {
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
        } else {
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

// Global functions for HTML onclick events
window.exportTableData = function(type) {
    const exportManager = new ExportManager();
    
    switch (type) {
        case 'pdf':
            exportManager.exportToPDF(['groups']);
            break;
        case 'excel':
            exportManager.exportToExcel(['groups']);
            break;
        case 'csv':
            exportManager.exportToCSV(['groups']);
            break;
    }
};

window.executeExport = function() {
    if (window.reportsManager && window.reportsManager.exportManager) {
        window.reportsManager.exportManager.executeExport();
    }
};

window.viewDetails = function(id) {
    Swal.fire({
        title: 'รายละเอียด',
        text: `แสดงรายละเอียดของรายการ ID: ${id}`,
        icon: 'info',
        confirmButtonColor: '#198754'
    });
};

window.exportRow = function(id) {
    Swal.fire({
        title: 'ส่งออกข้อมูล',
        text: `ส่งออกข้อมูลของรายการ ID: ${id}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ส่งออก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#198754'
    }).then((result) => {
        if (result.isConfirmed) {
            // Export single row
            console.log('Exporting row:', id);
        }
    });
};

window.changePage = function(page) {
    if (window.reportsManager) {
        // Reload current data with new page
        console.log('Changing to page:', page);
        // Implementation would reload table data for the specific page
    }
};

// Initialize functions for inline script compatibility
window.initializeCharts = function() {
    if (window.reportsManager) {
        const mockData = window.reportsManager.getMockDataForReport('system');
        window.reportsManager.updateCharts(mockData);
    }
};

window.loadReportData = function() {
    if (window.reportsManager) {
        window.reportsManager.loadReportData('system');
    }
};

window.setupEventListeners = function() {
    // Additional event listeners can be set up here
    console.log('Event listeners setup completed');
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.reportsManager = new ReportsManager();
    console.log('Reports Manager initialized');
});