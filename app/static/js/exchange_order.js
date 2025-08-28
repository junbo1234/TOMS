/**
 * 换货单生成管理器
 * 参考订单下载模块实现方式，针对换货单业务场景定制
 */
class ExchangeOrderManager {
    constructor() {
        // 初始化成员变量
        this.form = document.getElementById('exchange-form');
        this.detailCountInput = document.getElementById('detail-count');
        this.detailFieldsContainer = document.getElementById('detail-fields');
        this.generateDetailsBtn = document.getElementById('generate-details');
        this.previewBtn = document.getElementById('preview-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.jsonPreview = document.getElementById('json-preview');
        this.detailCountBadge = document.getElementById('detail-count-badge');
        this.copyJsonBtn = document.getElementById('copy-json');
        this.expandJsonBtn = document.getElementById('expand-json');
        this.preset = window.preset || {};
        this.toastContainer = null;
    }

    /**
     * 初始化函数
     */
    init() {
        console.log('开始初始化 ExchangeOrderManager');
        this.bindEvents();
        this.generateDetails(); // 初始化生成一行明细
        this.updateJsonPreview();
        this.setupAutoSave();
        console.log('ExchangeOrderManager 初始化完成');
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 表单提交事件
        this.form.addEventListener('submit', this.handleSubmit.bind(this));

        // 生成明细按钮事件
        this.generateDetailsBtn.addEventListener('click', () => {
            this.generateDetails();
        });

        // 预览按钮事件
        this.previewBtn.addEventListener('click', () => {
            this.updateJsonPreview();
        });

        // 重置按钮事件
        this.resetBtn.addEventListener('click', () => {
            this.resetForm();
        });

        // 复制JSON按钮事件
        this.copyJsonBtn.addEventListener('click', () => {
            this.copyJson();
        });

        // 展开JSON按钮事件
        this.expandJsonBtn.addEventListener('click', () => {
            this.toggleJsonExpansion();
        });

        // 监听明细数量变化
        this.detailCountInput.addEventListener('change', () => {
            this.generateDetails();
        });

        // 监听表单输入变化，实时更新预览
        this.form.addEventListener('input', this.debounce(() => {
            this.updateJsonPreview();
        }, 300));
    }

    /**
     * 生成商品明细项
     */
    generateDetails() {
        const detailCount = parseInt(this.detailCountInput.value) || 1;
        this.detailFieldsContainer.innerHTML = '';

        for (let i = 0; i < detailCount; i++) {
            const detailCard = this.createDetailCard(i);
            this.detailFieldsContainer.appendChild(detailCard);
        }

        this.updateDetailCount();
        this.updateJsonPreview();
    }

    /**
     * 创建明细项卡片
     */
    createDetailCard(index) {
        const card = document.createElement('div');
        card.className = 'detail-card mb-3 p-3 border rounded bg-white';
        card.setAttribute('data-index', index);

        // 从data-fields属性获取字段配置
        const fieldsConfig = JSON.parse(this.detailCountInput.getAttribute('data-fields'));

        let fieldsHTML = '';
        fieldsConfig.forEach((field, fieldIndex) => {
            const fieldId = `${field.idPrefix}${index}`;
            const fieldName = `${field.namePrefix}${index}`;
            const isRequired = field.required ? 'required' : '';
            const requiredMark = field.required ? '<span class="text-danger">*</span>' : '';
            const type = field.type || 'text';
            const min = field.type === 'number' && field.min ? `min="${field.min}"` : '';

            fieldsHTML += `
                <div class="col-md-2">
                    <label for="${fieldId}" class="form-label">
                        ${field.label} ${requiredMark}
                    </label>
                    <div class="input-group">
                        <span class="input-group-text">
                            <i class="${field.icon}"></i>
                        </span>
                        <input type="${type}" class="form-control" id="${fieldId}" name="${fieldName}"
                               placeholder="${field.placeholder}" ${isRequired} ${min}>
                    </div>
                </div>
            `;
        });

        // 添加操作按钮（仅当不是第一个时显示删除按钮）
        const actionsHTML = index > 0 ? `
            <div class="col-md-2">
                <label class="form-label">&nbsp;</label>
                <button type="button" class="btn btn-outline-danger w-100 remove-detail-btn"
                        data-index="${index}">
                    <i class="fas fa-trash-alt me-1"></i>删除
                </button>
            </div>
        ` : `
            <div class="col-md-2">
                <label class="form-label">&nbsp;</label>
                <button type="button" class="btn btn-outline-primary w-100 copy-detail-btn"
                        data-index="${index}">
                    <i class="fas fa-copy me-1"></i>复制
                </button>
            </div>
        `;

        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="mb-0 text-muted">明细项 ${index + 1}</h6>
            </div>
            <div class="row g-3">
                ${fieldsHTML}
                ${actionsHTML}
            </div>
        `;

        // 绑定按钮事件
        if (index > 0) {
            const removeBtn = card.querySelector('.remove-detail-btn');
            removeBtn.addEventListener('click', () => {
                this.removeDetail(index);
            });
        } else {
            const copyBtn = card.querySelector('.copy-detail-btn');
            copyBtn.addEventListener('click', () => {
                this.copyDetail(index);
            });
        }

        return card;
    }

    /**
     * 处理表单提交
     */
    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.form.checkValidity()) {
            this.form.classList.add('was-validated');
            this.showToast('请填写所有必填字段', 'error');
            return;
        }

        const submitBtn = this.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        try {
            // 显示加载状态
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>处理中...';

            // 构建表单数据，确保包含所有动态生成的输入框
            const formData = new FormData();
            
            // 添加基础字段
            const basicInputs = this.form.querySelectorAll('input[name], textarea[name]');
            basicInputs.forEach(input => {
                if (input.name && input.name !== 'detail_count') {
                    formData.append(input.name, input.value);
                }
            });
            
            // 添加明细数量
            const detailCount = parseInt(this.detailCountInput.value) || 1;
            formData.append('detail_count', detailCount);
            
            // 手动添加明细字段
            for (let i = 0; i < detailCount; i++) {
                const platformOutSkuCodeInput = document.getElementById(`platformOutSkuCode${i}`);
                const numInput = document.getElementById(`num${i}`);
                
                if (platformOutSkuCodeInput) formData.set(`platformOutSkuCode${i}`, platformOutSkuCodeInput.value);
                if (numInput) formData.set(`num${i}`, numInput.value);
            }

            // 提交数据到后端
            const response = await fetch('/exchange_order/submit', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.status === 'success') {
                // 保存到历史记录
                this.saveToHistory(Object.fromEntries(formData.entries()));
                
                // 显示成功提示
                this.showSuccessModal();
                
                // 打印最终推送到MQ的报文（后端会实际推送并打印）
                console.log('换货单数据已成功提交到后端，最终推送到RabbitMQ的报文会在后端日志中显示');
            } else {
                this.showErrorModal(result.message);
            }
        } catch (error) {
            console.error('提交失败:', error);
            this.showErrorModal(`网络错误: ${error.message}`);
        } finally {
            // 恢复按钮状态
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    /**
     * 构建换货单数据
     */
    buildExchangeData() {
        // 获取表单数据
        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData.entries());
        const detailCount = parseInt(this.detailCountInput.value) || 1;
        
        // 构建完整的换货单数据
        const exchangeData = {
            ...this.preset,
            platformExchangeNo: data.platformExchangeNo,
            platformOrderNo: data.platformOrderNo,
            platformStatus: data.platformStatus,
            platformId: data.platformId,
            storeId: data.storeId,
            applyNum: data.applyNum,
            platformInSkuId: data.platformInSkuId,
            platformNo: data.platformNo,
            backExpressNo: data.backExpressNo || '',
            backExpressName: data.backExpressName || '',
            applyTime: new Date().toISOString(),
            exchangeSkuList: [],
            exchangeSkuOutList: []
        };

        // 添加换出商品明细数据
        for (let i = 0; i < detailCount; i++) {
            const platformOutSkuCode = data[`platformOutSkuCode${i}`];
            const num = data[`num${i}`];
            
            // 确保必填字段都已填写
            if (!platformOutSkuCode || !num) {
                throw new Error(`明细项 ${i + 1} 的必填字段未填写完整`);
            }

            // 换入商品列表
            if (this.preset.exchangeSkuList && this.preset.exchangeSkuList[0]) {
                exchangeData.exchangeSkuList.push({
                    ...this.preset.exchangeSkuList[0],
                    platformInSkuId: platformOutSkuCode,
                    applyNum: parseInt(num),
                    platformNo: data.platformNo
                });
            } else {
                // 如果没有预设数据，创建基本结构
                exchangeData.exchangeSkuList.push({
                    platformInSkuId: platformOutSkuCode,
                    applyNum: parseInt(num),
                    platformNo: data.platformNo
                });
            }

            // 换出商品列表
            if (this.preset.exchangeSkuOutList && this.preset.exchangeSkuOutList[0]) {
                exchangeData.exchangeSkuOutList.push({
                    ...this.preset.exchangeSkuOutList[0],
                    platformOutSkuCode: platformOutSkuCode,
                    num: parseInt(num)
                });
            } else {
                // 如果没有预设数据，创建基本结构
                exchangeData.exchangeSkuOutList.push({
                    platformOutSkuCode: platformOutSkuCode,
                    num: parseInt(num)
                });
            }
        }

        return exchangeData;
    }

    /**
     * 更新JSON预览
     */
    updateJsonPreview() {
        try {
            // 获取表单数据
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());
            const detailCount = parseInt(this.detailCountInput.value) || 1;
            
            // 构建完整的换货单数据（宽松模式，允许字段为空）
            const exchangeData = {
                ...this.preset,
                platformExchangeNo: data.platformExchangeNo || '',
                platformOrderNo: data.platformOrderNo || '',
                platformStatus: data.platformStatus || '',
                platformId: data.platformId || '',
                storeId: data.storeId || '',
                applyNum: data.applyNum || '',
                platformInSkuId: data.platformInSkuId || '',
                platformNo: data.platformNo || '',
                backExpressNo: data.backExpressNo || '',
                backExpressName: data.backExpressName || '',
                applyTime: new Date().toISOString(),
                exchangeSkuList: [],
                exchangeSkuOutList: []
            };

            // 添加换出商品明细数据（宽松模式，允许字段为空）
            for (let i = 0; i < detailCount; i++) {
                const platformOutSkuCode = data[`platformOutSkuCode${i}`] || '';
                const num = data[`num${i}`] || '';

                // 换入商品列表
                if (this.preset.exchangeSkuList && this.preset.exchangeSkuList[0]) {
                    exchangeData.exchangeSkuList.push({
                        ...this.preset.exchangeSkuList[0],
                        platformInSkuId: platformOutSkuCode,
                        applyNum: num ? parseInt(num) : num,
                        platformNo: data.platformNo
                    });
                } else {
                    // 如果没有预设数据，创建基本结构
                    exchangeData.exchangeSkuList.push({
                        platformInSkuId: platformOutSkuCode,
                        applyNum: num ? parseInt(num) : num,
                        platformNo: data.platformNo
                    });
                }

                // 换出商品列表
                if (this.preset.exchangeSkuOutList && this.preset.exchangeSkuOutList[0]) {
                    exchangeData.exchangeSkuOutList.push({
                        ...this.preset.exchangeSkuOutList[0],
                        platformOutSkuCode: platformOutSkuCode,
                        num: num ? parseInt(num) : num
                    });
                } else {
                    // 如果没有预设数据，创建基本结构
                    exchangeData.exchangeSkuOutList.push({
                        platformOutSkuCode: platformOutSkuCode,
                        num: num ? parseInt(num) : num
                    });
                }
            }
            
            this.jsonPreview.textContent = JSON.stringify(exchangeData, null, 2);
            
            // 重新高亮代码
            if (window.Prism) {
                Prism.highlightElement(this.jsonPreview);
            }
        } catch (error) {
            console.error('JSON预览更新失败:', error);
            this.jsonPreview.textContent = '// JSON预览生成失败: ' + error.message;
        }
    }

    /**
     * 复制JSON到剪贴板
     */
    copyJson() {
        const jsonText = this.jsonPreview.textContent;
        navigator.clipboard.writeText(jsonText).then(() => {
            this.showToast('JSON已复制到剪贴板', 'success');
        }).catch(err => {
            console.error('复制失败:', err);
            this.showToast('复制失败，请手动复制', 'error');
        });
    }

    /**
     * 切换JSON预览展开状态
     */
    toggleJsonExpansion() {
        const isExpanded = this.jsonPreview.parentElement.classList.toggle('expanded');
        this.expandJsonBtn.innerHTML = isExpanded 
            ? '<i class="fas fa-compress me-1"></i>收起' 
            : '<i class="fas fa-expand me-1"></i>展开';
    }

    /**
     * 重置表单
     */
    resetForm() {
        this.form.reset();
        this.form.classList.remove('was-validated');
        this.detailCountInput.value = 1;
        this.generateDetails();
        this.updateJsonPreview();
        this.showToast('表单已重置', 'info');
    }

    /**
     * 复制明细项
     */
    copyDetail(index) {
        // 增加明细数量
        const currentCount = parseInt(this.detailCountInput.value);
        this.detailCountInput.value = currentCount + 1;
        this.generateDetails();
        
        // 复制原始数据到新项
        const originalCard = document.querySelector(`.detail-card[data-index="${index}"]`);
        const newCard = document.querySelector(`.detail-card[data-index="${currentCount}"]`);
        
        if (originalCard && newCard) {
            const originalInputs = originalCard.querySelectorAll('input');
            const newInputs = newCard.querySelectorAll('input');
            
            originalInputs.forEach((input, i) => {
                if (newInputs[i]) {
                    newInputs[i].value = input.value;
                }
            });
        }
        
        this.updateJsonPreview();
        this.showToast('明细项已复制', 'success');
    }

    /**
     * 删除明细项
     */
    removeDetail(index) {
        const cards = document.querySelectorAll('.detail-card');
        if (cards.length <= 1) {
            this.showToast('至少保留一项明细', 'warning');
            return;
        }
        
        // 减少明细数量
        const currentCount = parseInt(this.detailCountInput.value);
        this.detailCountInput.value = currentCount - 1;
        this.generateDetails();
        this.updateJsonPreview();
        this.showToast('明细项已删除', 'success');
    }

    /**
     * 更新明细数量显示
     */
    updateDetailCount() {
        const detailCount = document.querySelectorAll('.detail-card').length;
        this.detailCountBadge.textContent = `${detailCount} 项`;
    }

    /**
     * 显示成功模态框
     */
    showSuccessModal() {
        const successModal = new bootstrap.Modal(document.getElementById('successModal'));
        successModal.show();
    }

    /**
     * 显示错误模态框
     */
    showErrorModal(message) {
        const errorMessageElement = document.getElementById('error-message');
        errorMessageElement.textContent = message || '操作失败，请检查输入数据！';
        const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        errorModal.show();
    }

    /**
     * 显示Toast提示
     */
    showToast(message, type = 'info') {
        if (!this.toastContainer) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.className = 'toast-container position-fixed bottom-5 end-5 z-50';
            document.body.appendChild(this.toastContainer);
        }

        const toastId = `toast-${Date.now()}`;
        const toast = this.createToast(toastId, message, type);
        this.toastContainer.appendChild(toast);

        const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
        bsToast.show();

        // 显示后移除元素
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    /**
     * 创建Toast元素
     */
    createToast(id, message, type) {
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = `toast align-items-center text-white bg-${this.getTypeColor(type)} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');

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

    /**
     * 获取提示类型对应的颜色
     */
    getTypeColor(type) {
        const colors = {
            success: 'success',
            error: 'danger',
            warning: 'warning',
            info: 'info'
        };
        return colors[type] || 'info';
    }

    /**
     * 获取提示类型对应的图标
     */
    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-triangle',
            warning: 'exclamation-circle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * 设置自动保存
     */
    setupAutoSave() {
        // 自动保存表单数据到localStorage
        this.form.addEventListener('input', () => {
            const formData = new FormData(this.form);
            const data = Object.fromEntries(formData.entries());
            localStorage.setItem('exchangeOrderForm', JSON.stringify(data));
        });

        // 恢复保存的数据
        const savedData = localStorage.getItem('exchangeOrderForm');
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

    /**
     * 防抖函数
     */
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

    /**
     * 保存到历史记录
     */
    saveToHistory(data) {
        const history = JSON.parse(localStorage.getItem('exchangeOrderHistory') || '[]');
        history.unshift({
            ...data,
            timestamp: new Date().toISOString(),
            id: Date.now()
        });
        
        // 只保留最近10条记录
        if (history.length > 10) {
            history.splice(10);
        }
        
        localStorage.setItem('exchangeOrderHistory', JSON.stringify(history));
    }
}

// 初始化
let exchangeManager;
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，开始初始化 ExchangeOrderManager');
    exchangeManager = new ExchangeOrderManager();
    exchangeManager.init();
    console.log('ExchangeOrderManager 初始化完成:', exchangeManager);
});

// 暴露全局变量
window.exchangeManager = exchangeManager;