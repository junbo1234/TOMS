/*
 * 通知单入库页面JavaScript
 * 实现页面加载时自动预览JSON和实时更新功能
 */

class ReturnOrderNoticeManager {
    constructor() {
        this.form = document.getElementById('notice-form');
        this.detailCountInput = document.getElementById('detail-count');
        this.detailFieldsContainer = document.getElementById('detail-fields');
        this.detailCountBadge = document.getElementById('detail-count-badge');
        this.jsonPreview = document.getElementById('json-preview');
        this.previewBtn = document.getElementById('preview-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.copyJsonBtn = document.getElementById('copy-json');
        this.expandJsonBtn = document.getElementById('expand-json');

        this.successModal = new bootstrap.Modal(document.getElementById('successModal'));
        this.errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        this.errorMessage = document.getElementById('error-message');

        this.preset = {
            returnOrderCode: 'RN202410010001',
            warehouseCode: 'WH001',
            CloseStatus: '',
            itemCode: 'ITEMXXX',
            actualQty: '10'
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.generateDetailFields();
        this.updateJsonPreview();
    }

    bindEvents() {
        // 明细数量变化
        this.detailCountInput.addEventListener('input', () => {
            const count = parseInt(this.detailCountInput.value, 10);
            if (count >= 1 && count <= 10) {
                this.generateDetailFields();
                this.updateJsonPreview();
            } else if (count < 1) {
                this.detailCountInput.value = 1;
                this.generateDetailFields();
                this.updateJsonPreview();
            } else if (count > 10) {
                this.detailCountInput.value = 10;
                this.generateDetailFields();
                this.updateJsonPreview();
            }
        });

        // 预览按钮
        this.previewBtn.addEventListener('click', () => {
            this.updateJsonPreview();
            this.showToast('数据预览已更新', 'info');
        });

        // 重置按钮
        this.resetBtn.addEventListener('click', () => {
            this.resetForm();
        });

        // 复制JSON
        this.copyJsonBtn.addEventListener('click', () => {
            this.copyJson();
        });

        // 展开JSON
        this.expandJsonBtn.addEventListener('click', () => {
            this.toggleJsonExpansion();
        });

        // 实时更新JSON预览
        this.form.addEventListener('input', () => {
            this.debounce(() => this.updateJsonPreview(), 500);
        });

        // 提交表单
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    generateDetailFields() {
        const count = parseInt(this.detailCountInput.value, 10) || 1;
        const fieldsConfig = JSON.parse(this.detailCountInput.getAttribute('data-fields') || '[]');

        this.detailFieldsContainer.innerHTML = '';
        this.detailCountBadge.textContent = `${count} 项`;

        for (let i = 1; i <= count; i++) {
            const detailRow = document.createElement('div');
            detailRow.className = 'row g-3 mb-3 pb-3 border-bottom';
            detailRow.innerHTML = `<div class="col-md-12"><h6 class="text-muted mb-2">明细 ${i}</h6></div>`;

            fieldsConfig.forEach(field => {
                const fieldCol = document.createElement('div');
                fieldCol.className = 'col-md-6';

                let inputHtml = `<input type="${field.type || 'text'}" class="form-control" `;
                if (field.min) inputHtml += `min="${field.min}" `;
                inputHtml += `id="${field.idPrefix}${i}" name="${field.namePrefix}${i}" placeholder="${field.placeholder}" ${field.required ? 'required' : ''}>`;

                fieldCol.innerHTML = `
                    <label for="${field.idPrefix}${i}" class="form-label">
                        ${field.label} ${field.required ? '<span class="text-danger">*</span>' : ''}
                    </label>
                    <div class="input-group">
                        <span class="input-group-text">
                            <i class="${field.icon}"></i>
                        </span>
                        ${inputHtml}
                    </div>
                `;

                detailRow.appendChild(fieldCol);
            });

            this.detailFieldsContainer.appendChild(detailRow);
        }
    }

    updateJsonPreview() {
        // 收集表单数据
        const formData = new FormData(this.form);
        const formValues = Object.fromEntries(formData.entries());
        const detailCount = parseInt(formValues.detail_count || 1, 10);

        // 使用预制参数填充缺失字段
        const returnOrderCode = formValues.returnOrderCode || this.preset.returnOrderCode;
        const warehouseCode = formValues.warehouseCode || this.preset.warehouseCode;
        const closeStatus = formValues.CloseStatus || this.preset.CloseStatus;

        // 收集明细数据，使用预制参数填充缺失值
        const orderLines = [];
        for (let i = 1; i <= detailCount; i++) {
            const itemCode = formValues[`itemCode${i}`] || `${this.preset.itemCode}${i}`;
            const actualQty = formValues[`actualQty${i}`] || this.preset.actualQty;

            orderLines.push({
                itemCode: itemCode,
                actualQty: actualQty,
                inventoryType: 'ZP',
                orderLineNo: i.toString(),
                ownerCode: 'XIER'
            });
        }

        // 获取当前时间
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const currentTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

        // 构建最终JSON
        const finalJson = {
            type: 2,
            returnOrderCode: returnOrderCode,
            callbackResponse: {
                apiMethodName: 'returnorder.confirm',
                orderLines: orderLines,
                extendProps: {
                    CloseStatus: closeStatus,
                    ApiSource: 'FLUXWMS'
                },
                responseClass: 'com.qimen.api.response.ReturnorderConfirmResponse',
                returnOrder: {
                    orderConfirmTime: currentTime,
                    orderType: 'THRK',
                    outBizCode: '',
                    ownerCode: 'XIER',
                    remark: '',
                    returnOrderCode: returnOrderCode,
                    warehouseCode: warehouseCode
                },
                version: '2.0'
            }
        };

        this.jsonPreview.textContent = JSON.stringify(finalJson, null, 2);
    }

    handleSubmit(e) {
        e.preventDefault();

        // 使用Fetch API提交表单
        fetch('/return_order_notice/submit', {
            method: 'POST',
            body: new FormData(this.form)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // 更新JSON预览
                this.updateJsonPreview();
                this.successModal.show();
            } else {
                this.errorMessage.textContent = data.message;
                this.errorModal.show();
            }
        })
        .catch(error => {
            this.errorMessage.textContent = `提交失败: ${error.message}`;
            this.errorModal.show();
        });
    }

    copyJson() {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = this.jsonPreview.textContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('JSON已复制到剪贴板', 'success');
        } catch (error) {
            console.error('复制失败:', error);
            this.showToast('复制失败，请手动复制', 'error');
        }
    }

    toggleJsonExpansion() {
        const currentText = this.jsonPreview.textContent;
        try {
            const jsonObj = JSON.parse(currentText);
            if (currentText.includes('\n')) {
                // 折叠
                this.jsonPreview.textContent = JSON.stringify(jsonObj);
                this.expandJsonBtn.innerHTML = '<i class="fas fa-expand me-1"></i>展开';
            } else {
                // 展开
                this.jsonPreview.textContent = JSON.stringify(jsonObj, null, 2);
                this.expandJsonBtn.innerHTML = '<i class="fas fa-compress me-1"></i>折叠';
            }
        } catch (e) {
            // 不是有效的JSON，不做处理
        }
    }

    resetForm() {
        this.form.reset();
        this.detailCountInput.value = 1;
        this.generateDetailFields();
        this.updateJsonPreview();
        this.showToast('表单已重置', 'info');
    }

    debounce(func, wait) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(func, wait);
    }

    showToast(message, type = 'info') {
        // 创建toast元素
        const toastContainer = document.createElement('div');
        toastContainer.className = `toast fade show position-fixed top-20 end-0 p-3 bg-${type} text-white z-50`;
        toastContainer.setAttribute('role', 'alert');
        toastContainer.setAttribute('aria-live', 'assertive');
        toastContainer.setAttribute('aria-atomic', 'true');
        toastContainer.style.minWidth = '250px';

        toastContainer.innerHTML = `
            <div class="toast-header bg-${type} text-white border-0">
                <strong class="me-auto">提示</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;

        document.body.appendChild(toastContainer);

        // 自动关闭
        setTimeout(() => {
            toastContainer.classList.remove('show');
            toastContainer.classList.add('hide');
            setTimeout(() => {
                document.body.removeChild(toastContainer);
            }, 500);
        }, 3000);
    }
}

// 确保Bootstrap已加载
if (typeof bootstrap === 'undefined') {
    console.error('Bootstrap is not loaded!');
}