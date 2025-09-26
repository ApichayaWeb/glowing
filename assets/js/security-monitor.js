/**
 * ===================================================================
 * SecurityMonitor Class - Advanced Security Monitoring
 * ===================================================================
 * 
 * Advanced security monitoring with threat detection, suspicious
 * activity analysis, and emergency response capabilities.
 * 
 * @author Auto Logout System
 * @version 2.0.0
 * @license MIT
 */

class SecurityMonitor extends EventTarget {
    /**
     * @typedef {Object} SecurityMonitorConfig
     * @property {number} maxFailedAttempts - Maximum failed login attempts
     * @property {number} suspiciousThreshold - Threshold for suspicious activity
     * @property {number} lockoutDuration - Account lockout duration in milliseconds
     * @property {boolean} enableDevToolsDetection - Detect developer tools
     * @property {boolean} enableRightClickProtection - Disable right-click
     * @property {boolean} enableKeyboardProtection - Monitor keyboard shortcuts
     * @property {string[]} blockedUserAgents - Blocked user agent patterns
     * @property {string[]} allowedDomains - Allowed domains for requests
     */

    /**
     * Initialize SecurityMonitor
     * @param {SecurityMonitorConfig} config - Configuration object
     */
    constructor(config = {}) {
        super();
        
        this.config = {
            maxFailedAttempts: 3,
            suspiciousThreshold: 10,
            lockoutDuration: 15 * 60 * 1000,    // 15 minutes
            sessionTimeoutThreshold: 8 * 60 * 60 * 1000, // 8 hours
            enableDevToolsDetection: true,
            enableRightClickProtection: false,
            enableKeyboardProtection: true,
            enableMultiTabDetection: true,
            enableVPNDetection: false,
            maxTabSwitches: 50,
            maxPageChanges: 100,
            blockedUserAgents: [
                'bot', 'crawler', 'spider', 'scraper'
            ],
            allowedDomains: [
                window.location.hostname
            ],
            ...config
        };

        this.state = {
            isMonitoring: false,
            sessionId: null,
            userId: null,
            failedAttempts: 0,
            suspiciousActivities: [],
            securityEvents: [],
            lockoutEndTime: null,
            devToolsOpen: false,
            tabSwitchCount: 0,
            pageChangeCount: 0,
            lastActivity: Date.now(),
            activeSessions: [],
            ipAddress: null,
            userAgent: navigator.userAgent
        };

        this.boundDevToolsCheck = this.checkDevTools.bind(this);
        this.boundVisibilityHandler = this.handleVisibilityChange.bind(this);
        this.boundStorageHandler = this.handleStorageChange.bind(this);
        this.boundKeyboardHandler = this.handleKeyboardEvent.bind(this);
        this.boundMouseHandler = this.handleMouseEvent.bind(this);
        this.boundContextMenuHandler = this.handleContextMenu.bind(this);
        this.boundPopstateHandler = this.handlePopstate.bind(this);
        
        this.initializeMonitoring();
    }

    /**
     * Start security monitoring
     * @param {Object} sessionInfo - Session information
     * @returns {Promise<void>}
     */
    async startMonitoring(sessionInfo = {}) {
        try {
            if (this.state.isMonitoring) {
                console.warn('Security monitoring is already active');
                return;
            }

            this.state.isMonitoring = true;
            this.state.sessionId = sessionInfo.sessionId || this.generateId();
            this.state.userId = sessionInfo.userId || 'anonymous';
            
            // Get client IP and basic info
            await this.initializeClientInfo();
            
            // Check for existing lockout
            this.checkLockoutStatus();
            
            // Start monitoring components
            this.startEventListeners();
            this.startPeriodicChecks();
            
            // Initial security assessment
            await this.performSecurityAssessment();

            this.logSecurityEvent('monitoring_started', {
                sessionId: this.state.sessionId,
                userId: this.state.userId,
                userAgent: this.state.userAgent,
                ipAddress: this.state.ipAddress
            });

            this.dispatchEvent(new CustomEvent('security:started', {
                detail: { sessionId: this.state.sessionId }
            }));

            console.log('Security monitoring started');

        } catch (error) {
            console.error('Failed to start security monitoring:', error);
            throw new Error(`SecurityMonitor start failed: ${error.message}`);
        }
    }

    /**
     * Stop security monitoring
     * @returns {Promise<void>}
     */
    async stopMonitoring() {
        try {
            if (!this.state.isMonitoring) {
                return;
            }

            // Stop monitoring
            this.stopEventListeners();
            this.stopPeriodicChecks();
            
            // Log final security report
            this.logSecurityEvent('monitoring_stopped', {
                sessionId: this.state.sessionId,
                duration: Date.now() - this.getSessionStartTime(),
                totalEvents: this.state.securityEvents.length,
                suspiciousActivities: this.state.suspiciousActivities.length,
                failedAttempts: this.state.failedAttempts
            });

            this.state.isMonitoring = false;

            this.dispatchEvent(new CustomEvent('security:stopped', {
                detail: {
                    sessionId: this.state.sessionId,
                    summary: this.getSecuritySummary()
                }
            }));

            console.log('Security monitoring stopped');

        } catch (error) {
            console.error('Failed to stop security monitoring:', error);
        }
    }

    /**
     * Record failed login attempt
     * @param {Object} attemptInfo - Attempt information
     * @returns {Promise<boolean>} Whether account should be locked
     */
    async recordFailedAttempt(attemptInfo = {}) {
        try {
            this.state.failedAttempts++;
            
            this.logSecurityEvent('failed_login_attempt', {
                attemptNumber: this.state.failedAttempts,
                username: attemptInfo.username || 'unknown',
                ipAddress: this.state.ipAddress,
                userAgent: this.state.userAgent,
                timestamp: Date.now(),
                ...attemptInfo
            });

            // Check if lockout threshold reached
            if (this.state.failedAttempts >= this.config.maxFailedAttempts) {
                await this.triggerAccountLockout();
                return true;
            }

            // Trigger warning if approaching limit
            if (this.state.failedAttempts >= this.config.maxFailedAttempts - 1) {
                this.dispatchEvent(new CustomEvent('security:warning', {
                    detail: {
                        type: 'approaching_lockout',
                        attemptsRemaining: this.config.maxFailedAttempts - this.state.failedAttempts
                    }
                }));
            }

            return false;

        } catch (error) {
            console.error('Failed to record login attempt:', error);
            return false;
        }
    }

    /**
     * Record successful login
     * @param {Object} loginInfo - Login information
     * @returns {void}
     */
    recordSuccessfulLogin(loginInfo = {}) {
        // Reset failed attempts on successful login
        this.state.failedAttempts = 0;
        
        this.logSecurityEvent('successful_login', {
            userId: loginInfo.userId || this.state.userId,
            ipAddress: this.state.ipAddress,
            userAgent: this.state.userAgent,
            timestamp: Date.now(),
            ...loginInfo
        });
        
        // Clear any existing lockout
        this.clearLockout();
    }

    /**
     * Detect suspicious activity
     * @param {string} type - Activity type
     * @param {Object} details - Activity details
     * @returns {Promise<boolean>} Whether activity is suspicious
     */
    async detectSuspiciousActivity(type, details = {}) {
        try {
            const activity = {
                id: this.generateId(),
                type,
                timestamp: Date.now(),
                sessionId: this.state.sessionId,
                details,
                severity: this.calculateSeverity(type, details)
            };

            this.state.suspiciousActivities.push(activity);

            // Log the activity
            this.logSecurityEvent('suspicious_activity', activity);

            // Check if threshold exceeded
            const recentActivities = this.getRecentSuspiciousActivities();
            if (recentActivities.length >= this.config.suspiciousThreshold) {
                await this.triggerSecurityAlert('suspicious_threshold_exceeded', {
                    activitiesCount: recentActivities.length,
                    timeframe: '1 hour'
                });
                return true;
            }

            return false;

        } catch (error) {
            console.error('Failed to detect suspicious activity:', error);
            return false;
        }
    }

    /**
     * Trigger account lockout
     * @returns {Promise<void>}
     * @private
     */
    async triggerAccountLockout() {
        try {
            this.state.lockoutEndTime = Date.now() + this.config.lockoutDuration;
            
            this.logSecurityEvent('account_locked', {
                reason: 'max_failed_attempts',
                failedAttempts: this.state.failedAttempts,
                lockoutDuration: this.config.lockoutDuration,
                lockoutEndTime: this.state.lockoutEndTime
            });

            // Store lockout in localStorage
            localStorage.setItem('security_lockout', JSON.stringify({
                endTime: this.state.lockoutEndTime,
                reason: 'max_failed_attempts',
                timestamp: Date.now()
            }));

            this.dispatchEvent(new CustomEvent('security:lockout', {
                detail: {
                    duration: this.config.lockoutDuration,
                    endTime: this.state.lockoutEndTime,
                    reason: 'max_failed_attempts'
                }
            }));

        } catch (error) {
            console.error('Failed to trigger lockout:', error);
        }
    }

    /**
     * Trigger security alert
     * @param {string} alertType - Type of alert
     * @param {Object} details - Alert details
     * @returns {Promise<void>}
     * @private
     */
    async triggerSecurityAlert(alertType, details = {}) {
        try {
            const alert = {
                id: this.generateId(),
                type: alertType,
                timestamp: Date.now(),
                sessionId: this.state.sessionId,
                severity: 'high',
                details
            };

            this.logSecurityEvent('security_alert', alert);

            this.dispatchEvent(new CustomEvent('security:alert', {
                detail: alert
            }));

            // For critical alerts, force immediate logout
            if (this.isCriticalAlert(alertType)) {
                this.dispatchEvent(new CustomEvent('security:force_logout', {
                    detail: {
                        reason: alertType,
                        immediate: true
                    }
                }));
            }

        } catch (error) {
            console.error('Failed to trigger security alert:', error);
        }
    }

    /**
     * Check developer tools status
     * @private
     */
    checkDevTools() {
        if (!this.config.enableDevToolsDetection) {
            return;
        }

        const threshold = 160;
        const isOpen = (
            window.outerHeight - window.innerHeight > threshold ||
            window.outerWidth - window.innerWidth > threshold
        );

        if (isOpen && !this.state.devToolsOpen) {
            this.state.devToolsOpen = true;
            this.detectSuspiciousActivity('devtools_opened', {
                windowSize: {
                    outer: { width: window.outerWidth, height: window.outerHeight },
                    inner: { width: window.innerWidth, height: window.innerHeight }
                }
            });
        } else if (!isOpen && this.state.devToolsOpen) {
            this.state.devToolsOpen = false;
            this.logSecurityEvent('devtools_closed', {
                timestamp: Date.now()
            });
        }
    }

    /**
     * Handle visibility change events
     * @private
     */
    handleVisibilityChange() {
        if (!this.state.isMonitoring) return;

        if (document.hidden) {
            this.state.tabSwitchCount++;
            
            if (this.state.tabSwitchCount > this.config.maxTabSwitches) {
                this.detectSuspiciousActivity('excessive_tab_switching', {
                    count: this.state.tabSwitchCount,
                    timeframe: 'session'
                });
            }
        }
        
        this.logSecurityEvent('visibility_change', {
            hidden: document.hidden,
            tabSwitchCount: this.state.tabSwitchCount
        });
    }

    /**
     * Handle storage change events (cross-tab detection)
     * @param {StorageEvent} event - Storage event
     * @private
     */
    handleStorageChange(event) {
        if (!this.config.enableMultiTabDetection) return;
        if (!event.key || !event.key.startsWith('session_')) return;

        // Detect potential session hijacking or multiple sessions
        if (event.key === 'session_current' && event.newValue) {
            try {
                const sessionData = JSON.parse(event.newValue);
                if (sessionData.sessionId !== this.state.sessionId) {
                    this.detectSuspiciousActivity('multiple_sessions', {
                        currentSession: this.state.sessionId,
                        newSession: sessionData.sessionId,
                        userAgent: sessionData.userAgent
                    });
                }
            } catch (error) {
                console.error('Failed to parse session data:', error);
            }
        }
    }

    /**
     * Handle keyboard events
     * @param {KeyboardEvent} event - Keyboard event
     * @private
     */
    handleKeyboardEvent(event) {
        if (!this.config.enableKeyboardProtection) return;

        // Detect dangerous key combinations
        const dangerous = [
            { ctrl: true, shift: true, key: 'I' },    // Dev tools
            { ctrl: true, shift: true, key: 'J' },    // Console
            { ctrl: true, shift: true, key: 'C' },    // Inspector
            { key: 'F12' },                           // Dev tools
            { ctrl: true, key: 'u' },                 // View source
            { ctrl: true, key: 'U' }                  // View source
        ];

        const isDangerous = dangerous.some(combo => {
            return (!combo.ctrl || event.ctrlKey) &&
                   (!combo.shift || event.shiftKey) &&
                   (!combo.alt || event.altKey) &&
                   event.key === combo.key;
        });

        if (isDangerous) {
            this.detectSuspiciousActivity('dangerous_keyboard_shortcut', {
                key: event.key,
                ctrl: event.ctrlKey,
                shift: event.shiftKey,
                alt: event.altKey
            });
        }
    }

    /**
     * Handle mouse events
     * @param {MouseEvent} event - Mouse event
     * @private
     */
    handleMouseEvent(event) {
        // Track rapid clicking patterns
        if (!this.lastClickTime) {
            this.lastClickTime = Date.now();
            this.clickCount = 1;
            return;
        }

        const timeDiff = Date.now() - this.lastClickTime;
        if (timeDiff < 100) { // Less than 100ms between clicks
            this.clickCount++;
            if (this.clickCount > 10) {
                this.detectSuspiciousActivity('rapid_clicking', {
                    clickCount: this.clickCount,
                    timeframe: timeDiff * this.clickCount
                });
            }
        } else {
            this.clickCount = 1;
        }
        
        this.lastClickTime = Date.now();
    }

    /**
     * Handle context menu events
     * @param {Event} event - Context menu event
     * @private
     */
    handleContextMenu(event) {
        if (this.config.enableRightClickProtection) {
            event.preventDefault();
            this.detectSuspiciousActivity('right_click_attempt', {
                target: event.target.tagName,
                coordinates: { x: event.clientX, y: event.clientY }
            });
        }
    }

    /**
     * Handle navigation/history events
     * @param {PopStateEvent} event - Popstate event
     * @private
     */
    handlePopstate(event) {
        this.state.pageChangeCount++;
        
        if (this.state.pageChangeCount > this.config.maxPageChanges) {
            this.detectSuspiciousActivity('excessive_navigation', {
                count: this.state.pageChangeCount,
                timeframe: 'session'
            });
        }
    }

    /**
     * Initialize monitoring components
     * @private
     */
    initializeMonitoring() {
        // Check user agent
        this.checkUserAgent();
        
        // Check if running in suspicious environment
        this.checkEnvironment();
    }

    /**
     * Initialize client information
     * @returns {Promise<void>}
     * @private
     */
    async initializeClientInfo() {
        try {
            // Get IP address
            this.state.ipAddress = await this.getClientIP();
            
            // Check if VPN detection is enabled
            if (this.config.enableVPNDetection) {
                await this.checkVPN();
            }
            
        } catch (error) {
            console.warn('Failed to initialize client info:', error);
        }
    }

    /**
     * Start event listeners
     * @private
     */
    startEventListeners() {
        // Developer tools detection
        if (this.config.enableDevToolsDetection) {
            this.devToolsInterval = setInterval(this.boundDevToolsCheck, 1000);
        }

        // Visibility change monitoring
        document.addEventListener('visibilitychange', this.boundVisibilityHandler);
        
        // Storage change monitoring (cross-tab)
        window.addEventListener('storage', this.boundStorageHandler);
        
        // Keyboard monitoring
        if (this.config.enableKeyboardProtection) {
            document.addEventListener('keydown', this.boundKeyboardHandler);
        }
        
        // Mouse monitoring
        document.addEventListener('click', this.boundMouseHandler, { passive: true });
        
        // Context menu monitoring
        document.addEventListener('contextmenu', this.boundContextMenuHandler);
        
        // Navigation monitoring
        window.addEventListener('popstate', this.boundPopstateHandler);
    }

    /**
     * Stop event listeners
     * @private
     */
    stopEventListeners() {
        if (this.devToolsInterval) {
            clearInterval(this.devToolsInterval);
        }

        document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
        window.removeEventListener('storage', this.boundStorageHandler);
        document.removeEventListener('keydown', this.boundKeyboardHandler);
        document.removeEventListener('click', this.boundMouseHandler);
        document.removeEventListener('contextmenu', this.boundContextMenuHandler);
        window.removeEventListener('popstate', this.boundPopstateHandler);
    }

    /**
     * Start periodic security checks
     * @private
     */
    startPeriodicChecks() {
        // Check every 30 seconds
        this.securityCheckInterval = setInterval(() => {
            this.performSecurityAssessment();
        }, 30000);
    }

    /**
     * Stop periodic checks
     * @private
     */
    stopPeriodicChecks() {
        if (this.securityCheckInterval) {
            clearInterval(this.securityCheckInterval);
        }
    }

    /**
     * Perform comprehensive security assessment
     * @returns {Promise<Object>} Assessment results
     * @private
     */
    async performSecurityAssessment() {
        const assessment = {
            timestamp: Date.now(),
            riskLevel: 'low',
            factors: []
        };

        // Check failed attempts
        if (this.state.failedAttempts > 0) {
            assessment.factors.push('failed_attempts');
            if (this.state.failedAttempts >= this.config.maxFailedAttempts - 1) {
                assessment.riskLevel = 'high';
            }
        }

        // Check suspicious activities
        const recentSuspicious = this.getRecentSuspiciousActivities();
        if (recentSuspicious.length > 0) {
            assessment.factors.push('suspicious_activities');
            if (recentSuspicious.length >= this.config.suspiciousThreshold / 2) {
                assessment.riskLevel = 'medium';
            }
        }

        // Check session duration
        const sessionDuration = Date.now() - this.getSessionStartTime();
        if (sessionDuration > this.config.sessionTimeoutThreshold) {
            assessment.factors.push('long_session');
            assessment.riskLevel = 'medium';
        }

        // Check if locked out
        if (this.isLockedOut()) {
            assessment.riskLevel = 'critical';
            assessment.factors.push('locked_out');
        }

        this.logSecurityEvent('security_assessment', assessment);
        
        return assessment;
    }

    /**
     * Check user agent for suspicious patterns
     * @private
     */
    checkUserAgent() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isSuspicious = this.config.blockedUserAgents.some(pattern => 
            userAgent.includes(pattern.toLowerCase())
        );

        if (isSuspicious) {
            this.detectSuspiciousActivity('suspicious_user_agent', {
                userAgent: navigator.userAgent
            });
        }
    }

    /**
     * Check environment for suspicious indicators
     * @private
     */
    checkEnvironment() {
        const suspicious = [];

        // Check for automation indicators
        if (window.navigator.webdriver) {
            suspicious.push('webdriver_detected');
        }

        // Check for headless browser indicators
        if (!window.chrome || !window.chrome.runtime) {
            if (navigator.userAgent.includes('Chrome')) {
                suspicious.push('possible_headless_chrome');
            }
        }

        // Check for unusual screen properties
        if (screen.width === 0 || screen.height === 0) {
            suspicious.push('invalid_screen_size');
        }

        if (suspicious.length > 0) {
            this.detectSuspiciousActivity('suspicious_environment', {
                indicators: suspicious
            });
        }
    }

    /**
     * Check for VPN usage
     * @returns {Promise<void>}
     * @private
     */
    async checkVPN() {
        try {
            // This would typically use a VPN detection service
            // For demo purposes, we'll just log the check
            this.logSecurityEvent('vpn_check_performed', {
                ipAddress: this.state.ipAddress
            });
        } catch (error) {
            console.error('VPN check failed:', error);
        }
    }

    /**
     * Get client IP address
     * @returns {Promise<string>} IP address
     * @private
     */
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Check lockout status
     * @private
     */
    checkLockoutStatus() {
        try {
            const lockoutData = localStorage.getItem('security_lockout');
            if (lockoutData) {
                const lockout = JSON.parse(lockoutData);
                if (Date.now() < lockout.endTime) {
                    this.state.lockoutEndTime = lockout.endTime;
                } else {
                    this.clearLockout();
                }
            }
        } catch (error) {
            console.error('Failed to check lockout status:', error);
        }
    }

    /**
     * Clear lockout
     * @private
     */
    clearLockout() {
        this.state.lockoutEndTime = null;
        localStorage.removeItem('security_lockout');
    }

    /**
     * Calculate activity severity
     * @param {string} type - Activity type
     * @param {Object} details - Activity details
     * @returns {string} Severity level
     * @private
     */
    calculateSeverity(type, details) {
        const severityMap = {
            'devtools_opened': 'medium',
            'dangerous_keyboard_shortcut': 'medium',
            'multiple_sessions': 'high',
            'suspicious_user_agent': 'high',
            'excessive_tab_switching': 'low',
            'rapid_clicking': 'low',
            'right_click_attempt': 'low',
            'excessive_navigation': 'medium'
        };

        return severityMap[type] || 'low';
    }

    /**
     * Get recent suspicious activities
     * @param {number} timeframe - Timeframe in milliseconds (default: 1 hour)
     * @returns {Array} Recent activities
     * @private
     */
    getRecentSuspiciousActivities(timeframe = 60 * 60 * 1000) {
        const cutoff = Date.now() - timeframe;
        return this.state.suspiciousActivities.filter(activity => 
            activity.timestamp > cutoff
        );
    }

    /**
     * Check if alert is critical
     * @param {string} alertType - Alert type
     * @returns {boolean} Whether alert is critical
     * @private
     */
    isCriticalAlert(alertType) {
        const criticalAlerts = [
            'multiple_sessions',
            'suspicious_threshold_exceeded',
            'account_locked'
        ];
        
        return criticalAlerts.includes(alertType);
    }

    /**
     * Log security event
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     * @private
     */
    logSecurityEvent(eventType, data = {}) {
        const event = {
            id: this.generateId(),
            type: eventType,
            timestamp: Date.now(),
            sessionId: this.state.sessionId,
            userId: this.state.userId,
            data
        };

        this.state.securityEvents.push(event);
        
        // Keep only last 1000 events
        if (this.state.securityEvents.length > 1000) {
            this.state.securityEvents.splice(0, this.state.securityEvents.length - 1000);
        }

        // Log to console for debugging
        console.log(`Security Event: ${eventType}`, event);
    }

    /**
     * Get session start time
     * @returns {number} Session start timestamp
     * @private
     */
    getSessionStartTime() {
        return parseInt(localStorage.getItem('session_start_time') || Date.now());
    }

    /**
     * Generate unique ID
     * @returns {string} Unique identifier
     * @private
     */
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if account is locked out
     * @returns {boolean} Lockout status
     */
    isLockedOut() {
        return this.state.lockoutEndTime && Date.now() < this.state.lockoutEndTime;
    }

    /**
     * Get time remaining in lockout
     * @returns {number} Time remaining in milliseconds
     */
    getLockoutTimeRemaining() {
        if (!this.isLockedOut()) {
            return 0;
        }
        return Math.max(0, this.state.lockoutEndTime - Date.now());
    }

    /**
     * Get security summary
     * @returns {Object} Security summary
     */
    getSecuritySummary() {
        return {
            isMonitoring: this.state.isMonitoring,
            failedAttempts: this.state.failedAttempts,
            suspiciousActivities: this.state.suspiciousActivities.length,
            securityEvents: this.state.securityEvents.length,
            isLockedOut: this.isLockedOut(),
            lockoutTimeRemaining: this.getLockoutTimeRemaining(),
            tabSwitchCount: this.state.tabSwitchCount,
            pageChangeCount: this.state.pageChangeCount,
            devToolsOpen: this.state.devToolsOpen
        };
    }

    /**
     * Get security events by type
     * @param {string} eventType - Event type to filter
     * @param {number} timeframe - Timeframe in milliseconds
     * @returns {Array} Filtered events
     */
    getSecurityEvents(eventType = null, timeframe = null) {
        let events = [...this.state.securityEvents];
        
        if (eventType) {
            events = events.filter(event => event.type === eventType);
        }
        
        if (timeframe) {
            const cutoff = Date.now() - timeframe;
            events = events.filter(event => event.timestamp > cutoff);
        }
        
        return events;
    }

    /**
     * Clear security data
     * @returns {void}
     */
    clearSecurityData() {
        this.state.securityEvents = [];
        this.state.suspiciousActivities = [];
        this.state.failedAttempts = 0;
        this.clearLockout();
        
        this.dispatchEvent(new CustomEvent('security:data_cleared'));
    }

    /**
     * Update configuration
     * @param {Partial<SecurityMonitorConfig>} newConfig - New configuration
     * @returns {void}
     */
    updateConfig(newConfig) {
        const wasMonitoring = this.state.isMonitoring;
        
        if (wasMonitoring) {
            this.stopMonitoring();
        }
        
        this.config = { ...this.config, ...newConfig };
        
        if (wasMonitoring) {
            this.startMonitoring({
                sessionId: this.state.sessionId,
                userId: this.state.userId
            });
        }
    }
}

/**
 * Export SecurityMonitor
 */
window.SecurityMonitor = SecurityMonitor;

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SecurityMonitor };
}