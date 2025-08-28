/**
 * 出库单推送管理器
 * 处理出库单推送页面的动态功能、表单验证和JSON预览
 */
class StockoutPushManager {
    constructor() {
        // 初始化属性
        this.successModal = new bootstrap.Modal(document.getElementById('successModal'));
        this.errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        this.errorMessage = document.getElementById('error-message');
        this.detailCountInput = document.getElementById('detail-count');
        this.detailCountBadge = document.getElementById('detail-count-badge');
        this.detailFieldsContainer = document.getElementById('detail-fields');
        this.jsonPreview = document.getElementById('json-preview');
        this.copyJsonBtn = document.getElementById('copy-json');
        this.expandJsonBtn = document.getElementById('expand-json');
        this.resetBtn = document.getElementById('reset-btn');
        this.form = document.getElementById('stockout-form');
        this.isJsonExpanded = false;

        // 初始化页面
        this.init();
    }

    /**
     * 初始化页面
     */
    init() {
        // 生成初始明细项
        this.generateDetailFields();

        // 添加事件监听
        this.detailCountInput.addEventListener('input', this.debounce(() => this.generateDetailFields(), 300));
        this.form.addEventListener('input', this.debounce(() => this.updateJsonPreview(), 300));
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.copyJsonBtn.addEventListener('click', () => this.copyJson());
        this.expandJsonBtn.addEventListener('click', () => this.toggleJsonExpansion());
        this.resetBtn.addEventListener('click', () => this.resetForm());

        // 页面加载时更新JSON预览
        this.updateJsonPreview();
    }

    /**
     * 生成商品明细字段
     */
    generateDetailFields() {
        // 获取明细数量并确保在有效范围内
        let count = parseInt(this.detailCountInput.value);
        if (isNaN(count) || count < 1) count = 1;
        if (count > 10) count = 10;
        this.detailCountInput.value = count;
        this.detailCountBadge.textContent = `${count} 项`;

        // 清空现有明细字段
        this.detailFieldsContainer.innerHTML = '';

        // 获取字段配置
        const fieldsConfig = JSON.parse(this.detailCountInput.getAttribute('data-fields'));

        // 生成新的明细字段
        for (let i = 0; i < count; i++) {
            const row = document.createElement('div');
            row.className = 'row g-4 mb-3 pb-3 border-b';
            row.dataset.index = i;

            // 明细项标题
            const titleCol = document.createElement('div');
            titleCol.className = 'col-12';
            titleCol.innerHTML = `<h6 class="text-muted mb-0">明细项 ${i + 1}</h6>`;
            row.appendChild(titleCol);

            // 为每个字段创建输入框
            fieldsConfig.forEach((field, fieldIndex) => {
                const col = document.createElement('div');
                col.className = 'col-md-6';

                const inputId = `${field.idPrefix}-${i}`;
                const inputName = `${field.namePrefix}[${i}]`;

                let inputHtml = `
                    <label for="${inputId}" class="form-label">
                        ${field.label} ${field.required ? '<span class="text-danger">*</span>' : ''}
                    </label>
                    <div class="input-group">
                        <span class="input-group-text">
                            <i class="${field.icon}"></i>
                        </span>
                        <input type="${field.type || 'text'}" class="form-control" id="${inputId}" name="${inputName}"
                               placeholder="${field.placeholder}" ${field.required ? 'required' : ''}
                               ${field.min !== undefined ? `min="${field.min}"` : ''}>
                    </div>
                `;

                col.innerHTML = inputHtml;
                row.appendChild(col);
            });

            this.detailFieldsContainer.appendChild(row);
        }
    }

    /**
     * 更新JSON预览
     */
    updateJsonPreview() {
        try {
            // 获取表单数据
            const formData = this.collectFormData();

            // 创建JSON结构
            const jsonData = this.buildJsonData(formData);

            // 格式化JSON并显示
            const formattedJson = this.isJsonExpanded ?
                JSON.stringify(jsonData, null, 2) :
                JSON.stringify(jsonData);

            this.jsonPreview.textContent = formattedJson;
        } catch (error) {
            this.jsonPreview.textContent = `// 生成JSON失败: ${error.message}`;
        }
    }

    /**
     * 收集表单数据
     */
    collectFormData() {
        const formData = {
            deliveryOrderCode: document.getElementById('deliveryOrderCode').value.trim(),
            warehouseCode: document.getElementById('warehouseCode').value.trim(),
            itemCodes: [],
            actualQtys: []
        };

        // 收集所有明细项
        const detailCount = parseInt(this.detailCountInput.value);
        for (let i = 0; i < detailCount; i++) {
            formData.itemCodes.push(document.getElementById(`itemCode-${i}`).value.trim());
            formData.actualQtys.push(parseInt(document.getElementById(`actualQty-${i}`).value) || 0);
        }

        return formData;
    }

    /**
     * 构建JSON数据
     */
    buildJsonData(formData) {
        // 获取预设参数
        const preset = window.preset || {};

        // 获取当前时间，格式化为yyyy-MM-dd HH:mm:ss
        const currentTime = this.formatDateTime(new Date());

        // 创建订单行
        const orderLines = [];
        for (let i = 0; i < formData.itemCodes.length; i++) {
            orderLines.push({
                actualQty: formData.actualQtys[i],
                inventoryType: 'ZP',
                itemCode: formData.itemCodes[i],
                orderLineNo: `${i + 1}`,
                ownerCode: 'XIER'
            });
        }

        // 构建完整JSON
        const jsonData = {
            callbackResponse: {
                apiMethodName: 'stockout.confirm',
                deliveryOrder: {
                    confirmType: 0,
                    deliveryOrderCode: formData.deliveryOrderCode,
                    operateTime: currentTime,
                    orderConfirmTime: currentTime,
                    orderType: 'PTCK',
                    outBizCode: '',
                    ownerCode: 'XIER',
                    status: 'DELIVERED',
                    warehouseCode: formData.warehouseCode
                },
                orderLines: orderLines,
                responseClass: 'com.qimen.api.response.StockoutConfirmResponse',
                version: '2.0'
            },
            outOrderCode: formData.deliveryOrderCode,
            type: 2
        };

        return jsonData;
    }

    /**
     * 格式化日期时间
     */
    formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * 处理表单提交
     */
    handleSubmit(e) {
        e.preventDefault();

        // 验证表单
        if (!this.form.checkValidity()) {
            e.stopPropagation();
            this.form.classList.add('was-validated');
            this.showToast('请填写所有必填字段', 'error');
            return;
        }

        try {
            // 获取表单数据并构建JSON
            const formData = this.collectFormData();
            const jsonData = this.buildJsonData(formData);

            // 发送数据到后端
            fetch('/stockout_push/api/stockout_push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(jsonData)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('网络响应错误');
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    this.showToast('出库单已成功推送', 'success');
                } else {
                    this.errorMessage.textContent = data.message || '推送失败，请稍后重试';
                    this.errorModal.show();
                    this.showToast(data.message || '推送失败，请稍后重试', 'error');
                }
            })
            .catch(error => {
                this.errorMessage.textContent = `推送失败: ${error.message}`;
                this.errorModal.show();
                this.showToast(`推送失败: ${error.message}`, 'error');
            });
        } catch (error) {
            this.errorMessage.textContent = `处理请求时出错: ${error.message}`;
            this.errorModal.show();
            this.showToast(`处理请求时出错: ${error.message}`, 'error');
        }
    }

    /**
     * 复制JSON到剪贴板
     */
    copyJson() {
        const jsonText = this.jsonPreview.textContent;
        navigator.clipboard.writeText(jsonText)
            .then(() => {
                this.showToast('JSON已复制到剪贴板', 'success');
            })
            .catch(err => {
                this.showToast('复制失败，请手动复制', 'error');
            });
    }

    /**
     * 切换JSON展开/折叠状态
     */
    toggleJsonExpansion() {
        this.isJsonExpanded = !this.isJsonExpanded;
        this.expandJsonBtn.innerHTML = this.isJsonExpanded ?
            '<i class="fas fa-compress me-1"></i>折叠' :
            '<i class="fas fa-expand me-1"></i>展开';
        this.updateJsonPreview();
    }

    /**
     * 重置表单
     */
    resetForm() {
        this.form.reset();
        this.form.classList.remove('was-validated');
        this.detailCountInput.value = 1;
        this.generateDetailFields();
        this.updateJsonPreview();
        this.showToast('表单已重置', 'info');
    }

    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }

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
            toastContainer.style.zIndex = '1055';
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

        toastContainer.innerHTML += toastHtml;

        // 显示toast
        const toast = new bootstrap.Toast(document.getElementById(toastId));
        toast.show();

        // 3秒后自动移除
        setTimeout(() => {
            const element = document.getElementById(toastId);
            if (element) {
                element.remove();
            }
        }, 3000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    new StockoutPushManager();
});