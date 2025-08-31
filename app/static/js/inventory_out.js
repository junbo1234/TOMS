/**
 * 其他出库页面JavaScript
 * 现代化的商务风格交互体验
 */

class OtherAllocationOutManager {
    constructor() {
        this.form = document.getElementById('other-allocation-out-form');
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

    setupAutoSave() {
        try {
            // 尝试从本地存储加载表单数据
            const savedFormData = localStorage.getItem('otherAllocationOutFormData');
            if (savedFormData) {
                const data = JSON.parse(savedFormData);
                this.fillFormWithData(data);
            }

            // 设置表单数据自动保存
            this.form.addEventListener('change', () => {
                this.autoSaveFormData();
            });
        } catch (error) {
            console.error('自动保存设置失败:', error);
        }
    }

    autoSaveFormData() {
        try {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());
            localStorage.setItem('otherAllocationOutFormData', JSON.stringify(data));
        } catch (error) {
            console.error('表单数据自动保存失败:', error);
        }
    }

    fillFormWithData(data) {
        try {
            // 填充基础字段
            Object.keys(data).forEach(key => {
                if (key !== 'detail_count' && !key.includes('itemCode') && !key.includes('actualQty')) {
                    const input = this.form.querySelector(`[name="${key}"]`);
                    if (input) {
                        input.value = data[key] || '';
                    }
                }
            });

            // 设置明细数量
            if (data.detail_count) {
                this.detailCountInput.value = data.detail_count;
                this.generateDetails();
            }
        } catch (error) {
            console.error('表单数据填充失败:', error);
        }
    }

    generateDetails() {
        try {
            const count = parseInt(this.detailCountInput.value) || 1;
            this.detailFieldsContainer.innerHTML = '';
            
            const fields = JSON.parse(this.detailCountInput.dataset.fields || '[]');
            
            for (let i = 0; i < count; i++) {
                const detailCard = this.createDetailCard(fields, i);
                this.detailFieldsContainer.appendChild(detailCard);
            }
            
            this.updateDetailCount();
        } catch (error) {
            console.error('生成明细失败:', error);
        }
    }

    createDetailCard(fields, index) {
        const card = document.createElement('div');
        card.className = 'detail-card mb-3 p-3 border rounded bg-light';
        card.setAttribute('data-index', index);
        
        const cardHeader = document.createElement('div');
        cardHeader.className = 'd-flex justify-content-between items-center mb-2';
        
        const title = document.createElement('h6');
        title.className = 'text-primary mb-0';
        title.textContent = `商品明细 ${index + 1}`;
        
        const actions = document.createElement('div');
        actions.className = 'btn-group btn-group-sm';
        
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn-outline-secondary';
        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        copyBtn.title = '复制明细';
        copyBtn.addEventListener('click', () => this.copyDetail(index));
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-outline-danger';
        removeBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        removeBtn.title = '删除明细';
        removeBtn.addEventListener('click', () => this.removeDetail(index));
        
        actions.appendChild(copyBtn);
        actions.appendChild(removeBtn);
        
        cardHeader.appendChild(title);
        cardHeader.appendChild(actions);
        
        const row = document.createElement('div');
        row.className = 'row g-3';
        
        fields.forEach(field => {
            const col = document.createElement('div');
            col.className = 'col-md-4';
            
            const fieldHtml = `
                <label for="${field.idPrefix}${index}" class="form-label">
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
            col.innerHTML = fieldHtml;
            row.appendChild(col);
        });

        card.appendChild(cardHeader);
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
                const itemCodeInput = document.getElementById(`itemCode${i}`);
                const actualQtyInput = document.getElementById(`actualQty${i}`);
                
                if (itemCodeInput) formData.set(`itemCode${i}`, itemCodeInput.value);
                if (actualQtyInput) formData.set(`actualQty${i}`, actualQtyInput.value);
            }

            const response = await fetch('/inventory_out/submit', {
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
            // 获取表单数据
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());
            
            // 获取当前时间
            const currentTime = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(/\//g, '-');

            // 构建完整的订单数据
            const orderData = {
                ...this.preset,
                type: 2,
                callbackResponse: {
                    ...this.preset.callbackResponse,
                    deliveryOrder: {
                        ...this.preset.callbackResponse.deliveryOrder,
                        deliveryOrderCode: data.deliveryOrderCode,
                        outBizCode: data.deliveryOrderCode,
                        operateTime: currentTime,
                        orderConfirmTime: currentTime
                    },
                    orderLines: []
                }
            };

            // 添加明细数据
            const detailCount = parseInt(data.detail_count) || 1;
            
            for (let i = 0; i < detailCount; i++) {
                const itemCode = data[`itemCode${i}`] || '';
                const actualQty = data[`actualQty${i}`] || '';
                
                const detail = {
                    ...this.preset.callbackResponse.orderLines[0],
                    itemCode: itemCode,
                    actualQty: actualQty,
                    orderLineNo: (i + 1).toString()
                };
                orderData.callbackResponse.orderLines.push(detail);
            }

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
        navigator.clipboard.writeText(jsonText).then(() => {
            this.showToast('JSON已复制到剪贴板', 'success');
        }).catch(() => {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = jsonText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('JSON已复制到剪贴板', 'success');
        });
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
        const errorMessageElement = document.getElementById('error-message');
        if (errorMessageElement) {
            errorMessageElement.textContent = message || '操作失败，请检查输入数据！';
        }
        const modal = new bootstrap.Modal(document.getElementById('errorModal'));
        modal.show();
    }

    showToast(message, type = 'info') {
        if (!this.toastContainer) {
            this.toastContainer = this.createToastContainer();
        }
        
        const toast = this.createToast(message, type);
        this.toastContainer.appendChild(toast);
        
        const bootstrapToast = new bootstrap.Toast(toast);
        bootstrapToast.show();
        
        // 自动移除toast
        setTimeout(() => {
            toast.remove();
        }, 5000);
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
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
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
        const history = JSON.parse(localStorage.getItem('otherAllocationOutHistory') || '[]');
        history.unshift({
            ...data,
            timestamp: new Date().toISOString(),
            id: Date.now()
        });
        
        // 只保留最近10条记录
        if (history.length > 10) {
            history.splice(10);
        }
        
        localStorage.setItem('otherAllocationOutHistory', JSON.stringify(history));
    }
}

// 初始化
let otherAllocationOutManager;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，开始初始化 OtherAllocationOutManager'); // 调试信息
    otherAllocationOutManager = new OtherAllocationOutManager();
    console.log('OtherAllocationOutManager 初始化完成:', otherAllocationOutManager); // 调试信息
});

// 全局函数（用于HTML中的onclick）
window.otherAllocationOutManager = otherAllocationOutManager;