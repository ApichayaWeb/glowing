/**
 * ระบบสอบย้อนกลับผักอุดร - QR Code Scanner
 * ======================================
 */

/**
 * QR Scanner Class
 */
class QRScanner {
    constructor() {
        this.scanner = null;
        this.isScanning = false;
        this.videoElement = null;
        this.scannerArea = null;
        this.startButton = null;
        this.stopButton = null;
        this.demoSection = null;
        
        this.init();
    }

    /**
     * Initialize scanner
     */
    init() {
        // Get DOM elements
        this.videoElement = document.getElementById('qrVideo');
        this.scannerArea = document.getElementById('scannerArea');
        this.startButton = document.getElementById('startScanBtn');
        this.stopButton = document.getElementById('stopScanBtn');
        this.demoSection = document.getElementById('demoSection');

        // Bind event listeners
        this.bindEvents();

        // Check camera support
        this.checkCameraSupport();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        if (this.startButton) {
            this.startButton.addEventListener('click', () => this.startScanning());
        }

        if (this.stopButton) {
            this.stopButton.addEventListener('click', () => this.stopScanning());
        }

        // Handle manual search form
        const manualSearchForm = document.getElementById('manualSearchForm');
        if (manualSearchForm) {
            manualSearchForm.addEventListener('submit', (e) => this.handleManualSearch(e));
        }
    }

    /**
     * Check camera support
     */
    checkCameraSupport() {
        if (!Utils.hasCameraSupport()) {
            if (this.startButton) {
                this.startButton.disabled = true;
                this.startButton.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>ไม่รองรับกล้อง';
                this.startButton.title = 'เบราว์เซอร์นี้ไม่รองรับการใช้งานกล้อง';
            }
        }
    }

    /**
     * Start QR scanning
     */
    async startScanning() {
        try {
            if (this.isScanning) return;

            // Check if QrScanner is available
            if (typeof QrScanner === 'undefined') {
                throw new Error('QR Scanner library ไม่พร้อมใช้งาน');
            }

            // Hide demo section and show scanner
            if (this.demoSection) this.demoSection.style.display = 'none';
            if (this.scannerArea) this.scannerArea.style.display = 'block';

            // Initialize scanner
            this.scanner = new QrScanner(
                this.videoElement,
                result => this.onScanSuccess(result.data),
                {
                    onDecodeError: error => this.onScanError(error),
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    preferredCamera: 'environment' // Use back camera on mobile
                }
            );

            // Start scanning
            await this.scanner.start();
            this.isScanning = true;

            // Update UI
            if (this.startButton) {
                this.startButton.style.display = 'none';
            }
            
            // Add scanning animation
            this.addScanningAnimation();

            Utils.showSuccess('เริ่มสแกน', 'กล้องพร้อมสแกน QR Code แล้ว');

        } catch (error) {
            console.error('Error starting scanner:', error);
            this.handleScannerError(error);
        }
    }

    /**
     * Stop QR scanning
     */
    stopScanning() {
        try {
            if (this.scanner && this.isScanning) {
                this.scanner.stop();
                this.scanner.destroy();
                this.scanner = null;
                this.isScanning = false;
            }

            // Update UI
            if (this.scannerArea) this.scannerArea.style.display = 'none';
            if (this.demoSection) this.demoSection.style.display = 'block';
            if (this.startButton) {
                this.startButton.style.display = 'inline-block';
            }

            // Remove scanning animation
            this.removeScanningAnimation();

        } catch (error) {
            console.error('Error stopping scanner:', error);
        }
    }

    /**
     * Handle successful QR scan
     */
    onScanSuccess(qrData) {
        try {
            console.log('QR Code detected:', qrData);
            
            // Stop scanning
            this.stopScanning();
            
            // Vibrate on mobile (if supported)
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }

            // Process QR code
            this.processQRCode(qrData);

        } catch (error) {
            console.error('Error processing QR result:', error);
            Utils.showError('เกิดข้อผิดพลาด', 'ไม่สามารถประมวลผล QR Code ได้');
        }
    }

    /**
     * Handle scan error
     */
    onScanError(error) {
        // Don't show errors for normal scanning process
        if (error.name !== 'NotFoundException') {
            console.warn('QR Scan error:', error);
        }
    }

    /**
     * Handle scanner initialization error
     */
    handleScannerError(error) {
        let message = 'ไม่สามารถเปิดกล้องได้';
        
        if (error.name === 'NotAllowedError') {
            message = 'กรุณาอนุญาตให้เข้าถึงกล้อง';
        } else if (error.name === 'NotFoundError') {
            message = 'ไม่พบกล้องในอุปกรณ์นี้';
        } else if (error.name === 'NotSupportedError') {
            message = 'เบราว์เซอร์ไม่รองรับการใช้งานกล้อง';
        } else if (error.name === 'NotReadableError') {
            message = 'กล้องถูกใช้งานโดยแอพอื่น';
        }

        Utils.showError('ไม่สามารถเปิดกล้องได้', message);
        
        // Reset UI
        this.stopScanning();
    }

    /**
     * Process QR Code from URL parameter
     * @param {string} code - QR code from URL parameter
     * @return {Promise<Object>} Processing result
     */
    async processQRCodeFromURL(code) {
        try {
            // Validate QR Code format (XX-XXXXXXXXXXXXX)
            if (!this.validateSystemQRCode(code)) {
                return {
                    success: false,
                    error: 'INVALID_FORMAT',
                    message: 'รูปแบบรหัสไม่ถูกต้อง'
                };
            }

            // Call API to search
            const result = await QRAPI.searchByQRCode(code);

            if (result.success) {
                // Add URL parameter for tracking
                this.addCodeToURL(code);
                
                // Navigate to result page
                const params = new URLSearchParams({
                    code: code,
                    type: 'url',
                    source: 'direct'
                });
                
                window.location.href = `public/qr-result.html?${params.toString()}`;
                
                return {
                    success: true,
                    data: result.data,
                    redirected: true
                };
            } else {
                return {
                    success: false,
                    error: 'NOT_FOUND',
                    message: result.message || 'ไม่พบข้อมูลสำหรับรหัสนี้'
                };
            }

        } catch (error) {
            console.error('Process QR code from URL error:', error);
            return {
                success: false,
                error: 'API_ERROR',
                message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
            };
        }
    }

    /**
     * Process QR Code data (enhanced version)
     * @param {string} qrData - QR code data
     * @param {string} source - Source of QR code (camera|url|manual)
     */
    async processQRCode(qrData, source = 'camera') {
        try {
            console.log('Processing QR Code:', qrData, 'Source:', source);

            // Validate system QR Code format first
            if (!this.validateSystemQRCode(qrData)) {
                // Handle non-system QR codes
                this.handleNonSystemQRCode(qrData, source);
                return;
            }

            // Show loading
            Utils.showLoading('กำลังค้นหาข้อมูล...');

            // Search for product data
            const result = await QRAPI.searchByQRCode(qrData);

            if (result.success) {
                // Add to URL for sharing (only if from camera scan)
                if (source === 'camera') {
                    this.addCodeToURL(qrData);
                }
                
                // Log successful scan
                this.logQRCodeScan(qrData, source, 'success');

                // Navigate to result page
                const params = new URLSearchParams({
                    code: qrData,
                    type: source,
                    timestamp: Date.now()
                });
                
                window.location.href = `public/qr-result.html?${params.toString()}`;
            } else {
                Utils.hideLoading();
                this.showNotFoundMessage(qrData, source);
                this.logQRCodeScan(qrData, source, 'not_found');
            }

        } catch (error) {
            Utils.hideLoading();
            console.error('Process QR code error:', error);
            this.handleQRCodeError(error, qrData, source);
            this.logQRCodeScan(qrData, source, 'error', error.message);
        }
    }

    /**
     * Validate system QR code format (XX-XXXXXXXXXXXXX)
     * @param {string} code - QR code to validate
     * @return {boolean} Whether code is valid system format
     */
    validateSystemQRCode(code) {
        if (!code || typeof code !== 'string') return false;
        
        // Check pattern: 2-3 digits, dash, 13 digits
        const systemPattern = /^(\d{2,3})-(\d{13})$/;
        return systemPattern.test(code.trim());
    }

    /**
     * Handle non-system QR codes
     * @param {string} qrData - QR code data
     * @param {string} source - Source of scan
     */
    handleNonSystemQRCode(qrData, source) {
        console.log('Non-system QR code detected:', qrData);
        
        Swal.fire({
            icon: 'info',
            title: 'QR Code ไม่ใช่ของระบบ',
            html: `
                <p class="mb-3">QR Code นี้ไม่ใช่รหัสผลิตภัณฑ์ในระบบสอบย้อนกลับผักอุดร</p>
                <div class="alert alert-info small text-start">
                    <strong>ข้อมูลที่สแกนได้:</strong><br>
                    <code>${Utils.escapeHtml(qrData.substring(0, 100))}${qrData.length > 100 ? '...' : ''}</code>
                </div>
                <p class="small text-muted">
                    หากคุณมีรหัสผลิตภัณฑ์ กรุณาใช้ปุ่มค้นหาด้วยตัวเลข
                </p>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-search me-1"></i>ค้นหาด้วยตัวเลข',
            cancelButtonText: 'ปิด',
            confirmButtonColor: '#198754',
            cancelButtonColor: '#6c757d'
        }).then((result) => {
            if (result.isConfirmed) {
                // Open manual search modal
                const modal = new bootstrap.Modal(document.getElementById('manualSearchModal'));
                modal.show();
                
                // Pre-fill if it looks like a product code
                const searchInput = document.getElementById('searchCode');
                if (searchInput && this.couldBeProductCode(qrData)) {
                    searchInput.value = qrData;
                }
            }
        });
    }

    /**
     * Check if QR data could be a product code
     * @param {string} data - QR data
     * @return {boolean} Whether it could be a product code
     */
    couldBeProductCode(data) {
        // Check if it contains only numbers and dashes
        return /^[\d-]+$/.test(data) && data.includes('-');
    }

    /**
     * Show not found message with options
     * @param {string} qrData - QR code data
     * @param {string} source - Source of scan
     */
    showNotFoundMessage(qrData, source) {
        Swal.fire({
            icon: 'warning',
            title: 'ไม่พบข้อมูล',
            html: `
                <p class="mb-3">ไม่พบข้อมูลสำหรับรหัส: <code>${Utils.escapeHtml(qrData)}</code></p>
                <div class="alert alert-warning small">
                    <i class="fas fa-exclamation-triangle me-1"></i>
                    รหัสนี้อาจยังไม่ได้ลงทะเบียนในระบบ หรือข้อมูลอาจถูกลบ
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-redo me-1"></i>ลองใหม่',
            cancelButtonText: 'ปิด',
            confirmButtonColor: '#198754',
            cancelButtonColor: '#6c757d'
        }).then((result) => {
            if (result.isConfirmed) {
                // Retry the same code
                this.processQRCode(qrData, source);
            }
        });
    }

    /**
     * Handle QR code processing error
     * @param {Error} error - Error object
     * @param {string} qrData - QR code data
     * @param {string} source - Source of scan
     */
    handleQRCodeError(error, qrData, source) {
        let errorMessage = 'เกิดข้อผิดพลาดในการค้นหาข้อมูล';
        
        if (error.name === 'NetworkError' || error.message.includes('network')) {
            errorMessage = 'ไม่สามารถเชื่อมต่อเครือข่ายได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
        } else if (error.name === 'TimeoutError') {
            errorMessage = 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง';
        }

        Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: errorMessage,
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-redo me-1"></i>ลองใหม่',
            cancelButtonText: 'ปิด',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d'
        }).then((result) => {
            if (result.isConfirmed) {
                // Retry processing
                this.processQRCode(qrData, source);
            }
        });
    }

    /**
     * Add QR code to current URL for sharing
     * @param {string} code - QR code to add
     */
    addCodeToURL(code) {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('code', code);
            url.searchParams.set('shared', 'true');
            
            // Update URL without reloading page
            window.history.pushState({}, '', url.toString());
            
            console.log('Added code to URL for sharing:', code);
        } catch (error) {
            console.error('Error adding code to URL:', error);
        }
    }

    /**
     * Get shareable URL for QR code
     * @param {string} code - QR code
     * @return {string} Shareable URL
     */
    getShareableURL(code) {
        try {
            const url = new URL(window.location.origin + window.location.pathname);
            url.searchParams.set('code', code);
            return url.toString();
        } catch (error) {
            console.error('Error creating shareable URL:', error);
            return window.location.href;
        }
    }

    /**
     * Share QR code functionality
     * @param {string} code - QR code to share
     * @param {Object} productData - Product data (optional)
     */
    async shareQRCode(code, productData = null) {
        try {
            const shareUrl = this.getShareableURL(code);
            const shareTitle = productData ? 
                `ตรวจสอบผลิตภัณฑ์: ${productData.productName || 'ผักปลอดภัย'}` : 
                'ตรวจสอบที่มาผลิตภัณฑ์ผักปลอดภัย';
            const shareText = `ตรวจสอบที่มาและความปลอดภัยของผลิตภัณฑ์ผัก\nรหัส: ${code}`;

            // Check if Web Share API is supported
            if (navigator.share) {
                await navigator.share({
                    title: shareTitle,
                    text: shareText,
                    url: shareUrl
                });
                
                Utils.showSuccess('แชร์สำเร็จ', 'ลิงก์ถูกแชร์เรียบร้อยแล้ว');
            } else {
                // Fallback: Copy to clipboard
                await navigator.clipboard.writeText(shareUrl);
                
                Swal.fire({
                    icon: 'success',
                    title: 'คัดลอกลิงก์แล้ว',
                    html: `
                        <p class="mb-3">ลิงก์ถูกคัดลอกไปยังคลิปบอร์ดแล้ว</p>
                        <div class="alert alert-info small">
                            <code>${shareUrl}</code>
                        </div>
                        <p class="small text-muted">นำลิงก์นี้ไปแชร์ในแอพอื่นๆ ได้</p>
                    `,
                    confirmButtonText: 'ตกลง',
                    confirmButtonColor: '#198754'
                });
            }
            
            this.logQRCodeScan(code, 'share', 'success');
            
        } catch (error) {
            console.error('Error sharing QR code:', error);
            Utils.showError('ไม่สามารถแชร์ได้', 'เกิดข้อผิดพลาดในการแชร์ลิงก์');
        }
    }

    /**
     * Log QR code scan for analytics
     * @param {string} code - QR code
     * @param {string} source - Source of scan
     * @param {string} status - Scan status
     * @param {string} error - Error message (optional)
     */
    logQRCodeScan(code, source, status, error = null) {
        try {
            const logData = {
                timestamp: new Date().toISOString(),
                code: code,
                source: source,
                status: status,
                error: error,
                userAgent: navigator.userAgent,
                url: window.location.href
            };
            
            // Store in localStorage for analytics
            const logs = JSON.parse(localStorage.getItem('qr_scan_logs') || '[]');
            logs.push(logData);
            
            // Keep only last 100 logs
            if (logs.length > 100) {
                logs.splice(0, logs.length - 100);
            }
            
            localStorage.setItem('qr_scan_logs', JSON.stringify(logs));
            
            console.log('QR scan logged:', logData);
        } catch (error) {
            console.error('Error logging QR scan:', error);
        }
    }

    /**
     * Handle manual search form
     */
    async handleManualSearch(event) {
        event.preventDefault();
        
        const searchCode = document.getElementById('searchCode').value.trim();
        
        if (!searchCode) {
            Utils.showWarning('กรุณาใส่รหัส', 'กรุณาใส่รหัสที่ต้องการค้นหา');
            return;
        }

        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('manualSearchModal'));
        if (modal) modal.hide();

        // Process the code with manual source
        await this.processQRCode(searchCode, 'manual');
    }

    /**
     * Get QR scan analytics
     * @return {Array} Array of scan logs
     */
    getQRScanAnalytics() {
        try {
            return JSON.parse(localStorage.getItem('qr_scan_logs') || '[]');
        } catch (error) {
            console.error('Error getting QR scan analytics:', error);
            return [];
        }
    }

    /**
     * Clear QR scan logs
     */
    clearQRScanLogs() {
        try {
            localStorage.removeItem('qr_scan_logs');
            console.log('QR scan logs cleared');
        } catch (error) {
            console.error('Error clearing QR scan logs:', error);
        }
    }

    /**
     * Get scan statistics
     * @return {Object} Scan statistics
     */
    getScanStatistics() {
        const logs = this.getQRScanAnalytics();
        
        const stats = {
            total: logs.length,
            successful: logs.filter(log => log.status === 'success').length,
            failed: logs.filter(log => log.status === 'error').length,
            notFound: logs.filter(log => log.status === 'not_found').length,
            bySource: {
                camera: logs.filter(log => log.source === 'camera').length,
                url: logs.filter(log => log.source === 'url').length,
                manual: logs.filter(log => log.source === 'manual').length,
                share: logs.filter(log => log.source === 'share').length
            },
            recent: logs.slice(-10) // Last 10 scans
        };
        
        return stats;
    }

    /**
     * Add scanning animation
     */
    addScanningAnimation() {
        const scannerBox = document.querySelector('.scanner-box');
        if (scannerBox) {
            scannerBox.classList.add('scanning');
            
            // Add CSS for scanning animation if not exists
            if (!document.getElementById('scanningStyle')) {
                const style = document.createElement('style');
                style.id = 'scanningStyle';
                style.textContent = `
                    .scanner-box.scanning {
                        animation: scanningPulse 2s infinite;
                    }
                    
                    @keyframes scanningPulse {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.05); opacity: 0.8; }
                    }
                    
                    .scanner-box.scanning::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 2px;
                        background: linear-gradient(90deg, transparent, #fff, transparent);
                        animation: scanningLine 2s infinite;
                    }
                    
                    @keyframes scanningLine {
                        0% { transform: translateY(0); }
                        100% { transform: translateY(196px); }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }

    /**
     * Remove scanning animation
     */
    removeScanningAnimation() {
        const scannerBox = document.querySelector('.scanner-box');
        if (scannerBox) {
            scannerBox.classList.remove('scanning');
        }
    }

    /**
     * Get available cameras
     */
    async getAvailableCameras() {
        try {
            if (typeof QrScanner !== 'undefined') {
                return await QrScanner.listCameras();
            }
            return [];
        } catch (error) {
            console.error('Error getting cameras:', error);
            return [];
        }
    }

    /**
     * Switch camera (front/back)
     */
    async switchCamera() {
        try {
            if (this.scanner && this.isScanning) {
                const cameras = await this.getAvailableCameras();
                if (cameras.length > 1) {
                    // Switch to next camera
                    const currentCamera = this.scanner.getCamera();
                    const currentIndex = cameras.findIndex(cam => cam.id === currentCamera?.id);
                    const nextIndex = (currentIndex + 1) % cameras.length;
                    await this.scanner.setCamera(cameras[nextIndex].id);
                }
            }
        } catch (error) {
            console.error('Error switching camera:', error);
        }
    }
}

/**
 * Global function to process QR Code (enhanced)
 * @param {string} qrData - QR code data
 * @param {string} source - Source of QR code
 */
async function processQRCode(qrData, source = 'external') {
    if (window.qrScannerInstance) {
        await window.qrScannerInstance.processQRCode(qrData, source);
    } else {
        // Create temporary instance
        const tempScanner = new QRScanner();
        await tempScanner.processQRCode(qrData, source);
    }
}

/**
 * Process QR Code from URL parameter
 * @param {string} code - QR code from URL
 */
async function processQRCodeFromURL(code) {
    if (window.qrScannerInstance) {
        return await window.qrScannerInstance.processQRCodeFromURL(code);
    } else {
        // Create temporary instance
        const tempScanner = new QRScanner();
        return await tempScanner.processQRCodeFromURL(code);
    }
}

/**
 * Share QR Code functionality
 * @param {string} code - QR code to share
 * @param {Object} productData - Product data (optional)
 */
async function shareQRCode(code, productData = null) {
    if (window.qrScannerInstance) {
        await window.qrScannerInstance.shareQRCode(code, productData);
    } else {
        // Create temporary instance
        const tempScanner = new QRScanner();
        await tempScanner.shareQRCode(code, productData);
    }
}

/**
 * Get shareable URL for QR code
 * @param {string} code - QR code
 * @return {string} Shareable URL
 */
function getShareableURL(code) {
    if (window.qrScannerInstance) {
        return window.qrScannerInstance.getShareableURL(code);
    } else {
        // Create temporary instance
        const tempScanner = new QRScanner();
        return tempScanner.getShareableURL(code);
    }
}

/**
 * Get QR scan statistics
 * @return {Object} Scan statistics
 */
function getQRScanStatistics() {
    if (window.qrScannerInstance) {
        return window.qrScannerInstance.getScanStatistics();
    } else {
        // Create temporary instance
        const tempScanner = new QRScanner();
        return tempScanner.getScanStatistics();
    }
}

/**
 * Validate system QR code format
 * @param {string} code - QR code to validate
 * @return {boolean} Whether code is valid
 */
function validateSystemQRCode(code) {
    if (window.qrScannerInstance) {
        return window.qrScannerInstance.validateSystemQRCode(code);
    } else {
        // Use inline validation
        const systemPattern = /^(\d{2,3})-(\d{13})$/;
        return systemPattern.test(code?.trim() || '');
    }
}

/**
 * Initialize QR Scanner when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize on pages with QR scanner elements
    if (document.getElementById('qrVideo')) {
        window.qrScannerInstance = new QRScanner();
        
        // Check for URL parameter on initialization
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code && !window.mainApp?.isProcessingURL) {
            // Process URL parameter if mainApp is not handling it
            console.log('QR Scanner: Processing URL parameter:', code);
            setTimeout(() => {
                processQRCodeFromURL(code);
            }, 1000);
        }
    }
});

// Export for global use
window.QRScanner = QRScanner;
window.processQRCode = processQRCode;
window.processQRCodeFromURL = processQRCodeFromURL;
window.shareQRCode = shareQRCode;
window.getShareableURL = getShareableURL;
window.getQRScanStatistics = getQRScanStatistics;
window.validateSystemQRCode = validateSystemQRCode;