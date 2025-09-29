/**
 * ระบบสอบย้อนกลับผักอุดร - API Connection
 * =====================================
 */

/**
 * API Handler Class
 */
class APIHandler {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
        this.timeout = 15000; // 15 seconds (reduced for better UX)
        this.cache = new Map(); // Simple cache for Google Services requests
        this.loadingStates = new Map(); // Track loading states to prevent duplicate requests
    }

    /**
     * Enhanced API request with retry mechanism for critical operations
     */
    async makeRequestWithRetry(endpoint, data = {}, method = 'POST', customTimeout = null, maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 API Request attempt ${attempt}/${maxRetries}: ${endpoint}`);
                return await this.makeRequest(endpoint, data, method, customTimeout);
            } catch (error) {
                console.warn(`⚠️ API Request attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    // Last attempt failed
                    throw error;
                }
                
                // Wait before retry (exponential backoff)
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                console.log(`⏳ Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Enhanced API request with better error handling and connection testing
     */
    async makeRequest(endpoint, data = {}, method = 'POST', customTimeout = null) {
        try {
            // For development/testing - mock some authentication endpoints
            if (this.shouldUseMock(endpoint)) {
                return await this.mockRequest(endpoint, data);
            }

            // Check cache for Google Services read operations
            if (this.shouldUseCache(endpoint, data)) {
                const cacheKey = this.getCacheKey(endpoint, data);
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    console.log(`🎯 Cache hit for ${endpoint}`);
                    return cached;
                }
            }

            // Prevent duplicate concurrent requests
            const requestKey = this.getRequestKey(endpoint, data);
            if (this.loadingStates.has(requestKey)) {
                console.log(`⏳ Request already in progress for ${endpoint}, waiting...`);
                return await this.loadingStates.get(requestKey);
            }

            // Test connection first for critical operations (except health checks)
            if (endpoint !== 'health' && endpoint !== 'healthCheck' && !this.connectionTested) {
                try {
                    await this.testConnection();
                    this.connectionTested = true;
                } catch (connectionError) {
                    console.warn('Connection test failed, proceeding anyway:', connectionError.message);
                }
            }

            const requestData = {
                action: endpoint,
                ...data,
                timestamp: new Date().toISOString()
            };
            
            // Improved data sanitization - only apply to specific fields that need text format
            const textFields = ['GroupCode', 'PlotNumber', 'IDCard', 'Phone', 'QRCode', 'LotCode', 'SearchCode', 'DistributorCode'];
            textFields.forEach(field => {
                if (data[field] && typeof data[field] === 'string') {
                    // Only apply text format if it's a numeric string that needs preservation
                    if (/^\d+$/.test(data[field])) {
                        requestData[field] = asText(data[field]);
                    } else {
                        requestData[field] = data[field];
                    }
                }
            });

            // 🔧 CRITICAL FIX: ส่งข้อมูลแบบ JSON สำหรับ updateProductionData และ createProductionCycle เพื่อรองรับ nested structure
            let options;
            if (endpoint === 'updateProductionData' || endpoint === 'createProductionCycle') {
                options = {
                    method: method,
                    redirect: 'follow',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                };
                if (endpoint === 'updateProductionData') {
                    console.log('📤 Sending updateProductionData as JSON:', JSON.stringify(requestData, null, 2));
                } else if (endpoint === 'createProductionCycle') {
                    console.log('📤 Sending createProductionCycle as JSON:', JSON.stringify(requestData, null, 2));
                }
            } else {
                options = {
                    method: method,
                    redirect: 'follow',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams(requestData)
                };
            }

            // Dynamic timeout based on operation type
            const timeoutValue = customTimeout || this.getTimeoutForOperation(endpoint, data);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutValue);
            options.signal = controller.signal;

            console.log(`🚀 API Request: ${endpoint} (timeout: ${timeoutValue}ms)`);
            const startTime = Date.now();

            // Create promise and store it in loading states
            const requestPromise = (async () => {
                try {
                    const response = await fetch(this.baseURL, options);
                    clearTimeout(timeoutId);
                    
                    const responseTime = Date.now() - startTime;
                    console.log(`✅ API Response: ${endpoint} (${responseTime}ms)`);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const result = await response.json();
                    
                    // Enhanced error checking
                    if (result.error || (result.success === false && !result.message)) {
                        throw new Error(result.error || result.message || 'Unknown server error');
                    }

                    // Cache result if it's a cacheable request
                    if (this.shouldUseCache(endpoint, data)) {
                        const cacheKey = this.getCacheKey(endpoint, data);
                        this.setCache(cacheKey, result);
                    }

                    return result;
                } finally {
                    // Remove from loading states when done
                    this.loadingStates.delete(requestKey);
                }
            })();

            // Store the promise in loading states
            this.loadingStates.set(requestKey, requestPromise);
            
            return await requestPromise;

        } catch (error) {
            console.error('API Request Error:', error);
            
            // Enhanced error handling with specific error types
            if (error.name === 'AbortError') {
                console.warn(`⚠️ Request aborted for ${endpoint} after ${Date.now() - (this._requestStartTime || Date.now())}ms`);
                throw new Error('การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง');
            } else if (error.message.includes('Failed to fetch')) {
                throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
            } else if (error.message.includes('CORS')) {
                throw new Error('ปัญหาการเชื่อมต่อ CORS กรุณาติดต่อผู้ดูแลระบบ');
            } else if (error.message.includes('HTTP 404')) {
                throw new Error('ไม่พบ API endpoint กรุณาตรวจสอบการตั้งค่า');
            } else if (error.message.includes('HTTP 403')) {
                throw new Error('ไม่มีสิทธิ์เข้าถึง กรุณาตรวจสอบการตั้งค่าสิทธิ์');
            }
            
            throw new Error(error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
        }
    }

    /**
     * Get appropriate timeout for different operations
     */
    getTimeoutForOperation(endpoint, data = {}) {
        const baseTimeout = this.timeout;
        
        // File upload operations need longer timeout
        if (endpoint.includes('upload') || endpoint.includes('file')) {
            const fileSize = data.fileContent ? data.fileContent.length : 0;
            return Math.max(baseTimeout, Math.min(fileSize / 1024 * 1000, 300000)); // Max 5 minutes
        }
        
        // Batch operations need longer timeout
        if (endpoint.includes('batch') || endpoint.includes('report')) {
            return baseTimeout * 2;
        }
        
        // ⚠️ TEMPORARY FIX: Group operations and createProductionCycle need longer timeout until Google Apps Script is optimized
        if (endpoint === 'getAllGroups' || endpoint === 'getGroupData' || endpoint.includes('Group') || endpoint === 'createProductionCycle') {
            return 30000; // 30 seconds - ชั่วคราวจนกว่าจะ Deploy GAS ใหม่
        }
        
        return baseTimeout;
    }

    /**
     * Test connection to the API
     */
    async testConnection() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for connection test
            
            const response = await fetch(this.baseURL, {
                method: 'POST',
                mode: 'cors',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({ action: 'health' }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('🏥 Health check result:', result);
            
            return result;
        } catch (error) {
            console.error('❌ Connection test failed:', error);
            throw error;
        }
    }

    /**
     * Test Google Sheets connection
     */
    async testSheetsConnection() {
        try {
            return await this.makeRequest('testSheetsConnection', {}, 'POST', 15000);
        } catch (error) {
            console.error('❌ Sheets connection test failed:', error);
            throw error;
        }
    }

    /**
     * Test Google Drive access
     */
    async testDriveAccess() {
        try {
            return await this.makeRequest('testDriveAccess', {}, 'POST', 15000);
        } catch (error) {
            console.error('❌ Drive access test failed:', error);
            throw error;
        }
    }

    /**
     * Check if we should use mock for this endpoint
     */
    shouldUseMock(endpoint) {
        // Enable mock for testing - set to false for production
        const useMock = false; // เปลี่ยนเป็น true เพื่อทดสอบ, false เพื่อใช้งานจริง
        return useMock && ['login', 'changePasswordFirstTime', 'createGroup'].includes(endpoint);
    }

    /**
     * Cache management methods
     */
    shouldUseCache(endpoint, data) {
        // Cache read-only operations for Google Services
        const cacheableEndpoints = [
            'getGroups', 'getGroupData', 'getDashboardStats', 
            'testSheetsConnection', 'testDriveAccess', 'getSystemHealth'
        ];
        return cacheableEndpoints.includes(endpoint);
    }

    getCacheKey(endpoint, data) {
        // Create unique key based on endpoint and data
        const keyData = { endpoint, ...data };
        return JSON.stringify(keyData);
    }

    getRequestKey(endpoint, data) {
        // Similar to cache key but for tracking concurrent requests
        return this.getCacheKey(endpoint, data);
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        // Check if cache expired with dynamic TTL based on endpoint
        const now = Date.now();
        let ttl = 300000; // 5 minutes default
        
        // Group data can be cached longer since it changes infrequently
        if (key.includes('getGroupData') || key.includes('getAllGroups')) {
            ttl = 600000; // 10 minutes for group data
        }
        
        if (now - cached.timestamp > ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
        
        // Limit cache size (keep only last 50 entries)
        if (this.cache.size > 50) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache cleared');
    }

    /**
     * Mock API responses for development/testing
     */
    async mockRequest(endpoint, data) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        switch (endpoint) {
            case 'login':
                return this.mockLogin(data);
            case 'changePasswordFirstTime':
                return this.mockPasswordChange(data);
            case 'createGroup':
                return this.mockCreateGroup(data);
            default:
                throw new Error('Unknown mock endpoint: ' + endpoint);
        }
    }

    /**
     * Mock login response - simulating real database structure
     */
    mockLogin(data) {
        const { username, password } = data;

        // Mock data matching your Users sheet structure
        const mockUsers = {
            'admin': { 
                userID: 'U001',
                username: 'admin', 
                role: 'admin', 
                fullName: 'ผู้ดูแลระบบ', 
                password: 'admin123',
                groupID: null,
                status: 'Active',
                firstLogin: false,
                lastLogin: '2024-01-15 10:30:00'
            },
            'group01_manager': { 
                userID: 'U002',
                username: 'group01_manager', 
                role: 'group', 
                fullName: 'ผู้จัดการกลุ่ม 01', 
                password: 'group123',
                groupID: 'G001',
                status: 'Active',
                firstLogin: true, // <-- นี่คือ key สำคัญสำหรับการตรวจสอบ
                lastLogin: null
            },
            'group02_manager': { 
                userID: 'U003',
                username: 'group02_manager', 
                role: 'group', 
                fullName: 'ผู้จัดการกลุ่ม 02', 
                password: 'group456',
                groupID: 'G002',
                status: 'Active',
                firstLogin: false, // <-- ผู้ใช้นี้เปลี่ยนรหัสผ่านแล้ว
                lastLogin: '2024-01-10 14:20:00'
            },
            'farmer01': { 
                userID: 'U004',
                username: 'farmer01', 
                role: 'farmer', 
                fullName: 'เกษตรกร 01', 
                password: '0812345678',
                groupID: 'G001',
                status: 'Active',
                firstLogin: false,
                lastLogin: '2024-01-12 09:15:00'
            }
        };

        let user = mockUsers[username];
        
        // Check if this is a newly created group manager
        if (!user && typeof window !== 'undefined' && window.mockNewManagers && window.mockNewManagers[username]) {
            user = window.mockNewManagers[username];
        }
        
        if (!user || user.password !== password) {
            return {
                success: false,
                message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
            };
        }

        if (user.status !== 'Active') {
            return {
                success: false,
                message: 'บัญชีผู้ใช้ถูกระงับ กรุณาติดต่อผู้ดูแลระบบ'
            };
        }

        // Return user data without password, including FirstLogin flag
        const { password: _, ...userWithoutPassword } = user;
        
        return {
            success: true,
            user: userWithoutPassword,
            message: 'เข้าสู่ระบบสำเร็จ'
        };
    }

    /**
     * Mock password change response
     */
    mockPasswordChange(data) {
        const { username, oldPassword, newPassword } = data;

        // Simple validation
        if (!username || !oldPassword || !newPassword) {
            return {
                success: false,
                message: 'ข้อมูลไม่ครบถ้วน'
            };
        }

        if (newPassword.length < 6) {
            return {
                success: false,
                message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'
            };
        }

        // Validate current password (in real implementation, this would check against database)
        if (username === 'group01_manager' && oldPassword !== 'group123') {
            return {
                success: false,
                message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง'
            };
        }

        // Simulate updating FirstLogin to FALSE and LastLogin timestamp in database
        // In real implementation, this would update the Users sheet:
        // FirstLogin = FALSE, LastLogin = current timestamp
        console.log(`Simulating database update for ${username}:`);
        console.log('- FirstLogin: TRUE -> FALSE');
        console.log('- LastLogin: NULL ->', new Date().toISOString());
        console.log('- Password: [UPDATED]');

        return {
            success: true,
            message: 'เปลี่ยนรหัสผ่านสำเร็จ',
            updatedFields: {
                firstLogin: false,
                lastLogin: new Date().toISOString()
            }
        };
    }

    /**
     * Mock create group response
     */
    mockCreateGroup(data) {
        const { managerUsername, managerPassword } = data;

        // Simple validation
        if (!managerUsername || !managerPassword) {
            return {
                success: false,
                message: 'ข้อมูลไม่ครบถ้วน'
            };
        }

        // Generate mock group data
        const groupId = 'G' + String(Date.now()).slice(-3);
        const groupCode = 'GROUP' + String(Date.now()).slice(-4);
        
        // Store the new group manager in mock storage for login testing
        if (typeof window !== 'undefined') {
            window.mockNewManagers = window.mockNewManagers || {};
            window.mockNewManagers[managerUsername] = {
                userID: 'U' + String(Date.now()).slice(-3),
                username: managerUsername,
                role: 'group',
                fullName: 'ผู้จัดการกลุ่ม ' + groupCode,
                password: managerPassword,
                groupID: groupId,
                status: 'Active',
                firstLogin: true,
                lastLogin: null
            };
        }
        
        console.log(`Simulating group creation:`);
        console.log(`- Group ID: ${groupId}`);
        console.log(`- Group Code: ${groupCode}`);
        console.log(`- Manager Username: ${managerUsername}`);
        console.log(`- Manager Password: [HIDDEN]`);
        console.log(`- Manager FirstLogin: TRUE`);
        console.log('- Added to mock login data for testing');

        return {
            success: true,
            message: 'สร้างกลุ่มเกษตรกรสำเร็จ',
            firstLoginRequired: true,
            group: {
                groupId: groupId,
                groupCode: groupCode,
                groupName: groupCode,
                managerUsername: managerUsername,
                managerPassword: managerPassword,
                folders: {
                    success: true,
                    groupFolderId: 'folder_' + groupId
                }
            },
            instructions: {
                login: `ผู้จัดการกลุ่มสามารถเข้าสู่ระบบด้วยชื่อผู้ใช้: ${managerUsername}`,
                password: 'เมื่อเข้าสู่ระบบครั้งแรก จะต้องเปลี่ยนรหัสผ่านเพื่อความปลอดภัย'
            }
        };
    }

    /**
     * Upload file to Google Drive
     */
    async uploadFile(file, folder = 'uploads') {
        try {
            // Convert file to base64
            const base64 = await this.fileToBase64(file);
            
            const data = {
                fileName: file.name,
                fileContent: base64,
                mimeType: file.type,
                folder: folder
            };

            return await this.makeRequest('uploadFile', data);
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    }

    /**
     * Convert file to base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Remove data:image/jpeg;base64, prefix
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    /**
     * Upload file to specific folder based on farmer ID and file type
     */
    async uploadFileToSpecificFolder(file, farmerID, fileType, onProgress = null) {
        try {
            // Validate file first
            this.validateFile(file, fileType);
            
            // Compress image if needed
            let processedFile = file;
            if (fileType === 'farm_photo' || fileType === 'product_photo') {
                processedFile = await this.compressImage(file);
            }
            
            // Determine folder based on file type
            const folderMapping = {
                'farm_photo': 'รูปภาพแปลงปลูก',
                'certificate': 'เอกสารการรับรอง',
                'product_photo': 'รูปภาพผลิตภัณฑ์'
            };
            
            const folderName = folderMapping[fileType];
            if (!folderName) {
                throw new Error('ประเภทไฟล์ไม่ถูกต้อง');
            }
            
            // Convert to base64
            const base64 = await this.fileToBase64(processedFile);
            
            const data = {
                fileName: processedFile.name,
                fileContent: base64,
                mimeType: processedFile.type,
                farmerID: farmerID,
                fileType: fileType,
                folderName: folderName
            };

            // Create progress handler if provided
            if (onProgress) {
                onProgress(0); // Start progress
            }

            const result = await this.makeRequest('uploadFileToFarmerFolder', data);
            
            if (onProgress) {
                onProgress(100); // Complete progress
            }
            
            return result;
        } catch (error) {
            console.error('File upload to specific folder error:', error);
            throw error;
        }
    }

    /**
     * Upload file to group-specific folder
     */
    async uploadFileToGroupFolder(file, groupId, fileType, onProgress = null) {
        try {
            // Convert to base64
            const base64 = await this.fileToBase64(file);
            
            const data = {
                fileName: file.name,
                fileContent: base64,
                mimeType: file.type,
                groupId: groupId,
                uploadedBy: AuthAPI.getCurrentUser()?.username || 'system',
                fileType: fileType
            };

            // Create progress handler if provided
            if (onProgress) {
                onProgress(0); // Start progress
            }

            const result = await this.makeRequest('uploadFile', data);
            
            if (onProgress) {
                onProgress(100); // Complete progress
            }
            
            return result;
        } catch (error) {
            console.error('File upload to group folder error:', error);
            throw error;
        }
    }

    /**
     * Validate file size and type
     */
    validateFile(file, fileType) {
        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > maxSize) {
            throw new Error('ขนาดไฟล์เกิน 10MB กรุณาเลือกไฟล์ที่มีขนาดเล็กกว่า');
        }
        
        // Check file type based on fileType parameter
        const allowedTypes = {
            'farm_photo': ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
            'certificate': ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
            'product_photo': ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        };
        
        const allowed = allowedTypes[fileType];
        if (!allowed || !allowed.includes(file.type)) {
            const typeNames = {
                'farm_photo': 'รูปภาพ (JPEG, PNG, WebP)',
                'certificate': 'เอกสาร PDF หรือรูปภาพ (PDF, JPEG, PNG)',
                'product_photo': 'รูปภาพ (JPEG, PNG, WebP)'
            };
            throw new Error(`ประเภทไฟล์ไม่ถูกต้อง กรุณาเลือก${typeNames[fileType]}`);
        }
    }

    /**
     * Compress image before upload
     */
    async compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                // Set canvas size
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    // Create new File object with compressed data
                    const compressedFile = new File([blob], file.name, {
                        type: file.type,
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, file.type, quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Create progress indicator for file upload
     */
    createProgressIndicator(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;
        
        const progressDiv = document.createElement('div');
        progressDiv.className = 'upload-progress';
        progressDiv.innerHTML = `
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: 0%"></div>
            </div>
            <div class="progress-text">เตรียมอัพโหลด...</div>
        `;
        
        container.appendChild(progressDiv);
        
        return {
            update: (percent, text) => {
                const bar = progressDiv.querySelector('.progress-bar');
                const textEl = progressDiv.querySelector('.progress-text');
                if (bar) bar.style.width = percent + '%';
                if (textEl && text) textEl.textContent = text;
            },
            remove: () => {
                if (progressDiv.parentNode) {
                    progressDiv.parentNode.removeChild(progressDiv);
                }
            }
        };
    }

    /**
     * Alias for makeRequest() - for backward compatibility
     */
    call(endpoint, data = {}, method = 'POST', customTimeout = null) {
        return this.makeRequest(endpoint, data, method, customTimeout);
    }
}

// Create global API instance
const API = new APIHandler();

// Note: AuthAPI has been moved to auth.js to avoid conflicts

/**
 * QR Code API Functions
 */
const QRAPI = {
    
    /**
     * Search by QR Code
     */
    async searchByQRCode(qrCode) {
        try {
            const parsedCode = Utils.parseQRCode(qrCode);
            if (!parsedCode) {
                throw new Error('รูปแบบ QR Code ไม่ถูกต้อง');
            }

            const result = await API.makeRequest('searchQRCode', {
                qrCode: qrCode,
                groupCode: parsedCode.groupCode,
                plotNumber: parsedCode.plotNumber
            });

            return result;
        } catch (error) {
            console.error('QR search error:', error);
            throw error;
        }
    },

    /**
     * Search by deep search code
     */
    async searchByDeepCode(searchCode) {
        try {
            const parsedCode = Utils.parseSearchCode(searchCode);
            if (!parsedCode) {
                throw new Error('รูปแบบรหัสค้นหาไม่ถูกต้อง');
            }

            const result = await API.makeRequest('searchDeepCode', {
                searchCode: searchCode,
                dateCode: parsedCode.dateCode,
                sequenceCode: parsedCode.sequenceCode
            });

            return result;
        } catch (error) {
            console.error('Deep search error:', error);
            throw error;
        }
    },

    /**
     * Generate QR Code for farmer
     */
    async generateQRCode(farmerData) {
        try {
            return await API.makeRequest('generateQRCode', farmerData);
        } catch (error) {
            console.error('QR generation error:', error);
            throw error;
        }
    }
};

/**
 * Admin API Functions
 */
const AdminAPI = {
    
    /**
     * Retry mechanism for API calls
     */
    async withRetry(fn, maxRetries = 2, operationName = 'API call') {
        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
                console.log(`🔄 ${operationName} attempt ${attempt}/${maxRetries + 1}`);
                return await fn();
            } catch (error) {
                if (attempt === maxRetries + 1) {
                    console.error(`❌ ${operationName} failed after ${maxRetries + 1} attempts:`, error);
                    throw error;
                }
                
                const isTimeout = error.message.includes('เวลานานเกินไป') || error.name === 'AbortError';
                if (isTimeout) {
                    const delay = attempt * 2000; // 2s, 4s delay
                    console.warn(`⏱️ ${operationName} timeout, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error; // Don't retry non-timeout errors
                }
            }
        }
    },
    
    /**
     * Get all groups with retry mechanism
     */
    async getAllGroups() {
        return await this.withRetry(async () => {
            return await API.makeRequest('getAllGroups');
        }, 2, 'getAllGroups'); // 2 retries สำหรับ getAllGroups
    },

    /**
     * Create new group
     */
    async createGroup(groupData) {
        return await API.makeRequest('createGroup', {
            managerUsername: Utils.sanitizeInput(groupData.managerUsername),
            managerPassword: groupData.managerPassword // Don't sanitize password as it might alter it
            // ลบ groupName ออก ให้ backend สร้างรหัสกลุ่มอัตโนมัติ
        });
    },

    /**
     * Update group
     */
    async updateGroup(groupId, groupData) {
        return await API.makeRequest('updateGroup', {
            groupId: groupId,
            ...groupData
        });
    },

    /**
     * Delete group
     */
    async deleteGroup(groupId) {
        return await API.makeRequest('deleteGroup', { groupId: groupId });
    },

    /**
     * Get system statistics
     */
    async getSystemStats() {
        return await API.makeRequest('getSystemStats');
    },

    /**
     * Generate system report
     */
    async generateSystemReport(reportType, dateFrom, dateTo) {
        return await API.makeRequest('generateSystemReport', {
            reportType: reportType,
            dateFrom: dateFrom,
            dateTo: dateTo
        });
    },

    /**
     * Enhanced system diagnostics
     */
    async runSystemDiagnostics() {
        try {
            console.log('🔍 Running comprehensive system diagnostics...');
            
            const diagnostics = {
                timestamp: new Date().toISOString(),
                tests: {},
                overall: 'unknown'
            };
            
            // Test 1: Health Check
            try {
                const healthResult = await API.testConnection();
                diagnostics.tests.health = {
                    status: healthResult.status === 'healthy' ? 'pass' : 'fail',
                    data: healthResult,
                    message: healthResult.status === 'healthy' ? 'ระบบทำงานปกติ' : 'ระบบมีปัญหา'
                };
            } catch (error) {
                diagnostics.tests.health = {
                    status: 'fail',
                    error: error.message,
                    message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้'
                };
            }
            
            // Test 2: Google Sheets Connection
            try {
                const sheetsResult = await API.testSheetsConnection();
                diagnostics.tests.sheets = {
                    status: sheetsResult.success ? 'pass' : 'fail',
                    data: sheetsResult.data,
                    message: sheetsResult.message
                };
            } catch (error) {
                diagnostics.tests.sheets = {
                    status: 'fail',
                    error: error.message,
                    message: 'ไม่สามารถเชื่อมต่อกับ Google Sheets ได้'
                };
            }
            
            // Test 3: Google Drive Access
            try {
                const driveResult = await API.testDriveAccess();
                diagnostics.tests.drive = {
                    status: driveResult.success ? 'pass' : 'fail',
                    data: driveResult.data,
                    message: driveResult.message
                };
            } catch (error) {
                diagnostics.tests.drive = {
                    status: 'fail',
                    error: error.message,
                    message: 'ไม่สามารถเข้าถึง Google Drive ได้'
                };
            }
            
            // Determine overall status
            const testResults = Object.values(diagnostics.tests);
            const passCount = testResults.filter(test => test.status === 'pass').length;
            const totalTests = testResults.length;
            
            if (passCount === totalTests) {
                diagnostics.overall = 'healthy';
            } else if (passCount > 0) {
                diagnostics.overall = 'degraded';
            } else {
                diagnostics.overall = 'critical';
            }
            
            console.log('✅ System diagnostics completed:', diagnostics);
            return diagnostics;
            
        } catch (error) {
            console.error('❌ System diagnostics failed:', error);
            return {
                timestamp: new Date().toISOString(),
                overall: 'critical',
                error: error.message,
                message: 'ไม่สามารถทำการตรวจสอบระบบได้'
            };
        }
    },

    /**
     * Test Google Drive access
     */
    async testDriveAccess() {
        return await API.makeRequest('testDriveAccess');
    },

    /**
     * Test Google Sheets connection
     */
    async testSheetsConnection() {
        return await API.makeRequest('testSheetsConnection');
    },

    /**
     * Get health status
     */
    async getHealthStatus() {
        return await API.testConnection();
    }
    ,

    /**
     * Delete file from Google Drive
     */
    async deleteFile(fileId, requestedBy) {
        return await API.makeRequest('deleteFile', {
            fileId: fileId,
            requestedBy: requestedBy
        });
    },

    /**
     * List files in group folder
     */
    async listGroupFiles(groupId, folderType = 'all') {
        return await API.makeRequest('listGroupFiles', {
            groupId: groupId,
            folderType: folderType
        });
    },

    /**
     * Get file statistics for a group
     */
    async getFileStats(groupId, days = 30) {
        return await API.makeRequest('getFileStats', {
            groupId: groupId,
            days: days
        });
    }
};

/**
 * Group API Functions
 */
const GroupAPI = {
    
    /**
     * Get group data (with retry for better reliability)
     */
    async getGroupData(groupId) {
        return await API.makeRequestWithRetry('getGroupData', { groupId: groupId });
    },

    /**
     * Update group profile
     */
    async updateGroupProfile(groupData) {
        return await API.makeRequest('updateGroupProfile', groupData);
    },

    /**
     * Upload group documents
     */
    async uploadGroupDocument(file, documentType) {
        try {
            const uploadResult = await API.uploadFile(file, 'group-documents');
            
            return await API.makeRequest('saveGroupDocument', {
                groupId: groupData.groupId,
                documentType: documentType,
                fileName: file.name,
                fileUrl: uploadResult.fileUrl,
                fileId: uploadResult.fileId
            });
        } catch (error) {
            console.error('Group document upload error:', error);
            throw error;
        }
    },

    /**
     * Get all farmers in group
     */
    async getGroupFarmers(groupId) {
        return await API.makeRequest('getGroupFarmers', { groupId: groupId });
    },

    /**
     * Add new farmer to group
     */
    async addFarmer(farmerData) {
        return await API.makeRequest('addFarmer', {
            groupId: farmerData.groupId,
            fullName: Utils.sanitizeInput(farmerData.fullName),
            phone: Utils.sanitizeInput(farmerData.phone),
            idCard: Utils.sanitizeInput(farmerData.idCard),
            address: Utils.sanitizeInput(farmerData.address)
        });
    },

    /**
     * Update farmer data
     */
    async updateFarmer(farmerId, farmerData) {
        return await API.makeRequest('updateFarmer', {
            farmerId: farmerId,
            ...farmerData
        });
    },

    /**
     * Delete farmer
     */
    async deleteFarmer(farmerId) {
        return await API.makeRequest('deleteFarmer', { farmerId: farmerId });
    },

    /**
     * Get group statistics
     */
    async getGroupStats(groupId) {
        return await API.makeRequest('getGroupStats', { groupId: groupId });
    }
};

/**
 * Farmer API Functions (Old - ใช้ farmer-api.js แทน)
 */
const OldFarmerAPI = {
    
    /**
     * Get farmer data
     */
    async getFarmerData(farmerId) {
        return await API.makeRequest('getFarmerData', { farmerId: farmerId });
    },

    /**
     * Save farmer section data
     */
    async saveFarmerSection(farmerId, sectionNumber, sectionData) {
        return await API.makeRequest('saveFarmerSection', {
            farmerId: farmerId,
            sectionNumber: sectionNumber,
            sectionData: JSON.stringify(sectionData)
        });
    },

    /**
     * Upload farmer document
     */
    async uploadFarmerDocument(farmerId, file, documentType) {
        try {
            const uploadResult = await API.uploadFile(file, 'farmer-documents');
            
            return await API.makeRequest('saveFarmerDocument', {
                farmerId: farmerId,
                documentType: documentType,
                fileName: file.name,
                fileUrl: uploadResult.fileUrl,
                fileId: uploadResult.fileId
            });
        } catch (error) {
            console.error('Farmer document upload error:', error);
            throw error;
        }
    },

    /**
     * Get farmer's QR Code
     */
    async getFarmerQRCode(farmerId) {
        return await API.makeRequest('getFarmerQRCode', { farmerId: farmerId });
    },

    /**
     * Generate search code for farmer
     */
    async generateSearchCode(farmerId, shipDate) {
        return await API.makeRequest('generateSearchCode', {
            farmerId: farmerId,
            shipDate: shipDate
        });
    }
};

/**
 * Report API Functions
 */
const ReportAPI = {
    
    /**
     * Generate farmer report
     */
    async generateFarmerReport(farmerId) {
        return await API.makeRequest('generateFarmerReport', { farmerId: farmerId });
    },

    /**
     * Generate group report
     */
    async generateGroupReport(groupId, dateFrom, dateTo) {
        return await API.makeRequest('generateGroupReport', {
            groupId: groupId,
            dateFrom: dateFrom,
            dateTo: dateTo
        });
    },

    /**
     * Export data to Excel
     */
    async exportToExcel(reportType, filters = {}) {
        return await API.makeRequest('exportToExcel', {
            reportType: reportType,
            filters: JSON.stringify(filters)
        });
    }
};

/**
 * Enhanced Error Handler for API calls with better diagnostics
 */
function handleAPIError(error, defaultMessage = 'เกิดข้อผิดพลาด', showDiagnostics = false) {
    console.error('API Error:', error);
    console.error('Error details:', {
        type: typeof error,
        message: error?.message,
        stack: error?.stack,
        response: error?.response,
        status: error?.status,
        details: error?.details
    });
    
    let message = defaultMessage;
    let title = 'เกิดข้อผิดพลาด';
    let severity = 'error';
    let suggestions = [];
    
    // Handle different error types
    if (error?.response?.data?.message) {
        message = error.response.data.message;
    } else if (error?.message) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    } else if (error?.error) {
        message = error.error;
    }
    
    // Enhanced error categorization with suggestions
    if (message.includes('Cannot access spreadsheet') || message.includes('SPREADSHEET_ID')) {
        title = 'ปัญหาการเข้าถึง Google Sheets';
        severity = 'critical';
        suggestions = [
            'ตรวจสอบว่า Google Sheets ID ถูกต้อง',
            'ตรวจสอบสิทธิ์การเข้าถึง Google Sheets',
            'ลองเข้าถึง Google Sheets ผ่านเบราว์เซอร์'
        ];
    } else if (message.includes('Cannot access drive folder') || message.includes('DRIVE_FOLDER_ID')) {
        title = 'ปัญหาการเข้าถึง Google Drive';
        severity = 'critical';
        suggestions = [
            'ตรวจสอบว่า Google Drive Folder ID ถูกต้อง',
            'ตรวจสอบสิทธิ์การเข้าถึง Google Drive',
            'ลองเข้าถึงโฟลเดอร์ผ่านเบราว์เซอร์'
        ];
    } else if (message.includes('HTTP 404')) {
        title = 'ไม่พบ API Endpoint';
        severity = 'critical';
        suggestions = [
            'ตรวจสอบ URL ของ Google Apps Script',
            'ตรวจสอบว่า Web App ได้ถูก deploy แล้ว',
            'ลองใช้ URL ใหม่'
        ];
    } else if (message.includes('HTTP 403') || message.includes('Permission')) {
        title = 'ไม่มีสิทธิ์เข้าถึง';
        severity = 'critical';
        suggestions = [
            'ตรวจสอบสิทธิ์การเข้าถึงไฟล์และโฟลเดอร์',
            'ตรวจสอบการตั้งค่า sharing ใน Google Drive',
            'ติดต่อผู้ดูแลระบบ'
        ];
    } else if (message.includes('Failed to fetch') || message.includes('network')) {
        title = 'ปัญหาการเชื่อมต่อเครือข่าย';
        severity = 'warning';
        suggestions = [
            'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
            'ลองรีเฟรชหน้าเว็บ',
            'ลองใหม่ในอีกสักครู่'
        ];
    } else if (message.includes('timeout') || message.includes('ใช้เวลานานเกินไป')) {
        title = 'การเชื่อมต่อใช้เวลานานเกินไป';
        severity = 'warning';
        suggestions = [
            'ลองใหม่อีกครั้ง',
            'ตรวจสอบความเร็วอินเทอร์เน็ต',
            'ลดขนาดไฟล์หากกำลังอัปโหลด'
        ];
    } else if (message.includes('CORS')) {
        title = 'ปัญหาการตั้งค่า CORS';
        severity = 'critical';
        suggestions = [
            'ติดต่อผู้ดูแลระบบ',
            'ตรวจสอบการตั้งค่า Web App',
            'ลองใช้เบราว์เซอร์อื่น'
        ];
    }
    
    Utils.hideLoading();
    
    // Show enhanced error dialog with suggestions
    if (showDiagnostics && suggestions.length > 0) {
        showEnhancedErrorDialog(title, message, suggestions, severity);
    } else {
        Utils.showError(title, message);
    }
    
    // Log error for analytics/monitoring
    logErrorForMonitoring(error, {
        title: title,
        message: message,
        severity: severity,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
    });
}

/**
 * Show enhanced error dialog with suggestions
 */
function showEnhancedErrorDialog(title, message, suggestions, severity) {
    const severityColors = {
        critical: 'danger',
        warning: 'warning',
        error: 'danger',
        info: 'info'
    };
    
    const color = severityColors[severity] || 'danger';
    
    let suggestionsHtml = '';
    if (suggestions.length > 0) {
        suggestionsHtml = `
            <div class="mt-3">
                <h6>แนวทางแก้ไข:</h6>
                <ul class="list-unstyled">
                    ${suggestions.map(suggestion => `<li><i class="fas fa-lightbulb text-warning me-2"></i>${suggestion}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    const errorHtml = `
        <div class="alert alert-${color} border-0">
            <div class="d-flex align-items-center">
                <i class="fas fa-exclamation-triangle me-3 fs-4"></i>
                <div>
                    <h5 class="alert-heading mb-2">${title}</h5>
                    <p class="mb-0">${message}</p>
                    ${suggestionsHtml}
                </div>
            </div>
        </div>
        <div class="mt-3 d-flex gap-2">
            <button type="button" class="btn btn-outline-secondary" onclick="AdminAPI.runSystemDiagnostics().then(result => console.log('Diagnostics:', result))">
                <i class="fas fa-stethoscope me-2"></i>ตรวจสอบระบบ
            </button>
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
                <i class="fas fa-check me-2"></i>เข้าใจแล้ว
            </button>
        </div>
    `;
    
    // Show in modal (assuming Bootstrap modal is available)
    Utils.showModal('ข้อผิดพลาดของระบบ', errorHtml);
}

/**
 * Log error for monitoring purposes
 */
function logErrorForMonitoring(error, metadata) {
    try {
        // Store error in localStorage for later analysis
        const errorLog = JSON.parse(localStorage.getItem('error_log') || '[]');
        errorLog.push({
            error: {
                message: error?.message,
                stack: error?.stack,
                name: error?.name
            },
            metadata: metadata
        });
        
        // Keep only last 50 errors
        if (errorLog.length > 50) {
            errorLog.splice(0, errorLog.length - 50);
        }
        
        localStorage.setItem('error_log', JSON.stringify(errorLog));
        
        // Optionally send to external monitoring service
        // sendToMonitoringService(error, metadata);
        
    } catch (logError) {
        console.warn('Failed to log error:', logError);
    }
}

/**
 * Global API call wrapper with loading
 */
async function apiCall(apiFunction, loadingMessage = 'กำลังโหลด...') {
    try {
        Utils.showLoading(loadingMessage);
        const result = await apiFunction();
        Utils.hideLoading();
        return result;
    } catch (error) {
        Utils.hideLoading();
        handleAPIError(error);
        throw error;
    }
}

// Export API modules (AuthAPI is exported from auth.js)
window.API = API;
window.QRAPI = QRAPI;
window.AdminAPI = AdminAPI;
window.GroupAPI = GroupAPI;
window.OldFarmerAPI = OldFarmerAPI;
window.ReportAPI = ReportAPI;
window.handleAPIError = handleAPIError;
window.apiCall = apiCall;

// Production API - all requests will be sent to Google Apps Script