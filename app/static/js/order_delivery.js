/**
 * 销售订单发货页面JavaScript
 * 现代化的商务风格交互体验
 */

/**
 * 订单发货管理类
 */
class OrderDeliveryManager {
    constructor() {
        // 初始化元素引用
        this.form = document.getElementById('order-delivery-form');
        this.detailCountInput = document.getElementById('detail-count');
        this.detailFieldsContainer = document.getElementById('detail-fields');
        this.detailCountBadge = document.getElementById('detail-count-badge');
        this.generateDetailsBtn = document.getElementById('generate-details');
        this.resetBtn = document.getElementById('reset-btn');
        this.previewBtn = document.getElementById('preview-btn');
        this.jsonPreview = document.getElementById('json-preview');
        this.copyJsonBtn = document.getElementById('copy-json');
        this.expandJsonBtn = document.getElementById('expand-json');
        this.deliveryOrderCodeInput = document.getElementById('deliveryOrderCode');
        this.deliveryOrderIdInput = document.getElementById('deliveryOrderId');
        this.outBizCodeInput = document.getElementById('outBizCode');

        // 初始化状态
        this.isJsonExpanded = false;

        // 绑定事件
        this.initEventListeners();

        // 初始生成商品明细
        this.generateDetails();
    }

    /**
     * 初始化事件监听器
     */
    initEventListeners() {
        // 移除生成明细按钮点击事件
        // this.generateDetailsBtn.addEventListener('click', () => this.generateDetails());

        // 添加明细数量输入框变化事件
        this.detailCountInput.addEventListener('input', () => this.generateDetails());

        // 表单提交事件
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // 重置按钮点击事件
        this.resetBtn.addEventListener('click', () => this.resetForm());

        // 预览按钮点击事件
        this.previewBtn.addEventListener('click', () => this.updateJsonPreview());

        // 复制JSON按钮点击事件
        this.copyJsonBtn.addEventListener('click', () => this.copyJson());

        // 展开/收起JSON按钮点击事件
        this.expandJsonBtn.addEventListener('click', () => this.toggleJsonExpand());

        // 发货单号变化事件 - 自动设置deliveryOrderId和outBizCode
        this.deliveryOrderCodeInput.addEventListener('input', () => this.updateAutoFields());

        // 表单字段变化事件 - 实时更新JSON预览
        this.form.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('input', () => this.debounceUpdateJsonPreview());
        });

        // 快速填充按钮事件
        document.querySelectorAll('[data-field][data-value]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const field = e.currentTarget.dataset.field;
                const value = e.currentTarget.dataset.value;
                const logisticsName = e.currentTarget.dataset.logisticsName;
                this.fillField(field, value, logisticsName);
            });
        });
    }

    /**
     * 生成商品明细字段
     */
    generateDetails() {
        const count = parseInt(this.detailCountInput.value) || 1;
        // 确保至少生成1行
        if (isNaN(count) || count < 1) count = 1;
        // 限制最多10行
        if (count > 10) count = 10;
        
        // 更新输入框的值，确保显示的数量与实际生成的一致
        this.detailCountInput.value = count;

        // 定义字段配置
        const fieldsConfig = [
            {
                label: "商品编码",
                idPrefix: "itemCode",
                namePrefix: "itemCode",
                placeholder: "请输入商品编码",
                required: true,
                icon: "fas fa-barcode"
            },
            {
                label: "发货数量",
                idPrefix: "quantity",
                namePrefix: "quantity",
                placeholder: "请输入发货数量",
                required: true,
                type: "number",
                min: 1,
                icon: "fas fa-sort-numeric-up"
            }
        ];

        // 更新明细数量徽章
        this.detailCountBadge.textContent = `${count} 项`;

        // 清空现有明细
        this.detailFieldsContainer.innerHTML = '';

        // 生成新明细
        for (let i = 0; i < count; i++) {
            const detailCard = document.createElement('div');
            detailCard.className = 'card border-0 shadow-sm mb-3 detail-item';
            detailCard.dataset.index = i;

            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header bg-white border-0 d-flex justify-content-between align-items-center';
            cardHeader.innerHTML = `
                <h6 class="card-title mb-0">商品明细 ${i + 1}</h6>
            `;

            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';

            const row = document.createElement('div');
            row.className = 'row g-3';

            // 生成每个字段
            fieldsConfig.forEach(fieldConfig => {
                const col = document.createElement('div');
                col.className = 'col-md-6';

                const label = document.createElement('label');
                label.className = 'form-label';
                label.innerHTML = `
                    <i class="${fieldConfig.icon} me-1"></i>${fieldConfig.label} ${fieldConfig.required ? '<span class="text-danger">*</span>' : ''}
                `;
                label.setAttribute('for', `${fieldConfig.idPrefix}${i}`);

                const inputGroup = document.createElement('div');
                inputGroup.className = 'input-group';

                const inputGroupText = document.createElement('span');
                inputGroupText.className = 'input-group-text';
                inputGroupText.innerHTML = `<i class="${fieldConfig.icon}"></i>`;

                const input = document.createElement('input');
                input.type = fieldConfig.type || 'text';
                input.className = 'form-control';
                input.id = `${fieldConfig.idPrefix}${i}`;
                input.name = `${fieldConfig.namePrefix}${i}`;
                input.placeholder = fieldConfig.placeholder || '';
                input.required = fieldConfig.required || false;

                if (fieldConfig.min !== undefined) {
                    input.min = fieldConfig.min;
                }

                inputGroup.appendChild(inputGroupText);
                inputGroup.appendChild(input);
                col.appendChild(label);
                col.appendChild(inputGroup);
                row.appendChild(col);

                // 添加事件监听器以更新JSON预览
                input.addEventListener('input', () => this.debounceUpdateJsonPreview());
            });

            cardBody.appendChild(row);
            detailCard.appendChild(cardHeader);
            detailCard.appendChild(cardBody);
            this.detailFieldsContainer.appendChild(detailCard);
        }

        // 更新JSON预览
        this.updateJsonPreview();
    }

    /**
     * 更新自动填充字段 (deliveryOrderId 和 outBizCode)
     */
    updateAutoFields() {
        const deliveryOrderCode = this.deliveryOrderCodeInput.value.trim();
        this.deliveryOrderIdInput.value = deliveryOrderCode;
        this.outBizCodeInput.value = deliveryOrderCode;
        this.updateJsonPreview();
    }

    /**
     * 处理表单提交
     */
    async handleSubmit(e) {
        e.preventDefault();

        if (!this.form.checkValidity()) {
            this.form.classList.add('was-validated');
            this.showToast('请填写所有必填字段', 'warning');
            return;
        }

        const submitBtn = this.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        try {
            // 显示加载状态
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>处理中...';

            // 直接获取各个必填字段的值，确保正确获取
            const deliveryOrderCode = document.getElementById('deliveryOrderCode').value;
            const warehouseCode = document.getElementById('warehouseCode').value;
            const logisticsCode = document.getElementById('logisticsCode').value;
            const logisticsName = document.getElementById('logisticsName').value;
            const expressCode = document.getElementById('expressCode').value;

            // 显示获取的字段值
            console.log('直接获取的必填字段值:');
            console.log('- deliveryOrderCode:', deliveryOrderCode);
            console.log('- warehouseCode:', warehouseCode);
            console.log('- logisticsCode:', logisticsCode);
            console.log('- logisticsName:', logisticsName);
            console.log('- expressCode:', expressCode);

            // 构建表单数据
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());
            const detailCount = parseInt(data.detail_count) || 0;

            // 添加日志以检查必填字段
            console.log('表单数据:', data);
            console.log('必填字段检查:');
            console.log('- deliveryOrderCode:', data.deliveryOrderCode);
            console.log('- warehouseCode:', data.warehouseCode);
            console.log('- logisticsCode:', data.logisticsCode);
            console.log('- logisticsName:', data.logisticsName);
            console.log('- expressCode:', data.expressCode);

            // 构建JSON数据
            const jsonData = this.buildJsonData(data, detailCount);
            console.log('构建的JSON数据:', jsonData);

            // 手动设置必填字段，确保它们被包含在JSON数据中
            jsonData.callbackResponse.deliveryOrder.deliveryOrderCode = deliveryOrderCode;
            jsonData.callbackResponse.deliveryOrder.warehouseCode = warehouseCode;
            jsonData.callbackResponse.deliveryOrder.logisticsCode = logisticsCode;
            jsonData.callbackResponse.deliveryOrder.logisticsName = logisticsName;
            jsonData.callbackResponse.deliveryOrder.expressCode = expressCode;

            // 检查必填字段是否都已包含在JSON数据中
            const missingFields = [];
            if (!jsonData.callbackResponse.deliveryOrder.deliveryOrderCode) missingFields.push('deliveryOrderCode');
            if (!jsonData.callbackResponse.deliveryOrder.warehouseCode) missingFields.push('warehouseCode');
            if (!jsonData.callbackResponse.deliveryOrder.logisticsCode) missingFields.push('logisticsCode');
            if (!jsonData.callbackResponse.deliveryOrder.logisticsName) missingFields.push('logisticsName');
            if (!jsonData.callbackResponse.deliveryOrder.expressCode) missingFields.push('expressCode');

            if (missingFields.length > 0) {
                throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
            }

            // 提交表单数据
            const response = await fetch('/order_delivery/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(jsonData)
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showSuccessModal(result.message);
            } else {
                this.showErrorModal(`提交失败: ${result.message}\n\n表单数据: ${JSON.stringify(data)}\n\nJSON数据: ${JSON.stringify(jsonData)}`);
            }

        } catch (error) {
            console.error('提交失败:', error);
            this.showErrorModal(`提交失败: ${error.message}\n\n表单数据: ${JSON.stringify(Object.fromEntries(new FormData(this.form).entries()))}`);
        } finally {
            // 恢复按钮状态
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    /**
     * 构建JSON数据
     */
    buildJsonData(formData, detailCount) {
        // 创建符合预设模板的JSON结构
        const jsonData = {
            "callbackResponse": {
                "apiMethodName": "deliveryorder.confirm",
                "deliveryOrder": {
                    "confirmType": 0,
                    "deliveryOrderCode": formData.deliveryOrderCode || '',
                    "deliveryOrderId": formData.deliveryOrderId || '',
                    "orderConfirmTime": new Date().toISOString().replace('T', ' ').slice(0, 19),
                    "orderType": "JYCK",
                    "outBizCode": formData.outBizCode || '',
                    "status": "DELIVERED",
                    "warehouseCode": formData.warehouseCode || '',
                    // 添加缺失的物流信息字段
                    "logisticsCode": formData.logisticsCode || '',
                    "logisticsName": formData.logisticsName || '',
                    "expressCode": formData.expressCode || ''
                },
                "orderLines": [],
                "packages": [],
                "responseClass": "com.qimen.api.response.DeliveryorderConfirmResponse",
                "version": "2.0"
            },
            "type": 2
        };

        // 添加订单行和包裹信息
        for (let i = 0; i < detailCount; i++) {
            const itemCode = formData[`itemCode${i}`] || '';
            const quantity = formData[`quantity${i}`] || '';

            if (itemCode && quantity) {
                // 添加订单行
                jsonData.callbackResponse.orderLines.push({
                    "actualQty": quantity,
                    "batchCode": "BH36520121703000017",
                    "batchs": [{
                        "actualQty": quantity,
                        "batchCode": "BH36520121703000017",
                        "expireDate": "2022-12-16",
                        "inventoryType": "ZP",
                        "productDate": "2019-12-17"
                    }],
                    "expireDate": "2022-12-16",
                    "inventoryType": "ZP",
                    "itemCode": itemCode,
                    "itemId": itemCode, // 假设itemId与itemCode相同
                    "ownerCode": "0212000695",
                    "planQty": quantity,
                    "productDate": "2019-12-17"
                });

                // 添加包裹信息
                // 如果是第一个明细，创建第一个包裹
                if (jsonData.callbackResponse.packages.length === 0) {
                    jsonData.callbackResponse.packages.push({
                        "expressCode": formData.expressCode || '',
                        "height": "0",
                        "items": [{
                            "itemCode": itemCode,
                            "itemId": itemCode, // 假设itemId与itemCode相同
                            "quantity": parseInt(quantity)
                        }],
                        "length": "0",
                        "logisticsCode": formData.logisticsCode || '',
                        "logisticsName": formData.logisticsName || '',
                        "packageMaterialList": [{
                            "quantity": "1",
                            "type": "BC0011"
                        }],
                        "volume": "0",
                        "weight": "11.32",
                        "width": "0"
                    });
                } else {
                    // 后续明细添加到同一个包裹
                    jsonData.callbackResponse.packages[0].items.push({
                        "itemCode": itemCode,
                        "itemId": itemCode, // 假设itemId与itemCode相同
                        "quantity": parseInt(quantity)
                    });
                }
            }
        }

        return jsonData;
    }

    /**
     * 更新JSON预览
     */
    updateJsonPreview() {
        try {
            // 构建表单数据
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());
            const detailCount = parseInt(data.detail_count) || 0;

            // 构建JSON数据
            const jsonData = this.buildJsonData(data, detailCount);

            // 更新预览
            this.jsonPreview.textContent = JSON.stringify(jsonData, null, 2);

            // 重新高亮代码
            if (window.Prism) {
                Prism.highlightElement(this.jsonPreview);
            }

        } catch (error) {
            this.jsonPreview.textContent = '// 生成预览时出错: ' + error.message;
        }
    }

    /**
     * 重置表单
     */
    resetForm() {
        if (confirm('确定要重置表单吗？')) {
            this.form.reset();
            // 重置明细数量
            this.detailCountInput.value = 1;
            // 重新生成明细
            this.generateDetails();
            // 更新自动填充字段
            this.updateAutoFields();
            this.showToast('表单已重置', 'info');
        }
    }

    /**
     * 复制JSON
     */
    copyJson() {
        const previewText = this.jsonPreview.textContent;
        navigator.clipboard.writeText(previewText).then(() => {
            this.showToast('JSON数据已复制到剪贴板', 'success');
        }).catch(() => {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = previewText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('JSON数据已复制到剪贴板', 'success');
        });
    }

    /**
     * 展开/收起JSON
     */
    toggleJsonExpand() {
        const previewContainer = this.jsonPreview.parentElement;

        if (this.isJsonExpanded) {
            previewContainer.style.maxHeight = '300px';
            previewContainer.style.overflowY = 'auto';
            this.expandJsonBtn.innerHTML = '<i class="fas fa-expand me-1"></i>展开';
        } else {
            previewContainer.style.maxHeight = 'none';
            previewContainer.style.overflowY = 'visible';
            this.expandJsonBtn.innerHTML = '<i class="fas fa-compress me-1"></i>收起';
        }

        this.isJsonExpanded = !this.isJsonExpanded;
    }

    /**
     * 快速填充字段
     */
    fillField(field, value, logisticsName = '') {
        const input = document.getElementById(field);
        if (input) {
            input.value = value;
            // 触发input事件以更新预览
            input.dispatchEvent(new Event('input'));

            // 如果是物流公司编码，同时填充物流公司名称
            if (field === 'logisticsCode' && logisticsName) {
                const logisticsNameInput = document.getElementById('logisticsName');
                if (logisticsNameInput) {
                    logisticsNameInput.value = logisticsName;
                    logisticsNameInput.dispatchEvent(new Event('input'));
                }
            }

            this.showToast(`已填充${input.previousElementSibling.textContent.trim()}`, 'success');
        }
    }

    /**
     * 显示成功模态框
     */
    showSuccessModal(message) {
        const modal = new bootstrap.Modal(document.getElementById('successModal'));
        modal.show();
    }

    /**
     * 显示错误模态框
     */
    showErrorModal(message) {
        const modal = new bootstrap.Modal(document.getElementById('errorModal'));
        document.getElementById('error-message').textContent = message;
        modal.show();
    }

    // 继续完成OrderDeliveryManager类的实现
    
    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
        // 检查是否已有toast容器
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
    
        // 创建toast元素
        const toastId = `toast-${Date.now()}`;
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;
    
        toastContainer.innerHTML = toastHtml;
    
        // 显示toast
        const toast = new bootstrap.Toast(document.getElementById(toastId));
        toast.show();
    
        // 自动关闭
        setTimeout(() => {
            toast.hide();
        }, 3000);
    }
    
    /**
     * 防抖更新JSON预览
     */
    debounceUpdateJsonPreview() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.updateJsonPreview();
        }, 300);
    }
    }
    
    // 页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', () => {
        new OrderDeliveryManager();
    });