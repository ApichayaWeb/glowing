/**
 * ระบบสอบย้อนกลับผักอุดร - Mobile Optimizations
 * ===============================================
 * Mobile-specific JavaScript optimizations
 */

/**
 * Mobile Detection and Optimization Manager
 */
class MobileOptimizer {
    constructor() {
        this.isMobile = this.detectMobile();
        this.isIOS = this.detectIOS();
        this.isAndroid = this.detectAndroid();
        this.supportsHaptics = this.detectHapticSupport();
        this.touchDevice = 'ontouchstart' in window;
        
        this.init();
    }

    /**
     * Detect if device is mobile
     */
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    /**
     * Detect iOS devices
     */
    detectIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    /**
     * Detect Android devices
     */
    detectAndroid() {
        return /Android/i.test(navigator.userAgent);
    }

    /**
     * Detect haptic feedback support
     */
    detectHapticSupport() {
        return 'vibrate' in navigator || 
               ('hapticFeedback' in navigator) ||
               (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function');
    }

    /**
     * Initialize mobile optimizations
     */
    init() {
        this.setupViewport();
        this.setupTouchOptimizations();
        this.setupKeyboardOptimizations();
        this.setupScrollOptimizations();
        this.setupOrientationHandling();
        
        if (this.isMobile) {
            this.enableMobileFeatures();
        }
    }

    /**
     * Setup viewport for mobile
     */
    setupViewport() {
        // Prevent zoom on input focus for iOS
        if (this.isIOS) {
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
                viewport.setAttribute('content', 
                    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
                );
            }
        }

        // Handle dynamic viewport height
        this.updateViewportHeight();
        window.addEventListener('resize', () => this.updateViewportHeight());
    }

    /**
     * Update viewport height for mobile browsers
     */
    updateViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    /**
     * Setup touch optimizations
     */
    setupTouchOptimizations() {
        if (!this.touchDevice) return;

        // Add touch classes to body
        document.body.classList.add('touch-device');
        
        // Improve touch response
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
        
        // Prevent double-tap zoom on specific elements
        this.preventDoubleTabZoom();
        
        // Add ripple effect to buttons
        this.addRippleEffect();
    }

    /**
     * Handle touch start events
     */
    handleTouchStart(event) {
        const target = event.target.closest('button, .btn, [role="button"]');
        if (target) {
            target.classList.add('touched');
            this.triggerHapticFeedback('light');
        }
    }

    /**
     * Handle touch end events
     */
    handleTouchEnd(event) {
        const target = event.target.closest('button, .btn, [role="button"]');
        if (target) {
            setTimeout(() => {
                target.classList.remove('touched');
            }, 150);
        }
    }

    /**
     * Prevent double-tap zoom on buttons
     */
    preventDoubleTabZoom() {
        const elements = document.querySelectorAll('button, .btn, [role="button"]');
        elements.forEach(element => {
            element.addEventListener('touchend', (event) => {
                event.preventDefault();
                event.target.click();
            }, { passive: false });
        });
    }

    /**
     * Add ripple effect to buttons
     */
    addRippleEffect() {
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(button => {
            button.addEventListener('touchstart', (event) => {
                this.createRipple(event, button);
            }, { passive: true });
        });
    }

    /**
     * Create ripple animation
     */
    createRipple(event, element) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.touches[0].clientX - rect.left - size / 2;
        const y = event.touches[0].clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
            z-index: 1;
        `;

        // Add ripple styles if not exists
        if (!document.getElementById('ripple-styles')) {
            const style = document.createElement('style');
            style.id = 'ripple-styles';
            style.textContent = `
                @keyframes ripple {
                    to {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
                .btn {
                    position: relative;
                    overflow: hidden;
                }
            `;
            document.head.appendChild(style);
        }

        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);

        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, 600);
    }

    /**
     * Setup keyboard optimizations for mobile
     */
    setupKeyboardOptimizations() {
        if (!this.isMobile) return;

        // Prevent viewport shift when keyboard appears
        let initialViewportHeight = window.innerHeight;
        
        window.addEventListener('resize', () => {
            const currentHeight = window.innerHeight;
            const heightDifference = initialViewportHeight - currentHeight;
            
            if (heightDifference > 150) {
                // Keyboard is likely open
                document.body.classList.add('keyboard-open');
                this.handleKeyboardOpen();
            } else {
                // Keyboard is likely closed
                document.body.classList.remove('keyboard-open');
                this.handleKeyboardClose();
            }
        });

        // Auto-scroll to focused input
        this.setupInputFocusScroll();
        
        // Optimize input types for mobile keyboards
        this.optimizeInputTypes();
    }

    /**
     * Handle keyboard open event
     */
    handleKeyboardOpen() {
        // Reduce hero section height when keyboard is open
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) {
            heroSection.style.minHeight = '50vh';
        }
    }

    /**
     * Handle keyboard close event
     */
    handleKeyboardClose() {
        // Restore hero section height
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) {
            heroSection.style.minHeight = '100vh';
        }
    }

    /**
     * Setup auto-scroll to focused inputs
     */
    setupInputFocusScroll() {
        const inputs = document.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    const rect = input.getBoundingClientRect();
                    const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
                    
                    if (!isVisible) {
                        input.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                }, 300); // Wait for keyboard animation
            });
        });
    }

    /**
     * Optimize input types for mobile keyboards
     */
    optimizeInputTypes() {
        // Phone number inputs
        const phoneInputs = document.querySelectorAll('input[name*="phone"], input[id*="phone"]');
        phoneInputs.forEach(input => {
            input.setAttribute('type', 'tel');
            input.setAttribute('inputmode', 'tel');
        });

        // Email inputs
        const emailInputs = document.querySelectorAll('input[name*="email"], input[id*="email"]');
        emailInputs.forEach(input => {
            input.setAttribute('type', 'email');
            input.setAttribute('inputmode', 'email');
        });

        // Number inputs
        const numberInputs = document.querySelectorAll('input[name*="number"], input[id*="number"]');
        numberInputs.forEach(input => {
            input.setAttribute('inputmode', 'numeric');
        });

        // Search inputs
        const searchInputs = document.querySelectorAll('input[name*="search"], input[id*="search"]');
        searchInputs.forEach(input => {
            input.setAttribute('type', 'search');
        });
    }

    /**
     * Setup scroll optimizations
     */
    setupScrollOptimizations() {
        // Improve scroll performance
        let ticking = false;
        
        const updateScrollPosition = () => {
            const scrollTop = window.pageYOffset;
            document.documentElement.style.setProperty('--scroll-y', `${scrollTop}px`);
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateScrollPosition);
                ticking = true;
            }
        }, { passive: true });

        // Smooth scroll for anchor links
        const anchorLinks = document.querySelectorAll('a[href^="#"]');
        anchorLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    /**
     * Setup orientation change handling
     */
    setupOrientationHandling() {
        window.addEventListener('orientationchange', () => {
            // Wait for orientation change to complete
            setTimeout(() => {
                this.updateViewportHeight();
                this.handleOrientationChange();
            }, 500);
        });

        // Also listen for resize as fallback
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.handleOrientationChange();
            }, 250);
        });
    }

    /**
     * Handle orientation change
     */
    handleOrientationChange() {
        const isLandscape = window.innerWidth > window.innerHeight;
        
        if (isLandscape) {
            document.body.classList.add('landscape');
            document.body.classList.remove('portrait');
        } else {
            document.body.classList.add('portrait');
            document.body.classList.remove('landscape');
        }

        // Adjust carousel controls for landscape
        const carousel = document.querySelector('.carousel');
        if (carousel && isLandscape && window.innerHeight < 500) {
            carousel.classList.add('landscape-compact');
        } else if (carousel) {
            carousel.classList.remove('landscape-compact');
        }
    }

    /**
     * Enable mobile-specific features
     */
    enableMobileFeatures() {
        document.body.classList.add('mobile-device');
        
        if (this.isIOS) {
            document.body.classList.add('ios-device');
            this.enableIOSFeatures();
        }
        
        if (this.isAndroid) {
            document.body.classList.add('android-device');
            this.enableAndroidFeatures();
        }
    }

    /**
     * Enable iOS-specific features
     */
    enableIOSFeatures() {
        // Handle iOS safe areas
        this.handleSafeAreas();
        
        // Improve iOS scroll behavior
        document.body.style.webkitOverflowScrolling = 'touch';
        
        // Handle iOS rubber band scrolling
        this.preventIOSRubberBand();
    }

    /**
     * Handle iOS safe areas
     */
    handleSafeAreas() {
        const navbar = document.querySelector('.navbar');
        const heroSection = document.querySelector('.hero-section');
        
        if (navbar) {
            navbar.style.paddingTop = 'env(safe-area-inset-top)';
        }
        
        if (heroSection) {
            heroSection.style.paddingTop = 'calc(56px + env(safe-area-inset-top))';
        }
    }

    /**
     * Prevent iOS rubber band scrolling
     */
    preventIOSRubberBand() {
        let startY = 0;
        
        document.addEventListener('touchstart', (event) => {
            startY = event.touches[0].pageY;
        }, { passive: true });
        
        document.addEventListener('touchmove', (event) => {
            const y = event.touches[0].pageY;
            const scrollTop = window.pageYOffset;
            const scrollHeight = document.documentElement.scrollHeight;
            const clientHeight = document.documentElement.clientHeight;
            
            // Prevent overscroll at top
            if (scrollTop === 0 && y > startY) {
                event.preventDefault();
            }
            
            // Prevent overscroll at bottom
            if (scrollTop + clientHeight >= scrollHeight && y < startY) {
                event.preventDefault();
            }
        }, { passive: false });
    }

    /**
     * Enable Android-specific features
     */
    enableAndroidFeatures() {
        // Handle Android navigation bar
        this.handleAndroidNavigation();
        
        // Improve Android performance
        this.optimizeAndroidPerformance();
    }

    /**
     * Handle Android navigation bar
     */
    handleAndroidNavigation() {
        // Add padding for Android navigation bar
        const footerElements = document.querySelectorAll('.fixed-bottom, .footer');
        footerElements.forEach(element => {
            element.style.paddingBottom = 'env(safe-area-inset-bottom)';
        });
    }

    /**
     * Optimize Android performance
     */
    optimizeAndroidPerformance() {
        // Use transform3d for better GPU acceleration
        const animatedElements = document.querySelectorAll('.btn, .card, .modal');
        animatedElements.forEach(element => {
            element.style.transform = 'translateZ(0)';
        });
    }

    /**
     * Trigger haptic feedback
     */
    triggerHapticFeedback(type = 'light') {
        if (!this.supportsHaptics) return;
        
        try {
            if (navigator.vibrate) {
                const patterns = {
                    light: [10],
                    medium: [20],
                    heavy: [30]
                };
                navigator.vibrate(patterns[type] || patterns.light);
            }
            
            // iOS haptic feedback
            if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
                // Note: Haptic feedback requires user gesture
                if (this.hapticPermissionGranted) {
                    // Trigger haptic feedback (this would need native integration)
                }
            }
        } catch (error) {
            console.log('Haptic feedback not available:', error);
        }
    }

    /**
     * Request haptic permission for iOS
     */
    async requestHapticPermission() {
        if (this.isIOS && window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                this.hapticPermissionGranted = permission === 'granted';
                return this.hapticPermissionGranted;
            } catch (error) {
                console.log('Haptic permission denied:', error);
                return false;
            }
        }
        return true;
    }

    /**
     * Optimize images for mobile
     */
    optimizeImages() {
        const images = document.querySelectorAll('img[data-mobile-src]');
        images.forEach(img => {
            if (this.isMobile) {
                const mobileSrc = img.getAttribute('data-mobile-src');
                if (mobileSrc) {
                    img.src = mobileSrc;
                }
            }
        });
    }

    /**
     * Setup lazy loading for better performance
     */
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const src = img.getAttribute('data-src');
                        
                        if (src) {
                            img.src = src;
                            img.classList.add('loaded');
                            img.removeAttribute('data-src');
                        }
                        
                        observer.unobserve(img);
                    }
                });
            });

            const lazyImages = document.querySelectorAll('img[data-src]');
            lazyImages.forEach(img => {
                img.classList.add('lazy-image');
                imageObserver.observe(img);
            });
        }
    }

    /**
     * Setup pull-to-refresh (if needed)
     */
    setupPullToRefresh() {
        if (!this.isMobile) return;
        
        let startY = 0;
        let pullDistance = 0;
        const threshold = 60;
        
        document.addEventListener('touchstart', (event) => {
            if (window.pageYOffset === 0) {
                startY = event.touches[0].pageY;
            }
        }, { passive: true });
        
        document.addEventListener('touchmove', (event) => {
            if (window.pageYOffset === 0 && startY) {
                pullDistance = event.touches[0].pageY - startY;
                
                if (pullDistance > 0 && pullDistance < threshold) {
                    // Show pull indicator
                    this.showPullIndicator(pullDistance / threshold);
                }
            }
        }, { passive: true });
        
        document.addEventListener('touchend', () => {
            if (pullDistance >= threshold) {
                // Trigger refresh
                this.triggerRefresh();
            }
            
            this.hidePullIndicator();
            startY = 0;
            pullDistance = 0;
        }, { passive: true });
    }

    /**
     * Show pull-to-refresh indicator
     */
    showPullIndicator(progress) {
        // Implementation would show a visual indicator
        console.log('Pull progress:', progress);
    }

    /**
     * Hide pull-to-refresh indicator
     */
    hidePullIndicator() {
        // Implementation would hide the visual indicator
    }

    /**
     * Trigger page refresh
     */
    triggerRefresh() {
        this.triggerHapticFeedback('medium');
        
        // Show loading state
        const refreshIndicator = document.createElement('div');
        refreshIndicator.className = 'refresh-indicator';
        refreshIndicator.innerHTML = '<div class="spinner-border text-primary"></div>';
        document.body.appendChild(refreshIndicator);
        
        // Simulate refresh (replace with actual refresh logic)
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
}

/**
 * QR Scanner Mobile Optimizations
 */
class MobileQRScanner {
    constructor() {
        this.isFullscreen = false;
        this.stream = null;
        this.init();
    }

    init() {
        this.setupFullscreenScanner();
        this.setupCameraOptimizations();
    }

    /**
     * Setup fullscreen QR scanner for mobile
     */
    setupFullscreenScanner() {
        const scannerButtons = document.querySelectorAll('[data-scanner="open"]');
        scannerButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.openFullscreenScanner();
            });
        });
    }

    /**
     * Open fullscreen QR scanner
     */
    async openFullscreenScanner() {
        // Create fullscreen scanner overlay
        const overlay = document.createElement('div');
        overlay.className = 'qr-scanner-fullscreen';
        overlay.innerHTML = this.getFullscreenTemplate();
        
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        
        // Trigger haptic feedback
        if (window.mobileOptimizer) {
            window.mobileOptimizer.triggerHapticFeedback('medium');
        }
        
        // Initialize camera
        await this.initializeCamera(overlay.querySelector('.qr-video'));
        
        // Setup close button
        overlay.querySelector('.qr-scanner-close').addEventListener('click', () => {
            this.closeFullscreenScanner(overlay);
        });
        
        // Handle back button on Android
        if (window.mobileOptimizer && window.mobileOptimizer.isAndroid) {
            this.handleAndroidBack(overlay);
        }
    }

    /**
     * Get fullscreen scanner template
     */
    getFullscreenTemplate() {
        return `
            <div class="qr-scanner-header safe-area-top">
                <h3 class="qr-scanner-title">สแกน QR Code</h3>
                <button class="qr-scanner-close" type="button">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="qr-camera-container">
                <video class="qr-video" autoplay playsinline></video>
                <div class="qr-scanner-overlay">
                    <div class="qr-scanner-box">
                        <div class="qr-scanner-corners">
                            <div class="qr-corner qr-corner-tl"></div>
                            <div class="qr-corner qr-corner-tr"></div>
                            <div class="qr-corner qr-corner-bl"></div>
                            <div class="qr-corner qr-corner-br"></div>
                        </div>
                        <div class="qr-scan-line"></div>
                    </div>
                </div>
            </div>
            
            <div class="qr-scanner-footer safe-area-bottom">
                <p class="qr-scanner-instruction">
                    <i class="fas fa-camera me-2"></i>
                    นำกล้องไปที่ QR Code บนผลิตภัณฑ์
                </p>
                <div class="qr-scanner-controls">
                    <button class="btn btn-outline-light" onclick="this.closest('.qr-scanner-fullscreen').querySelector('.qr-scanner-close').click()">
                        <i class="fas fa-times me-2"></i>ปิด
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Initialize camera for QR scanning
     */
    async initializeCamera(videoElement) {
        try {
            const constraints = {
                video: {
                    facingMode: 'environment', // Back camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = this.stream;
            
            // Start QR detection when video is ready
            videoElement.addEventListener('loadedmetadata', () => {
                this.startQRDetection(videoElement);
            });
            
        } catch (error) {
            console.error('Camera initialization failed:', error);
            this.handleCameraError(error);
        }
    }

    /**
     * Start QR code detection
     */
    startQRDetection(videoElement) {
        if (typeof QrScanner !== 'undefined') {
            const qrScanner = new QrScanner(
                videoElement,
                (result) => {
                    this.handleQRDetected(result);
                },
                {
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    maxScansPerSecond: 5
                }
            );
            
            qrScanner.start();
            
            // Store reference for cleanup
            videoElement.qrScanner = qrScanner;
        }
    }

    /**
     * Handle QR code detection
     */
    handleQRDetected(result) {
        // Trigger haptic feedback
        if (window.mobileOptimizer) {
            window.mobileOptimizer.triggerHapticFeedback('heavy');
        }
        
        // Process QR code
        if (typeof processQRCode === 'function') {
            processQRCode(result.data);
        }
        
        // Close scanner
        const overlay = document.querySelector('.qr-scanner-fullscreen');
        if (overlay) {
            this.closeFullscreenScanner(overlay);
        }
    }

    /**
     * Close fullscreen scanner
     */
    closeFullscreenScanner(overlay) {
        // Stop camera stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Stop QR scanner
        const video = overlay.querySelector('.qr-video');
        if (video && video.qrScanner) {
            video.qrScanner.destroy();
        }
        
        // Remove overlay
        document.body.removeChild(overlay);
        document.body.style.overflow = '';
    }

    /**
     * Handle camera access errors
     */
    handleCameraError(error) {
        let message = 'ไม่สามารถเข้าถึงกล้องได้';
        
        if (error.name === 'NotAllowedError') {
            message = 'กรุณาอนุญาตการใช้งานกล้องในการตั้งค่าเบราว์เซอร์';
        } else if (error.name === 'NotFoundError') {
            message = 'ไม่พบกล้องในอุปกรณ์';
        } else if (error.name === 'NotSupportedError') {
            message = 'เบราว์เซอร์ไม่รองรับการใช้งานกล้อง';
        }
        
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: message,
                confirmButtonColor: '#198754'
            });
        } else {
            alert(message);
        }
    }

    /**
     * Handle Android back button
     */
    handleAndroidBack(overlay) {
        const handleBackButton = (event) => {
            event.preventDefault();
            this.closeFullscreenScanner(overlay);
            window.removeEventListener('popstate', handleBackButton);
        };
        
        // Push a dummy state
        history.pushState(null, null, window.location.href);
        window.addEventListener('popstate', handleBackButton);
    }

    /**
     * Setup camera optimizations
     */
    setupCameraOptimizations() {
        // Add camera permission request button
        const requestCameraBtn = document.getElementById('requestCameraPermission');
        if (requestCameraBtn) {
            requestCameraBtn.addEventListener('click', async () => {
                try {
                    await navigator.mediaDevices.getUserMedia({ video: true });
                    requestCameraBtn.style.display = 'none';
                } catch (error) {
                    this.handleCameraError(error);
                }
            });
        }
    }
}

// Initialize mobile optimizations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize mobile optimizer
    window.mobileOptimizer = new MobileOptimizer();
    
    // Initialize mobile QR scanner
    window.mobileQRScanner = new MobileQRScanner();
    
    // Setup lazy loading
    window.mobileOptimizer.setupLazyLoading();
    
    // Optimize images for mobile
    window.mobileOptimizer.optimizeImages();
    
    // Request haptic permission on first user interaction
    document.addEventListener('click', async function requestHaptic() {
        if (window.mobileOptimizer && window.mobileOptimizer.isIOS) {
            await window.mobileOptimizer.requestHapticPermission();
        }
        document.removeEventListener('click', requestHaptic);
    }, { once: true });
    
    console.log('Mobile optimizations initialized');
});