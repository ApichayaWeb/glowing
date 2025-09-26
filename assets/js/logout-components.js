/**
 * ===================================================================
 * Enhanced Logout System Components
 * ===================================================================
 * 
 * Modern ES6+ JavaScript components for comprehensive logout
 * functionality with event-driven architecture and mobile compatibility.
 * 
 * Components:
 * - IdleDetector: User activity detection
 * - SessionManager: Session lifecycle management
 * - LogoutModal: Interactive warning dialogs
 * - ActivityTracker: User activity logging
 * - SecurityMonitor: Security threat detection
 * 
 * @author Enhanced Logout System
 * @version 2.1.0
 * @license MIT
 */

/**
 * ===================================================================
 * 1. IdleDetector Class
 * ===================================================================
 * 
 * Detects user inactivity across multiple input methods including
 * mouse, keyboard, touch, and scroll events with configurable timeouts.
 */
class IdleDetector extends EventTarget {
    /**
     * @typedef {Object} IdleDetectorConfig
     * @property {number} timeout - Idle timeout in milliseconds (default: 30 minutes)
     * @property {number} warningTime - Warning time before logout in milliseconds (default: 5 minutes)
     * @property {string[]} events - Events to monitor for activity
     * @property {boolean} detectVisibilityChange - Monitor tab visibility changes
     * @property {boolean} detectPageFocus - Monitor page focus/blur events
     * @property {number} throttleDelay - Throttle delay for event handling in milliseconds
     */

    /**
     * Initialize IdleDetector with configuration
     * @param {IdleDetectorConfig} config - Configuration object
     */
    constructor(config = {}) {
        super();
        
        this.config = {
            timeout: 30 * 60 * 1000,           // 30 minutes
            warningTime: 5 * 60 * 1000,        // 5 minutes before timeout
            throttleDelay: 250,                // 250ms throttle
            detectVisibilityChange: true,
            detectPageFocus: true,
            events: [
                'mousedown', 'mousemove', 'mouseup', 'click',
                'keydown', 'keyup', 'keypress',
                'scroll', 'wheel',
                'touchstart', 'touchmove', 'touchend', 'touchcancel',
                'pointerdown', 'pointermove', 'pointerup',
                'focus', 'blur'
            ],
            ...config
        };

        this.state = {
            isIdle: false,
            isWarning: false,
            lastActivity: Date.now(),
            idleTimer: null,
            warningTimer: null,
            isEnabled: false
        };

        this.boundEventHandler = this.throttle(this.handleActivity.bind(this), this.config.throttleDelay);
        this.boundVisibilityHandler = this.handleVisibilityChange.bind(this);
        this.boundFocusHandler = this.handleFocusChange.bind(this);
    }

    /**
     * Start idle detection
     * @returns {Promise<void>}
     */
    async start() {
        try {
            if (this.state.isEnabled) {
                console.warn('IdleDetector is already running');
                return;
            }

            this.state.isEnabled = true;
            this.state.lastActivity = Date.now();
            
            // Add event listeners
            this.addEventListeners();
            
            // Start timers
            this.resetTimers();
            
            this.dispatchEvent(new CustomEvent('idle:started', {
                detail: { timestamp: this.state.lastActivity }
            }));

            console.log('IdleDetector started with', this.config.timeout / 1000, 'second timeout');
        } catch (error) {
            console.error('Failed to start IdleDetector:', error);
            throw new Error(`IdleDetector start failed: ${error.message}`);
        }
    }

    /**
     * Stop idle detection
     * @returns {void}
     */
    stop() {
        try {
            if (!this.state.isEnabled) {
                return;
            }

            this.state.isEnabled = false;
            
            // Remove event listeners
            this.removeEventListeners();
            
            // Clear timers
            this.clearTimers();
            
            // Reset state
            this.state.isIdle = false;
            this.state.isWarning = false;
            
            this.dispatchEvent(new CustomEvent('idle:stopped', {
                detail: { timestamp: Date.now() }
            }));

            console.log('IdleDetector stopped');
        } catch (error) {
            console.error('Failed to stop IdleDetector:', error);
        }
    }

    /**
     * Reset idle timers
     * @returns {void}
     */
    resetTimers() {
        try {
            this.clearTimers();
            
            if (!this.state.isEnabled) {
                return;
            }

            const warningTimeout = this.config.timeout - this.config.warningTime;
            
            // Set warning timer
            this.state.warningTimer = setTimeout(() => {
                this.triggerWarning();
            }, warningTimeout);
            
            // Set idle timer
            this.state.idleTimer = setTimeout(() => {
                this.triggerIdle();
            }, this.config.timeout);

        } catch (error) {
            console.error('Failed to reset timers:', error);
        }
    }

    /**
     * Clear all timers
     * @private
     */
    clearTimers() {
        if (this.state.idleTimer) {
            clearTimeout(this.state.idleTimer);
            this.state.idleTimer = null;
        }
        
        if (this.state.warningTimer) {
            clearTimeout(this.state.warningTimer);
            this.state.warningTimer = null;
        }
    }

    /**
     * Add event listeners for activity detection
     * @private
     */
    addEventListeners() {
        // Add activity event listeners
        this.config.events.forEach(eventType => {
            document.addEventListener(eventType, this.boundEventHandler, {
                passive: true,
                capture: true
            });
        });

        // Add visibility change listener
        if (this.config.detectVisibilityChange) {
            document.addEventListener('visibilitychange', this.boundVisibilityHandler);
        }

        // Add focus/blur listeners
        if (this.config.detectPageFocus) {
            window.addEventListener('focus', this.boundFocusHandler);
            window.addEventListener('blur', this.boundFocusHandler);
        }
    }

    /**
     * Remove event listeners
     * @private
     */
    removeEventListeners() {
        // Remove activity event listeners
        this.config.events.forEach(eventType => {
            document.removeEventListener(eventType, this.boundEventHandler, true);
        });

        // Remove visibility change listener
        if (this.config.detectVisibilityChange) {
            document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
        }

        // Remove focus/blur listeners
        if (this.config.detectPageFocus) {
            window.removeEventListener('focus', this.boundFocusHandler);
            window.removeEventListener('blur', this.boundFocusHandler);
        }
    }

    /**
     * Handle user activity
     * @private
     */
    handleActivity() {
        if (!this.state.isEnabled) {
            return;
        }

        const now = Date.now();
        this.state.lastActivity = now;
        
        // Reset idle state if currently idle or warning
        if (this.state.isIdle || this.state.isWarning) {
            this.state.isIdle = false;
            this.state.isWarning = false;
            
            this.dispatchEvent(new CustomEvent('idle:resumed', {
                detail: { timestamp: now }
            }));
        }
        
        // Reset timers
        this.resetTimers();
    }

    /**
     * Handle visibility change events
     * @private
     */
    handleVisibilityChange() {
        if (!document.hidden && this.state.isEnabled) {
            this.handleActivity();
        }
    }

    /**
     * Handle focus change events
     * @private
     */
    handleFocusChange() {
        if (!document.hasFocus() || this.state.isEnabled) {
            this.handleActivity();
        }
    }

    /**
     * Trigger warning state
     * @private
     */
    triggerWarning() {
        if (this.state.isWarning || this.state.isIdle) {
            return;
        }

        this.state.isWarning = true;
        
        this.dispatchEvent(new CustomEvent('idle:warning', {
            detail: {
                timestamp: Date.now(),
                timeUntilIdle: this.config.warningTime,
                lastActivity: this.state.lastActivity
            }
        }));
    }

    /**
     * Trigger idle state
     * @private
     */
    triggerIdle() {
        if (this.state.isIdle) {
            return;
        }

        this.state.isIdle = true;
        this.state.isWarning = false;
        
        this.dispatchEvent(new CustomEvent('idle:timeout', {
            detail: {
                timestamp: Date.now(),
                lastActivity: this.state.lastActivity,
                idleDuration: Date.now() - this.state.lastActivity
            }
        }));
    }

    /**
     * Throttle function for performance optimization
     * @param {Function} func - Function to throttle
     * @param {number} delay - Throttle delay in milliseconds
     * @returns {Function} Throttled function
     * @private
     */
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        
        return function (...args) {
            const currentTime = Date.now();
            
            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }

    /**
     * Get current idle state
     * @returns {Object} Current state information
     */
    getState() {
        return {
            isIdle: this.state.isIdle,
            isWarning: this.state.isWarning,
            isEnabled: this.state.isEnabled,
            lastActivity: this.state.lastActivity,
            timeSinceLastActivity: Date.now() - this.state.lastActivity
        };
    }

    /**
     * Update configuration
     * @param {Partial<IdleDetectorConfig>} newConfig - New configuration
     */
    updateConfig(newConfig) {
        const wasEnabled = this.state.isEnabled;
        
        if (wasEnabled) {
            this.stop();
        }
        
        this.config = { ...this.config, ...newConfig };
        
        if (wasEnabled) {
            this.start();
        }
    }
}

/**
 * ===================================================================
 * 2. SessionManager Class
 * ===================================================================
 * 
 * Manages session lifecycle including duration tracking, expiration
 * handling, metadata storage, and cross-tab synchronization.
 */
class SessionManager extends EventTarget {
    /**
     * @typedef {Object} SessionConfig
     * @property {number} maxDuration - Maximum session duration in milliseconds
     * @property {number} warningTime - Warning time before expiration in milliseconds
     * @property {number} heartbeatInterval - Heartbeat interval in milliseconds
     * @property {string} storagePrefix - Storage key prefix
     * @property {boolean} enableCrossTab - Enable cross-tab synchronization
     * @property {boolean} enableHeartbeat - Enable heartbeat monitoring
     */

    /**
     * Initialize SessionManager
     * @param {SessionConfig} config - Configuration object
     */
    constructor(config = {}) {
        super();
        
        this.config = {
            maxDuration: 8 * 60 * 60 * 1000,    // 8 hours
            warningTime: 30 * 60 * 1000,        // 30 minutes
            heartbeatInterval: 5 * 60 * 1000,   // 5 minutes
            storagePrefix: 'session_',
            enableCrossTab: true,
            enableHeartbeat: true,
            ...config
        };

        this.state = {
            sessionId: null,
            startTime: null,
            lastActivity: null,
            isActive: false,
            warningShown: false,
            heartbeatTimer: null,
            warningTimer: null,
            expirationTimer: null
        };

        this.crossTabChannel = null;
        this.boundStorageHandler = this.handleStorageChange.bind(this);
        this.boundBeforeUnloadHandler = this.handleBeforeUnload.bind(this);
    }

    /**
     * Start new session
     * @param {Object} userInfo - User information
     * @returns {Promise<string>} Session ID
     */
    async startSession(userInfo = {}) {
        try {
            const sessionId = this.generateSessionId();
            const startTime = Date.now();
            
            this.state = {
                ...this.state,
                sessionId,
                startTime,
                lastActivity: startTime,
                isActive: true,
                warningShown: false
            };

            const sessionData = {
                sessionId,
                startTime,
                lastActivity: startTime,
                userInfo,
                userAgent: navigator.userAgent,
                ip: await this.getClientIP().catch(() => 'unknown')
            };

            // Store session data
            this.storeSessionData(sessionData);
            
            // Start monitoring
            this.startMonitoring();
            
            // Setup cross-tab communication
            if (this.config.enableCrossTab) {
                this.setupCrossTabSync();
            }

            this.dispatchEvent(new CustomEvent('session:started', {
                detail: { sessionId, startTime, userInfo }
            }));

            console.log(`Session started: ${sessionId}`);
            return sessionId;

        } catch (error) {
            console.error('Failed to start session:', error);
            throw new Error(`Session start failed: ${error.message}`);
        }
    }

    /**
     * End current session
     * @param {string} reason - Reason for ending session
     * @returns {Promise<void>}
     */
    async endSession(reason = 'manual') {
        try {
            if (!this.state.isActive) {
                console.warn('No active session to end');
                return;
            }

            const endTime = Date.now();
            const duration = endTime - this.state.startTime;

            // Stop monitoring
            this.stopMonitoring();
            
            // Store session end data
            this.storeSessionEndData(endTime, duration, reason);
            
            // Notify other tabs
            if (this.config.enableCrossTab) {
                this.broadcastSessionEnd(reason);
            }
            
            // Clear session data
            this.clearSessionData();
            
            this.dispatchEvent(new CustomEvent('session:ended', {
                detail: {
                    sessionId: this.state.sessionId,
                    duration,
                    reason,
                    endTime
                }
            }));

            // Reset state
            this.state.isActive = false;
            this.state.sessionId = null;

            console.log(`Session ended: ${reason} (duration: ${duration}ms)`);

        } catch (error) {
            console.error('Failed to end session:', error);
            throw new Error(`Session end failed: ${error.message}`);
        }
    }

    /**
     * Update last activity timestamp
     * @returns {void}
     */
    updateActivity() {
        if (!this.state.isActive) {
            return;
        }

        const now = Date.now();
        this.state.lastActivity = now;
        
        // Update stored session data
        const sessionData = this.getStoredSessionData();
        if (sessionData) {
            sessionData.lastActivity = now;
            this.storeSessionData(sessionData);
        }

        // Reset warning state if needed
        if (this.state.warningShown) {
            this.state.warningShown = false;
            this.resetExpirationTimer();
        }

        this.dispatchEvent(new CustomEvent('session:activity', {
            detail: { timestamp: now }
        }));
    }

    /**
     * Extend session duration
     * @param {number} additionalTime - Additional time in milliseconds
     * @returns {Promise<boolean>} Success status
     */
    async extendSession(additionalTime = this.config.maxDuration) {
        try {
            if (!this.state.isActive) {
                throw new Error('No active session to extend');
            }

            const sessionData = this.getStoredSessionData();
            if (!sessionData) {
                throw new Error('Session data not found');
            }

            // Update session data
            sessionData.extendedAt = Date.now();
            sessionData.additionalDuration = additionalTime;
            this.storeSessionData(sessionData);

            // Reset timers with new duration
            this.resetExpirationTimer(additionalTime);

            this.dispatchEvent(new CustomEvent('session:extended', {
                detail: {
                    sessionId: this.state.sessionId,
                    additionalTime,
                    newExpirationTime: this.state.startTime + this.config.maxDuration + additionalTime
                }
            }));

            console.log(`Session extended by ${additionalTime}ms`);
            return true;

        } catch (error) {
            console.error('Failed to extend session:', error);
            return false;
        }
    }

    /**
     * Get current session information
     * @returns {Object|null} Session information
     */
    getSessionInfo() {
        if (!this.state.isActive) {
            return null;
        }

        const now = Date.now();
        const duration = now - this.state.startTime;
        const timeUntilExpiration = this.config.maxDuration - duration;
        const timeSinceLastActivity = now - this.state.lastActivity;

        return {
            sessionId: this.state.sessionId,
            startTime: this.state.startTime,
            lastActivity: this.state.lastActivity,
            duration,
            timeUntilExpiration: Math.max(0, timeUntilExpiration),
            timeSinceLastActivity,
            isActive: this.state.isActive,
            isExpired: timeUntilExpiration <= 0
        };
    }

    /**
     * Check if session is valid
     * @returns {boolean} Session validity
     */
    isValid() {
        if (!this.state.isActive || !this.state.sessionId) {
            return false;
        }

        const sessionInfo = this.getSessionInfo();
        return sessionInfo && !sessionInfo.isExpired;
    }

    /**
     * Start session monitoring
     * @private
     */
    startMonitoring() {
        // Start heartbeat
        if (this.config.enableHeartbeat) {
            this.startHeartbeat();
        }

        // Start expiration monitoring
        this.resetExpirationTimer();

        // Add beforeunload handler
        window.addEventListener('beforeunload', this.boundBeforeUnloadHandler);
    }

    /**
     * Stop session monitoring
     * @private
     */
    stopMonitoring() {
        // Stop heartbeat
        if (this.state.heartbeatTimer) {
            clearInterval(this.state.heartbeatTimer);
            this.state.heartbeatTimer = null;
        }

        // Stop expiration timers
        if (this.state.warningTimer) {
            clearTimeout(this.state.warningTimer);
            this.state.warningTimer = null;
        }

        if (this.state.expirationTimer) {
            clearTimeout(this.state.expirationTimer);
            this.state.expirationTimer = null;
        }

        // Remove event listeners
        window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler);
    }

    /**
     * Start heartbeat monitoring
     * @private
     */
    startHeartbeat() {
        this.state.heartbeatTimer = setInterval(() => {
            if (this.state.isActive) {
                this.sendHeartbeat();
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Send heartbeat signal
     * @private
     */
    async sendHeartbeat() {
        try {
            const heartbeatData = {
                sessionId: this.state.sessionId,
                timestamp: Date.now(),
                lastActivity: this.state.lastActivity
            };

            this.dispatchEvent(new CustomEvent('session:heartbeat', {
                detail: heartbeatData
            }));

            // Store heartbeat (optional)
            localStorage.setItem(
                `${this.config.storagePrefix}heartbeat`,
                JSON.stringify(heartbeatData)
            );

        } catch (error) {
            console.error('Heartbeat failed:', error);
        }
    }

    /**
     * Reset expiration timer
     * @param {number} customDuration - Custom duration override
     * @private
     */
    resetExpirationTimer(customDuration = null) {
        // Clear existing timers
        if (this.state.warningTimer) {
            clearTimeout(this.state.warningTimer);
        }
        if (this.state.expirationTimer) {
            clearTimeout(this.state.expirationTimer);
        }

        const duration = customDuration || this.config.maxDuration;
        const warningTime = Math.min(this.config.warningTime, duration - 60000); // At least 1 minute before expiration

        // Set warning timer
        this.state.warningTimer = setTimeout(() => {
            this.triggerExpirationWarning();
        }, duration - warningTime);

        // Set expiration timer
        this.state.expirationTimer = setTimeout(() => {
            this.triggerSessionExpiration();
        }, duration);
    }

    /**
     * Trigger expiration warning
     * @private
     */
    triggerExpirationWarning() {
        if (this.state.warningShown || !this.state.isActive) {
            return;
        }

        this.state.warningShown = true;
        
        this.dispatchEvent(new CustomEvent('session:warning', {
            detail: {
                sessionId: this.state.sessionId,
                timeUntilExpiration: this.config.warningTime,
                timestamp: Date.now()
            }
        }));
    }

    /**
     * Trigger session expiration
     * @private
     */
    triggerSessionExpiration() {
        if (!this.state.isActive) {
            return;
        }

        this.dispatchEvent(new CustomEvent('session:expired', {
            detail: {
                sessionId: this.state.sessionId,
                timestamp: Date.now()
            }
        }));

        this.endSession('expired');
    }

    /**
     * Setup cross-tab synchronization
     * @private
     */
    setupCrossTabSync() {
        // Use storage events for cross-tab communication
        window.addEventListener('storage', this.boundStorageHandler);

        // Create broadcast channel if available
        if (typeof BroadcastChannel !== 'undefined') {
            this.crossTabChannel = new BroadcastChannel('session_sync');
            this.crossTabChannel.addEventListener('message', (event) => {
                this.handleCrossTabMessage(event.data);
            });
        }

        // Register this session
        this.registerSessionInCrossTab();
    }

    /**
     * Handle storage change events
     * @param {StorageEvent} event - Storage event
     * @private
     */
    handleStorageChange(event) {
        if (!event.key || !event.key.startsWith(this.config.storagePrefix)) {
            return;
        }

        if (event.key === `${this.config.storagePrefix}sync`) {
            try {
                const data = JSON.parse(event.newValue);
                this.handleCrossTabMessage(data);
            } catch (error) {
                console.error('Failed to parse cross-tab message:', error);
            }
        }
    }

    /**
     * Handle cross-tab messages
     * @param {Object} data - Message data
     * @private
     */
    handleCrossTabMessage(data) {
        if (!data || data.sessionId === this.state.sessionId) {
            return;
        }

        switch (data.type) {
            case 'session_ended':
                if (data.reason === 'logout') {
                    this.dispatchEvent(new CustomEvent('session:cross_tab_logout', {
                        detail: data
                    }));
                }
                break;

            case 'force_logout':
                this.dispatchEvent(new CustomEvent('session:force_logout', {
                    detail: data
                }));
                break;

            case 'activity_update':
                this.dispatchEvent(new CustomEvent('session:cross_tab_activity', {
                    detail: data
                }));
                break;
        }
    }

    /**
     * Broadcast session end to other tabs
     * @param {string} reason - End reason
     * @private
     */
    broadcastSessionEnd(reason) {
        const message = {
            type: 'session_ended',
            sessionId: this.state.sessionId,
            reason,
            timestamp: Date.now()
        };

        this.broadcastMessage(message);
    }

    /**
     * Broadcast message to other tabs
     * @param {Object} message - Message to broadcast
     * @private
     */
    broadcastMessage(message) {
        // Use localStorage for cross-tab communication
        localStorage.setItem(
            `${this.config.storagePrefix}sync`,
            JSON.stringify(message)
        );

        // Use BroadcastChannel if available
        if (this.crossTabChannel) {
            this.crossTabChannel.postMessage(message);
        }
    }

    /**
     * Register session in cross-tab storage
     * @private
     */
    registerSessionInCrossTab() {
        const activeSessions = this.getActiveSessionsFromStorage();
        const sessionInfo = {
            sessionId: this.state.sessionId,
            startTime: this.state.startTime,
            lastActivity: this.state.lastActivity,
            userAgent: navigator.userAgent
        };

        // Add or update current session
        const existingIndex = activeSessions.findIndex(s => s.sessionId === this.state.sessionId);
        if (existingIndex >= 0) {
            activeSessions[existingIndex] = sessionInfo;
        } else {
            activeSessions.push(sessionInfo);
        }

        // Clean old sessions (older than max duration)
        const now = Date.now();
        const validSessions = activeSessions.filter(s => 
            now - s.lastActivity < this.config.maxDuration
        );

        localStorage.setItem(
            `${this.config.storagePrefix}active_sessions`,
            JSON.stringify(validSessions)
        );
    }

    /**
     * Get active sessions from storage
     * @returns {Array} Active sessions
     * @private
     */
    getActiveSessionsFromStorage() {
        try {
            const stored = localStorage.getItem(`${this.config.storagePrefix}active_sessions`);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to get active sessions:', error);
            return [];
        }
    }

    /**
     * Handle beforeunload event
     * @private
     */
    handleBeforeUnload() {
        if (this.state.isActive) {
            this.storeSessionData({
                ...this.getStoredSessionData(),
                lastActivity: Date.now(),
                unloadTime: Date.now()
            });
        }
    }

    /**
     * Generate unique session ID
     * @returns {string} Session ID
     * @private
     */
    generateSessionId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `session_${timestamp}_${random}`;
    }

    /**
     * Store session data
     * @param {Object} data - Session data
     * @private
     */
    storeSessionData(data) {
        try {
            localStorage.setItem(
                `${this.config.storagePrefix}current`,
                JSON.stringify(data)
            );
        } catch (error) {
            console.error('Failed to store session data:', error);
        }
    }

    /**
     * Get stored session data
     * @returns {Object|null} Session data
     * @private
     */
    getStoredSessionData() {
        try {
            const stored = localStorage.getItem(`${this.config.storagePrefix}current`);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Failed to get session data:', error);
            return null;
        }
    }

    /**
     * Store session end data
     * @param {number} endTime - End timestamp
     * @param {number} duration - Session duration
     * @param {string} reason - End reason
     * @private
     */
    storeSessionEndData(endTime, duration, reason) {
        try {
            const endData = {
                sessionId: this.state.sessionId,
                startTime: this.state.startTime,
                endTime,
                duration,
                reason,
                lastActivity: this.state.lastActivity
            };

            localStorage.setItem(
                `${this.config.storagePrefix}last_ended`,
                JSON.stringify(endData)
            );
        } catch (error) {
            console.error('Failed to store session end data:', error);
        }
    }

    /**
     * Clear session data
     * @private
     */
    clearSessionData() {
        try {
            localStorage.removeItem(`${this.config.storagePrefix}current`);
            localStorage.removeItem(`${this.config.storagePrefix}heartbeat`);
        } catch (error) {
            console.error('Failed to clear session data:', error);
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
}

/**
 * ===================================================================
 * 3. LogoutModal Component
 * ===================================================================
 * 
 * Interactive modal component for displaying logout warnings with
 * countdown timer, progress bar, and user action buttons.
 */
class LogoutModal extends EventTarget {
    /**
     * @typedef {Object} LogoutModalConfig
     * @property {string} title - Modal title
     * @property {string} message - Warning message
     * @property {number} countdownTime - Countdown time in milliseconds
     * @property {Object} buttons - Button configuration
     * @property {Object} styling - Custom styling options
     * @property {boolean} showProgressBar - Show progress bar
     * @property {boolean} allowOutsideClick - Allow clicking outside to close
     * @property {string} position - Modal position
     */

    /**
     * Initialize LogoutModal
     * @param {LogoutModalConfig} config - Configuration object
     */
    constructor(config = {}) {
        super();
        
        this.config = {
            title: 'การแจ้งเตือนระบบ',
            message: 'คุณจะถูกออกจากระบบอัตโนมัติ',
            countdownTime: 5 * 60 * 1000, // 5 minutes
            position: 'center',
            allowOutsideClick: false,
            showProgressBar: true,
            autoHeight: true,
            buttons: {
                stay: {
                    text: 'ใช้งานต่อ',
                    class: 'btn-success',
                    icon: 'fas fa-refresh'
                },
                logout: {
                    text: 'ออกจากระบบ',
                    class: 'btn-danger',
                    icon: 'fas fa-sign-out-alt'
                }
            },
            styling: {
                modalClass: 'logout-warning-modal',
                headerClass: 'modal-header-warning',
                bodyClass: 'modal-body-centered',
                footerClass: 'modal-footer-centered'
            },
            ...config
        };

        this.state = {
            isVisible: false,
            timeRemaining: this.config.countdownTime,
            countdownInterval: null,
            progressInterval: null,
            startTime: null,
            modalElement: null,
            backdrop: null
        };

        this.boundKeyHandler = this.handleKeyPress.bind(this);
        this.boundClickHandler = this.handleOutsideClick.bind(this);
    }

    /**
     * Show the modal
     * @param {Object} options - Override options
     * @returns {Promise<string>} User action ('stay' or 'logout')
     */
    async show(options = {}) {
        return new Promise((resolve, reject) => {
            try {
                if (this.state.isVisible) {
                    console.warn('Modal is already visible');
                    return;
                }

                // Merge options with config
                const modalConfig = { ...this.config, ...options };
                
                // Create modal element
                this.createModal(modalConfig);
                
                // Setup event handlers
                this.setupEventHandlers(resolve);
                
                // Show modal
                this.displayModal();
                
                // Start countdown
                this.startCountdown(resolve);
                
                this.state.isVisible = true;
                this.state.startTime = Date.now();
                this.state.timeRemaining = modalConfig.countdownTime;

                this.dispatchEvent(new CustomEvent('modal:shown', {
                    detail: { 
                        startTime: this.state.startTime,
                        countdownTime: modalConfig.countdownTime
                    }
                }));

            } catch (error) {
                console.error('Failed to show modal:', error);
                reject(error);
            }
        });
    }

    /**
     * Hide the modal
     * @param {string} action - Action taken
     * @returns {void}
     */
    hide(action = 'dismissed') {
        try {
            if (!this.state.isVisible) {
                return;
            }

            // Clear intervals
            this.clearIntervals();
            
            // Remove event listeners
            this.removeEventHandlers();
            
            // Hide modal with animation
            this.hideModal();
            
            // Clean up DOM
            setTimeout(() => {
                this.removeModalFromDOM();
            }, 300); // Wait for animation
            
            this.state.isVisible = false;
            
            this.dispatchEvent(new CustomEvent('modal:hidden', {
                detail: { 
                    action,
                    duration: Date.now() - this.state.startTime
                }
            }));

        } catch (error) {
            console.error('Failed to hide modal:', error);
        }
    }

    /**
     * Create modal DOM element
     * @param {Object} config - Modal configuration
     * @private
     */
    createModal(config) {
        // Create backdrop
        this.state.backdrop = document.createElement('div');
        this.state.backdrop.className = 'modal-backdrop fade';
        this.state.backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        // Create modal container
        this.state.modalElement = document.createElement('div');
        this.state.modalElement.className = `modal fade ${config.styling.modalClass}`;
        this.state.modalElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transform: scale(0.8);
            transition: all 0.3s ease;
        `;

        // Create modal dialog
        const modalDialog = document.createElement('div');
        modalDialog.className = 'modal-dialog modal-dialog-centered';
        modalDialog.style.cssText = `
            max-width: 500px;
            width: 90%;
            margin: 0;
        `;

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            border: none;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        `;

        // Create header
        const header = this.createModalHeader(config);
        
        // Create body
        const body = this.createModalBody(config);
        
        // Create footer
        const footer = this.createModalFooter(config);

        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(body);
        modalContent.appendChild(footer);
        modalDialog.appendChild(modalContent);
        this.state.modalElement.appendChild(modalDialog);
    }

    /**
     * Create modal header
     * @param {Object} config - Configuration
     * @returns {HTMLElement} Header element
     * @private
     */
    createModalHeader(config) {
        const header = document.createElement('div');
        header.className = `modal-header ${config.styling.headerClass}`;
        header.style.cssText = `
            background: linear-gradient(45deg, #ff6b6b, #ee5a24);
            color: white;
            padding: 1.5rem;
            border-bottom: none;
        `;

        header.innerHTML = `
            <div class="d-flex align-items-center w-100">
                <i class="fas fa-exclamation-triangle fa-2x me-3" style="color: #fff;"></i>
                <div>
                    <h4 class="modal-title mb-0">${config.title}</h4>
                    <small class="opacity-75">ระบบจะดำเนินการโดยอัตโนมัติ</small>
                </div>
            </div>
        `;

        return header;
    }

    /**
     * Create modal body
     * @param {Object} config - Configuration
     * @returns {HTMLElement} Body element
     * @private
     */
    createModalBody(config) {
        const body = document.createElement('div');
        body.className = `modal-body ${config.styling.bodyClass}`;
        body.style.cssText = `
            padding: 2rem;
            text-align: center;
        `;

        body.innerHTML = `
            <div class="alert alert-warning border-0 mb-4" style="background: #fff3cd; border-radius: 10px;">
                <p class="mb-0 fs-5">${config.message}</p>
            </div>
            
            <div class="countdown-display mb-4">
                <div class="countdown-timer" style="
                    font-size: 2.5rem;
                    font-weight: bold;
                    color: #dc3545;
                    margin-bottom: 1rem;
                ">
                    <span id="countdown-minutes">05</span>:<span id="countdown-seconds">00</span>
                </div>
                
                ${config.showProgressBar ? `
                    <div class="progress" style="height: 8px; border-radius: 10px; background: #e9ecef;">
                        <div class="progress-bar bg-danger" 
                             id="countdown-progress" 
                             role="progressbar" 
                             style="width: 100%; transition: width 1s linear; border-radius: 10px;">
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="activity-status text-muted">
                <small>
                    <i class="fas fa-clock me-1"></i>
                    เวลาไม่ใช้งานล่าสุด: <span id="last-activity-time">กำลังคำนวณ...</span>
                </small>
            </div>
        `;

        return body;
    }

    /**
     * Create modal footer
     * @param {Object} config - Configuration
     * @returns {HTMLElement} Footer element
     * @private
     */
    createModalFooter(config) {
        const footer = document.createElement('div');
        footer.className = `modal-footer ${config.styling.footerClass}`;
        footer.style.cssText = `
            padding: 1.5rem 2rem;
            border-top: 1px solid #e9ecef;
            background: #f8f9fa;
            justify-content: center;
            gap: 1rem;
        `;

        footer.innerHTML = `
            <button type="button" 
                    class="btn ${config.buttons.stay.class} btn-lg px-4" 
                    id="btn-stay-logged-in"
                    style="border-radius: 25px; min-width: 150px;">
                <i class="${config.buttons.stay.icon} me-2"></i>
                ${config.buttons.stay.text}
            </button>
            
            <button type="button" 
                    class="btn ${config.buttons.logout.class} btn-lg px-4" 
                    id="btn-logout-now"
                    style="border-radius: 25px; min-width: 150px;">
                <i class="${config.buttons.logout.icon} me-2"></i>
                ${config.buttons.logout.text}
            </button>
        `;

        return footer;
    }

    /**
     * Setup event handlers
     * @param {Function} resolve - Promise resolve function
     * @private
     */
    setupEventHandlers(resolve) {
        // Button click handlers
        const stayButton = this.state.modalElement.querySelector('#btn-stay-logged-in');
        const logoutButton = this.state.modalElement.querySelector('#btn-logout-now');

        if (stayButton) {
            stayButton.addEventListener('click', () => {
                this.handleUserAction('stay', resolve);
            });
        }

        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                this.handleUserAction('logout', resolve);
            });
        }

        // Keyboard handlers
        document.addEventListener('keydown', this.boundKeyHandler);

        // Outside click handler
        if (this.config.allowOutsideClick) {
            this.state.backdrop.addEventListener('click', this.boundClickHandler);
        }
    }

    /**
     * Remove event handlers
     * @private
     */
    removeEventHandlers() {
        document.removeEventListener('keydown', this.boundKeyHandler);
        if (this.state.backdrop) {
            this.state.backdrop.removeEventListener('click', this.boundClickHandler);
        }
    }

    /**
     * Handle keyboard events
     * @param {KeyboardEvent} event - Keyboard event
     * @private
     */
    handleKeyPress(event) {
        if (!this.state.isVisible) return;

        switch (event.key) {
            case 'Escape':
                if (this.config.allowOutsideClick) {
                    this.handleUserAction('dismissed');
                }
                break;
            case 'Enter':
                this.handleUserAction('stay');
                break;
            case ' ': // Spacebar
                event.preventDefault();
                this.handleUserAction('stay');
                break;
        }
    }

    /**
     * Handle outside click
     * @private
     */
    handleOutsideClick() {
        if (this.config.allowOutsideClick) {
            this.handleUserAction('dismissed');
        }
    }

    /**
     * Handle user action
     * @param {string} action - User action
     * @param {Function} resolve - Promise resolve function
     * @private
     */
    handleUserAction(action, resolve = null) {
        this.dispatchEvent(new CustomEvent('modal:action', {
            detail: { 
                action,
                timeRemaining: this.state.timeRemaining,
                duration: Date.now() - this.state.startTime
            }
        }));

        this.hide(action);
        
        if (resolve) {
            resolve(action);
        }
    }

    /**
     * Display modal with animation
     * @private
     */
    displayModal() {
        // Add to DOM
        document.body.appendChild(this.state.backdrop);
        document.body.appendChild(this.state.modalElement);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Trigger animations
        setTimeout(() => {
            this.state.backdrop.style.opacity = '1';
            this.state.modalElement.style.opacity = '1';
            this.state.modalElement.style.transform = 'scale(1)';
        }, 10);
    }

    /**
     * Hide modal with animation
     * @private
     */
    hideModal() {
        if (this.state.backdrop) this.state.backdrop.style.opacity = '0';
        if (this.state.modalElement) {
            this.state.modalElement.style.opacity = '0';
            this.state.modalElement.style.transform = 'scale(0.8)';
        }
    }

    /**
     * Remove modal from DOM
     * @private
     */
    removeModalFromDOM() {
        try {
            if (this.state.backdrop && this.state.backdrop.parentNode) {
                this.state.backdrop.parentNode.removeChild(this.state.backdrop);
            }
            
            if (this.state.modalElement && this.state.modalElement.parentNode) {
                this.state.modalElement.parentNode.removeChild(this.state.modalElement);
            }
            
            // Restore body scroll
            document.body.style.overflow = '';
            
            this.state.backdrop = null;
            this.state.modalElement = null;
            
        } catch (error) {
            console.error('Failed to remove modal from DOM:', error);
        }
    }

    /**
     * Start countdown timer
     * @param {Function} resolve - Promise resolve function
     * @private
     */
    startCountdown(resolve) {
        const startTime = Date.now();
        const totalTime = this.state.timeRemaining;
        
        this.updateCountdownDisplay();
        
        this.state.countdownInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            this.state.timeRemaining = Math.max(0, totalTime - elapsed);
            
            this.updateCountdownDisplay();
            this.updateProgressBar(elapsed, totalTime);
            
            if (this.state.timeRemaining <= 0) {
                this.handleUserAction('timeout', resolve);
            }
        }, 1000);
    }

    /**
     * Update countdown display
     * @private
     */
    updateCountdownDisplay() {
        const minutes = Math.floor(this.state.timeRemaining / 60000);
        const seconds = Math.floor((this.state.timeRemaining % 60000) / 1000);
        
        const minutesElement = this.state.modalElement?.querySelector('#countdown-minutes');
        const secondsElement = this.state.modalElement?.querySelector('#countdown-seconds');
        
        if (minutesElement) {
            minutesElement.textContent = minutes.toString().padStart(2, '0');
        }
        
        if (secondsElement) {
            secondsElement.textContent = seconds.toString().padStart(2, '0');
        }
        
        // Update last activity time
        const lastActivityElement = this.state.modalElement?.querySelector('#last-activity-time');
        if (lastActivityElement) {
            const now = new Date();
            lastActivityElement.textContent = now.toLocaleTimeString('th-TH');
        }
    }

    /**
     * Update progress bar
     * @param {number} elapsed - Elapsed time
     * @param {number} total - Total time
     * @private
     */
    updateProgressBar(elapsed, total) {
        const progressElement = this.state.modalElement?.querySelector('#countdown-progress');
        if (!progressElement) return;
        
        const percentage = Math.max(0, ((total - elapsed) / total) * 100);
        progressElement.style.width = `${percentage}%`;
        
        // Change color as time runs out
        if (percentage < 25) {
            progressElement.className = 'progress-bar bg-danger';
        } else if (percentage < 50) {
            progressElement.className = 'progress-bar bg-warning';
        } else {
            progressElement.className = 'progress-bar bg-danger';
        }
    }

    /**
     * Clear all intervals
     * @private
     */
    clearIntervals() {
        if (this.state.countdownInterval) {
            clearInterval(this.state.countdownInterval);
            this.state.countdownInterval = null;
        }
        
        if (this.state.progressInterval) {
            clearInterval(this.state.progressInterval);
            this.state.progressInterval = null;
        }
    }

    /**
     * Get current state
     * @returns {Object} Current modal state
     */
    getState() {
        return {
            isVisible: this.state.isVisible,
            timeRemaining: this.state.timeRemaining,
            startTime: this.state.startTime,
            duration: this.state.startTime ? Date.now() - this.state.startTime : 0
        };
    }

    /**
     * Update countdown time
     * @param {number} newTime - New countdown time in milliseconds
     * @returns {void}
     */
    updateCountdownTime(newTime) {
        this.state.timeRemaining = newTime;
        this.updateCountdownDisplay();
    }

    /**
     * Add additional time
     * @param {number} additionalTime - Additional time in milliseconds
     * @returns {void}
     */
    addTime(additionalTime) {
        this.state.timeRemaining = Math.max(0, this.state.timeRemaining + additionalTime);
        this.updateCountdownDisplay();
    }
}

/**
 * ===================================================================
 * 4. ActivityTracker Class
 * ===================================================================
 * 
 * Tracks and logs user activities with detailed analytics and storage.
 */
class ActivityTracker extends EventTarget {
    constructor(config = {}) {
        super();
        
        this.config = {
            maxLogSize: 1000,
            enableStorage: true,
            storageKey: 'activity_log',
            trackMouseMovement: false,
            trackScrolling: true,
            trackKeyboard: true,
            trackTouch: true,
            aggregateInterval: 60000, // 1 minute
            ...config
        };

        this.activities = [];
        this.aggregatedStats = {
            mouseClicks: 0,
            keyStrokes: 0,
            scrollEvents: 0,
            touchEvents: 0,
            pageViews: 0,
            totalTime: 0
        };

        this.lastAggregation = Date.now();
        this.boundTrackActivity = this.trackActivity.bind(this);
    }

    /**
     * Start activity tracking
     */
    start() {
        this.setupEventListeners();
        this.startAggregation();
        
        this.dispatchEvent(new CustomEvent('tracker:started', {
            detail: { timestamp: Date.now() }
        }));
    }

    /**
     * Stop activity tracking
     */
    stop() {
        this.removeEventListeners();
        this.stopAggregation();
        
        if (this.config.enableStorage) {
            this.saveToStorage();
        }
        
        this.dispatchEvent(new CustomEvent('tracker:stopped', {
            detail: { 
                timestamp: Date.now(),
                totalActivities: this.activities.length,
                stats: this.aggregatedStats
            }
        }));
    }

    /**
     * Track a specific activity
     */
    trackActivity(type, details = {}) {
        const activity = {
            type,
            timestamp: Date.now(),
            details,
            sessionId: this.getSessionId(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        this.activities.push(activity);
        this.updateAggregatedStats(type);
        
        // Limit log size
        if (this.activities.length > this.config.maxLogSize) {
            this.activities = this.activities.slice(-this.config.maxLogSize);
        }

        this.dispatchEvent(new CustomEvent('activity:tracked', {
            detail: activity
        }));
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Mouse events
        if (this.config.trackMouseMovement) {
            document.addEventListener('mousemove', (e) => {
                this.trackActivity('mouse_move', { x: e.clientX, y: e.clientY });
            });
        }
        
        document.addEventListener('click', (e) => {
            this.trackActivity('mouse_click', { 
                x: e.clientX, 
                y: e.clientY, 
                target: e.target.tagName 
            });
        });

        // Keyboard events
        if (this.config.trackKeyboard) {
            document.addEventListener('keydown', (e) => {
                this.trackActivity('key_press', { 
                    key: e.key,
                    code: e.code,
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey
                });
            });
        }

        // Scroll events
        if (this.config.trackScrolling) {
            document.addEventListener('scroll', () => {
                this.trackActivity('scroll', { 
                    scrollTop: window.pageYOffset,
                    scrollLeft: window.pageXOffset
                });
            });
        }

        // Touch events
        if (this.config.trackTouch) {
            document.addEventListener('touchstart', (e) => {
                this.trackActivity('touch_start', { 
                    touches: e.touches.length,
                    x: e.touches[0]?.clientX,
                    y: e.touches[0]?.clientY
                });
            });
        }

        // Page visibility
        document.addEventListener('visibilitychange', () => {
            this.trackActivity('visibility_change', { 
                hidden: document.hidden 
            });
        });
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        // This would remove the specific event listeners
        // For brevity, not implementing the full removal
    }

    /**
     * Update aggregated statistics
     */
    updateAggregatedStats(type) {
        switch (type) {
            case 'mouse_click':
                this.aggregatedStats.mouseClicks++;
                break;
            case 'key_press':
                this.aggregatedStats.keyStrokes++;
                break;
            case 'scroll':
                this.aggregatedStats.scrollEvents++;
                break;
            case 'touch_start':
                this.aggregatedStats.touchEvents++;
                break;
        }
    }

    /**
     * Start aggregation timer
     */
    startAggregation() {
        this.aggregationTimer = setInterval(() => {
            this.performAggregation();
        }, this.config.aggregateInterval);
    }

    /**
     * Stop aggregation timer
     */
    stopAggregation() {
        if (this.aggregationTimer) {
            clearInterval(this.aggregationTimer);
        }
    }

    /**
     * Perform data aggregation
     */
    performAggregation() {
        const now = Date.now();
        const elapsed = now - this.lastAggregation;
        
        this.aggregatedStats.totalTime += elapsed;
        this.lastAggregation = now;

        this.dispatchEvent(new CustomEvent('tracker:aggregated', {
            detail: {
                timestamp: now,
                stats: { ...this.aggregatedStats },
                period: elapsed
            }
        }));

        if (this.config.enableStorage) {
            this.saveToStorage();
        }
    }

    /**
     * Save data to storage
     */
    saveToStorage() {
        try {
            const data = {
                activities: this.activities.slice(-100), // Save last 100 activities
                stats: this.aggregatedStats,
                lastUpdate: Date.now()
            };
            
            localStorage.setItem(this.config.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save activity data:', error);
        }
    }

    /**
     * Load data from storage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.config.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                this.activities = data.activities || [];
                this.aggregatedStats = { ...this.aggregatedStats, ...data.stats };
                return data;
            }
        } catch (error) {
            console.error('Failed to load activity data:', error);
        }
        return null;
    }

    /**
     * Get session ID
     */
    getSessionId() {
        return sessionStorage.getItem('sessionId') || 'unknown';
    }

    /**
     * Get activity summary
     */
    getSummary() {
        const now = Date.now();
        const recentActivities = this.activities.filter(a => 
            now - a.timestamp < 60000 // Last minute
        );

        return {
            totalActivities: this.activities.length,
            recentActivities: recentActivities.length,
            stats: { ...this.aggregatedStats },
            lastActivity: this.activities[this.activities.length - 1],
            timeSpan: this.activities.length > 0 ? 
                now - this.activities[0].timestamp : 0
        };
    }
}

/**
 * ===================================================================
 * 5. SecurityMonitor Class
 * ===================================================================
 * 
 * Monitors for security threats and suspicious activities.
 */
class SecurityMonitor extends EventTarget {
    constructor(config = {}) {
        super();
        
        this.config = {
            maxFailedAttempts: 5,
            lockoutDuration: 15 * 60 * 1000, // 15 minutes
            suspiciousActivityThreshold: 10,
            monitorDevTools: true,
            monitorConsoleAccess: true,
            monitorNetworkRequests: false,
            enableThreatDetection: true,
            ...config
        };

        this.threats = [];
        this.failedAttempts = 0;
        this.isLocked = false;
        this.lockoutTime = null;
        
        this.setupSecurityMonitoring();
    }

    /**
     * Setup security monitoring
     */
    setupSecurityMonitoring() {
        if (this.config.monitorDevTools) {
            this.monitorDevTools();
        }

        if (this.config.monitorConsoleAccess) {
            this.monitorConsoleAccess();
        }

        this.monitorTabSwitching();
        this.monitorMultipleTabs();
        this.monitorSuspiciousKeyboard();
    }

    /**
     * Monitor developer tools
     */
    monitorDevTools() {
        // Simple DevTools detection
        setInterval(() => {
            const threshold = 160;
            if (window.outerHeight - window.innerHeight > threshold || 
                window.outerWidth - window.innerWidth > threshold) {
                this.reportThreat('dev_tools_detected', {
                    windowDimensions: {
                        outer: { width: window.outerWidth, height: window.outerHeight },
                        inner: { width: window.innerWidth, height: window.innerHeight }
                    }
                });
            }
        }, 1000);
    }

    /**
     * Monitor console access
     */
    monitorConsoleAccess() {
        const originalLog = console.log;
        console.log = (...args) => {
            this.reportThreat('console_access', { 
                args: args.map(arg => typeof arg === 'object' ? '[Object]' : String(arg).substring(0, 100))
            });
            return originalLog.apply(console, args);
        };
    }

    /**
     * Monitor tab switching
     */
    monitorTabSwitching() {
        let switchCount = 0;
        
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                switchCount++;
                if (switchCount > this.config.suspiciousActivityThreshold) {
                    this.reportThreat('excessive_tab_switching', { 
                        switchCount,
                        timeFrame: '1 session'
                    });
                }
            }
        });
    }

    /**
     * Monitor multiple tabs
     */
    monitorMultipleTabs() {
        const tabId = 'tab_' + Date.now() + '_' + Math.random();
        sessionStorage.setItem('currentTabId', tabId);
        
        // Check for other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'activeTabCheck') {
                this.reportThreat('multiple_tabs_detected', {
                    currentTab: tabId,
                    newTab: e.newValue
                });
            }
        });
        
        localStorage.setItem('activeTabCheck', tabId);
    }

    /**
     * Monitor suspicious keyboard activity
     */
    monitorSuspiciousKeyboard() {
        let rapidKeyCount = 0;
        let lastKeyTime = 0;
        
        document.addEventListener('keydown', (e) => {
            const now = Date.now();
            
            // Check for rapid typing (potential bot)
            if (now - lastKeyTime < 50) {
                rapidKeyCount++;
                if (rapidKeyCount > 20) {
                    this.reportThreat('rapid_keyboard_input', {
                        count: rapidKeyCount,
                        timeFrame: now - lastKeyTime
                    });
                }
            } else {
                rapidKeyCount = 0;
            }
            
            // Check for suspicious key combinations
            if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                this.reportThreat('dev_tools_shortcut', { 
                    shortcut: 'Ctrl+Shift+I' 
                });
            }
            
            lastKeyTime = now;
        });
    }

    /**
     * Report a security threat
     */
    reportThreat(type, details = {}) {
        const threat = {
            type,
            timestamp: Date.now(),
            details,
            userAgent: navigator.userAgent,
            url: window.location.href,
            sessionId: this.getSessionId()
        };

        this.threats.push(threat);
        
        // Limit threats array
        if (this.threats.length > 1000) {
            this.threats = this.threats.slice(-1000);
        }

        this.dispatchEvent(new CustomEvent('security:threat', {
            detail: threat
        }));

        // Auto-response to high-severity threats
        if (this.isHighSeverityThreat(type)) {
            this.handleHighSeverityThreat(threat);
        }

        console.warn('Security threat detected:', threat);
    }

    /**
     * Check if threat is high severity
     */
    isHighSeverityThreat(type) {
        const highSeverityThreats = [
            'multiple_sessions_detected',
            'session_hijack_attempt',
            'suspicious_activity_pattern'
        ];
        
        return highSeverityThreats.includes(type);
    }

    /**
     * Handle high severity threats
     */
    handleHighSeverityThreat(threat) {
        this.dispatchEvent(new CustomEvent('security:high_severity', {
            detail: threat
        }));
        
        // Could trigger immediate logout or additional security measures
        console.error('HIGH SEVERITY THREAT:', threat);
    }

    /**
     * Record failed login attempt
     */
    recordFailedAttempt() {
        this.failedAttempts++;
        
        if (this.failedAttempts >= this.config.maxFailedAttempts) {
            this.lockAccount();
        }

        this.reportThreat('failed_login_attempt', {
            attemptNumber: this.failedAttempts,
            maxAttempts: this.config.maxFailedAttempts
        });
    }

    /**
     * Lock account due to failed attempts
     */
    lockAccount() {
        this.isLocked = true;
        this.lockoutTime = Date.now();
        
        this.dispatchEvent(new CustomEvent('security:account_locked', {
            detail: {
                lockoutDuration: this.config.lockoutDuration,
                reason: 'failed_attempts',
                timestamp: this.lockoutTime
            }
        }));
    }

    /**
     * Check if account is currently locked
     */
    isAccountLocked() {
        if (!this.isLocked) return false;
        
        const elapsed = Date.now() - this.lockoutTime;
        if (elapsed > this.config.lockoutDuration) {
            this.isLocked = false;
            this.lockoutTime = null;
            this.failedAttempts = 0;
            return false;
        }
        
        return true;
    }

    /**
     * Get security summary
     */
    getSecuritySummary() {
        const now = Date.now();
        const recentThreats = this.threats.filter(t => 
            now - t.timestamp < 60 * 60 * 1000 // Last hour
        );

        return {
            totalThreats: this.threats.length,
            recentThreats: recentThreats.length,
            failedAttempts: this.failedAttempts,
            isLocked: this.isAccountLocked(),
            lockoutTimeRemaining: this.isLocked ? 
                Math.max(0, this.config.lockoutDuration - (now - this.lockoutTime)) : 0,
            threatsByType: this.getThreatsByType(),
            lastThreat: this.threats[this.threats.length - 1]
        };
    }

    /**
     * Get threats grouped by type
     */
    getThreatsByType() {
        const grouped = {};
        this.threats.forEach(threat => {
            grouped[threat.type] = (grouped[threat.type] || 0) + 1;
        });
        return grouped;
    }

    /**
     * Get session ID
     */
    getSessionId() {
        return sessionStorage.getItem('sessionId') || 'unknown';
    }

    /**
     * Clear all threats
     */
    clearThreats() {
        this.threats = [];
        this.dispatchEvent(new CustomEvent('security:threats_cleared', {
            detail: { timestamp: Date.now() }
        }));
    }

    /**
     * Reset failed attempts
     */
    resetFailedAttempts() {
        this.failedAttempts = 0;
        this.isLocked = false;
        this.lockoutTime = null;
        
        this.dispatchEvent(new CustomEvent('security:attempts_reset', {
            detail: { timestamp: Date.now() }
        }));
    }
}

/**
 * ===================================================================
 * Export Components
 * ===================================================================
 */

// Make components available globally
window.IdleDetector = IdleDetector;
window.SessionManager = SessionManager;
window.LogoutModal = LogoutModal;
window.ActivityTracker = ActivityTracker;
window.SecurityMonitor = SecurityMonitor;

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        IdleDetector, 
        SessionManager, 
        LogoutModal, 
        ActivityTracker,
        SecurityMonitor 
    };
}