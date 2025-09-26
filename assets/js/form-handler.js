/**
 * ระบบสอบย้อนกลับผักอุดร - Form Handler
 * ==========================================
 * จัดการการ validate และส่งข้อมูล form ทั่วระบบ
 */

/**
 * Form Validation Handler Class
 */
class FormHandler {
    constructor() {
        this.validators = {};
        this.messages = {};
        this.initializeValidators();
        this.initializeMessages();
    }

    /**
     * เริ่มต้น validators
     */
    initializeValidators() {
        this.validators = {
            required: (value) => value && value.trim() !== '',
            email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            phone: (value) => /^[0-9-+().\s]+$/.test(value) && value.length >= 10,
            idCard: (value) => /^[0-9]{13}$/.test(value.replace(/\D/g, '')),
            number: (value) => !isNaN(value) && isFinite(value),
            positiveNumber: (value) => !isNaN(value) && parseFloat(value) > 0,
            minLength: (value, min) => value.length >= min,
            maxLength: (value, max) => value.length <= max,
            url: (value) => {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            },
            date: (value) => {
                const date = new Date(value);
                return date instanceof Date && !isNaN(date);
            },
            plotCode: (value) => /^[A-Z0-9]{3,10}$/.test(value),
            username: (value) => /^[a-zA-Z0-9_]{3,20}$/.test(value),
            password: (value) => value.length >= 6
        };
    }

    /**
     * เริ่มต้น error messages
     */
    initializeMessages() {
        this.messages = {
            required: 'ฟิลด์นี้จำเป็นต้องกรอก',
            email: 'รูปแบบอีเมลไม่ถูกต้อง',
            phone: 'รูปแบบเบอร์โทรไม่ถูกต้อง',
            idCard: 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก',
            number: 'ต้องเป็นตัวเลขเท่านั้น',
            positiveNumber: 'ต้องเป็นตัวเลขที่มากกว่า 0',
            minLength: 'ความยาวต้องไม่น้อยกว่า {min} ตัวอักษร',
            maxLength: 'ความยาวต้องไม่เกิน {max} ตัวอักษร',
            url: 'รูปแบบ URL ไม่ถูกต้อง',
            date: 'รูปแบบวันที่ไม่ถูกต้อง',
            plotCode: 'รหัสแปลงต้องเป็นตัวอักษรภาษาอังกฤษและตัวเลข 3-10 ตัว',
            username: 'ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _ ความยาว 3-20 ตัว',
            password: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'
        };
    }

    /**
     * Validate field เดียว
     * @param {HTMLElement} field - element ที่จะ validate
     * @param {Object} rules - กฎการ validate
     * @return {Object} ผลการ validate
     */
    validateField(field, rules) {
        const value = field.value.trim();
        const fieldName = field.getAttribute('data-name') || field.name || field.id;
        
        for (const rule of rules) {
            const [validatorName, ...params] = rule.split(':');
            
            if (validatorName === 'required' && !value) {
                return {
                    isValid: false,
                    message: this.getMessage(validatorName, fieldName, params)
                };
            }
            
            if (value && this.validators[validatorName]) {
                let isValid;
                if (params.length > 0) {
                    isValid = this.validators[validatorName](value, ...params);
                } else {
                    isValid = this.validators[validatorName](value);
                }
                
                if (!isValid) {
                    return {
                        isValid: false,
                        message: this.getMessage(validatorName, fieldName, params)
                    };
                }
            }
        }
        
        return { isValid: true };
    }

    /**
     * Validate form ทั้งหมด
     * @param {HTMLFormElement} form - form ที่จะ validate
     * @return {Object} ผลการ validate
     */
    validateForm(form) {
        const errors = [];
        const fields = form.querySelectorAll('[data-validate]');
        
        fields.forEach(field => {
            const rules = field.getAttribute('data-validate').split('|');
            const result = this.validateField(field, rules);
            
            if (!result.isValid) {
                errors.push({
                    field: field,
                    message: result.message
                });
                this.showFieldError(field, result.message);
            } else {
                this.clearFieldError(field);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * แสดง error message ใต้ field
     * @param {HTMLElement} field - field ที่มี error
     * @param {string} message - ข้อความ error
     */
    showFieldError(field, message) {
        this.clearFieldError(field);
        
        field.classList.add('is-invalid');
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'invalid-feedback';
        errorDiv.textContent = message;
        
        field.parentNode.appendChild(errorDiv);
    }

    /**
     * ลบ error message จาก field
     * @param {HTMLElement} field - field ที่จะลบ error
     */
    clearFieldError(field) {
        field.classList.remove('is-invalid');
        
        const errorDiv = field.parentNode.querySelector('.invalid-feedback');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    /**
     * ล้าง error ทั้งหมดใน form
     * @param {HTMLFormElement} form - form ที่จะล้าง error
     */
    clearFormErrors(form) {
        const fields = form.querySelectorAll('.is-invalid');
        fields.forEach(field => this.clearFieldError(field));
        
        const errorDivs = form.querySelectorAll('.invalid-feedback');
        errorDivs.forEach(div => div.remove());
    }

    /**
     * ดึง error message
     * @param {string} validatorName - ชื่อ validator
     * @param {string} fieldName - ชื่อ field
     * @param {Array} params - parameters เพิ่มเติม
     * @return {string} ข้อความ error
     */
    getMessage(validatorName, fieldName, params = []) {
        let message = this.messages[validatorName] || 'ข้อมูลไม่ถูกต้อง';
        
        // แทนที่ placeholder ใน message
        params.forEach((param, index) => {
            const placeholder = `{${Object.keys(this.messages)[index] || index}}`;
            message = message.replace(placeholder, param);
        });
        
        return message;
    }

    /**
     * Real-time validation
     * @param {HTMLFormElement} form - form ที่จะเปิด real-time validation
     */
    enableRealTimeValidation(form) {
        const fields = form.querySelectorAll('[data-validate]');
        
        fields.forEach(field => {
            field.addEventListener('blur', () => {
                const rules = field.getAttribute('data-validate').split('|');
                const result = this.validateField(field, rules);
                
                if (!result.isValid) {
                    this.showFieldError(field, result.message);
                } else {
                    this.clearFieldError(field);
                }
            });
            
            field.addEventListener('input', () => {
                if (field.classList.contains('is-invalid')) {
                    const rules = field.getAttribute('data-validate').split('|');
                    const result = this.validateField(field, rules);
                    
                    if (result.isValid) {
                        this.clearFieldError(field);
                    }
                }
            });
        });
    }
}

/**
 * File Upload Handler Class
 */
class FileUploadHandler {
    constructor() {
        this.allowedTypes = {
            image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            all: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        };
        
        this.maxSizes = {
            image: 5 * 1024 * 1024, // 5MB
            document: 10 * 1024 * 1024, // 10MB
            default: 5 * 1024 * 1024 // 5MB
        };
    }

    /**
     * ตรวจสอบไฟล์
     * @param {File} file - ไฟล์ที่จะตรวจสอบ
     * @param {string} type - ประเภทไฟล์ที่อนุญาต
     * @return {Object} ผลการตรวจสอบ
     */
    validateFile(file, type = 'all') {
        const allowedTypes = this.allowedTypes[type] || this.allowedTypes.all;
        const maxSize = this.maxSizes[type] || this.maxSizes.default;
        
        // ตรวจสอบประเภทไฟล์
        if (!allowedTypes.includes(file.type)) {
            return {
                isValid: false,
                message: `ประเภทไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ประเภท: ${this.getTypeDescription(type)}`
            };
        }
        
        // ตรวจสอบขนาดไฟล์
        if (file.size > maxSize) {
            return {
                isValid: false,
                message: `ขนาดไฟล์เกิน ${this.formatFileSize(maxSize)} กรุณาเลือกไฟล์ที่มีขนาดเล็กกว่า`
            };
        }
        
        return { isValid: true };
    }

    /**
     * อัปโหลดไฟล์
     * @param {File} file - ไฟล์ที่จะอัปโหลด
     * @param {Function} progressCallback - callback สำหรับ progress
     * @return {Promise} Promise ของการอัปโหลด
     */
    async uploadFile(file, progressCallback = null) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const base64 = e.target.result.split(',')[1];
                
                resolve({
                    success: true,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    base64Content: base64
                });
            };
            
            reader.onerror = function() {
                reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
            };
            
            reader.onprogress = function(e) {
                if (progressCallback && e.lengthComputable) {
                    const progress = (e.loaded / e.total) * 100;
                    progressCallback(progress);
                }
            };
            
            reader.readAsDataURL(file);
        });
    }

    /**
     * สร้าง preview ของไฟล์
     * @param {File} file - ไฟล์ที่จะสร้าง preview
     * @param {HTMLElement} container - container สำหรับแสดง preview
     */
    createPreview(file, container) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'img-thumbnail';
                img.style.maxWidth = '150px';
                img.style.maxHeight = '150px';
                
                const wrapper = document.createElement('div');
                wrapper.className = 'd-inline-block m-2 position-relative';
                
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'btn btn-danger btn-sm position-absolute top-0 end-0';
                removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                removeBtn.onclick = () => wrapper.remove();
                
                wrapper.appendChild(img);
                wrapper.appendChild(removeBtn);
                container.appendChild(wrapper);
            };
            reader.readAsDataURL(file);
        } else {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'alert alert-info d-inline-block m-2';
            fileDiv.innerHTML = `
                <i class="fas fa-file me-2"></i>
                ${file.name}
                <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick="this.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(fileDiv);
        }
    }

    /**
     * ได้คำอธิบายประเภทไฟล์
     * @param {string} type - ประเภทไฟล์
     * @return {string} คำอธิบาย
     */
    getTypeDescription(type) {
        const descriptions = {
            image: 'รูปภาพ (JPG, PNG, GIF, WebP)',
            document: 'เอกสาร (PDF, DOC, DOCX)',
            all: 'รูปภาพและเอกสาร (JPG, PNG, GIF, WebP, PDF, DOC, DOCX)'
        };
        
        return descriptions[type] || descriptions.all;
    }

    /**
     * แปลงขนาดไฟล์เป็นรูปแบบที่อ่านง่าย
     * @param {number} bytes - ขนาดไฟล์ในหน่วย bytes
     * @return {string} ขนาดไฟล์ที่อ่านง่าย
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

/**
 * Auto-save Handler Class
 */
class AutoSaveHandler {
    constructor(interval = 30000) { // Auto-save ทุก 30 วินาที
        this.interval = interval;
        this.timers = new Map();
        this.saveCallbacks = new Map();
    }

    /**
     * เปิดใช้งาน auto-save สำหรับ form
     * @param {HTMLFormElement} form - form ที่จะเปิด auto-save
     * @param {Function} saveCallback - function สำหรับบันทึกข้อมูล
     */
    enable(form, saveCallback) {
        const formId = form.id || 'default-form';
        this.saveCallbacks.set(formId, saveCallback);
        
        // ตั้งเวลา auto-save
        const timer = setInterval(() => {
            this.saveForm(form);
        }, this.interval);
        
        this.timers.set(formId, timer);
        
        // บันทึกเมื่อมีการเปลี่ยนแปลง
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.scheduleQuickSave(form);
            });
        });
        
        Logger.log(`เปิดใช้งาน auto-save สำหรับ form: ${formId}`);
    }

    /**
     * ปิดใช้งาน auto-save
     * @param {HTMLFormElement} form - form ที่จะปิด auto-save
     */
    disable(form) {
        const formId = form.id || 'default-form';
        
        if (this.timers.has(formId)) {
            clearInterval(this.timers.get(formId));
            this.timers.delete(formId);
        }
        
        this.saveCallbacks.delete(formId);
        Logger.log(`ปิดใช้งาน auto-save สำหรับ form: ${formId}`);
    }

    /**
     * บันทึก form ทันที
     * @param {HTMLFormElement} form - form ที่จะบันทึก
     */
    async saveForm(form) {
        const formId = form.id || 'default-form';
        const saveCallback = this.saveCallbacks.get(formId);
        
        if (!saveCallback) return;
        
        try {
            const formData = this.collectFormData(form);
            await saveCallback(formData);
            
            this.showSaveIndicator(form, 'success');
            Logger.log(`Auto-save สำเร็จสำหรับ form: ${formId}`);
            
        } catch (error) {
            this.showSaveIndicator(form, 'error');
            Logger.log(`Auto-save ผิดพลาดสำหรับ form: ${formId}`, error);
        }
    }

    /**
     * กำหนดเวลาบันทึกด่วน (debounced)
     * @param {HTMLFormElement} form - form ที่จะบันทึก
     */
    scheduleQuickSave(form) {
        const formId = form.id || 'default-form';
        
        // ล้าง timer เก่า
        if (this.quickSaveTimers && this.quickSaveTimers[formId]) {
            clearTimeout(this.quickSaveTimers[formId]);
        }
        
        if (!this.quickSaveTimers) {
            this.quickSaveTimers = {};
        }
        
        // ตั้ง timer ใหม่
        this.quickSaveTimers[formId] = setTimeout(() => {
            this.saveForm(form);
        }, 3000); // บันทึกหลังจากไม่มีการเปลี่ยนแปลง 3 วินาที
    }

    /**
     * เก็บข้อมูลจาก form
     * @param {HTMLFormElement} form - form ที่จะเก็บข้อมูล
     * @return {Object} ข้อมูลจาก form
     */
    collectFormData(form) {
        const data = {};
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                data[input.name || input.id] = input.checked;
            } else if (input.type === 'radio') {
                if (input.checked) {
                    data[input.name || input.id] = input.value;
                }
            } else if (input.type !== 'file') {
                data[input.name || input.id] = input.value;
            }
        });
        
        return data;
    }

    /**
     * แสดงตัวบ่งชี้การบันทึก
     * @param {HTMLFormElement} form - form ที่จะแสดงตัวบ่งชี้
     * @param {string} status - สถานะ (success หรือ error)
     */
    showSaveIndicator(form, status) {
        let indicator = form.querySelector('.auto-save-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'auto-save-indicator position-fixed';
            indicator.style.top = '20px';
            indicator.style.right = '20px';
            indicator.style.zIndex = '9999';
            form.appendChild(indicator);
        }
        
        const icon = status === 'success' ? 'check' : 'exclamation-triangle';
        const color = status === 'success' ? 'success' : 'danger';
        const text = status === 'success' ? 'บันทึกแล้ว' : 'บันทึกไม่ได้';
        
        indicator.innerHTML = `
            <div class="alert alert-${color} alert-dismissible fade show" role="alert">
                <i class="fas fa-${icon} me-2"></i>${text}
            </div>
        `;
        
        // ซ่อนหลังจาก 3 วินาที
        setTimeout(() => {
            indicator.innerHTML = '';
        }, 3000);
    }
}

// สร้าง instances หลัก
const formHandler = new FormHandler();
const fileUploadHandler = new FileUploadHandler();
const autoSaveHandler = new AutoSaveHandler();

/**
 * Helper Functions สำหรับใช้งานทั่วไป
 */

/**
 * เริ่มต้น form validation
 * @param {string|HTMLFormElement} formSelector - selector หรือ element ของ form
 * @param {Object} options - ตัวเลือกเพิ่มเติม
 */
function initializeFormValidation(formSelector, options = {}) {
    const form = typeof formSelector === 'string' 
        ? document.querySelector(formSelector) 
        : formSelector;
    
    if (!form) return;
    
    // เปิด real-time validation
    if (options.realTime !== false) {
        formHandler.enableRealTimeValidation(form);
    }
    
    // เปิด auto-save
    if (options.autoSave && options.saveCallback) {
        autoSaveHandler.enable(form, options.saveCallback);
    }
    
    // จัดการ form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const validation = formHandler.validateForm(form);
        
        if (validation.isValid) {
            if (options.onSubmit) {
                await options.onSubmit(form);
            }
        } else {
            // โฟกัสไปที่ field แรกที่มี error
            if (validation.errors.length > 0) {
                validation.errors[0].field.focus();
            }
        }
    });
}

/**
 * เริ่มต้น file upload
 * @param {string|HTMLElement} inputSelector - selector หรือ element ของ input file
 * @param {Object} options - ตัวเลือกเพิ่มเติม
 */
function initializeFileUpload(inputSelector, options = {}) {
    const input = typeof inputSelector === 'string'
        ? document.querySelector(inputSelector)
        : inputSelector;
    
    if (!input) return;
    
    input.addEventListener('change', async function(e) {
        const files = Array.from(e.target.files);
        const container = options.previewContainer 
            ? document.querySelector(options.previewContainer)
            : input.parentNode.querySelector('.file-preview');
        
        for (const file of files) {
            const validation = fileUploadHandler.validateFile(file, options.type);
            
            if (!validation.isValid) {
                Utils.showError('ไฟล์ไม่ถูกต้อง', validation.message);
                continue;
            }
            
            if (container) {
                fileUploadHandler.createPreview(file, container);
            }
            
            if (options.onFileSelect) {
                await options.onFileSelect(file);
            }
        }
    });
}

/**
 * จัดรูปแบบ input fields
 */
function initializeInputFormatters() {
    // ID Card formatting
    document.addEventListener('input', function(e) {
        if (e.target.matches('[data-format="idcard"]')) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 13) value = value.slice(0, 13);
            e.target.value = value;
        }
    });
    
    // Phone number formatting
    document.addEventListener('input', function(e) {
        if (e.target.matches('[data-format="phone"]')) {
            let value = e.target.value.replace(/[^\d-+().\s]/g, '');
            e.target.value = value;
        }
    });
    
    // Number formatting
    document.addEventListener('input', function(e) {
        if (e.target.matches('[data-format="number"]')) {
            let value = e.target.value.replace(/[^\d.]/g, '');
            e.target.value = value;
        }
    });
    
    // Plot code formatting
    document.addEventListener('input', function(e) {
        if (e.target.matches('[data-format="plotcode"]')) {
            let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            e.target.value = value;
        }
    });
}

// เริ่มต้นระบบเมื่อ DOM โหลดเสร็จ
document.addEventListener('DOMContentLoaded', function() {
    initializeInputFormatters();
});

// Export สำหรับใช้งานในหน้าอื่น
window.FormHandler = FormHandler;
window.FileUploadHandler = FileUploadHandler;
window.AutoSaveHandler = AutoSaveHandler;
window.formHandler = formHandler;
window.fileUploadHandler = fileUploadHandler;
window.autoSaveHandler = autoSaveHandler;
window.initializeFormValidation = initializeFormValidation;
window.initializeFileUpload = initializeFileUpload;