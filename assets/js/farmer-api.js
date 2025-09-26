/**
 * Farmer API - ระบบสอบย้อนกลับผักอุดร
 * เชื่อมต่อกับ Google Apps Script
 */

// Helper function to ensure text format (fallback if asText is not available)
const ensureText = (v) => {
    if (typeof asText === 'function') {
        return asText(v);
    }
    // Fallback implementation
    return v == null ? '' : ('\'\'' + String(v));
};

const FarmerAPI = {
    
    /**
     * ดึงสถานะ Dashboard ของเกษตรกร
     */
    async getDashboardState() {
        try {
            const currentUser = Auth.getCurrentUser();
            console.log('getDashboardState - currentUser:', currentUser);
            
            if (!currentUser || (!currentUser.id && !currentUser.userID)) {
                throw new Error('ไม่พบข้อมูลผู้ใช้');
            }
            
            const userID = currentUser.userID || currentUser.id;
            const username = currentUser.username;
            console.log('Using userID:', userID, 'username:', username);

            // เรียก API getFarmerDashboardState จาก backend โดยตรง
            const response = await API.call('getFarmerDashboardState', {
                username: username,
                farmerID: currentUser.farmerID || userID
            });
            
            console.log('Dashboard API response:', response);
            
            if (response && response.success) {
                return response;
            }
            
            // Fallback: ใช้ FarmerID ที่มีอยู่แล้ว
            if (!currentUser.farmerID) {
                return {
                    success: true,
                    part1Complete: false,
                    message: 'ไม่พบข้อมูลเกษตรกร กรุณากรอกข้อมูลเกษตรกรก่อน'
                };
            }
            
            // สร้าง mock response สำหรับเกษตรกรที่มี farmerID แล้ว
            const farmerResponse = {
                success: true,
                farmer: {
                    FarmerID: currentUser.farmerID,
                    FullName: currentUser.fullName || '',
                    PlotNumber: currentUser.plotNumber || '',
                    Username: currentUser.username
                }
            };
            console.log('Farmer data response:', farmerResponse);
            
            if (!farmerResponse || !farmerResponse.success) {
                return {
                    success: true,
                    part1Complete: false,
                    message: 'ไม่พบข้อมูลเกษตรกร กรุณากรอกข้อมูลเกษตรกรก่อน'
                };
            }
            
            const farmer = farmerResponse.farmer || farmerResponse.data;
            
            // ตรวจสอบว่ากรอกข้อมูลส่วนที่ 1 ครบหรือไม่
            const part1Complete = farmer && farmer.FullName && farmer.IDCard && farmer.PlotNumber;
            
            const result = {
                success: true,
                part1Complete: part1Complete,
                farmer: farmer
            };
            
            // ถ้ากรอกส่วนที่ 1 แล้ว ให้ดึงข้อมูลเพิ่มเติม
            if (part1Complete) {
                // สร้าง QR Code สำหรับแปลง
                try {
                    const qrResponse = await this.generateFarmerQRCode();
                    if (qrResponse && qrResponse.success) {
                        result.qrCode = qrResponse.data || qrResponse;
                    }
                } catch (qrError) {
                    console.warn('QR Code generation failed:', qrError);
                }
                
                // ดึงประวัติการผลิตเฉพาะที่จำเป็นสำหรับ dashboard (10 รายการล่าสุด)
                try {
                    const historyResponse = await this.getProductionHistory({ limit: 10 });
                    if (historyResponse && historyResponse.success) {
                        result.productionRecords = historyResponse.records || historyResponse.data || [];
                    } else {
                        result.productionRecords = [];
                    }
                } catch (historyError) {
                    console.warn('Production history fetch failed:', historyError);
                    result.productionRecords = [];
                }
            }
            
            return result;
        } catch (error) {
            console.error('Error getting dashboard state:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลแดชบอร์ด',
                error: error.message
            };
        }
    },

    /**
     * ดึงข้อมูลเกษตรกรจาก username
     */
    async getFarmerDataByUsername(username) {
        try {
            console.log('getFarmerDataByUsername called with username:', username);
            
            // เรียก API เพื่อดึงข้อมูลจาก Google Sheet
            const response = await API.call('getFarmerByUsername', {
                username: ensureText(username)
            });
            
            if (response && response.success && response.data) {
                // มีข้อมูลใน Google Sheet แล้ว
                console.log('Existing farmer data found:', response.data);
                return {
                    success: true,
                    part1Complete: this.checkPart1Complete(response.data),
                    farmer: response.data
                };
            } else {
                // ตรวจสอบใหม่ด้วย getFarmerDashboardState
                console.log('No existing farmer data found, trying getFarmerDashboardState');
                const dashboardResponse = await API.call('getFarmerDashboardState', {
                    username: ensureText(username)
                });
                
                if (dashboardResponse && dashboardResponse.success && dashboardResponse.farmer) {
                    console.log('Found farmer data via dashboard state:', dashboardResponse.farmer);
                    return {
                        success: true,
                        part1Complete: dashboardResponse.part1Complete,
                        farmer: dashboardResponse.farmer
                    };
                }
                
                // ยังไม่มีข้อมูลใน Google Sheet - สร้าง default structure
                console.log('No existing farmer data found, creating default structure');
                return {
                    success: true,
                    part1Complete: false,
                    farmer: {
                        Username: username,
                        FullName: '',
                        IDCard: '',
                        PlotNumber: '',
                        Phone: username, // ใช้ username เป็น default phone
                        Address: '',
                        Area: ''
                    }
                };
            }
        } catch (error) {
            console.error('Error getting farmer data by username:', error);
            // ถ้าเกิด error ให้ return default structure เพื่อไม่ให้ form crash
            return {
                success: true,
                part1Complete: false,
                farmer: {
                    Username: username,
                    FullName: '',
                    IDCard: '',
                    PlotNumber: '',
                    Phone: username,
                    Address: '',
                    Area: ''
                }
            };
        }
    },
    
    /**
     * ตรวจสอบว่าข้อมูลส่วนที่ 1 ครบหรือไม่
     */
    checkPart1Complete(farmer) {
        return farmer && 
               farmer.FullName && farmer.FullName.toString().trim() !== '' &&
               farmer.IDCard && farmer.IDCard.toString().trim() !== '' &&
               farmer.Phone && farmer.Phone.toString().trim() !== '' &&
               farmer.PlotNumber && farmer.PlotNumber.toString().trim() !== '' &&
               farmer.Address && farmer.Address.toString().trim() !== '' &&
               farmer.Area && farmer.Area.toString().trim() !== '';
    },
    
    /**
     * ดึงข้อมูลเกษตรกร
     */
    async getFarmerData(farmerID) {
        try {
            console.log('getFarmerData called with farmerID:', farmerID);
            const response = await API.call('getFarmerData', {
                farmerId: ensureText(farmerID) // ใช้ farmerId ตามระบบเดิม
            });
            
            console.log('getFarmerData response:', response);
            return response;
        } catch (error) {
            console.error('Error getting farmer data:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเกษตรกร',
                error: error.message
            };
        }
    },

    /**
     * อัปเดตข้อมูลเกษตรกร (ส่วนที่ 1)
     */
    async updateFarmerProfile(farmerData) {
        try {
            console.log('updateFarmerProfile called with:', farmerData);
            
            const currentUser = Auth.getCurrentUser();
            if (!currentUser) {
                throw new Error('ไม่พบข้อมูลผู้ใช้');
            }

            console.log('Current user for update:', currentUser);

            // ใช้ FarmerID ที่มีอยู่ใน currentUser แล้ว
            const realFarmerID = currentUser.farmerID;
            if (!realFarmerID) {
                return { success: false, message: 'ไม่พบข้อมูล Farmer ID' };
            }

            const requestData = {
                farmerID: realFarmerID,
                username: (currentUser.username || '').replace(/^'/, ''),
                fullName: farmerData.fullName,
                idCard: farmerData.idCard,
                address: farmerData.address,
                area: farmerData.area,
                phone: farmerData.phone,
                plotNumber: farmerData.plotNumber
            };

            console.log('Sending update request:', requestData);

            const response = await API.call('updateFarmerProfile', requestData);
            
            console.log('Update response:', response);
            return response;
            
        } catch (error) {
            console.error('Error updating farmer profile:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลเกษตรกร: ' + error.message,
                error: error.message
            };
        }
    },

    /**
     * สร้าง QR Code สำหรับเกษตรกร
     */
    async generateFarmerQRCode() {
        try {
            const currentUser = Auth.getCurrentUser();
            
            // ใช้ FarmerID ที่มีอยู่ใน currentUser แล้ว
            const realFarmerID = currentUser.farmerID;
            if (!realFarmerID) {
                return { success: false, message: 'ไม่พบข้อมูล Farmer ID' };
            }
            
            const response = await API.call('generateFarmerQRCode', {
                farmerID: ensureText(realFarmerID)
            });
            
            return response;
        } catch (error) {
            console.error('Error generating QR Code:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการสร้าง QR Code',
                error: error.message
            };
        }
    },

    /**
     * สร้างรอบการผลิตใหม่ (แบบใหม่)
     */
    async createProductionCycle(productionCycleData) {
        try {
            const currentUser = Auth.getCurrentUser();
            console.log('createProductionCycle - Current user:', currentUser);
            console.log('createProductionCycle - Input data:', productionCycleData);
            
            if (!currentUser || !currentUser.farmerID) {
                throw new Error('ไม่พบข้อมูล Farmer ID');
            }
            
            const farmerID = currentUser.farmerID;
            console.log('Using FarmerID:', farmerID);
            
            // เตรียมข้อมูลสำหรับ backend (ไม่ใช้ ensureText)
            // ตรวจสอบข้อมูลที่จำเป็นก่อนส่ง
            const shipDate = productionCycleData.harvest.shipDate || productionCycleData.transport.farmShipDate || '';
            const distributorCode = productionCycleData.transport.distributorCode || '';
            
            console.log('Frontend validation - shipDate:', shipDate);
            console.log('Frontend validation - distributorCode:', distributorCode);
            
            if (!shipDate || !distributorCode) {
                console.error('Missing required data for submission:', {
                    shipDate: shipDate,
                    distributorCode: distributorCode
                });
                throw new Error(`ข้อมูลไม่ครบถ้วน: ${!shipDate ? 'วันที่จัดส่ง' : ''} ${!distributorCode ? 'รหัสผู้กระจายสินค้า' : ''}`);
            }

            // ส่งข้อมูลเป็น flat object เพื่อให้ทำงานกับ URLSearchParams ได้
            const cycleData = {
                farmerID: farmerID,
                // Production data
                cropType: productionCycleData.production.cropType || '',
                cropVariety: productionCycleData.production.cropVariety || '',
                plantingMethod: productionCycleData.production.plantingMethod || '',
                plantingMethodOther: productionCycleData.production.plantingMethodOther || '',
                fertilizer: productionCycleData.production.fertilizer || '',
                pesticide: productionCycleData.production.pesticide || '',
                plantDate: productionCycleData.production.plantDate || '',
                harvestDate: productionCycleData.production.harvestDate || '',
                waterSourceType: productionCycleData.production.waterSourceType || '',
                waterManagement: productionCycleData.production.waterManagement || '',
                recordMethod: productionCycleData.production.recordMethod || 'manual',
                pestControl: productionCycleData.production.pestControl || '',
                // Harvest data
                shipDate: shipDate,
                harvestMethod: productionCycleData.harvest.harvestMethod || '',
                packagingCompany: productionCycleData.harvest.packagingCompany || '',
                packagingLocation: productionCycleData.harvest.packagingLocation || '',
                responsiblePerson: productionCycleData.harvest.responsiblePerson || '',
                quantity: productionCycleData.harvest.quantity || '',
                unit: productionCycleData.harvest.unit || '',
                unitOther: productionCycleData.harvest.unitOther || '',
                // Transport data
                farmShipDate: shipDate,
                transportChannel: productionCycleData.transport.transportChannel || '',
                transportMethod: productionCycleData.transport.transportMethod || '',
                transportMethodOther: productionCycleData.transport.transportMethodOther || '',
                transportCompany: productionCycleData.transport.transportCompany || '',
                distributorCode: distributorCode,
                // Additional info
                comments: productionCycleData.additionalInfo?.comments || ''
            };

            console.log('Sending to backend:', cycleData);

            // สร้าง Production Cycle
            const response = await API.call('createProductionCycle', cycleData);
            console.log('Backend response:', response);
            
            if (response.success && response.data?.productionID && productionCycleData.documents) {
                console.log('Production cycle created, uploading files...');
                
                // อัปโหลดไฟล์แยก
                const productionID = response.data.productionID;
                const uploadResults = await this.uploadProductionFiles(productionID, productionCycleData.documents);
                console.log('File upload results:', uploadResults);
            }
            
            return response;
        } catch (error) {
            console.error('Error creating production cycle:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการสร้างรอบการผลิต: ' + error.message,
                error: error.message
            };
        }
    },

    /**
     * อัปโหลดไฟล์สำหรับรอบการผลิต
     */
    async uploadProductionFiles(productionID, documents) {
        try {
            console.log('Starting file upload for production:', productionID);
            console.log('Documents to upload:', documents);

            if (!documents) {
                console.log('No documents to upload');
                return;
            }

            // อัปโหลดไฟล์แต่ละประเภท
            const fileTypes = [
                { files: documents.plotImages, type: 'รูปแปลงปลูก' },
                { files: documents.productImages, type: 'รูปสินค้า' },
                { files: documents.plantingImages, type: 'รูปกิจกรรมการปลูก' },
                { files: documents.certificationDocs, type: 'เอกสารการรับรอง' },
                { files: documents.plantingMethodImages, type: 'วิธีการปลูก' }
            ];

            for (const fileCategory of fileTypes) {
                if (fileCategory.files && fileCategory.files.length > 0) {
                    console.log(`Uploading ${fileCategory.files.length} files for ${fileCategory.type}`);
                    console.log('=== DEBUG FRONTEND ===');
                    console.log('fileCategory.type:', fileCategory.type);
                    console.log('fileCategory.type length:', fileCategory.type.length);
                    console.log('fileCategory.type JSON:', JSON.stringify(fileCategory.type));
                    console.log('=====================');
                    
                    for (let i = 0; i < fileCategory.files.length; i++) {
                        const file = fileCategory.files[i];
                        console.log(`Uploading file: ${file.name} (${file.type}, ${file.size} bytes)`);
                        
                        try {
                            const uploadResult = await this.uploadDocument(file, fileCategory.type, productionID);
                            
                            if (uploadResult.success) {
                                console.log(`Successfully uploaded: ${file.name}`);
                            } else {
                                console.error(`Failed to upload ${file.name}:`, uploadResult.message);
                            }
                        } catch (uploadError) {
                            console.error(`Error uploading ${file.name}:`, uploadError);
                        }
                    }
                }
            }

            console.log('Completed file upload process');

        } catch (error) {
            console.error('Error in uploadProductionFiles:', error);
        }
    },

    /**
     * ดึงประวัติการผลิตทั้งหมด
     */
    async getProductionHistory(options = {}) {
        try {
            const currentUser = Auth.getCurrentUser();
            console.log('getProductionHistory - currentUser:', currentUser);
            
            // ใช้ FarmerID ที่มีอยู่ใน currentUser แล้ว
            const realFarmerID = currentUser.farmerID;
            console.log('getProductionHistory - using farmerID:', realFarmerID);
            
            if (!realFarmerID) {
                return { success: false, message: 'ไม่พบข้อมูล Farmer ID' };
            }
            
            const response = await API.call('getProductionHistory', {
                farmerID: realFarmerID,  // ไม่ใช้ ensureText เพราะจะเพิ่ม prefix
                limit: options.limit || 50,
                offset: options.offset || 0,
                sortBy: options.sortBy || 'created_desc'
            });
            
            console.log('getProductionHistory response:', response);
            
            return response;
        } catch (error) {
            console.error('Error getting production history:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการดึงประวัติการผลิต',
                error: error.message
            };
        }
    },

    /**
     * ดึงรายละเอียดรอบการผลิต
     */
    async getProductionDetail(productionID) {
        try {
            const currentUser = Auth.getCurrentUser();
            const response = await API.call('getProductionDetail', {
                productionId: ensureText(productionID), // Changed to match Google Apps Script
                farmerID: currentUser?.farmerID || null // Optional ownership verification
            });
            
            return response;
        } catch (error) {
            console.error('Error getting production detail:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการดึงรายละเอียดการผลิต',
                error: error.message
            };
        }
    },

    /**
     * อัปเดตข้อมูลการผลิตทั้งหมด (สำหรับ edit-production.html)
     */
    async updateProductionData(formData) {
        try {
            const currentUser = Auth.getCurrentUser();
            
            // Prepare data for backend API
            const requestData = {
                productionId: ensureText(formData.productionId),
                farmerID: currentUser?.farmerID || null,
                // Production data
                plantDate: formData.plantDate || '',
                cropType: formData.cropType || '',
                cropVariety: formData.cropVariety || '',
                plantingMethod: formData.plantingMethod || '',
                plantingMethodOther: formData.plantingMethodOther || '',
                fertilizer: formData.fertilizer || '',
                pesticide: formData.pesticide || '',
                waterSourceType: formData.waterSourceType || '',
                waterManagement: formData.waterManagement || '',
                pestControl: formData.pestControl || '',
                maintenanceRecord: formData.maintenanceRecord || '',
                // Harvest data
                harvestDate: formData.harvestDate || '',
                harvestQuantity: formData.harvestQuantity || '',
                harvestUnit: formData.harvestUnit || '',
                shipDate: formData.shipDate || '',
                farmShipDate: formData.farmShipDate || '',
                // Transport data
                transportMethod: formData.transportMethod || '',
                transportTemperature: formData.transportTemperature || '',
                transportRoute: formData.transportRoute || '',
                transportCondition: formData.transportCondition || '',
                // Additional data
                additionalStory: formData.additionalStory || '',
                additionalHighlight: formData.additionalHighlight || '',
                additionalOther: formData.additionalOther || ''
            };
            
            const response = await API.call('updateProductionData', requestData);
            return response;
            
        } catch (error) {
            console.error('Error updating production data:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลการผลิต',
                error: error.message
            };
        }
    },

    /**
     * ลบไฟล์ (soft delete)
     */
    async deleteFileRecord(fileId) {
        try {
            const currentUser = Auth.getCurrentUser();
            
            const response = await API.call('deleteFileRecord', {
                fileId: ensureText(fileId),
                farmerID: currentUser?.farmerID || null
            });
            
            return response;
        } catch (error) {
            console.error('Error deleting file record:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการลบไฟล์',
                error: error.message
            };
        }
    },

    /**
     * อัปเดตรอบการผลิต (legacy function - ใช้ updateProductionData แทน)
     */
    async updateProductionCycle(productionID, updateData) {
        try {
            const response = await API.call('updateProductionCycle', {
                productionID: ensureText(productionID),
                updateData: updateData
            });
            
            return response;
        } catch (error) {
            console.error('Error updating production cycle:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการอัปเดตรอบการผลิต',
                error: error.message
            };
        }
    },

    /**
     * ลบรอบการผลิต
     */
    async deleteProductionCycle(productionID) {
        try {
            const response = await API.call('deleteProductionCycle', {
                productionID: ensureText(productionID)
            });
            
            return response;
        } catch (error) {
            console.error('Error deleting production cycle:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการลบรอบการผลิต',
                error: error.message
            };
        }
    },

    /**
     * อัปโหลดเอกสาร
     */
    async uploadDocument(file, documentType, productionID = null) {
        try {
            const currentUser = Auth.getCurrentUser();
            
            // ใช้ FarmerID ที่มีอยู่ใน currentUser แล้ว
            const realFarmerID = currentUser.farmerID;
            if (!realFarmerID) {
                return { success: false, message: 'ไม่พบข้อมูล Farmer ID' };
            }
            
            // Convert file to base64
            const base64 = await this.fileToBase64(file);
            
            const response = await API.call('uploadFarmerDocument', {
                farmerID: ensureText(realFarmerID),
                productionID: productionID ? ensureText(productionID) : null,
                fileType: documentType,
                fileName: file.name, // ไม่ใช้ ensureText กับชื่อไฟล์
                fileContent: base64,
                mimeType: file.type,
                fileSize: file.size
            });
            
            return response;
        } catch (error) {
            console.error('Error uploading document:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการอัปโหลดเอกสาร',
                error: error.message
            };
        }
    },

    /**
     * ดึงเอกสารทั้งหมด
     */
    async getDocuments(productionID = null) {
        try {
            const currentUser = Auth.getCurrentUser();
            
            // ใช้ FarmerID ที่มีอยู่ใน currentUser แล้ว
            const realFarmerID = currentUser.farmerID;
            if (!realFarmerID) {
                return { success: false, message: 'ไม่พบข้อมูล Farmer ID' };
            }
            
            const response = await API.call('getFarmerDocuments', {
                farmerID: ensureText(realFarmerID),
                productionID: productionID ? ensureText(productionID) : null
            });
            
            return response;
        } catch (error) {
            console.error('Error getting documents:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการดึงเอกสาร',
                error: error.message
            };
        }
    },

    /**
     * ลบเอกสาร
     */
    async deleteDocument(documentID) {
        try {
            const response = await API.call('deleteFarmerDocument', {
                documentID: ensureText(documentID)
            });
            
            return response;
        } catch (error) {
            console.error('Error deleting document:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการลบเอกสาร',
                error: error.message
            };
        }
    },

    /**
     * สร้าง Search Code
     */
    async generateSearchCode(productionID, shipDate) {
        try {
            const currentUser = Auth.getCurrentUser();
            
            // ใช้ FarmerID ที่มีอยู่ใน currentUser แล้ว
            const realFarmerID = currentUser.farmerID;
            if (!realFarmerID) {
                return { success: false, message: 'ไม่พบข้อมูล Farmer ID' };
            }
            
            const response = await API.call('generateSearchCode', {
                farmerID: ensureText(realFarmerID),
                productionID: ensureText(productionID),
                shipDate: shipDate
            });
            
            return response;
        } catch (error) {
            console.error('Error generating search code:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการสร้างรหัสค้นหา',
                error: error.message
            };
        }
    },

    /**
     * ดาวน์โหลด QR Sticker PDF
     */
    async downloadQRSticker() {
        try {
            const currentUser = Auth.getCurrentUser();
            
            // ใช้ FarmerID ที่มีอยู่ใน currentUser แล้ว
            const realFarmerID = currentUser.farmerID;
            if (!realFarmerID) {
                return { success: false, message: 'ไม่พบข้อมูล Farmer ID' };
            }
            
            const response = await API.call('generateQRStickerPDF', {
                farmerID: ensureText(realFarmerID),
                qrCode: currentUser.qrCode || `${currentUser.groupCode}-${currentUser.plotNumber}`,
                farmerId: ensureText(realFarmerID)
            });
            
            return response;
        } catch (error) {
            console.error('Error downloading QR sticker:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการสร้างสติ๊กเกอร์ QR',
                error: error.message
            };
        }
    },

    /**
     * ดึงสถิติเกษตรกร
     */
    async getFarmerStatistics() {
        try {
            const currentUser = Auth.getCurrentUser();
            
            // ใช้ FarmerID ที่มีอยู่ใน currentUser แล้ว
            const realFarmerID = currentUser.farmerID;
            if (!realFarmerID) {
                return { success: false, message: 'ไม่พบข้อมูล Farmer ID' };
            }
            
            const response = await API.call('getFarmerStatistics', {
                farmerID: ensureText(realFarmerID)
            });
            
            return response;
        } catch (error) {
            console.error('Error getting farmer statistics:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
                error: error.message
            };
        }
    },

    /**
     * ค้นหาข้อมูลด้วย QR Code
     */
    async searchByQRCode(qrCode) {
        try {
            const response = await API.call('searchByQRCode', {
                qrCode: ensureText(qrCode)
            });
            
            return response;
        } catch (error) {
            console.error('Error searching by QR code:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการค้นหาด้วย QR Code',
                error: error.message
            };
        }
    },

    /**
     * ค้นหาข้อมูลด้วย Search Code
     */
    async searchBySearchCode(searchCode) {
        try {
            const response = await API.call('searchBySearchCode', {
                searchCode: ensureText(searchCode)
            });
            
            return response;
        } catch (error) {
            console.error('Error searching by search code:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการค้นหาด้วยรหัสค้นหา',
                error: error.message
            };
        }
    },

    /**
     * บันทึกข้อมูลส่วนที่ 1 (แปลง/เกษตรกร)
     */
    async savePart1(formData) {
        try {
            const response = await API.call('saveFarmerPart1', formData);
            return response;
        } catch (error) {
            console.error('Error saving part 1:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลส่วนที่ 1',
                error: error.message
            };
        }
    },

    /**
     * สร้างข้อมูลการผลิต (ส่วนที่ 2)
     */
    async createProduction(formData) {
        try {
            const response = await API.call('createProductionData', formData);
            return response;
        } catch (error) {
            console.error('Error creating production:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการสร้างข้อมูลการผลิต',
                error: error.message
            };
        }
    },

    /**
     * สร้างข้อมูลการเก็บเกี่ยว (ส่วนที่ 3)
     */
    async createHarvest(formData) {
        try {
            const response = await API.call('createHarvestData', formData);
            return response;
        } catch (error) {
            console.error('Error creating harvest:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการสร้างข้อมูลการเก็บเกี่ยว',
                error: error.message
            };
        }
    },

    /**
     * สร้างข้อมูลการขนส่ง (ส่วนที่ 4)
     */
    async createTransport(formData) {
        try {
            const response = await API.call('createTransportData', formData);
            return response;
        } catch (error) {
            console.error('Error creating transport:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการสร้างข้อมูลการขนส่ง',
                error: error.message
            };
        }
    },

    /**
     * สร้างข้อมูลเพิ่มเติม (ส่วนที่ 6)
     */
    async createAdditionalInfo(formData) {
        try {
            const response = await API.call('createAdditionalInfo', formData);
            return response;
        } catch (error) {
            console.error('Error creating additional info:', error);
            return { 
                success: false, 
                message: 'เกิดข้อผิดพลาดในการสร้างข้อมูลเพิ่มเติม',
                error: error.message
            };
        }
    },

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
};

// Export to global scope
window.FarmerAPI = FarmerAPI;
