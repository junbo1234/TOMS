/**
 * 订单下载页面JavaScript
 * 现代化的商务风格交互体验
 */

class OrderDownloadManager {
    constructor() {
        this.form = document.getElementById('download-form');
        this.detailCountInput = document.getElementById('detail-count');
        this.detailFieldsContainer = document.getElementById('detail-fields');
        this.jsonPreview = document.getElementById('json-preview');
        this.detailCountBadge = document.getElementById('detail-count-badge');
        
        this.preset = window.preset || {};
        this.init();
    }

    init() {
        this.bindEvents();
        this.generateDetails();
        this.updateJsonPreview();
        this.setupAutoSave();
    }

    bindEvents() {
        // 表单提交
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // 明细数量变化
        this.detailCountInput.addEventListener('change', () => {
            this.generateDetails();
            this.updateJsonPreview();
        });

        // 生成明细按钮
        document.getElementById('generate-details')?.addEventListener('click', () => {
            this.generateDetails();
            this.updateJsonPreview();
            this.showToast('明细已重新生成', 'success');
        });

        // 预览按钮
        document.getElementById('preview-btn')?.addEventListener('click', () => {
            this.updateJsonPreview();
            this.showToast('数据预览已更新', 'info');
        });

        // 重置按钮
        document.getElementById('reset-btn')?.addEventListener('click', () => {
            this.resetForm();
        });

        // 复制JSON
        document.getElementById('copy-json')?.addEventListener('click', () => {
            this.copyJson();
        });

        // 展开JSON
        document.getElementById('expand-json')?.addEventListener('click', () => {
            this.toggleJsonExpansion();
        });

        // 实时更新JSON预览
        this.form.addEventListener('input', () => {
            this.debounce(() => this.updateJsonPreview(), 500);
        });
    }

    generateDetails() {
        const count = parseInt(this.detailCountInput.value) || 1;
        const fields = JSON.parse(this.detailCountInput.dataset.fields || '[]');
        
        console.log('生成明细:', { count, fields }); // 调试信息
        
        this.detailFieldsContainer.innerHTML = '';
        this.detailCountBadge.textContent = `${count} 项`;

        for (let i = 0; i < count; i++) {
            const detailCard = this.createDetailCard(i, fields);
            this.detailFieldsContainer.appendChild(detailCard);
        }
        
        console.log('明细生成完成，当前明细数量:', this.detailFieldsContainer.children.length); // 调试信息
    }

    createDetailCard(index, fields) {
        const card = document.createElement('div');
        card.className = 'detail-group mb-3';
        card.dataset.index = index;

        const cardHeader = document.createElement('div');
        cardHeader.className = 'd-flex justify-content-between align-items-center mb-3';
        cardHeader.innerHTML = `
            <h6 class="mb-0 text-primary">
                <i class="fas fa-box me-2"></i>商品明细 ${index + 1}
            </h6>
            <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="orderManager.copyDetail(${index})">
                    <i class="fas fa-copy"></i>
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm" onclick="orderManager.removeDetail(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        card.appendChild(cardHeader);

        const row = document.createElement('div');
        row.className = 'row g-3';

        fields.forEach(field => {
            const col = document.createElement('div');
            col.className = 'col-md-3'; // 4个字段，每个占3列
            
            let fieldHtml = '';
            
            if (field.type === 'select') {
                // 构建select元素
                let optionsHtml = '';
                if (field.options && Array.isArray(field.options)) {
                    field.options.forEach(option => {
                        optionsHtml += `<option value="${option.value}">${option.text}</option>`;
                    });
                }
                
                fieldHtml = `
                    <label class="form-label">
                        ${field.label} ${field.required ? '<span class="text-danger">*</span>' : ''}
                    </label>
                    <div class="input-group">
                        <span class="input-group-text">
                            <i class="${field.icon || 'fas fa-edit'}"></i>
                        </span>
                        <select class="form-control" 
                                id="${field.idPrefix}${index}" 
                                name="${field.namePrefix}${index}" 
                                ${field.required ? 'required' : ''}>
                            ${optionsHtml}
                        </select>
                    </div>
                `;
            } else {
                // 构建普通input元素
                fieldHtml = `
                    <label class="form-label">
                        ${field.label} ${field.required ? '<span class="text-danger">*</span>' : ''}
                    </label>
                    <div class="input-group">
                        <span class="input-group-text">
                            <i class="${field.icon || 'fas fa-edit'}"></i>
                        </span>
                        <input type="${field.type || 'text'}" 
                               class="form-control" 
                               id="${field.idPrefix}${index}" 
                               name="${field.namePrefix}${index}" 
                               placeholder="${field.placeholder || ''}" 
                               ${field.required ? 'required' : ''}
                               ${field.min ? `min="${field.min}"` : ''}
                               ${field.max ? `max="${field.max}"` : ''}>
                    </div>
                `;
            }
            
            col.innerHTML = fieldHtml;
            row.appendChild(col);
        });

        card.appendChild(row);
        return card;
    }

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
            submitBtn.innerHTML = '<span class="loading me-2"></span>处理中...';

            // 手动构建表单数据，确保包含所有动态生成的输入框
            const formData = new FormData();
            
            // 添加基础字段
            const basicInputs = this.form.querySelectorAll('input[name], textarea[name]');
            basicInputs.forEach(input => {
                if (input.name && input.name !== 'detail_count') {
                    formData.append(input.name, input.value);
                }
            });
            
            // 添加明细数量
            formData.append('detail_count', this.detailCountInput.value);
            
            // 手动添加明细字段
            const detailCount = parseInt(this.detailCountInput.value) || 1;
            for (let i = 0; i < detailCount; i++) {
                const platformOuterSkuCodeInput = document.getElementById(`platformOuterSkuCode${i}`);
                const platformNoInput = document.getElementById(`platformNo${i}`);
                const qtyInput = document.getElementById(`qty${i}`);
                const isGiftInput = document.getElementById(`isGift${i}`);
                
                if (platformOuterSkuCodeInput) formData.set(`platformOuterSkuCode${i}`, platformOuterSkuCodeInput.value);
                if (platformNoInput) formData.set(`platformNo${i}`, platformNoInput.value);
                if (qtyInput) formData.set(`qty${i}`, qtyInput.value);
                if (isGiftInput) {
                    const isGiftValue = isGiftInput.value === '1' ? 1 : 0;
                    formData.set(`isGift${i}`, isGiftValue.toString());
                }
            }

            const response = await fetch('/order_download/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(formData)
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showSuccessModal(result.message);
                this.saveToHistory(Object.fromEntries(formData.entries()));
            } else {
                this.showErrorModal(result.message);
            }

        } catch (error) {
            console.error('提交失败:', error);
            this.showErrorModal('网络错误，请稍后重试');
        } finally {
            // 恢复按钮状态
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    updateJsonPreview() {
        try {
            // 手动构建表单数据，确保包含所有动态生成的输入框
            const formData = new FormData();
            
            // 添加基础字段
            const basicInputs = this.form.querySelectorAll('input[name], textarea[name]');
            basicInputs.forEach(input => {
                if (input.name && input.name !== 'detail_count') {
                    formData.append(input.name, input.value);
                }
            });
            
            // 添加明细数量
            formData.append('detail_count', this.detailCountInput.value);
            
            // 手动添加明细字段
            const detailCount = parseInt(this.detailCountInput.value) || 1;
            for (let i = 0; i < detailCount; i++) {
                const platformOuterSkuCodeInput = document.getElementById(`platformOuterSkuCode${i}`);
                const platformNoInput = document.getElementById(`platformNo${i}`);
                const qtyInput = document.getElementById(`qty${i}`);
                const isGiftInput = document.getElementById(`isGift${i}`);
                
                if (platformOuterSkuCodeInput) formData.set(`platformOuterSkuCode${i}`, platformOuterSkuCodeInput.value);
                if (platformNoInput) formData.set(`platformNo${i}`, platformNoInput.value);
                if (qtyInput) formData.set(`qty${i}`, qtyInput.value);
                if (isGiftInput) {
                    const isGiftValue = isGiftInput.value === '1' ? 1 : 0;
                    formData.set(`isGift${i}`, isGiftValue.toString());
                }
            }
            
            const data = Object.fromEntries(formData.entries());
            
            console.log('表单数据:', data); // 调试信息
            
            // 构建完整的订单数据
            const orderData = {
                ...this.preset,
                address: data.address,
                platformOrderNo: data.platformOrderNo,
                storeId: data.storeId,
                platformPayTime: data.platformPayTime,
                salesOrderDetailConvertDTOList: []
            };

            // 添加明细数据
            console.log('明细数量:', detailCount); // 调试信息
            
            for (let i = 0; i < detailCount; i++) {
                const platformOuterSkuCode = data[`platformOuterSkuCode${i}`] || '';
                const platformNo = data[`platformNo${i}`] || '';
                const qty = data[`qty${i}`] || '';
                
                console.log(`明细 ${i+1}:`, { platformOuterSkuCode, platformNo, qty }); // 调试信息
                
                const detail = {
                    ...this.preset.salesOrderDetailConvertDTOList[0],
                    platformOuterSkuCode: platformOuterSkuCode,
                    platformNo: platformNo,
                    qty: qty,
                    isGift: parseInt(data[`isGift${i}`]) || 0
                };
                // 删除 sku 字段
                delete detail.sku;
                orderData.salesOrderDetailConvertDTOList.push(detail);
            }

            console.log('最终JSON明细数量:', orderData.salesOrderDetailConvertDTOList.length); // 调试信息

            // 更新扩展字段
            orderData.salesOrderExtConvertDTO = {
                ...this.preset.salesOrderExtConvertDTO,
                platformPayTime: data.platformPayTime
            };

            this.jsonPreview.textContent = JSON.stringify(orderData, null, 2);
            
            // 重新高亮代码
            if (window.Prism) {
                Prism.highlightElement(this.jsonPreview);
            }

        } catch (error) {
            console.error('JSON预览更新失败:', error);
            this.jsonPreview.textContent = '// JSON预览生成失败';
        }
    }

    copyJson() {
        const jsonText = this.jsonPreview.textContent;
        // 先检查navigator.clipboard是否可用
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(jsonText).then(() => {
                this.showToast('JSON已复制到剪贴板', 'success');
            }).catch(() => {
                this.fallbackCopyJson(jsonText);
            });
        } else {
            this.fallbackCopyJson(jsonText);
        }
    }
    
    /**
     * 降级复制方案
     */
    fallbackCopyJson(jsonText) {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = jsonText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('JSON已复制到剪贴板', 'success');
        } catch (error) {
            console.error('复制JSON失败:', error);
            this.showToast('复制失败，请手动复制', 'error');
        }
    }

    toggleJsonExpansion() {
        const previewContainer = this.jsonPreview.parentElement.parentElement;
        const isExpanded = previewContainer.classList.contains('expanded');
        
        if (isExpanded) {
            previewContainer.classList.remove('expanded');
            this.jsonPreview.style.maxHeight = '500px';
        } else {
            previewContainer.classList.add('expanded');
            this.jsonPreview.style.maxHeight = 'none';
        }
    }

    resetForm() {
        if (confirm('确定要重置所有数据吗？')) {
            this.form.reset();
            this.generateDetails();
            this.updateJsonPreview();
            this.form.classList.remove('was-validated');
            this.showToast('表单已重置', 'info');
        }
    }

    copyDetail(index) {
        const detailCard = document.querySelector(`[data-index="${index}"]`);
        const inputs = detailCard.querySelectorAll('input');
        const data = Array.from(inputs).map(input => input.value).join('\t');
        
        navigator.clipboard.writeText(data).then(() => {
            this.showToast(`明细 ${index + 1} 已复制`, 'success');
        });
    }

    removeDetail(index) {
        if (confirm(`确定要删除明细 ${index + 1} 吗？`)) {
            const detailCard = document.querySelector(`[data-index="${index}"]`);
            detailCard.remove();
            this.updateDetailCount();
            this.updateJsonPreview();
        }
    }

    updateDetailCount() {
        const count = this.detailFieldsContainer.children.length;
        this.detailCountBadge.textContent = `${count} 项`;
    }

    showSuccessModal(message) {
        const modal = new bootstrap.Modal(document.getElementById('successModal'));
        modal.show();
    }

    showErrorModal(message) {
        const modal = new bootstrap.Modal(document.getElementById('errorModal'));
        document.getElementById('error-message').textContent = message;
        modal.show();
    }

    showToast(message, type = 'info') {
        // 创建Toast元素
        const toastContainer = document.getElementById('toast-container') || this.createToastContainer();
        const toast = this.createToast(message, type);
        toastContainer.appendChild(toast);
        
        // 显示Toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // 自动移除
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }

    createToast(message, type) {
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-' + type + ' border-0';
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-${this.getToastIcon(type)} me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        return toast;
    }

    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-triangle',
            warning: 'exclamation-circle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    setupAutoSave() {
        // 自动保存表单数据到localStorage
        this.form.addEventListener('input', () => {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());
            localStorage.setItem('orderDownloadForm', JSON.stringify(data));
        });

        // 恢复保存的数据
        const savedData = localStorage.getItem('orderDownloadForm');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                Object.keys(data).forEach(key => {
                    const input = this.form.querySelector(`[name="${key}"]`);
                    if (input) {
                        input.value = data[key];
                    }
                });
                this.generateDetails();
                this.updateJsonPreview();
            } catch (error) {
                console.error('恢复保存数据失败:', error);
            }
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    saveToHistory(data) {
        const history = JSON.parse(localStorage.getItem('orderDownloadHistory') || '[]');
        history.unshift({
            ...data,
            timestamp: new Date().toISOString(),
            id: Date.now()
        });
        
        // 只保留最近10条记录
        if (history.length > 10) {
            history.splice(10);
        }
        
        localStorage.setItem('orderDownloadHistory', JSON.stringify(history));
    }
}

// 初始化
let orderManager;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，开始初始化 OrderDownloadManager'); // 调试信息
    orderManager = new OrderDownloadManager();
    console.log('OrderDownloadManager 初始化完成:', orderManager); // 调试信息
});

// 全局函数（用于HTML中的onclick）
window.orderManager = orderManager;