/**
 * 调拨入库管理前端脚本
 * 负责处理调拨入库页面的交互逻辑
 */
class AllocationInManager {
    constructor() {
        // 初始化表单元素
        this.form = document.getElementById('allocation-form');
        this.entryOrderCode = document.getElementById('entryOrderCode');
        this.warehouseCode = document.getElementById('warehouseCode');
        this.detailCount = document.getElementById('detail-count');
        this.detailContainer = document.getElementById('detail-fields');
        this.jsonPreview = document.getElementById('json-preview');
        
        // 按钮元素
        this.submitBtn = document.getElementById('submitBtn');
        this.previewBtn = document.getElementById('preview-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.copyJsonBtn = document.getElementById('copy-json');
        this.expandJsonBtn = document.getElementById('expand-json');
        
        // 模态框元素
        this.successMessage = document.getElementById('successMessage');
        this.errorMessage = document.getElementById('error-message');
        
        // 使用Bootstrap的Modal类初始化模态框
        this.successModal = new bootstrap.Modal(document.getElementById('successModal'));
        this.errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        
        // 状态变量
        this.isJsonExpanded = false;
        // 存储当前生成的JSON数据对象
        this.currentJsonData = null;
    }
    
    /**
     * 初始化函数
     */
    init() {
        // 绑定事件
        this.bindEvents();
        // 初始化生成1个商品明细
        this.generateDetails(1);
        // 初始化JSON预览
        this.updateJsonPreview();
        // 设置自动保存
        this.setupAutoSave();
    }
    
    /**
     * 绑定事件处理函数
     */
    bindEvents() {
        // 表单提交事件
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
        
        // 预览JSON按钮事件
        this.previewBtn.addEventListener('click', () => {
            this.updateJsonPreview();
            this.showToast('JSON预览已更新', 'info');
        });
        
        // 重置按钮事件
        this.resetBtn.addEventListener('click', () => {
            this.resetForm();
        });
        
        // 复制JSON按钮事件
        this.copyJsonBtn.addEventListener('click', () => {
            this.copyJson();
        });
        
        // 展开/折叠JSON按钮事件
        this.expandJsonBtn.addEventListener('click', () => {
            this.toggleJsonExpansion();
        });
        
        // 明细数量变化事件
        this.detailCount.addEventListener('change', () => {
            const count = parseInt(this.detailCount.value);
            if (count >= 1 && count <= 20) {
                this.generateDetails(count);
            } else {
                this.showToast('明细数量需在1-20之间', 'warning');
                this.detailCountInput.value = 1;
                this.generateDetails(1);
            }
        });
        
        // 表单输入变化时更新JSON预览
        const inputs = this.form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.updateJsonPreview();
            });
        });
        
        // 模态框关闭事件
        document.getElementById('successModal').addEventListener('hidden.bs.modal', () => {
            // 可以在这里添加模态框关闭后的操作
        });
        
        document.getElementById('errorModal').addEventListener('hidden.bs.modal', () => {
            // 可以在这里添加模态框关闭后的操作
        });
        
        // 明细增减按钮事件（使用事件委托）
        this.detailContainer.addEventListener('click', (e) => {
            // 添加明细
            if (e.target.closest('.add-detail-btn')) {
                const btn = e.target.closest('.add-detail-btn');
                const index = parseInt(btn.dataset.index);
                this.addDetailAtIndex(index + 1);
            }
            // 移除明细
            else if (e.target.closest('.remove-detail-btn')) {
                const btn = e.target.closest('.remove-detail-btn');
                const index = parseInt(btn.dataset.index);
                this.removeDetailAtIndex(index);
            }
        });
    }
    
    /**
     * 在指定位置添加明细
     * @param {number} index - 要添加明细的位置索引
     */
    addDetailAtIndex(index) {
        const currentCards = this.detailContainer.querySelectorAll('.detail-card');
        
        // 检查是否超过最大限制
        if (currentCards.length >= 20) {
            this.showToast('明细数量不能超过20个', 'warning');
            return;
        }
        
        // 获取当前明细数量
        const currentCount = currentCards.length;
        
        // 重新生成所有明细，确保索引正确
        this.generateDetails(currentCount + 1);
        
        // 滚动到添加的位置
        setTimeout(() => {
            const newCard = this.detailContainer.querySelectorAll('.detail-card')[index];
            if (newCard) {
                newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
        
        this.showToast('明细已添加', 'success');
    }
    
    /**
     * 移除指定位置的明细
     * @param {number} index - 要移除明细的位置索引
     */
    removeDetailAtIndex(index) {
        const currentCards = this.detailContainer.querySelectorAll('.detail-card');
        
        // 检查是否只有一个明细，不能移除
        if (currentCards.length <= 1) {
            this.showToast('至少保留一个明细', 'warning');
            return;
        }
        
        // 获取当前明细数量
        const currentCount = currentCards.length;
        
        // 重新生成所有明细，确保索引正确
        this.generateDetails(currentCount - 1);
        
        this.showToast('明细已移除', 'success');
    }
    
    /**
     * 生成商品明细
     * @param {number} count - 明细数量
     */
    generateDetails(count) {
        this.detailContainer.innerHTML = '';
        
        for (let i = 0; i < count; i++) {
            const detailCard = this.createDetailCard(i);
            this.detailContainer.appendChild(detailCard);
        }
        
        this.updateJsonPreview();
    }
    
    /**
     * 创建明细卡片
     * @param {number} index - 明细索引
     * @returns {HTMLElement} - 明细卡片DOM元素
     */
    createDetailCard(index) {
        const card = document.createElement('div');
        card.className = 'detail-card bg-white rounded-lg shadow-sm p-3 mb-3 border border-gray-100';
        
        card.innerHTML = `
            <div class="d-flex justify-content-between items-center mb-2">
                <h6 class="text-sm font-medium text-gray-700">商品明细 ${index + 1}</h6>
                <div class="btn-group" role="group">
                    <button type="button" class="btn btn-sm btn-outline-success add-detail-btn" data-index="${index}">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-detail-btn" data-index="${index}">
                        <i class="fas fa-minus"></i>
                    </button>
                </div>
            </div>
            <div class="row g-3">
                <div class="col-md-6">
                    <label for="itemCode_${index}" class="form-label">SKU编码</label>
                    <input type="text" id="itemCode_${index}" name="itemCode_${index}" class="form-control form-control-sm" placeholder="请输入SKU编码">
                </div>
                <div class="col-md-6">
                    <label for="actualQty_${index}" class="form-label">实际数量</label>
                    <input type="number" id="actualQty_${index}" name="actualQty_${index}" class="form-control form-control-sm" placeholder="请输入实际数量" min="0">
                </div>
            </div>
        `;
        
        return card;
    }
    
    /**
     * 表单验证
     * @returns {boolean} - 验证是否通过
     */
    validateForm() {
        // 必填字段验证
        if (!this.entryOrderCode.value.trim()) {
            this.showToast('请输入调拨入库单号', 'error');
            this.entryOrderCode.focus();
            return false;
        }
        
        if (!this.warehouseCode.value.trim()) {
            this.showToast('请输入仓库编码', 'error');
            this.warehouseCode.focus();
            return false;
        }
        
        // 验证明细
        const detailCount = parseInt(this.detailCount.value);
        for (let i = 0; i < detailCount; i++) {
            const itemCodeInput = document.querySelector(`input[name="itemCode_${i}"]`);
            const actualQtyInput = document.querySelector(`input[name="actualQty_${i}"]`);
            
            if (!itemCodeInput || !actualQtyInput) {
                this.showToast('明细数据异常，请重新生成明细', 'error');
                return false;
            }
            
            if (!itemCodeInput.value.trim()) {
                this.showToast(`请输入商品 ${i + 1} 的SKU编码`, 'error');
                itemCodeInput.focus();
                return false;
            }
            
            const actualQty = parseInt(actualQtyInput.value);
            if (!actualQty || actualQty <= 0) {
                this.showToast(`请输入商品 ${i + 1} 的有效数量`, 'error');
                actualQtyInput.focus();
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 生成JSON数据
     * @returns {Object|null} - 生成的JSON数据对象，如果生成失败则返回null
     */
    generateJsonData() {
        try {
            // 获取用户输入的表单数据
            const entryOrderCode = this.entryOrderCode.value.trim();
            const warehouseCode = this.warehouseCode.value.trim();
            const currentDate = new Date();
            const formattedDateTime = formatDateTime(currentDate);
            
            // 构建基础数据结构 - 后端预设参数
            const orderData = {
                "callbackResponse": {
                    "apiMethodName": "entryorder.confirm",
                    "entryOrder": {
                        "confirmType": 0,
                        "entryOrderCode": "",
                        "entryOrderId": "",
                        "entryOrderType": "DBRK",
                        "operateTime": "2021-03-27 18:01:15",
                        "outBizCode": "",
                        "ownerCode": "XIER",
                        "remark": "",
                        "status": "PARTFULFILLED",
                        "warehouseCode": ""
                    },
                    "orderLines": [
                        {
                            "actualQty": "",
                            "inventoryType": "ZP",
                            "itemCode": "",
                            "orderLineNo": "",
                            "ownerCode": "XIER"
                        }
                    ],
                    "responseClass": "com.qimen.api.response.EntryorderConfirmResponse",
                    "version": "2.0"
                },
                "type": 2
            };
            
            // 使用前端输入覆盖预设参数
            orderData.callbackResponse.entryOrder.entryOrderCode = entryOrderCode;
            orderData.callbackResponse.entryOrder.entryOrderId = entryOrderCode; // 映射到entryOrderId
            orderData.callbackResponse.entryOrder.outBizCode = entryOrderCode; // 映射到outBizCode
            orderData.callbackResponse.entryOrder.warehouseCode = warehouseCode;
            orderData.callbackResponse.entryOrder.operateTime = formattedDateTime;
            
            // 清空预设的orderLines
            orderData.callbackResponse.orderLines = [];
            
            // 获取所有商品明细卡片
            const detailCards = this.detailContainer.querySelectorAll('.detail-card');
            
            // 遍历所有商品明细卡片
            detailCards.forEach((card, index) => {
                // 在当前卡片内查找itemCode和actualQty输入框
                const itemCodeInput = card.querySelector(`input[name="itemCode_${index}"]`);
                const actualQtyInput = card.querySelector(`input[name="actualQty_${index}"]`);
                
                // 确保输入框存在并且有值
                if (itemCodeInput && actualQtyInput) {
                    const itemCode = itemCodeInput.value.trim() || "";
                    const actualQty = actualQtyInput.value.trim() || "";
                    
                    // 添加明细到orderLines数组
                    orderData.callbackResponse.orderLines.push({
                        actualQty: actualQty,
                        inventoryType: "ZP",
                        itemCode: itemCode,
                        orderLineNo: String(index + 1),
                        ownerCode: "XIER"
                    });
                }
            });
            
            return orderData;
        } catch (error) {
            console.error('生成JSON数据失败:', error);
            return null;
        }
    }
    
    /**
     * 更新JSON预览
     */
    updateJsonPreview() {
        try {
            // 生成JSON数据并保存到实例变量
            this.currentJsonData = this.generateJsonData();
            
            if (this.currentJsonData) {
                // 生成JSON字符串
                const jsonString = JSON.stringify(this.currentJsonData, null, 2);
                
                // 更新预览区域
                this.jsonPreview.textContent = jsonString;
                
                // 高亮显示JSON
                this.highlightJson();
            } else {
                this.jsonPreview.textContent = '// 请填写表单数据以预览JSON';
            }
        } catch (error) {
            console.error('更新JSON预览失败:', error);
            this.jsonPreview.textContent = '更新JSON预览失败: ' + error.message;
        }
    }
    
    /**
     * 高亮显示JSON
     */
    highlightJson() {
        // 简单的JSON高亮实现
        const text = this.jsonPreview.textContent;
        const highlighted = text
            .replace(/"(.*?)"/g, '<span style="color: #a5d6ff;">$&</span>') // 字符串
            .replace(/\b(true|false|null)\b/g, '<span style="color: #ffa726;">$&</span>') // 布尔值和null
            .replace(/\b\d+\b/g, '<span style="color: #ffd54f;">$&</span>'); // 数字
        
        this.jsonPreview.innerHTML = highlighted;
    }
    
    /**
     * 复制JSON到剪贴板
     */
    copyJson() {
        try {
            // 确保先更新JSON数据
            if (!this.currentJsonData) {
                this.updateJsonPreview();
            }
            
            if (this.currentJsonData) {
                const jsonText = JSON.stringify(this.currentJsonData, null, 2);
                
                // 先检查navigator.clipboard是否可用
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(jsonText).then(() => {
                        this.showToast('JSON已复制到剪贴板', 'success');
                    }).catch(() => {
                        this.fallbackCopy(jsonText);
                    });
                } else {
                    this.fallbackCopy(jsonText);
                }
            } else {
                this.showToast('无可用JSON数据', 'error');
            }
        } catch (error) {
            console.error('复制JSON失败:', error);
            this.showToast('复制失败，请手动复制', 'error');
        }
    }
    
    /**
     * 回退复制方法 - 当Clipboard API不可用时使用
     * @param {string} text - 要复制的文本
     */
    fallbackCopy(text) {
        try {
            // 创建临时文本区域
            const textArea = document.createElement('textarea');
            textArea.value = text;
            
            // 确保元素不可见但可以选中
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            textArea.style.opacity = '0';
            
            // 添加到文档
            document.body.appendChild(textArea);
            
            // 选中并复制
            textArea.focus();
            textArea.select();
            
            // 执行复制命令
            const successful = document.execCommand('copy');
            
            // 清理
            document.body.removeChild(textArea);
            
            if (successful) {
                this.showToast('JSON已复制到剪贴板', 'success');
            } else {
                this.showToast('复制失败，请手动复制', 'error');
            }
        } catch (error) {
            console.error('回退复制方法失败:', error);
            this.showToast('复制失败，请手动复制', 'error');
        }
    }
    
    /**
     * 处理表单提交
     */
    handleSubmit() {
        // 表单验证
        if (!this.validateForm()) {
            return;
        }
        
        // 生成JSON数据
        this.currentJsonData = this.generateJsonData();
        
        if (!this.currentJsonData) {
            this.showToast('生成JSON数据失败，请检查输入', 'error');
            return;
        }
        
        this.showLoading(true);
        
        // 提交数据到后端
        fetch('/allocation_in/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(this.currentJsonData),
        })
        .then(response => response.json())
        .then(data => {
            this.showLoading(false);
            
            if (data.success) {
                this.showSuccessModal(data.message);
                this.saveToHistory();
            } else {
                this.showErrorModal(data.message);
            }
        })
        .catch(error => {
            this.showLoading(false);
            this.showErrorModal('提交失败，请检查网络连接');
            console.error('提交错误:', error);
        });
    }
    
    /**
     * 切换JSON展开/折叠状态
     */
    toggleJsonExpansion() {
        this.isJsonExpanded = !this.isJsonExpanded;
        
        if (this.isJsonExpanded) {
            this.jsonPreview.style.maxHeight = '800px';
            this.expandJsonBtn.innerHTML = '<i class="fa fa-compress"></i> 折叠';
        } else {
            this.jsonPreview.style.maxHeight = '400px';
            this.expandJsonBtn.innerHTML = '<i class="fa fa-expand"></i> 展开';
        }
    }
    
    /**
     * 重置表单
     */
    resetForm() {
        this.form.reset();
        this.generateDetails(1);
        this.updateJsonPreview();
        this.showToast('表单已重置', 'info');
    }
    
    /**
     * 显示成功模态框
     * @param {string} message - 成功消息
     */
    showSuccessModal(message) {
        this.successMessage.textContent = message;
        // 使用Bootstrap的Modal类显示模态框
        this.successModal.show();
    }
    
    /**
     * 显示错误模态框
     * @param {string} message - 错误消息
     */
    showErrorModal(message) {
        this.errorMessage.textContent = message;
        // 使用Bootstrap的Modal类显示模态框
        this.errorModal.show();
    }
    
    /**
     * 显示加载状态
     * @param {boolean} show - 是否显示加载状态
     */
    showLoading(show) {
        if (show) {
            // 禁用提交按钮
            this.submitBtn.disabled = true;
            this.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
        } else {
            // 启用提交按钮
            this.submitBtn.disabled = false;
            this.submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>生成并推送调拨入库数据';
        }
    }
    
    /**
     * 显示提示消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型：success, error, warning, info
     */
    showToast(message, type = 'info') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `toast position-fixed top-4 right-4 z-50 p-3 rounded-lg shadow-lg transition-opacity duration-300 opacity-0`;
        
        // 根据类型设置不同的背景色
        const bgColors = {
            success: 'bg-success text-white',
            error: 'bg-danger text-white',
            warning: 'bg-warning text-dark',
            info: 'bg-info text-white'
        };
        
        // 根据类型设置不同的图标
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        toast.classList.add(...bgColors[type].split(' '));
        
        // 设置toast内容
        toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas ${icons[type]} mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        // 添加到文档
        document.body.appendChild(toast);
        
        // 显示toast
        setTimeout(() => {
            toast.style.opacity = '1';
        }, 10);
        
        // 3秒后隐藏toast
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
    
    /**
     * 设置自动保存
     */
    setupAutoSave() {
        // 添加表单输入变化事件监听
        const inputs = this.form.querySelectorAll('input, select, textarea');
        let autoSaveTimer;
        
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                // 清除之前的定时器
                clearTimeout(autoSaveTimer);
                
                // 设置新的定时器，延迟2秒保存
                autoSaveTimer = setTimeout(() => {
                    this.saveFormData();
                }, 2000);
            });
        });
        
        // 页面关闭前保存
        window.addEventListener('beforeunload', () => {
            this.saveFormData();
        });
    }
    
    /**
     * 保存表单数据到localStorage
     */
    saveFormData() {
        try {
            const formData = {
                entryOrderCode: this.entryOrderCode.value.trim(),
                warehouseCode: this.warehouseCode.value.trim(),
                detailCount: parseInt(this.detailCount.value),
                details: []
            };
            
            // 保存明细数据
            const detailCount = parseInt(this.detailCount.value);
            for (let i = 0; i < detailCount; i++) {
                const itemCodeInput = document.querySelector(`input[name="itemCode_${i}"]`);
                const actualQtyInput = document.querySelector(`input[name="actualQty_${i}"]`);
                
                if (itemCodeInput && actualQtyInput) {
                    formData.details.push({
                        itemCode: itemCodeInput.value.trim(),
                        actualQty: actualQtyInput.value.trim()
                    });
                }
            }
            
            localStorage.setItem('allocationInFormData', JSON.stringify(formData));
        } catch (error) {
            console.error('保存表单数据失败:', error);
        }
    }
    
    /**
     * 从localStorage恢复表单数据
     */
    restoreFormData() {
        try {
            const savedData = localStorage.getItem('allocationInFormData');
            if (savedData) {
                const formData = JSON.parse(savedData);
                
                // 恢复基础数据
                if (formData.entryOrderCode) {
                    this.entryOrderCode.value = formData.entryOrderCode;
                }
                if (formData.warehouseCode) {
                    this.warehouseCode.value = formData.warehouseCode;
                }
                
                // 恢复明细数据
                if (formData.details && formData.details.length > 0) {
                    this.detailCount.value = formData.details.length;
                    this.generateDetails(formData.details.length);
                    
                    formData.details.forEach((detail, index) => {
                        const itemCodeInput = document.querySelector(`input[name="itemCode_${index}"]`);
                        const actualQtyInput = document.querySelector(`input[name="actualQty_${index}"]`);
                        
                        if (itemCodeInput && detail.itemCode) {
                            itemCodeInput.value = detail.itemCode;
                        }
                        if (actualQtyInput && detail.actualQty) {
                            actualQtyInput.value = detail.actualQty;
                        }
                    });
                }
                
                // 更新JSON预览
                this.updateJsonPreview();
            }
        } catch (error) {
            console.error('恢复表单数据失败:', error);
        }
    }
    
    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} delay - 延迟时间（毫秒）
     * @returns {Function} - 防抖处理后的函数
     */
    debounce(func, delay) {
        let timeoutId;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        };
    }
    
    /**
     * 保存到历史记录
     */
    saveToHistory() {
        try {
            const historyKey = 'allocationInHistory';
            let history = JSON.parse(localStorage.getItem(historyKey) || '[]');
            
            const record = {
                timestamp: new Date().toISOString(),
                entryOrderCode: this.entryOrderCode.value.trim(),
                warehouseCode: this.warehouseCode.value.trim(),
                detailCount: this.detailContainer.querySelectorAll('.detail-card').length
            };
            
            history.unshift(record);
            
            // 只保留最近10条记录
            if (history.length > 10) {
                history = history.slice(0, 10);
            }
            
            localStorage.setItem(historyKey, JSON.stringify(history));
        } catch (error) {
            console.error('保存历史记录失败:', error);
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    const manager = new AllocationInManager();
    manager.init();
});

/**
 * 全局工具函数：格式化日期时间
 * @param {Date} date - 日期对象
 * @returns {string} - 格式化后的日期时间字符串
 */
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 全局工具函数：显示通知消息
 * @param {string} type - 消息类型：success, error, warning, info
 * @param {string} message - 消息内容
 */
function showNotification(type, message) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = `toast position-fixed top-4 right-4 z-50 p-3 rounded-lg shadow-lg transition-opacity duration-300 opacity-0`;
    
    // 根据类型设置不同的背景色
    const bgColors = {
        success: 'bg-success text-white',
        error: 'bg-danger text-white',
        warning: 'bg-warning text-dark',
        info: 'bg-info text-white'
    };
    
    // 根据类型设置不同的图标
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.classList.add(...bgColors[type].split(' '));
    
    // 设置toast内容
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas ${icons[type]} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    // 添加到文档
    document.body.appendChild(toast);
    
    // 显示toast
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
    
    // 3秒后隐藏toast
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}