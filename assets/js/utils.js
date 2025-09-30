/**
 * ระบบสอบย้อนกลับผักอุดร - Utility Functions
 * ================================
 */

// Global Constants
const CONFIG = {
    // Google Apps Script Web App URL - ต้องอัปเดตเป็น URL ที่ Deploy จริง
    API_BASE_URL: 'https://script.google.com/macros/s/AKfycbwp6ZVkmZ1D3ro0ajk2tWd3I4PufIqJe-oiugXcgL5flm9Yo9prXop-7GglNbp0-XQV/exec',
    
    // QR Code patterns
    QR_CODE_PATTERN: /^(\d{2})-(\d{17})$/,
    SEARCH_CODE_PATTERN: /^(\d{8})-(\d{3})$/,
    
    // Roles
    ROLES: {
        ADMIN: 'admin',
        GROUP: 'group',
        FARMER: 'farmer'
    },
    
    // Storage keys
    STORAGE_KEYS: {
        AUTH_TOKEN: 'auth_token',
        USER_DATA: 'user_data',
        LAST_LOGIN: 'last_login'
    }
};

/**
 * Convert any value to text format (equivalent to server-side toText)
 */
const asText = v => v == null ? '' : ('\'' + String(v));

/**
 * Convert date to Buddhist calendar YYYYMMDD format
 */
function toBuddhistYMD(val) {
    const d = new Date(val);
    if (isNaN(d)) return '';
    
    const buddhistYear = d.getFullYear() + 543;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return String(buddhistYear) + month + day;
}

/**
 * Utility Functions
 */
const Utils = {
    
    /**
     * Format date to Thai format
     */
    formatDateThai: function(date) {
        if (!date) return '-';
        
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Bangkok'
        };
        
        return new Date(date).toLocaleDateString('th-TH', options);
    },

/**
     * 🐞 BUG FIX: Fixed timezone issue 
     * Format date for input type="date" - ใช้ local timezone
     */
    formatDateForInput(dateString) {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            // ใช้ local timezone แทน UTC เพื่อป้องกันปัญหาวันที่เปลี่ยน
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            return '';
        }
    },

    /**
     * 🐞 BUG FIX: Added this missing function
     * Format file size
     */
     formatBytes: function(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    },
    
    /**
     * Format date and time to Thai format
     */
    formatDateTimeThai: function(date) {
        if (!date) return '-';
        
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Bangkok'
        };
        
        return new Date(date).toLocaleDateString('th-TH', options);
    },
    
    /**
     * Validate QR Code format
     */
    validateQRCode: function(code) {
        if (!code) return false;
        return CONFIG.QR_CODE_PATTERN.test(code.trim());
    },
    
    /**
     * Validate search code format
     */
    validateSearchCode: function(code) {
        if (!code) return false;
        return CONFIG.SEARCH_CODE_PATTERN.test(code.trim());
    },
    
    /**
     * Parse QR Code
     */
    parseQRCode: function(code) {
        const match = code.match(CONFIG.QR_CODE_PATTERN);
        if (!match) return null;
        
        return {
            groupCode: match[1],
            plotNumber: match[2],
            fullCode: code
        };
    },
    
    /**
     * Parse search code
     */
    parseSearchCode: function(code) {
        const match = code.match(CONFIG.SEARCH_CODE_PATTERN);
        if (!match) return null;
        
        return {
            dateCode: match[1],
            sequenceCode: match[2],
            fullCode: code
        };
    },
    
    /**
     * Show loading modal
     */
    showLoading: function(message = 'กำลังโหลด...') {
        const modal = document.getElementById('loadingModal');
        if (modal) {
            const messageEl = modal.querySelector('h5');
            if (messageEl) messageEl.textContent = message;
            
            // Check if instance already exists, if not create new one
            let bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (!bootstrapModal) {
                bootstrapModal = new bootstrap.Modal(modal);
            }
            bootstrapModal.show();
        }
    },
    
    /**
     * Hide loading modal
     */
    hideLoading: function() {
        const modal = document.getElementById('loadingModal');
        if (modal) {
            let bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) {
                bootstrapModal.hide();
            } else {
                // Force hide by removing modal backdrop and classes
                modal.classList.remove('show');
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
                modal.removeAttribute('aria-modal');
                
                // Remove backdrop
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
                
                // Remove modal-open class from body
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('overflow');
                document.body.style.removeProperty('padding-right');
            }
        }
    },
    
    /**
     * Show success message
     */
    showSuccess: function(title, message) {
        Swal.fire({
            icon: 'success',
            title: title,
            html: message,
            confirmButtonColor: '#198754',
            confirmButtonText: 'ตกลง'
        });
    },
    
    /**
     * Show error message
     */
    showError: function(title, message) {
        Swal.fire({
            icon: 'error',
            title: title,
            text: message,
            confirmButtonColor: '#dc3545',
            confirmButtonText: 'ตกลง'
        });
    },
    
    /**
     * Show warning message
     */
    showWarning: function(title, message) {
        Swal.fire({
            icon: 'warning',
            title: title,
            text: message,
            confirmButtonColor: '#ffc107',
            confirmButtonText: 'ตกลง'
        });
    },
    
    /**
     * Show confirmation dialog
     */
    showConfirm: function(title, message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') {
        return Swal.fire({
            icon: 'question',
            title: title,
            text: message,
            showCancelButton: true,
            confirmButtonColor: '#198754',
            cancelButtonColor: '#6c757d',
            confirmButtonText: confirmText,
            cancelButtonText: cancelText
        });
    },
    
    /**
     * Sanitize input string
     */
    sanitizeInput: function(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/[<>]/g, '') // Remove < and >
            .trim();
    },
    
    /**
     * Validate email format
     */
    validateEmail: function(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    /**
     * Validate phone number (Thai format)
     */
    validatePhone: function(phone) {
        const phoneRegex = /^(0[68][0-9]{8}|0[2379][0-9]{7})$/;
        return phoneRegex.test(phone.replace(/[-\s]/g, ''));
    },
    
    /**
     * Format phone number
     */
    formatPhone: function(phone) {
        if (!phone) return '';
        
        const cleaned = phone.replace(/\D/g, '');
        
        if (cleaned.length === 10) {
            return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
        }
        
        return phone;
    },
    
    /**
     * Generate random ID
     */
    generateId: function(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    /**
     * Get current timestamp in Thai format
     */
    getCurrentTimestamp: function() {
        return new Date().toLocaleString('th-TH', {
            timeZone: 'Asia/Bangkok'
        });
    },
    
    /**
     * Debounce function
     */
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Copy text to clipboard
     */
    copyToClipboard: function(text) {
        if (navigator.clipboard) {
            return navigator.clipboard.writeText(text).then(() => {
                this.showSuccess('คัดลอกแล้ว', 'คัดลอกข้อมูลไปยังคลิปบอร์ดแล้ว');
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showSuccess('คัดลอกแล้ว', 'คัดลอกข้อมูลไปยังคลิปบอร์ดแล้ว');
        }
    },
    
    /**
     * Format file size
     */
    formatFileSize: function(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    /**
     * Check if file is image
     */
    isImageFile: function(file) {
        return file && file.type.startsWith('image/');
    },
    
    /**
     * Resize image file
     */
    resizeImage: function(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = function() {
                // Calculate new dimensions
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(resolve, file.type, quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    },
    
    /**
     * Get query parameter
     */
    getQueryParam: function(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },
    
    /**
     * Set query parameter
     */
    setQueryParam: function(name, value) {
        const url = new URL(window.location);
        url.searchParams.set(name, value);
        window.history.pushState({}, '', url);
    },
    
    /**
     * Remove query parameter
     */
    removeQueryParam: function(name) {
        const url = new URL(window.location);
        url.searchParams.delete(name);
        window.history.pushState({}, '', url);
    },
    
    /**
     * Check if user is on mobile device
     */
    isMobile: function() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    
    /**
     * Check if browser supports camera
     */
    hasCameraSupport: function() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    },
    
    /**
     * Get geolocation
     */
    getCurrentLocation: function() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                position => resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }),
                error => reject(error),
                { timeout: 10000, enableHighAccuracy: true }
            );
        });
    },
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml: function(text) {
        if (!text) return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.replace(/[&<>"']/g, function(m) { 
            return map[m]; 
        });
    },
    
    /**
     * Get time ago string
     */
    getTimeAgo: function(date) {
        if (!date) return '';
        
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'เมื่อกี้นี้';
        if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
        if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
        if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
        
        return this.formatDateThai(date);
    }
};

/**
 * Local Storage Helper
 */
const Storage = {
    
    /**
     * Set item in localStorage
     */
    set: function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    },
    
    /**
     * Get item from localStorage
     */
    get: function(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    },
    
    /**
     * Remove item from localStorage
     */
    remove: function(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    },
    
    /**
     * Clear all localStorage
     */
    clear: function() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            return false;
        }
    }
};

/**
 * Event Listeners
 */
document.addEventListener('DOMContentLoaded', function() {
    // Auto form loading animation is disabled to prevent button hanging issues
    // Individual forms should handle their own loading states if needed
    
    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
});

// Export for use in other files
window.Utils = Utils;
window.Storage = Storage;
window.CONFIG = CONFIG;
