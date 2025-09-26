/**
 * ระบบสอบย้อนกลับผักอุดร - Main Application
 * ===========================================
 * จัดการ URL parameters และการประมวลผล QR Code อัตโนมัติ
 */

/**
 * Main Application Class
 */
class MainApp {
    constructor() {
        this.isProcessingURL = false;
        this.currentCode = null;
        
        this.init();
    }

    /**
     * Initialize application
     */
    init() {
        // Bind page events
        this.bindEvents();
        
        // Set up URL parameter checking on page load
        document.addEventListener('DOMContentLoaded', () => {
            this.initializePageLoad();
        });
    }

    /**
     * Initialize page load sequence
     */
    async initializePageLoad() {
        try {
            // First check for URL parameters
            const hasURLCode = await this.checkURLParameter();
            
            if (!hasURLCode) {
                // No URL parameter, show normal page
                this.showNormalPage();
            }
            // If has URL code, auto-processing will handle the UI
            
        } catch (error) {
            console.error('Error initializing page:', error);
            this.showNormalPage();
        }
    }

    /**
     * Check for URL parameters
     * @return {Promise<boolean>} Whether URL code parameter exists
     */
    async checkURLParameter() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            
            if (code) {
                console.log('Found URL code parameter:', code);
                await this.autoProcessQRCode(code);
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('Error checking URL parameter:', error);
            return false;
        }
    }

    /**
     * Auto-process QR code from URL parameter
     * @param {string} code - QR code from URL
     */
    async autoProcessQRCode(code) {
        try {
            this.isProcessingURL = true;
            this.currentCode = code;
            
            // Show loading state immediately
            this.showURLProcessingState(code);
            
            // Validate code format
            if (!this.validateCodeFormat(code)) {
                throw new Error('รูปแบบรหัสไม่ถูกต้อง');
            }
            
            // Process the QR code
            const result = await this.processQRCodeData(code);
            
            if (result.success) {
                // Update URL to clean state (remove parameter)
                this.updateURL();
                
                // Navigate to result page
                await this.navigateToResult(code, result.data);
            } else {
                throw new Error(result.message || 'ไม่พบข้อมูลสำหรับรหัสนี้');
            }
            
        } catch (error) {
            console.error('Error auto-processing QR code:', error);
            await this.handleURLProcessingError(error.message);
        } finally {
            this.isProcessingURL = false;
        }
    }

    /**
     * Show URL processing state
     * @param {string} code - QR code being processed
     */
    showURLProcessingState(code) {
        // Pause carousel if it exists
        const carousel = document.getElementById('heroCarousel');
        if (carousel && typeof bootstrap !== 'undefined') {
            const carouselInstance = bootstrap.Carousel.getInstance(carousel);
            if (carouselInstance) {
                carouselInstance.pause();
            }
        }
        
        // Hide normal page content
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) {
            heroSection.style.display = 'none';
        }
        
        // Show loading overlay
        this.showProcessingOverlay(code);
    }

    /**
     * Show processing overlay
     * @param {string} code - QR code being processed
     */
    showProcessingOverlay(code) {
        // Remove existing overlay
        const existingOverlay = document.getElementById('urlProcessingOverlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // Create processing overlay
        const overlay = document.createElement('div');
        overlay.id = 'urlProcessingOverlay';
        overlay.className = 'url-processing-overlay';
        overlay.innerHTML = `
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-md-6">
                        <div class="processing-card text-center">
                            <div class="processing-icon mb-4">
                                <div class="spinner-border text-success" style="width: 4rem; height: 4rem;">
                                    <span class="visually-hidden">กำลังโหลด...</span>
                                </div>
                            </div>
                            <h3 class="mb-3">กำลังตรวจสอบข้อมูล</h3>
                            <p class="text-muted mb-3">รหัส: <code>${Utils.escapeHtml(code)}</code></p>
                            <p class="text-muted">กรุณารอสักครู่...</p>
                            <div class="progress mt-4" style="height: 6px;">
                                <div class="progress-bar progress-bar-striped progress-bar-animated bg-success" 
                                     style="width: 100%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles for overlay
        const style = document.createElement('style');
        style.textContent = `
            .url-processing-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding-top: 80px;
            }
            
            .processing-card {
                background: white;
                border-radius: 1rem;
                padding: 3rem 2rem;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                max-width: 400px;
            }
            
            .processing-icon {
                position: relative;
            }
            
            @media (max-width: 768px) {
                .processing-card {
                    margin: 1rem;
                    padding: 2rem 1.5rem;
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(overlay);
    }

    /**
     * Hide processing overlay
     */
    hideProcessingOverlay() {
        const overlay = document.getElementById('urlProcessingOverlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * Validate code format
     * @param {string} code - Code to validate
     * @return {boolean} Whether code format is valid
     */
    validateCodeFormat(code) {
        if (!code || typeof code !== 'string') return false;
        
        // Check basic format: XX-XXXXXXXXXXXXX (2-3 digits, dash, 13 digits)
        const basicFormat = /^[0-9]{2,3}-[0-9]{13}$/.test(code.trim());
        
        if (!basicFormat) return false;
        
        // Additional validation using Utils if available
        if (typeof Utils !== 'undefined' && Utils.validateQRCode) {
            return Utils.validateQRCode(code);
        }
        
        return true;
    }

    /**
     * Process QR code data
     * @param {string} code - QR code to process
     * @return {Promise<Object>} Processing result
     */
    async processQRCodeData(code) {
        try {
            // Check if QRAPI is available
            if (typeof QRAPI === 'undefined') {
                throw new Error('API ไม่พร้อมใช้งาน');
            }
            
            // Call API to search for QR code data
            const result = await QRAPI.searchByQRCode(code);
            
            return result;
            
        } catch (error) {
            console.error('Error processing QR code data:', error);
            throw error;
        }
    }

    /**
     * Update URL (remove code parameter)
     */
    updateURL() {
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            
            // Update URL without refreshing page
            window.history.replaceState({}, document.title, url.toString());
            
        } catch (error) {
            console.error('Error updating URL:', error);
        }
    }

    /**
     * Navigate to result page
     * @param {string} code - QR code
     * @param {Object} data - Result data
     */
    async navigateToResult(code, data) {
        try {
            // Add small delay for better UX
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Navigate to result page
            const params = new URLSearchParams({
                code: code,
                type: 'url'
            });
            
            window.location.href = `public/qr-result.html?${params.toString()}`;
            
        } catch (error) {
            console.error('Error navigating to result:', error);
            throw error;
        }
    }

    /**
     * Handle URL processing error
     * @param {string} errorMessage - Error message
     */
    async handleURLProcessingError(errorMessage) {
        try {
            // Hide processing overlay
            this.hideProcessingOverlay();
            
            // Show error state
            this.showErrorState(errorMessage);
            
            // Auto-return to normal page after delay
            setTimeout(() => {
                this.returnToNormalPage();
            }, 5000);
            
        } catch (error) {
            console.error('Error handling URL processing error:', error);
            this.returnToNormalPage();
        }
    }

    /**
     * Show error state
     * @param {string} errorMessage - Error message
     */
    showErrorState(errorMessage) {
        // Create error overlay
        const overlay = document.createElement('div');
        overlay.id = 'urlErrorOverlay';
        overlay.className = 'url-processing-overlay';
        overlay.innerHTML = `
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-md-6">
                        <div class="processing-card text-center">
                            <div class="error-icon mb-4">
                                <i class="fas fa-exclamation-triangle text-warning" style="font-size: 4rem;"></i>
                            </div>
                            <h3 class="mb-3 text-danger">ไม่พบข้อมูล</h3>
                            <p class="text-muted mb-3">${Utils.escapeHtml(errorMessage)}</p>
                            <p class="small text-muted mb-4">รหัส: <code>${Utils.escapeHtml(this.currentCode || '')}</code></p>
                            <div class="d-grid gap-2">
                                <button class="btn btn-success" onclick="mainApp.returnToNormalPage()">
                                    <i class="fas fa-home me-2"></i>กลับหน้าหลัก
                                </button>
                                <button class="btn btn-outline-primary" onclick="mainApp.retryProcessing()">
                                    <i class="fas fa-redo me-2"></i>ลองใหม่
                                </button>
                            </div>
                            <p class="small text-muted mt-3">
                                <i class="fas fa-clock me-1"></i>
                                จะกลับหน้าหลักอัตโนมัติใน 5 วินาที
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    /**
     * Return to normal page
     */
    returnToNormalPage() {
        // Remove overlays
        this.hideProcessingOverlay();
        const errorOverlay = document.getElementById('urlErrorOverlay');
        if (errorOverlay) {
            errorOverlay.remove();
        }
        
        // Show normal page content
        this.showNormalPage();
        
        // Clear URL parameter
        this.updateURL();
        
        // Reset state
        this.currentCode = null;
        this.isProcessingURL = false;
    }

    /**
     * Show normal page
     */
    showNormalPage() {
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) {
            heroSection.style.display = 'block';
        }
        
        // Restart carousel if it exists
        const carousel = document.getElementById('heroCarousel');
        if (carousel && typeof bootstrap !== 'undefined') {
            const carouselInstance = bootstrap.Carousel.getOrCreateInstance(carousel);
            carouselInstance.cycle();
        }
    }

    /**
     * Retry processing current code
     */
    async retryProcessing() {
        if (this.currentCode) {
            // Remove error overlay
            const errorOverlay = document.getElementById('urlErrorOverlay');
            if (errorOverlay) {
                errorOverlay.remove();
            }
            
            // Retry processing
            await this.autoProcessQRCode(this.currentCode);
        } else {
            this.returnToNormalPage();
        }
    }

    /**
     * Bind page events
     */
    bindEvents() {
        // Handle browser back/forward
        window.addEventListener('popstate', (event) => {
            // Check if we need to process URL parameter again
            setTimeout(() => {
                this.checkURLParameter();
            }, 100);
        });
        
        // Handle page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.isProcessingURL) {
                // Check URL parameter when page becomes visible
                this.checkURLParameter();
            }
        });
    }

    /**
     * Test URL processing with sample code
     * @param {string} testCode - Test code (optional)
     */
    testURLProcessing(testCode = '01-4102010502568') {
        const url = new URL(window.location.href);
        url.searchParams.set('code', testCode);
        window.location.href = url.toString();
    }
}

/**
 * Utility functions for URL processing
 */
const URLProcessor = {
    /**
     * Get current URL parameters
     * @return {URLSearchParams} URL parameters
     */
    getURLParams() {
        return new URLSearchParams(window.location.search);
    },

    /**
     * Check if URL has code parameter
     * @return {boolean} Whether code parameter exists
     */
    hasCodeParameter() {
        return this.getURLParams().has('code');
    },

    /**
     * Get code from URL
     * @return {string|null} Code value or null
     */
    getCodeFromURL() {
        return this.getURLParams().get('code');
    },

    /**
     * Create shareable URL with code
     * @param {string} code - QR code
     * @return {string} Shareable URL
     */
    createShareableURL(code) {
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('code', code);
        return url.toString();
    },

    /**
     * Clean URL (remove all parameters)
     * @return {string} Clean URL
     */
    getCleanURL() {
        return window.location.origin + window.location.pathname;
    }
};

// Create main app instance
const mainApp = new MainApp();

// Global functions for external use
window.mainApp = mainApp;
window.URLProcessor = URLProcessor;

/**
 * Global function to test QR code with URL parameter
 * @param {string} code - Test code
 */
function testQRCodeURL(code) {
    mainApp.testURLProcessing(code);
}

/**
 * Global function to process QR code (maintains compatibility)
 * @param {string} qrData - QR code data
 */
async function processQRCode(qrData) {
    try {
        // If we're currently processing URL, don't interfere
        if (mainApp.isProcessingURL) {
            return;
        }
        
        // Use existing QR scanner instance if available
        if (window.qrScannerInstance) {
            await window.qrScannerInstance.processQRCode(qrData);
        } else {
            // Use main app processing
            const result = await mainApp.processQRCodeData(qrData);
            if (result.success) {
                await mainApp.navigateToResult(qrData, result.data);
            } else {
                throw new Error(result.message || 'ไม่พบข้อมูล');
            }
        }
    } catch (error) {
        console.error('Error processing QR code:', error);
        if (typeof Utils !== 'undefined') {
            Utils.showError('เกิดข้อผิดพลาด', error.message);
        } else {
            alert('เกิดข้อผิดพลาด: ' + error.message);
        }
    }
}

// Export for global use
window.processQRCode = processQRCode;
window.testQRCodeURL = testQRCodeURL;