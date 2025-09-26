/**
 * ระบบสอบย้อนกลับผักอุดร - Charts Library
 * ==========================================
 * Comprehensive Chart.js library for data visualization
 */

/**
 * Charts Configuration and Utilities
 */
class ChartsManager {
    constructor() {
        this.charts = {};
        this.defaultColors = {
            primary: '#198754',
            secondary: '#6c757d',
            success: '#28a745',
            info: '#17a2b8',
            warning: '#ffc107',
            danger: '#dc3545',
            light: '#f8f9fa',
            dark: '#343a40'
        };
        
        this.colorPalette = [
            '#198754', '#0dcaf0', '#fd7e14', '#6f42c1',
            '#d63384', '#20c997', '#ffc107', '#dc3545',
            '#6610f2', '#198754', '#0d6efd', '#6c757d'
        ];
        
        this.thaiMonths = [
            'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
            'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ];
        
        this.init();
    }
    
    /**
     * Initialize charts configuration
     */
    init() {
        // Configure Chart.js defaults
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = "'Sarabun', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
            Chart.defaults.font.size = 12;
            Chart.defaults.color = '#495057';
            Chart.defaults.elements.point.radius = 4;
            Chart.defaults.elements.point.hoverRadius = 6;
            Chart.defaults.elements.line.borderWidth = 2;
            Chart.defaults.elements.bar.borderRadius = 4;
            
            // Register plugins
            this.registerCustomPlugins();
        }
    }
    
    /**
     * Register custom Chart.js plugins
     */
    registerCustomPlugins() {
        // Print-friendly plugin
        Chart.register({
            id: 'printFriendly',
            beforePrint: function(chart) {
                chart.options.plugins.legend.labels.color = '#000000';
                chart.options.scales.x.ticks.color = '#000000';
                chart.options.scales.y.ticks.color = '#000000';
                chart.update();
            },
            afterPrint: function(chart) {
                chart.options.plugins.legend.labels.color = Chart.defaults.color;
                chart.options.scales.x.ticks.color = Chart.defaults.color;
                chart.options.scales.y.ticks.color = Chart.defaults.color;
                chart.update();
            }
        });
    }
    
    /**
     * Get responsive options
     */
    getResponsiveOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        };
    }
    
    /**
     * Destroy chart if exists
     */
    destroyChart(chartId) {
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
            delete this.charts[chartId];
        }
    }
}

// Initialize global charts manager
const chartsManager = new ChartsManager();

/**
 * 1. Create Groups Charts
 * @param {Object} data - Groups data
 * @param {string} containerId - Container element ID
 * @returns {Object} Created charts
 */
function createGroupsChart(data, containerId = 'groupsChartContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return null;
    }
    
    // Create chart containers
    container.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <div class="chart-wrapper">
                    <h6 class="chart-title">
                        <i class="fas fa-chart-pie me-2 text-primary"></i>สถานะกลุ่มเกษตรกร
                    </h6>
                    <canvas id="groupsStatusChart" height="300"></canvas>
                </div>
            </div>
            <div class="col-md-6">
                <div class="chart-wrapper">
                    <h6 class="chart-title">
                        <i class="fas fa-chart-bar me-2 text-success"></i>จำนวนเกษตรกรในแต่ละกลุ่ม
                    </h6>
                    <canvas id="groupsMembersChart" height="300"></canvas>
                </div>
            </div>
        </div>
    `;
    
    // Doughnut Chart - Groups Status
    const statusCtx = document.getElementById('groupsStatusChart');
    const statusData = {
        labels: ['กลุ่มเปิดใช้งาน', 'กลุ่มปิดใช้งาน'],
        datasets: [{
            data: [
                data.activeGroups || 0,
                data.inactiveGroups || 0
            ],
            backgroundColor: [
                chartsManager.defaultColors.success,
                chartsManager.defaultColors.secondary
            ],
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverBorderWidth: 3
        }]
    };
    
    chartsManager.destroyChart('groupsStatus');
    chartsManager.charts.groupsStatus = new Chart(statusCtx, {
        type: 'doughnut',
        data: statusData,
        options: {
            ...chartsManager.getResponsiveOptions(),
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((context.parsed / total) * 100);
                            return `${context.label}: ${context.parsed} กลุ่ม (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
    
    // Bar Chart - Members per Group
    const membersCtx = document.getElementById('groupsMembersChart');
    const membersData = {
        labels: data.groups?.map(group => group.name) || [],
        datasets: [{
            label: 'จำนวนเกษตรกร',
            data: data.groups?.map(group => group.membersCount) || [],
            backgroundColor: chartsManager.defaultColors.primary,
            borderColor: chartsManager.defaultColors.primary,
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false
        }]
    };
    
    chartsManager.destroyChart('groupsMembers');
    chartsManager.charts.groupsMembers = new Chart(membersCtx, {
        type: 'bar',
        data: membersData,
        options: {
            ...chartsManager.getResponsiveOptions(),
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `กลุ่ม: ${context[0].label}`;
                        },
                        label: function(context) {
                            return `จำนวนเกษตรกร: ${context.parsed.y} คน`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + ' คน';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
    
    return {
        statusChart: chartsManager.charts.groupsStatus,
        membersChart: chartsManager.charts.groupsMembers
    };
}

/**
 * 2. Create Growth Chart
 * @param {Object} data - Growth data
 * @param {string} canvasId - Canvas element ID
 * @returns {Chart} Created chart
 */
function createGrowthChart(data, canvasId = 'growthChart') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        console.error(`Canvas ${canvasId} not found`);
        return null;
    }
    
    const chartData = {
        labels: data.months || chartsManager.thaiMonths,
        datasets: [
            {
                label: 'กลุ่มเกษตรกร',
                data: data.groups || [1, 2, 3, 5, 7, 8, 10, 11, 12, 12, 12, 12],
                borderColor: chartsManager.defaultColors.primary,
                backgroundColor: chartsManager.defaultColors.primary + '20',
                tension: 0.4,
                fill: false,
                pointBackgroundColor: chartsManager.defaultColors.primary,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5
            },
            {
                label: 'เกษตรกร',
                data: data.farmers || [15, 28, 45, 67, 89, 125, 156, 189, 215, 234, 248, 248],
                borderColor: chartsManager.defaultColors.success,
                backgroundColor: chartsManager.defaultColors.success + '20',
                tension: 0.4,
                fill: false,
                pointBackgroundColor: chartsManager.defaultColors.success,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5
            },
            {
                label: 'QR Codes',
                data: data.qrCodes || [12, 35, 58, 89, 134, 178, 223, 267, 298, 334, 367, 389],
                borderColor: chartsManager.defaultColors.warning,
                backgroundColor: chartsManager.defaultColors.warning + '20',
                tension: 0.4,
                fill: false,
                pointBackgroundColor: chartsManager.defaultColors.warning,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5
            }
        ]
    };
    
    chartsManager.destroyChart('growth');
    chartsManager.charts.growth = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            ...chartsManager.getResponsiveOptions(),
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            return `เดือน ${context[0].label}`;
                        },
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            hover: {
                mode: 'nearest',
                intersect: true
            }
        }
    });
    
    return chartsManager.charts.growth;
}

/**
 * 3. Create Crop Types Charts
 * @param {Object} data - Crop types data
 * @param {string} containerId - Container element ID
 * @returns {Object} Created charts
 */
function createCropTypesChart(data, containerId = 'cropTypesContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return null;
    }
    
    // Create chart containers
    container.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <div class="chart-wrapper">
                    <h6 class="chart-title">
                        <i class="fas fa-chart-pie me-2 text-info"></i>สัดส่วนประเภทพืชผัก
                    </h6>
                    <canvas id="cropTypesPieChart" height="300"></canvas>
                </div>
            </div>
            <div class="col-md-6">
                <div class="chart-wrapper">
                    <h6 class="chart-title">
                        <i class="fas fa-chart-bar me-2 text-warning"></i>จำนวนรายพืช
                    </h6>
                    <canvas id="cropTypesBarChart" height="300"></canvas>
                </div>
            </div>
        </div>
    `;
    
    const cropTypes = data.cropTypes || {
        leafy: 45,
        fruit: 32,
        root: 18,
        herb: 12
    };
    
    const labels = ['ผักใบ', 'ผักผล', 'ผักราก', 'สมุนไพร'];
    const values = [cropTypes.leafy, cropTypes.fruit, cropTypes.root, cropTypes.herb];
    const colors = [
        chartsManager.defaultColors.success,
        chartsManager.defaultColors.warning,
        chartsManager.defaultColors.info,
        chartsManager.colorPalette[3]
    ];
    
    // Pie Chart
    const pieCtx = document.getElementById('cropTypesPieChart');
    const pieData = {
        labels: labels,
        datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverBorderWidth: 3
        }]
    };
    
    chartsManager.destroyChart('cropTypesPie');
    chartsManager.charts.cropTypesPie = new Chart(pieCtx, {
        type: 'pie',
        data: pieData,
        options: {
            ...chartsManager.getResponsiveOptions(),
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((context.parsed / total) * 100);
                            return `${context.label}: ${context.parsed} พืช (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Horizontal Bar Chart
    const barCtx = document.getElementById('cropTypesBarChart');
    const barData = {
        labels: labels,
        datasets: [{
            label: 'จำนวนพืช',
            data: values,
            backgroundColor: colors,
            borderWidth: 1,
            borderRadius: 6
        }]
    };
    
    chartsManager.destroyChart('cropTypesBar');
    chartsManager.charts.cropTypesBar = new Chart(barCtx, {
        type: 'bar',
        data: barData,
        options: {
            ...chartsManager.getResponsiveOptions(),
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.x} พืช`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + ' พืช';
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    return {
        pieChart: chartsManager.charts.cropTypesPie,
        barChart: chartsManager.charts.cropTypesBar
    };
}

/**
 * 4. Create Activity Charts
 * @param {Object} data - Activity data
 * @param {string} containerId - Container element ID
 * @returns {Object} Created charts
 */
function createActivityChart(data, containerId = 'activityContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return null;
    }
    
    // Create chart containers
    container.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <div class="chart-wrapper">
                    <h6 class="chart-title">
                        <i class="fas fa-clock me-2 text-primary"></i>ช่วงเวลาการใช้งาน
                    </h6>
                    <canvas id="activityHeatmapChart" height="300"></canvas>
                </div>
            </div>
            <div class="col-md-6">
                <div class="chart-wrapper">
                    <h6 class="chart-title">
                        <i class="fas fa-chart-line me-2 text-success"></i>กิจกรรมรายวัน
                    </h6>
                    <canvas id="activityTimelineChart" height="300"></canvas>
                </div>
            </div>
        </div>
    `;
    
    // Heat Map Chart (using matrix visualization)
    const heatmapCtx = document.getElementById('activityHeatmapChart');
    const heatmapData = {
        labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
        datasets: [{
            label: 'จำนวนการใช้งาน',
            data: data.hourlyActivity || [5, 2, 8, 25, 45, 38, 52, 28],
            backgroundColor: function(context) {
                const value = context.parsed.y;
                const alpha = Math.min(value / 50, 1); // Normalize to max 50
                return `rgba(25, 135, 84, ${alpha})`;
            },
            borderColor: chartsManager.defaultColors.primary,
            borderWidth: 1,
            borderRadius: 4
        }]
    };
    
    chartsManager.destroyChart('activityHeatmap');
    chartsManager.charts.activityHeatmap = new Chart(heatmapCtx, {
        type: 'bar',
        data: heatmapData,
        options: {
            ...chartsManager.getResponsiveOptions(),
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `เวลา ${context[0].label}`;
                        },
                        label: function(context) {
                            return `การใช้งาน: ${context.parsed.y} ครั้ง`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + ' ครั้ง';
                        }
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
    
    // Timeline Chart
    const timelineCtx = document.getElementById('activityTimelineChart');
    const timelineData = {
        labels: data.dailyLabels || ['7 วันที่แล้ว', '6 วันที่แล้ว', '5 วันที่แล้ว', '4 วันที่แล้ว', '3 วันที่แล้ว', '2 วันที่แล้ว', 'เมื่อวาน'],
        datasets: [
            {
                label: 'เข้าสู่ระบบ',
                data: data.dailyLogins || [12, 19, 15, 25, 22, 30, 28],
                borderColor: chartsManager.defaultColors.primary,
                backgroundColor: chartsManager.defaultColors.primary + '20',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: chartsManager.defaultColors.primary
            },
            {
                label: 'สร้าง QR Code',
                data: data.dailyQRCodes || [8, 12, 10, 18, 15, 22, 20],
                borderColor: chartsManager.defaultColors.warning,
                backgroundColor: chartsManager.defaultColors.warning + '20',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: chartsManager.defaultColors.warning
            }
        ]
    };
    
    chartsManager.destroyChart('activityTimeline');
    chartsManager.charts.activityTimeline = new Chart(timelineCtx, {
        type: 'line',
        data: timelineData,
        options: {
            ...chartsManager.getResponsiveOptions(),
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
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
    
    return {
        heatmapChart: chartsManager.charts.activityHeatmap,
        timelineChart: chartsManager.charts.activityTimeline
    };
}

/**
 * 5. Create Data Completeness Charts
 * @param {Object} data - Data completeness data
 * @param {string} containerId - Container element ID
 * @returns {Object} Created charts
 */
function createDataCompletenessChart(data, containerId = 'dataCompletenessContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container ${containerId} not found`);
        return null;
    }
    
    // Create chart containers
    container.innerHTML = `
        <div class="row">
            <div class="col-md-8">
                <div class="chart-wrapper">
                    <h6 class="chart-title">
                        <i class="fas fa-chart-bar me-2 text-success"></i>ความสมบูรณ์ข้อมูลตามกลุ่ม
                    </h6>
                    <canvas id="dataCompletenessStackedChart" height="250"></canvas>
                </div>
            </div>
            <div class="col-md-4">
                <div class="chart-wrapper">
                    <h6 class="chart-title">
                        <i class="fas fa-tasks me-2 text-info"></i>ความคืบหน้าเกษตรกร
                    </h6>
                    <div id="progressChartsContainer" style="max-height: 250px; overflow-y: auto;">
                        <!-- Progress charts will be generated here -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Stacked Bar Chart
    const stackedCtx = document.getElementById('dataCompletenessStackedChart');
    const groupLabels = data.groups?.map(group => group.name) || ['กลุ่มที่ 1', 'กลุ่มที่ 2', 'กลุ่มที่ 3'];
    
    const stackedData = {
        labels: groupLabels,
        datasets: [
            {
                label: 'ข้อมูลครบถ้วน',
                data: data.groups?.map(group => group.completed) || [18, 22, 15],
                backgroundColor: chartsManager.defaultColors.success,
                borderWidth: 1,
                borderRadius: {
                    topLeft: 4,
                    topRight: 4
                }
            },
            {
                label: 'ข้อมูลไม่ครบ',
                data: data.groups?.map(group => group.incomplete) || [4, 3, 6],
                backgroundColor: chartsManager.defaultColors.warning,
                borderWidth: 1
            },
            {
                label: 'ยังไม่เริ่ม',
                data: data.groups?.map(group => group.notStarted) || [2, 1, 3],
                backgroundColor: chartsManager.defaultColors.danger,
                borderWidth: 1,
                borderRadius: {
                    bottomLeft: 4,
                    bottomRight: 4
                }
            }
        ]
    };
    
    chartsManager.destroyChart('dataCompletenessStacked');
    chartsManager.charts.dataCompletenessStacked = new Chart(stackedCtx, {
        type: 'bar',
        data: stackedData,
        options: {
            ...chartsManager.getResponsiveOptions(),
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `กลุ่ม: ${context[0].label}`;
                        },
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} คน`;
                        },
                        footer: function(tooltipItems) {
                            const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
                            return `รวม: ${total} คน`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + ' คน';
                        }
                    }
                }
            }
        }
    });
    
    // Progress Charts for Individual Farmers
    const progressContainer = document.getElementById('progressChartsContainer');
    const farmers = data.farmers || [
        { name: 'นายสมชาย ใจดี', progress: 100 },
        { name: 'นางมาลี รักษ์ดี', progress: 85 },
        { name: 'นายประยุทธ สร้างสุข', progress: 65 },
        { name: 'นางวิมล ทำดี', progress: 45 },
        { name: 'นายธีระ มั่นคง', progress: 20 }
    ];
    
    progressContainer.innerHTML = '';
    
    farmers.forEach(farmer => {
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item mb-3';
        progressItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <small class="fw-medium">${farmer.name}</small>
                <small class="text-muted">${farmer.progress}%</small>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar ${farmer.progress >= 80 ? 'bg-success' : farmer.progress >= 50 ? 'bg-warning' : 'bg-danger'}" 
                     style="width: ${farmer.progress}%"></div>
            </div>
        `;
        progressContainer.appendChild(progressItem);
    });
    
    return {
        stackedChart: chartsManager.charts.dataCompletenessStacked,
        progressCharts: progressContainer
    };
}

/**
 * Utility Functions
 */

/**
 * Update chart data
 */
function updateChartData(chartId, newData) {
    const chart = chartsManager.charts[chartId];
    if (!chart) {
        console.error(`Chart ${chartId} not found`);
        return;
    }
    
    chart.data = newData;
    chart.update();
}

/**
 * Resize all charts
 */
function resizeAllCharts() {
    Object.values(chartsManager.charts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    });
}

/**
 * Export chart as image
 */
function exportChartAsImage(chartId, filename = 'chart.png') {
    const chart = chartsManager.charts[chartId];
    if (!chart) {
        console.error(`Chart ${chartId} not found`);
        return;
    }
    
    const url = chart.toBase64Image();
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
}

/**
 * Destroy all charts
 */
function destroyAllCharts() {
    Object.keys(chartsManager.charts).forEach(chartId => {
        chartsManager.destroyChart(chartId);
    });
}

/**
 * Print-friendly chart mode
 */
function enablePrintMode() {
    Object.values(chartsManager.charts).forEach(chart => {
        if (chart && chart.options) {
            // Save original colors
            chart._originalColors = {
                backgroundColor: chart.options.plugins?.legend?.labels?.color,
                ticksColor: chart.options.scales?.x?.ticks?.color
            };
            
            // Set print-friendly colors
            if (chart.options.plugins?.legend?.labels) {
                chart.options.plugins.legend.labels.color = '#000000';
            }
            if (chart.options.scales?.x?.ticks) {
                chart.options.scales.x.ticks.color = '#000000';
            }
            if (chart.options.scales?.y?.ticks) {
                chart.options.scales.y.ticks.color = '#000000';
            }
            
            chart.update();
        }
    });
}

/**
 * Restore normal chart mode
 */
function disablePrintMode() {
    Object.values(chartsManager.charts).forEach(chart => {
        if (chart && chart._originalColors) {
            // Restore original colors
            if (chart.options.plugins?.legend?.labels) {
                chart.options.plugins.legend.labels.color = chart._originalColors.backgroundColor || Chart.defaults.color;
            }
            if (chart.options.scales?.x?.ticks) {
                chart.options.scales.x.ticks.color = chart._originalColors.ticksColor || Chart.defaults.color;
            }
            if (chart.options.scales?.y?.ticks) {
                chart.options.scales.y.ticks.color = chart._originalColors.ticksColor || Chart.defaults.color;
            }
            
            delete chart._originalColors;
            chart.update();
        }
    });
}

// Event Listeners
window.addEventListener('resize', () => {
    clearTimeout(window.chartResizeTimeout);
    window.chartResizeTimeout = setTimeout(resizeAllCharts, 300);
});

// Print event listeners
window.addEventListener('beforeprint', enablePrintMode);
window.addEventListener('afterprint', disablePrintMode);

// Export global functions
window.ChartsManager = ChartsManager;
window.chartsManager = chartsManager;
window.createGroupsChart = createGroupsChart;
window.createGrowthChart = createGrowthChart;
window.createCropTypesChart = createCropTypesChart;
window.createActivityChart = createActivityChart;
window.createDataCompletenessChart = createDataCompletenessChart;
window.updateChartData = updateChartData;
window.resizeAllCharts = resizeAllCharts;
window.exportChartAsImage = exportChartAsImage;
window.destroyAllCharts = destroyAllCharts;