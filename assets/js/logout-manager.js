/**
 * Enhanced Logout Manager System
 * Combines mobile auto logout and desktop logout functionality
 * Supports both desktop and mobile environments with comprehensive monitoring
 */

class LogoutManager {
    constructor(config = {}) {
        // Merge mobile and desktop configurations
        this.config = {
            // Basic session settings
            sessionTimeout: config.sessionTimeout || 30 * 60 * 1000, // 30 minutes
            warningTime: config.warningTime || 5 * 60 * 1000, // 5 minutes warning
            idleTimeout: config.idleTimeout || 15 * 60 * 1000, // 15 minutes idle
            extendTime: config.extendTime || 30 * 60 * 1000, // 30 minutes extension
            
            // Mobile-specific settings
            batteryThreshold: config.batteryThreshold || 10, // 10% battery warning
            enableVibration: config.enableVibration !== false,
            enableSound: config.enableSound !== false,
            backgroundSyncEnabled: config.backgroundSyncEnabled !== false,
            
            // Activity detection settings
            touchSensitivity: config.touchSensitivity || 3,
            gestureMinDistance: config.gestureMinDistance || 30,
            orientationDelay: config.orientationDelay || 500,
            
            // Performance settings
            throttleInterval: config.throttleInterval || 100,
            memoryCheckInterval: config.memoryCheckInterval || 30000,
            
            ...config
        };

        // Session data
        this.sessionData = {
            loginTime: new Date(),
            sessionDuration: this.config.sessionTimeout,
            warningTime: this.config.warningTime,
            idleTimeout: this.config.idleTimeout,
            lastActivity: new Date()
        };
        
        // Timers management
        this.timers = {
            sessionTimer: null,
            idleTimer: null,
            warningTimer: null,
            countdownTimer: null,
            uiTimer: null,
            memoryTimer: null,
            batteryTimer: null
        };

        // State management
        this.state = {
            isActive: true,
            sessionStartTime: Date.now(),
            lastActivityTime: Date.now(),
            currentWarningType: null,
            isBackground: false,
            deviceState: 'active',
            networkStatus: 'online',
            batteryLevel: 100,
            batteryCharging: true,
            
            // Activity counters
            touchCount: 0,
            gestureCount: 0,
            orientationCount: 0,
            
            // Performance metrics
            memoryUsage: 0,
            activeTimers: new Set(),
            eventListeners: new Map()
        };

        // Mobile-specific properties
        this.touchData = {
            startX: 0,
            startY: 0,
            startTime: 0,
            touches: []
        };

        // Detect device capabilities
        this.deviceCapabilities = {
            isMobile: this.isMobileDevice(),
            hasVibration: 'vibrate' in navigator,
            hasDeviceOrientation: 'DeviceOrientationEvent' in window,
            hasDeviceMotion: 'DeviceMotionEvent' in window,
            hasBattery: 'getBattery' in navigator,
            hasServiceWorker: 'serviceWorker' in navigator,
            hasVisibilityAPI: 'visibilityState' in document,
            hasWakeLock: 'wakeLock' in navigator,
            hasNetworkInfo: 'connection' in navigator
        };

        this.init();
    }

    /**
     * Initialize the logout manager system
     */
    async init() {
        try {
            console.log('Initializing Logout Manager for', this.deviceCapabilities.isMobile ? 'Mobile' : 'Desktop');
            
            // Setup device monitoring (mobile features)
            if (this.deviceCapabilities.isMobile) {
                await this.setupDeviceMonitoring();
            }
            
            // Setup activity detection
            this.setupActivityListeners();
            
            // Setup UI elements
            this.setupUI();
            
            // Start monitoring loops
            this.startMonitoring();
            
            // Register service worker for PWA (mobile)
            if (this.deviceCapabilities.hasServiceWorker && this.deviceCapabilities.isMobile) {
                await this.registerServiceWorker();
            }
            
            console.log('Logout Manager initialized successfully');
            
            if (this.deviceCapabilities.isMobile) {
                this.showToast('System initialized', 'success');
            }
            
        } catch (error) {
            console.error('Failed to initialize Logout Manager:', error);
        }
    }

    /**
     * Check if device is mobile
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.innerWidth <= 768);
    }

    /**
     * Setup device state monitoring (Mobile features)
     */
    async setupDeviceMonitoring() {
        // Battery API
        if (this.deviceCapabilities.hasBattery) {
            try {
                const battery = await navigator.getBattery();
                
                this.state.batteryLevel = Math.round(battery.level * 100);
                this.state.batteryCharging = battery.charging;
                this.updateBatteryDisplay();
                
                // Battery event listeners
                this.addEventListenerSafe(battery, 'levelchange', () => {
                    this.state.batteryLevel = Math.round(battery.level * 100);
                    this.updateBatteryDisplay();
                    this.checkBatteryWarning();
                });
                
                this.addEventListenerSafe(battery, 'chargingchange', () => {
                    this.state.batteryCharging = battery.charging;
                    this.updateBatteryDisplay();
                });
                
            } catch (error) {
                console.warn('Battery API not supported:', error);
            }
        }

        // Network Information API
        if (this.deviceCapabilities.hasNetworkInfo) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection) {
                this.addEventListenerSafe(connection, 'change', () => {
                    this.handleNetworkChange();
                });
            }
        }

        // Online/Offline events
        this.addEventListenerSafe(window, 'online', () => {
            this.state.networkStatus = 'online';
            this.updateNetworkDisplay();
            this.handleNetworkReconnection();
        });

        this.addEventListenerSafe(window, 'offline', () => {
            this.state.networkStatus = 'offline';
            this.updateNetworkDisplay();
            this.handleNetworkDisconnection();
        });

        // Page Visibility API
        if (this.deviceCapabilities.hasVisibilityAPI) {
            this.addEventListenerSafe(document, 'visibilitychange', () => {
                this.handleVisibilityChange();
            });
        }

        // App lifecycle events (PWA)
        this.addEventListenerSafe(window, 'beforeunload', (e) => {
            this.handleAppClose();
        });

        this.addEventListenerSafe(window, 'pagehide', () => {
            this.handleAppBackground();
        });

        this.addEventListenerSafe(window, 'pageshow', () => {
            this.handleAppForeground();
        });
    }

    /**
     * Setup comprehensive activity detection
     */
    setupActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            this.addEventListenerSafe(document, event, 
                this.throttle(() => this.updateLastActivity(event), this.config.throttleInterval),
                { passive: true }
            );
        });

        // Mobile-specific touch events
        if (this.deviceCapabilities.isMobile) {
            const touchEvents = ['touchstart', 'touchmove', 'touchend'];
            touchEvents.forEach(event => {
                this.addEventListenerSafe(document, event, 
                    this.throttle((e) => this.handleTouchActivity(e), this.config.throttleInterval),
                    { passive: true }
                );
            });

            // Device orientation
            if (this.deviceCapabilities.hasDeviceOrientation) {
                let orientationTimer;
                this.addEventListenerSafe(window, 'orientationchange', () => {
                    clearTimeout(orientationTimer);
                    orientationTimer = setTimeout(() => {
                        this.handleOrientationChange();
                    }, this.config.orientationDelay);
                });
            }

            // Device motion (optional - can be battery intensive)
            if (this.deviceCapabilities.hasDeviceMotion && this.config.enableMotionDetection) {
                this.addEventListenerSafe(window, 'devicemotion',
                    this.throttle((e) => this.handleDeviceMotion(e), 1000),
                    { passive: true }
                );
            }
        }

        // Focus events
        this.addEventListenerSafe(window, 'focus', () => this.handleWindowFocus());
        this.addEventListenerSafe(window, 'blur', () => this.handleWindowBlur());
    }

    /**
     * Handle touch activity with gesture detection (Mobile)
     */
    handleTouchActivity(event) {
        this.updateActivity('touch');
        this.state.touchCount++;
        this.updateActivityStats();

        // Gesture detection
        switch(event.type) {
            case 'touchstart':
                this.handleTouchStart(event);
                break;
            case 'touchmove':
                this.handleTouchMove(event);
                break;
            case 'touchend':
                this.handleTouchEnd(event);
                break;
        }
    }

    /**
     * Handle touch start for gesture detection
     */
    handleTouchStart(event) {
        const touch = event.touches[0];
        this.touchData.startX = touch.clientX;
        this.touchData.startY = touch.clientY;
        this.touchData.startTime = Date.now();
        this.touchData.touches = Array.from(event.touches);

        // Multi-touch detection
        if (event.touches.length > 1) {
            this.handleMultiTouch(event);
        }
    }

    /**
     * Handle touch move for swipe detection
     */
    handleTouchMove(event) {
        if (this.touchData.startTime === 0) return;

        const touch = event.touches[0];
        const deltaX = touch.clientX - this.touchData.startX;
        const deltaY = touch.clientY - this.touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > this.config.gestureMinDistance) {
            this.detectSwipeDirection(deltaX, deltaY);
        }
    }

    /**
     * Handle touch end
     */
    handleTouchEnd(event) {
        const duration = Date.now() - this.touchData.startTime;
        this.touchData.startTime = 0;
    }

    /**
     * Handle multi-touch gestures
     */
    handleMultiTouch(event) {
        if (event.touches.length === 2) {
            this.log('Pinch/zoom gesture detected');
            this.state.gestureCount++;
            this.updateActivity('gesture');
        }
    }

    /**
     * Detect swipe direction
     */
    detectSwipeDirection(deltaX, deltaY) {
        const threshold = this.config.gestureMinDistance;
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (Math.abs(deltaX) > threshold) {
                const direction = deltaX > 0 ? 'right' : 'left';
                this.log(`Swipe ${direction} detected`);
                this.state.gestureCount++;
                this.updateActivity('swipe');
            }
        } else {
            if (Math.abs(deltaY) > threshold) {
                const direction = deltaY > 0 ? 'down' : 'up';
                this.log(`Swipe ${direction} detected`);
                this.state.gestureCount++;
                this.updateActivity('swipe');
            }
        }
    }

    /**
     * Handle orientation change
     */
    handleOrientationChange() {
        this.state.orientationCount++;
        this.updateActivity('orientation');
        this.updateActivityStats();
        this.log('Device orientation changed');
        
        // Adjust UI for new orientation
        setTimeout(() => this.adjustUIForOrientation(), 100);
    }

    /**
     * Handle device motion (accelerometer/gyroscope)
     */
    handleDeviceMotion(event) {
        const acceleration = event.acceleration || event.accelerationIncludingGravity;
        if (acceleration) {
            const totalAcceleration = Math.abs(acceleration.x) + Math.abs(acceleration.y) + Math.abs(acceleration.z);
            if (totalAcceleration > 10) { // Threshold for significant movement
                this.updateActivity('motion');
            }
        }
    }

    /**
     * Handle window focus
     */
    handleWindowFocus() {
        this.state.isBackground = false;
        this.updateActivity('focus');
        this.log('App gained focus');
    }

    /**
     * Handle window blur
     */
    handleWindowBlur() {
        this.state.isBackground = true;
        this.log('App lost focus');
    }

    /**
     * Handle visibility change (app switch detection)
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.handleAppForeground();
        } else {
            this.handleAppBackground();
        }
    }

    /**
     * Handle app going to background
     */
    handleAppBackground() {
        this.state.isBackground = true;
        this.state.deviceState = 'background';
        this.log('App switched to background');
        
        // Store session state for background sync
        if (this.config.backgroundSyncEnabled) {
            this.storeSessionState();
        }
        
        // Reduce activity monitoring frequency
        this.adjustMonitoringFrequency('background');
    }

    /**
     * Handle app coming to foreground
     */
    handleAppForeground() {
        this.state.isBackground = false;
        this.state.deviceState = 'active';
        this.updateActivity('foreground');
        this.log('App switched to foreground');
        
        // Resume normal monitoring
        this.adjustMonitoringFrequency('foreground');
        
        // Check session validity
        this.validateSession();
    }

    /**
     * Handle network disconnection
     */
    handleNetworkDisconnection() {
        this.log('Network disconnected');
        if (this.deviceCapabilities.isMobile) {
            this.showOfflineIndicator();
        }
        this.storeSessionState();
    }

    /**
     * Handle network reconnection
     */
    handleNetworkReconnection() {
        this.log('Network reconnected');
        if (this.deviceCapabilities.isMobile) {
            this.hideOfflineIndicator();
        }
        this.validateSessionWithServer();
    }

    /**
     * Handle app close
     */
    handleAppClose() {
        this.storeSessionState();
        this.cleanup();
    }

    /**
     * Update activity timestamp and reset idle timer
     */
    updateActivity(type) {
        this.state.lastActivityTime = Date.now();
        this.sessionData.lastActivity = new Date();
        this.resetIdleTimer();
        
        // Log activity
        this.logActivity(type);
        
        // Cancel any active warnings if user is active
        if (this.state.currentWarningType) {
            this.cancelWarning();
        }
    }

    /**
     * Update last activity (compatibility method)
     */
    updateLastActivity(eventType = 'general') {
        this.updateActivity(eventType);
    }

    /**
     * Log activity to UI
     */
    logActivity(type) {
        if (!this.deviceCapabilities.isMobile) return;
        
        const logContainer = document.getElementById('activityLog');
        if (!logContainer) return;

        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-icon bg-primary text-white">
                <i class="fas fa-${this.getActivityIcon(type)}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${this.getActivityTitle(type)}</div>
                <div class="activity-time">${new Date().toLocaleTimeString('th-TH')}</div>
            </div>
        `;

        logContainer.insertBefore(activityItem, logContainer.firstChild);

        // Keep only last 10 activities
        while (logContainer.children.length > 10) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    /**
     * Get icon for activity type
     */
    getActivityIcon(type) {
        const icons = {
            touch: 'hand-point-up',
            gesture: 'hand-paper',
            swipe: 'arrows-alt',
            mouse: 'mouse-pointer',
            keyboard: 'keyboard',
            scroll: 'scroll',
            orientation: 'mobile-alt',
            motion: 'running',
            focus: 'eye',
            foreground: 'window-restore',
            general: 'circle'
        };
        return icons[type] || 'circle';
    }

    /**
     * Get title for activity type
     */
    getActivityTitle(type) {
        const titles = {
            touch: 'Touch detected',
            gesture: 'Gesture performed',
            swipe: 'Swipe gesture',
            mouse: 'Mouse activity',
            keyboard: 'Keyboard input',
            scroll: 'Scroll activity',
            orientation: 'Orientation changed',
            motion: 'Device movement',
            focus: 'App focused',
            foreground: 'App foreground',
            general: 'Activity detected'
        };
        return titles[type] || 'Activity detected';
    }

    /**
     * Setup UI elements
     */
    setupUI() {
        this.updateSessionDisplay();
        if (this.deviceCapabilities.isMobile) {
            this.updateBatteryDisplay();
            this.updateNetworkDisplay();
            this.updateActivityStats();
            this.adjustUIForOrientation();
        }
    }

    /**
     * Start monitoring loops
     */
    startMonitoring() {
        // Session timer
        this.startTimer('session', () => {
            this.checkSessionTimeout();
        }, 1000);

        // Idle timer
        this.resetIdleTimer();

        // UI update timer
        this.startTimer('ui', () => {
            this.updateSessionDisplay();
            if (this.deviceCapabilities.isMobile) {
                this.updateProgressCircle();
            }
        }, 1000);

        if (this.deviceCapabilities.isMobile) {
            // Memory monitoring (mobile)
            this.startTimer('memory', () => {
                this.checkMemoryUsage();
            }, this.config.memoryCheckInterval);

            // Battery monitoring (mobile)
            this.startTimer('battery', () => {
                this.checkBatteryWarning();
            }, 60000); // Check every minute
        }
    }

    /**
     * Start a named timer
     */
    startTimer(name, callback, interval) {
        this.clearTimer(name);
        const timer = setInterval(callback, interval);
        this.state.activeTimers.set(name, timer);
        this.timers[name] = timer;
    }

    /**
     * Clear a named timer
     */
    clearTimer(name) {
        const timer = this.state.activeTimers.get(name);
        if (timer) {
            clearInterval(timer);
            this.state.activeTimers.delete(name);
        }
        if (this.timers[name]) {
            clearTimeout(this.timers[name]);
            this.timers[name] = null;
        }
    }

    /**
     * Start session timer
     */
    startSessionTimer() {
        this.timers.sessionTimer = setTimeout(() => {
            this.showSessionExpiry(60); // 60 seconds warning
        }, this.sessionData.sessionDuration - this.sessionData.warningTime);
    }

    /**
     * Reset idle timer
     */
    resetIdleTimer() {
        this.clearTimer('idle');
        this.startTimer('idle', () => {
            this.handleIdleTimeout();
        }, this.config.idleTimeout);
    }

    /**
     * Check session timeout
     */
    checkSessionTimeout() {
        const elapsed = Date.now() - this.state.sessionStartTime;
        const remaining = this.config.sessionTimeout - elapsed;
        
        if (remaining <= 0) {
            this.handleSessionExpired();
        } else if (remaining <= this.config.warningTime && !this.state.currentWarningType) {
            this.showSessionWarning();
        }
    }

    /**
     * Handle idle timeout
     */
    handleIdleTimeout() {
        this.log('Idle timeout detected');
        this.showIdleWarning();
    }

    /**
     * Handle session expired
     */
    handleSessionExpired() {
        this.log('Session expired');
        this.performLogout('session_expired');
    }

    /**
     * Show session warning
     */
    showSessionWarning() {
        this.state.currentWarningType = 'session';
        if (this.deviceCapabilities.isMobile) {
            this.showMobileWarning('session');
        } else {
            this.showSessionExpiry(60);
        }
    }

    /**
     * Show idle warning
     */
    showIdleWarning() {
        this.state.currentWarningType = 'idle';
        if (this.deviceCapabilities.isMobile) {
            this.showMobileWarning('idle');
        } else {
            this.showIdleWarningModal(30);
        }
    }

    /**
     * Show session expiry modal (Desktop)
     */
    showSessionExpiry(countdown = 60) {
        const modal = new bootstrap.Modal(document.getElementById('sessionExpiryModal'));
        const countdownElement = document.getElementById('expiryCountdown');
        const progressElement = document.getElementById('expiryProgress');
        
        let timeLeft = countdown;
        
        const updateCountdown = () => {
            if (countdownElement) countdownElement.textContent = timeLeft;
            if (progressElement) {
                const progressPercentage = (timeLeft / countdown) * 100;
                progressElement.style.width = progressPercentage + '%';
            }
            
            if (timeLeft <= 0) {
                modal.hide();
                this.performLogout('session_expired');
                return;
            }
            
            timeLeft--;
        };

        updateCountdown();
        this.timers.countdownTimer = setInterval(updateCountdown, 1000);
        
        modal.show();
        
        // Clear timer when modal is hidden
        document.getElementById('sessionExpiryModal').addEventListener('hidden.bs.modal', () => {
            if (this.timers.countdownTimer) {
                clearInterval(this.timers.countdownTimer);
            }
        });
    }

    /**
     * Show idle warning modal (Desktop)
     */
    showIdleWarningModal(countdown = 30) {
        const modal = new bootstrap.Modal(document.getElementById('idleWarningModal'));
        const countdownElement = document.getElementById('idleCountdown');
        const circleElement = document.getElementById('idleCircle');
        const percentageElement = document.getElementById('idlePercentage');
        
        let timeLeft = countdown;
        
        const updateCountdown = () => {
            if (countdownElement) countdownElement.textContent = timeLeft;
            
            const progressPercentage = (timeLeft / countdown) * 100;
            
            // Update circular progress
            if (circleElement && percentageElement) {
                const circumference = 2 * Math.PI * 15.9155;
                const strokeDasharray = (progressPercentage / 100) * circumference;
                circleElement.style.strokeDasharray = `${strokeDasharray}, ${circumference}`;
                percentageElement.textContent = `${Math.round(progressPercentage)}%`;
            }
            
            if (timeLeft <= 0) {
                modal.hide();
                this.performLogout('idle_timeout');
                return;
            }
            
            timeLeft--;
        };

        updateCountdown();
        this.timers.countdownTimer = setInterval(updateCountdown, 1000);
        
        modal.show();
        
        document.getElementById('idleWarningModal').addEventListener('hidden.bs.modal', () => {
            if (this.timers.countdownTimer) {
                clearInterval(this.timers.countdownTimer);
            }
        });
    }

    /**
     * Show mobile warning modal
     */
    showMobileWarning(type) {
        const modal = document.getElementById('mobileWarningModal');
        const modalInstance = new bootstrap.Modal(modal, {
            backdrop: 'static',
            keyboard: false
        });

        // Update modal content based on type
        this.updateWarningContent(type);

        // Start countdown
        this.startWarningCountdown();

        // Show modal
        modalInstance.show();

        // Mobile-specific feedback
        this.provideMobileFeedback();
    }

    /**
     * Update warning modal content
     */
    updateWarningContent(type) {
        const title = type === 'session' ? 'Session Timeout Warning' : 'Inactivity Warning';
        const message = type === 'session' ? 
            'Your session will expire soon' : 
            'You will be logged out due to inactivity';

        const titleElement = document.querySelector('#mobileWarningModal h3');
        const messageElement = document.querySelector('#mobileWarningModal p.lead');
        
        if (titleElement) titleElement.textContent = title;
        if (messageElement) messageElement.textContent = message;
    }

    /**
     * Start warning countdown
     */
    startWarningCountdown(seconds = 30) {
        const countdownElement = document.getElementById('countdownText');
        const circleElement = document.getElementById('countdownCircle');
        
        let timeLeft = seconds;
        
        this.clearTimer('countdown');
        this.startTimer('countdown', () => {
            if (countdownElement) countdownElement.textContent = timeLeft;
            
            // Update circle progress
            if (circleElement) {
                const progress = (timeLeft / seconds) * 100;
                const circumference = 2 * Math.PI * 15.9155;
                const strokeDasharray = (progress / 100) * circumference;
                circleElement.style.strokeDasharray = `${strokeDasharray}, ${circumference}`;
            }
            
            if (timeLeft <= 0) {
                this.clearTimer('countdown');
                this.hideWarningModal();
                this.performLogout('timeout');
                return;
            }
            
            // Visual feedback for last 10 seconds
            if (timeLeft <= 10) {
                this.provideCriticalFeedback();
            }
            
            timeLeft--;
        }, 1000);
    }

    /**
     * Provide mobile-specific feedback
     */
    provideMobileFeedback() {
        // Vibration
        if (this.deviceCapabilities.hasVibration && this.config.enableVibration) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }

        // Sound (if enabled)
        if (this.config.enableSound) {
            this.playWarningSound();
        }

        // Visual feedback
        document.body.classList.add('vibrating');
        setTimeout(() => {
            document.body.classList.remove('vibrating');
        }, 500);
    }

    /**
     * Provide critical feedback for last seconds
     */
    provideCriticalFeedback() {
        if (this.deviceCapabilities.hasVibration && this.config.enableVibration) {
            navigator.vibrate(100);
        }
    }

    /**
     * Play warning sound
     */
    playWarningSound() {
        try {
            // Create audio context for warning sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.warn('Could not play warning sound:', error);
        }
    }

    /**
     * Cancel current warning
     */
    cancelWarning() {
        this.state.currentWarningType = null;
        this.clearTimer('countdown');
        this.hideWarningModal();
    }

    /**
     * Hide warning modal
     */
    hideWarningModal() {
        const mobileModal = document.getElementById('mobileWarningModal');
        if (mobileModal) {
            const modal = bootstrap.Modal.getInstance(mobileModal);
            if (modal) modal.hide();
        }
        
        const desktopModals = ['sessionExpiryModal', 'idleWarningModal'];
        desktopModals.forEach(modalId => {
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) modal.hide();
            }
        });
    }

    /**
     * Extend session
     */
    extendSession() {
        // Add extension time
        this.sessionData.sessionDuration += this.config.extendTime;
        this.state.sessionStartTime = Date.now();
        
        this.updateActivity('extend');
        this.cancelWarning();
        
        if (this.deviceCapabilities.isMobile) {
            this.showToast('Session extended successfully', 'success');
        } else {
            this.showToast('sessionToast', 'เซสชันถูกขยายเวลาแล้ว 30 นาที');
        }
        
        this.log('Session extended by user');
        
        // Restart timers
        this.clearTimers();
        this.startSessionTimer();
    }

    /**
     * Continue session (from idle warning)
     */
    continueSession() {
        this.updateActivity('continue');
        this.cancelWarning();
        
        if (this.deviceCapabilities.isMobile) {
            this.showToast('Welcome back!', 'success');
        } else {
            this.showToast('sessionToast', 'กลับมาใช้งานแล้ว');
        }
        
        this.log('Session continued by user');
    }

    /**
     * Update session display
     */
    updateSessionDisplay() {
        const elapsed = this.deviceCapabilities.isMobile ? 
            Date.now() - this.state.sessionStartTime :
            Date.now() - this.sessionData.loginTime.getTime();
            
        const remaining = Math.max(0, this.config.sessionTimeout - elapsed);
        
        // Update time display
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        const sessionTimeElement = document.getElementById('sessionTime') || 
                                 document.getElementById('timeRemaining');
        if (sessionTimeElement) {
            sessionTimeElement.textContent = timeDisplay;
            
            // Change color when time is low
            if (remaining < this.config.warningTime) {
                sessionTimeElement.className = 'text-warning fw-bold';
            } else if (remaining < 60000) {
                sessionTimeElement.className = 'text-danger fw-bold';
            } else {
                sessionTimeElement.className = 'text-success fw-bold';
            }
        }

        // Update status badge (mobile)
        const statusElement = document.getElementById('sessionStatus');
        if (statusElement) {
            if (remaining < this.config.warningTime) {
                statusElement.className = 'badge bg-warning';
                statusElement.textContent = 'Warning';
            } else if (remaining < 60000) {
                statusElement.className = 'badge bg-danger';
                statusElement.textContent = 'Critical';
            } else {
                statusElement.className = 'badge bg-success';
                statusElement.textContent = 'Active';
            }
        }

        // Update circular progress
        const progressPercentage = (remaining / this.config.sessionTimeout) * 100;
        this.updateCircularProgress(progressPercentage);
        
        // Update login time display
        const loginTimeElement = document.getElementById('loginTime');
        if (loginTimeElement) {
            const loginTime = this.deviceCapabilities.isMobile ? 
                new Date(this.state.sessionStartTime) : 
                this.sessionData.loginTime;
            loginTimeElement.textContent = loginTime.toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    /**
     * Update circular progress
     */
    updateCircularProgress(percentage) {
        const circles = document.querySelectorAll('.circular-chart .circle');
        circles.forEach(circle => {
            const circumference = 2 * Math.PI * 15.9155;
            const strokeDasharray = (percentage / 100) * circumference;
            circle.style.strokeDasharray = `${strokeDasharray}, ${circumference}`;
        });

        const percentageTexts = document.querySelectorAll('.circular-chart .percentage');
        percentageTexts.forEach(text => {
            text.textContent = `${Math.round(percentage)}%`;
        });
    }

    /**
     * Update progress circle (mobile specific)
     */
    updateProgressCircle() {
        const elapsed = Date.now() - this.state.sessionStartTime;
        const progress = Math.max(0, 100 - (elapsed / this.config.sessionTimeout) * 100);
        
        const circle = document.getElementById('sessionCircle');
        const percentage = document.getElementById('sessionPercentage');
        
        if (circle && percentage) {
            const circumference = 2 * Math.PI * 15.9155;
            const strokeDasharray = (progress / 100) * circumference;
            circle.style.strokeDasharray = `${strokeDasharray}, ${circumference}`;
            percentage.textContent = `${Math.round(progress)}%`;
        }
    }

    /**
     * Update battery display (mobile)
     */
    updateBatteryDisplay() {
        const batteryElement = document.getElementById('batteryLevel');
        const batteryIcon = document.querySelector('#batteryIndicator i');
        
        if (batteryElement) {
            batteryElement.textContent = `${this.state.batteryLevel}%`;
        }
        
        if (batteryIcon) {
            let iconClass = 'fas ';
            if (this.state.batteryLevel > 75) {
                iconClass += 'fa-battery-full text-success';
            } else if (this.state.batteryLevel > 50) {
                iconClass += 'fa-battery-three-quarters text-success';
            } else if (this.state.batteryLevel > 25) {
                iconClass += 'fa-battery-half text-warning';
            } else if (this.state.batteryLevel > 10) {
                iconClass += 'fa-battery-quarter text-warning';
            } else {
                iconClass += 'fa-battery-empty text-danger';
            }
            
            batteryIcon.className = iconClass;
        }
    }

    /**
     * Update network display (mobile)
     */
    updateNetworkDisplay() {
        const networkIcon = document.getElementById('networkStatus');
        
        if (networkIcon) {
            if (this.state.networkStatus === 'online') {
                networkIcon.className = 'fas fa-wifi text-success';
            } else {
                networkIcon.className = 'fas fa-wifi-slash text-danger';
            }
        }
    }

    /**
     * Update activity statistics (mobile)
     */
    updateActivityStats() {
        const touchElement = document.getElementById('touchCount');
        const gestureElement = document.getElementById('gestureCount');
        const orientationElement = document.getElementById('orientationCount');

        if (touchElement) touchElement.textContent = this.state.touchCount;
        if (gestureElement) gestureElement.textContent = this.state.gestureCount;
        if (orientationElement) orientationElement.textContent = this.state.orientationCount;
    }

    /**
     * Adjust UI for orientation (mobile)
     */
    adjustUIForOrientation() {
        if (!this.deviceCapabilities.isMobile) return;
        
        const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        document.body.className = document.body.className.replace(/(portrait|landscape)/g, '') + ' ' + orientation;
    }

    /**
     * Check battery warning (mobile)
     */
    checkBatteryWarning() {
        if (this.state.batteryLevel <= this.config.batteryThreshold && !this.state.batteryCharging) {
            this.showToast(`Low battery: ${this.state.batteryLevel}%`, 'warning');
        }
    }

    /**
     * Check memory usage (mobile)
     */
    checkMemoryUsage() {
        if ('memory' in performance) {
            const memInfo = performance.memory;
            this.state.memoryUsage = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
            
            if (this.state.memoryUsage > 0.9) {
                this.log('High memory usage detected');
                this.optimizeMemoryUsage();
            }
        }
    }

    /**
     * Optimize memory usage (mobile)
     */
    optimizeMemoryUsage() {
        // Clear old activity logs
        const logContainer = document.getElementById('activityLog');
        if (logContainer && logContainer.children.length > 5) {
            while (logContainer.children.length > 5) {
                logContainer.removeChild(logContainer.lastChild);
            }
        }

        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }

    /**
     * Adjust monitoring frequency based on device state
     */
    adjustMonitoringFrequency(state) {
        if (state === 'background') {
            // Reduce frequency when in background
            this.clearTimer('ui');
            this.startTimer('ui', () => this.updateSessionDisplay(), 5000); // Update every 5 seconds
        } else {
            // Resume normal frequency
            this.clearTimer('ui');
            this.startTimer('ui', () => this.updateSessionDisplay(), 1000); // Update every second
        }
    }

    /**
     * Show offline indicator (mobile)
     */
    showOfflineIndicator() {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.remove('d-none');
            indicator.classList.add('show');
        }
    }

    /**
     * Hide offline indicator (mobile)
     */
    hideOfflineIndicator() {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.remove('show');
            setTimeout(() => {
                indicator.classList.add('d-none');
            }, 300);
        }
    }

    /**
     * Store session state for offline/background handling
     */
    storeSessionState() {
        try {
            const sessionState = {
                sessionStartTime: this.state.sessionStartTime,
                lastActivityTime: this.state.lastActivityTime,
                touchCount: this.state.touchCount,
                gestureCount: this.state.gestureCount,
                orientationCount: this.state.orientationCount,
                timestamp: Date.now()
            };
            
            localStorage.setItem('logoutManagerState', JSON.stringify(sessionState));
        } catch (error) {
            console.warn('Could not store session state:', error);
        }
    }

    /**
     * Restore session state
     */
    restoreSessionState() {
        try {
            const stored = localStorage.getItem('logoutManagerState');
            if (stored) {
                const sessionState = JSON.parse(stored);
                
                // Only restore if not too old
                if (Date.now() - sessionState.timestamp < this.config.sessionTimeout) {
                    this.state.sessionStartTime = sessionState.sessionStartTime;
                    this.state.lastActivityTime = sessionState.lastActivityTime;
                    this.state.touchCount = sessionState.touchCount || 0;
                    this.state.gestureCount = sessionState.gestureCount || 0;
                    this.state.orientationCount = sessionState.orientationCount || 0;
                }
                
                localStorage.removeItem('logoutManagerState');
            }
        } catch (error) {
            console.warn('Could not restore session state:', error);
        }
    }

    /**
     * Validate session
     */
    validateSession() {
        const elapsed = Date.now() - this.state.sessionStartTime;
        if (elapsed > this.config.sessionTimeout) {
            this.performLogout('session_expired');
        }
    }

    /**
     * Validate session with server
     */
    async validateSessionWithServer() {
        try {
            this.log('Validating session with server...');
            
            // Simulate API call - replace with actual implementation
            setTimeout(() => {
                this.log('Session validation completed');
            }, 1000);
        } catch (error) {
            console.error('Session validation failed:', error);
            this.performLogout('validation_failed');
        }
    }

    /**
     * Register service worker for PWA functionality (mobile)
     */
    async registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('mobile-logout-sw.js');
            this.log('Service worker registered successfully');
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleServiceWorkerMessage(event.data);
            });
        } catch (error) {
            console.warn('Service worker registration failed:', error);
        }
    }

    /**
     * Handle messages from service worker
     */
    handleServiceWorkerMessage(data) {
        switch (data.type) {
            case 'LOGOUT_REQUIRED':
                this.performLogout('background_timeout');
                break;
            case 'SESSION_WARNING':
                this.showMobileWarning('session');
                break;
            default:
                this.log(`Unknown message from service worker: ${data.type}`);
        }
    }

    /**
     * Show toast notification
     */
    showToast(messageOrToastId, typeOrMessage) {
        if (this.deviceCapabilities.isMobile && typeof messageOrToastId === 'string' && typeof typeOrMessage === 'string') {
            // Mobile toast (message, type)
            const toast = document.getElementById('mobileToast');
            const toastBody = document.getElementById('mobileToastBody');
            
            if (toastBody) {
                toastBody.textContent = messageOrToastId;
            }
            
            // Update toast style based on type
            const toastHeader = toast?.querySelector('.toast-header');
            const icon = toastHeader?.querySelector('i');
            
            // Remove existing type classes
            if (toast) {
                toast.className = 'toast mobile-toast';
                
                // Add type-specific styling
                switch (typeOrMessage) {
                    case 'success':
                        toast.classList.add('border-success');
                        if (icon) icon.className = 'fas fa-check-circle text-success me-2';
                        break;
                    case 'warning':
                        toast.classList.add('border-warning');
                        if (icon) icon.className = 'fas fa-exclamation-triangle text-warning me-2';
                        break;
                    case 'error':
                        toast.classList.add('border-danger');
                        if (icon) icon.className = 'fas fa-exclamation-circle text-danger me-2';
                        break;
                    default:
                        if (icon) icon.className = 'fas fa-info-circle text-primary me-2';
                }
                
                const bsToast = new bootstrap.Toast(toast);
                bsToast.show();
            }
        } else {
            // Desktop toast (toastId, message)
            const toastElement = document.getElementById(messageOrToastId);
            const toastBody = toastElement?.querySelector('.toast-body') || 
                             document.getElementById(messageOrToastId + 'Body');
            
            if (toastBody) {
                toastBody.textContent = typeOrMessage;
            }
            
            if (toastElement) {
                const toast = new bootstrap.Toast(toastElement);
                toast.show();
            }
        }
    }

    /**
     * Clear all timers
     */
    clearTimers() {
        Object.values(this.timers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        
        this.state.activeTimers.forEach((timer, name) => {
            clearInterval(timer);
        });
        this.state.activeTimers.clear();
    }

    /**
     * Perform logout
     */
    performLogout(reason = 'user') {
        this.log(`Performing logout: ${reason}`);
        
        // Clear all timers
        this.clearTimers();
        
        // Store final session data
        this.storeSessionState();
        
        // Hide any open modals
        this.hideAllModals();
        
        if (this.deviceCapabilities.isMobile) {
            // Show mobile loading overlay
            this.showLoadingOverlay();
            setTimeout(() => {
                this.showMobileLogoutSuccess();
            }, 2000);
        } else {
            // Show desktop logout success page
            this.showLogoutSuccessPage();
        }
    }

    /**
     * Show loading overlay (mobile)
     */
    showLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('d-none');
        }
    }

    /**
     * Hide loading overlay (mobile)
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('d-none');
        }
    }

    /**
     * Show mobile logout success page
     */
    showMobileLogoutSuccess() {
        this.hideLoadingOverlay();
        
        // Hide main content
        const mainContent = document.body.children[0];
        if (mainContent) mainContent.style.display = 'none';
        
        // Show success page
        const successPage = document.getElementById('mobileLogoutSuccess');
        if (successPage) {
            successPage.classList.remove('d-none');
            this.updateMobileLogoutSummary();
            this.startMobileRedirectCountdown();
        }
    }

    /**
     * Show logout success page (desktop)
     */
    showLogoutSuccessPage() {
        // Hide main content
        Array.from(document.body.children).forEach(child => {
            if (child.id !== 'logoutSuccessPage') {
                child.style.display = 'none';
            }
        });
        
        // Show success page
        const successPage = document.getElementById('logoutSuccessPage');
        if (successPage) {
            successPage.classList.remove('d-none');
            this.updateLogoutSummary();
            this.startRedirectCountdown();
        }
    }

    /**
     * Update mobile logout summary
     */
    updateMobileLogoutSummary() {
        const duration = Date.now() - this.state.sessionStartTime;
        const minutes = Math.floor(duration / 60000);
        const totalActivities = this.state.touchCount + this.state.gestureCount + this.state.orientationCount;

        const durationElement = document.getElementById('sessionDurationMobile');
        const activitiesElement = document.getElementById('totalActivitiesMobile');

        if (durationElement) {
            durationElement.textContent = `${minutes} minutes`;
        }

        if (activitiesElement) {
            activitiesElement.textContent = `${totalActivities} actions`;
        }
    }

    /**
     * Update logout summary (desktop)
     */
    updateLogoutSummary() {
        const now = new Date();
        const duration = now - this.sessionData.loginTime;
        
        // Login time
        const loginTimeElement = document.getElementById('summaryLoginTime');
        if (loginTimeElement) {
            loginTimeElement.textContent = this.sessionData.loginTime.toLocaleTimeString('th-TH');
        }
        
        // Logout time
        const logoutTimeElement = document.getElementById('summaryLogoutTime');
        if (logoutTimeElement) {
            logoutTimeElement.textContent = now.toLocaleTimeString('th-TH');
        }
        
        // Duration
        const durationElement = document.getElementById('summaryDuration');
        if (durationElement) {
            const hours = Math.floor(duration / 3600000);
            const minutes = Math.floor((duration % 3600000) / 60000);
            durationElement.textContent = `${hours} ชั่วโมง ${minutes} นาที`;
        }
    }

    /**
     * Start redirect countdown (mobile)
     */
    startMobileRedirectCountdown(seconds = 5) {
        const countElement = document.getElementById('mobileRedirectCount');
        const progressElement = document.getElementById('redirectProgress');
        
        let timeLeft = seconds;
        
        this.clearTimer('redirect');
        this.startTimer('redirect', () => {
            if (countElement) {
                countElement.textContent = timeLeft;
            }
            
            if (progressElement) {
                const progress = (timeLeft / seconds) * 100;
                progressElement.style.width = progress + '%';
            }
            
            if (timeLeft <= 0) {
                this.clearTimer('redirect');
                this.redirectToLogin();
                return;
            }
            
            timeLeft--;
        }, 1000);
    }

    /**
     * Start redirect countdown (desktop)
     */
    startRedirectCountdown(seconds = 5) {
        const countdownElement = document.getElementById('redirectCountdown');
        let timeLeft = seconds;
        
        const updateCountdown = () => {
            if (countdownElement) {
                countdownElement.textContent = timeLeft;
            }
            
            if (timeLeft <= 0) {
                this.redirectToLogin();
                return;
            }
            
            timeLeft--;
        };
        
        updateCountdown();
        setInterval(updateCountdown, 1000);
    }

    /**
     * Hide all modals
     */
    hideAllModals() {
        const modals = ['logoutModal', 'sessionExpiryModal', 'idleWarningModal', 'mobileWarningModal', 'mobileLogoutModal', 'emergencyLogoutModal'];
        modals.forEach(modalId => {
            const modalElement = document.getElementById(modalId);
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) modal.hide();
            }
        });
    }

    /**
     * Add event listener with tracking for cleanup
     */
    addEventListenerSafe(target, event, handler, options = {}) {
        target.addEventListener(event, handler, options);
        
        // Track for cleanup
        const key = `${target.constructor.name}_${event}`;
        if (!this.state.eventListeners.has(key)) {
            this.state.eventListeners.set(key, []);
        }
        this.state.eventListeners.get(key).push({ target, event, handler, options });
    }

    /**
     * Throttle function calls
     */
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    /**
     * Log with timestamp
     */
    log(message) {
        console.log(`[LogoutManager] ${new Date().toISOString()}: ${message}`);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear all timers
        this.clearTimers();
        
        // Remove all event listeners
        this.state.eventListeners.forEach((listeners, key) => {
            listeners.forEach(({ target, event, handler, options }) => {
                target.removeEventListener(event, handler, options);
            });
        });
        this.state.eventListeners.clear();
        
        this.log('Logout Manager cleaned up');
    }

    /**
     * Reset session
     */
    resetSession() {
        this.cleanup();
        
        // Reset state
        this.state.sessionStartTime = Date.now();
        this.state.lastActivityTime = Date.now();
        this.state.touchCount = 0;
        this.state.gestureCount = 0;
        this.state.orientationCount = 0;
        this.state.currentWarningType = null;
        
        this.sessionData.loginTime = new Date();
        this.sessionData.sessionDuration = this.config.sessionTimeout;
        this.sessionData.lastActivity = new Date();
        
        // Hide success page if shown
        const successPages = ['logoutSuccessPage', 'mobileLogoutSuccess'];
        successPages.forEach(pageId => {
            const successPage = document.getElementById(pageId);
            if (successPage && !successPage.classList.contains('d-none')) {
                successPage.classList.add('d-none');
                Array.from(document.body.children).forEach(child => {
                    if (!successPages.includes(child.id)) {
                        child.style.display = '';
                    }
                });
            }
        });
        
        // Close all modals
        this.hideAllModals();
        
        // Restart monitoring
        this.init();
        
        this.showToast(this.deviceCapabilities.isMobile ? 'Session reset successfully' : 'sessionToast', 
                      this.deviceCapabilities.isMobile ? 'success' : 'เซสชันถูกรีเซ็ตแล้ว');
        this.log('Session reset');
    }

    /**
     * Redirect to login page
     */
    redirectToLogin() {
        window.location.href = 'login.html';
    }

    /**
     * Go to home page
     */
    goToHomepage() {
        window.location.href = 'index.html';
    }
}

// Global functions for HTML event handlers
let logoutManager;

// Desktop functions
function showLogoutModal() {
    const modal = new bootstrap.Modal(document.getElementById('logoutModal'));
    modal.show();
}

function performLogout() {
    logoutManager.performLogout('user');
}

function extendSession() {
    logoutManager.extendSession();
}

function continueSession() {
    logoutManager.continueSession();
}

function startIdleTimer(seconds) {
    logoutManager.showIdleWarning(seconds);
}

function showSessionExpiry(seconds) {
    logoutManager.showSessionExpiry(seconds);
}

function resetSession() {
    logoutManager.resetSession();
}

function redirectToLogin() {
    logoutManager.redirectToLogin();
}

function goToHomepage() {
    logoutManager.goToHomepage();
}

// Mobile functions
function showMobileLogoutModal() {
    const modal = new bootstrap.Modal(document.getElementById('mobileLogoutModal'));
    modal.show();
}

function performMobileLogout() {
    logoutManager.performLogout('user');
}

function extendMobileSession() {
    logoutManager.extendSession();
}

function continueMobileSession() {
    logoutManager.continueSession();
}

function resetMobileSession() {
    logoutManager.resetSession();
}

function redirectToMobileLogin() {
    logoutManager.redirectToLogin();
}

function goToMobileHome() {
    logoutManager.goToHomepage();
}

// Emergency logout
function showEmergencyLogout() {
    const modal = new bootstrap.Modal(document.getElementById('emergencyLogoutModal'));
    const progressElement = document.getElementById('emergencyProgress');
    
    modal.show();
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += 20;
        if (progressElement) progressElement.style.width = progress + '%';
        
        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                modal.hide();
                logoutManager.performLogout('emergency');
            }, 500);
        }
    }, 200);
}

// Simulation functions for testing (mobile)
function simulateAppSwitch() {
    if (logoutManager) {
        logoutManager.handleAppBackground();
        setTimeout(() => logoutManager.handleAppForeground(), 3000);
        logoutManager.showToast('App switch simulated', 'info');
    }
}

function simulateDeviceSleep() {
    if (logoutManager) {
        logoutManager.handleVisibilityChange();
        logoutManager.showToast('Device sleep simulated', 'info');
    }
}

function simulateNetworkChange() {
    if (logoutManager) {
        logoutManager.handleNetworkDisconnection();
        setTimeout(() => logoutManager.handleNetworkReconnection(), 2000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Detect environment and set appropriate configuration
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         (window.innerWidth <= 768);
        
        const config = {
            sessionTimeout: isMobile ? 10 * 60 * 1000 : 30 * 60 * 1000, // Shorter for mobile demo
            warningTime: isMobile ? 2 * 60 * 1000 : 5 * 60 * 1000,
            idleTimeout: isMobile ? 5 * 60 * 1000 : 15 * 60 * 1000,
            enableVibration: true,
            enableSound: true,
            backgroundSyncEnabled: true
        };
        
        logoutManager = new LogoutManager(config);
        
        console.log('Logout Manager initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize Logout Manager:', error);
    }
    
    // Add enhanced button interactions
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        // Loading states
        button.addEventListener('click', function() {
            if (this.onclick && this.onclick.toString().includes('performLogout')) {
                this.classList.add('loading');
                setTimeout(() => {
                    this.classList.remove('loading');
                }, 2000);
            }
        });
        
        // Ripple effect
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 600ms linear;
                background-color: rgba(255, 255, 255, 0.7);
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                pointer-events: none;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // Add CSS for ripple animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});

// Handle page unload
window.addEventListener('beforeunload', function(e) {
    if (logoutManager) {
        logoutManager.cleanup();
    }
    
    const confirmationMessage = 'คุณแน่ใจว่าต้องการออกจากหน้านี้? ข้อมูลที่ยังไม่ได้บันทึกอาจสูญหาย';
    e.returnValue = confirmationMessage;
    return confirmationMessage;
});

// Handle visibility change (tab switching)
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && logoutManager) {
        logoutManager.updateLastActivity('visibility');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl+Alt+L for logout
    if (e.ctrlKey && e.altKey && e.key === 'l') {
        e.preventDefault();
        showLogoutModal();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal.show');
        openModals.forEach(modal => {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        });
    }
});

// Service Worker for offline detection
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
}

// Network status monitoring
window.addEventListener('online', function() {
    if (logoutManager) {
        logoutManager.showToast(logoutManager.deviceCapabilities.isMobile ? 'เชื่อมต่ออินเทอร์เน็ตแล้ว' : 'sessionToast', 
                               logoutManager.deviceCapabilities.isMobile ? 'success' : 'เชื่อมต่ออินเทอร์เน็ตแล้ว');
    }
});

window.addEventListener('offline', function() {
    if (logoutManager) {
        logoutManager.showToast(logoutManager.deviceCapabilities.isMobile ? 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต' : 'sessionToast',
                               logoutManager.deviceCapabilities.isMobile ? 'warning' : 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต - ระบบจะออกจากระบบอัตโนมัติเมื่อกลับมาออนไลน์');
    }
});