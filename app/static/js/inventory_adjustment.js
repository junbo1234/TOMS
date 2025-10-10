/**
 * 库存调整页面JavaScript
 * 现代化的商务风格交互体验
 */

class InventoryAdjustmentManager {
    constructor() {
        this.form = document.getElementById('inventory-adjustment-form');
        this.skuCodeInput = document.getElementById('skuCode');
        this.quantityInput = document.getElementById('quantity');
        this.warehouseCodeInput = document.getElementById('warehouseCode');
        this.apiEnvSelect = document.getElementById('apiEnv');
        this.jsonPreview = document.getElementById('json-preview');
        this.resultCard = document.getElementById('result-card');
        this.resultStatus = document.getElementById('result-status');
        this.resultContent = document.getElementById('result-content');
        this.submitBtn = document.getElementById('submit-btn');
        this.previewBtn = document.getElementById('preview-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.copyJsonBtn = document.getElementById('copy-json-btn');
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadPresetData();
    }

    bindEvents() {
        // 表单提交
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // 输入变化时更新预览
        [this.skuCodeInput, this.quantityInput, this.warehouseCodeInput, this.apiEnvSelect].forEach(element => {
            element.addEventListener('input', () => this.updateJsonPreview());
            element.addEventListener('change', () => this.updateJsonPreview());
        });
        
        // 预览按钮
        this.previewBtn.addEventListener('click', () => {
            this.updateJsonPreview();
            this.showToast('参数预览已更新', 'info');
        });
        
        // 重置按钮
        this.resetBtn.addEventListener('click', () => {
            this.form.reset();
            this.resultCard.style.display = 'none';
            this.jsonPreview.textContent = '{}';
            this.showToast('表单已重置', 'info');
        });
        
        // 复制JSON按钮
        this.copyJsonBtn.addEventListener('click', () => {
            const jsonText = this.jsonPreview.textContent;
            navigator.clipboard.writeText(jsonText).then(() => {
                this.showToast('参数已复制到剪贴板', 'success');
            }).catch(() => {
                this.showToast('复制失败，请手动复制', 'error');
            });
        });
    }

    loadPresetData() {
        // 加载预设数据用于预览
        console.log('开始加载预设数据...');
        fetch('/inventory_adjustment/get-preset')
            .then(response => {
                console.log('获取预设数据响应状态:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP错误! 状态: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('获取预设数据成功:', data);
                if (data.status === 'success') {
                    this.jsonPreview.textContent = JSON.stringify(data.data, null, 2);
                } else {
                    console.error('预设数据状态错误:', data.status);
                    this.showToast('加载预设数据失败: ' + data.message, 'error');
                    // 如果没有获取到预设数据，使用默认示例数据
                    this.updateJsonPreview();
                }
            })
            .catch(error => {
                console.error('加载预设数据失败:', error);
                this.showToast('加载预设数据失败: ' + error.message, 'error');
                // 如果请求失败，使用默认示例数据
                this.updateJsonPreview();
            });
    }

    updateJsonPreview() {
        // 获取表单数据
        const skuCode = this.skuCodeInput.value.trim();
        const quantity = parseInt(this.quantityInput.value) || 0;
        const warehouseCode = this.warehouseCodeInput.value.trim();
        const apiEnv = this.apiEnvSelect.value;
        
        // 如果没有输入，使用示例数据
        const currentTime = new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/\//g, '-');
        
        const businessNo = Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0');
        const sourceCode = `${businessNo}112`;
        
        // 构建预览参数
        const previewData = {
            "appointmentNo": "",
            "businessNo": skuCode ? businessNo : "6926523473692",
            "checkMethod": "20",
            "detailList": [
                {
                    "actualArrivalNumber": quantity || 150000,
                    "batchCode": "1",
                    "lineNo": "1",
                    "planArrivalNumber": quantity || 150000,
                    "productDate": "2025-07-01",
                    "sampleQuality": 7,
                    "skuCode": skuCode || "6926523473692",
                    "sourceCode": sourceCode,
                    "volume": 1,
                    "weight": 1
                }
            ],
            "forecastArrivalTime": currentTime,
            "forecastDeliveryTime": currentTime,
            "isCallCar": 0,
            "orderCreator": "LY",
            "remark": "LY",
            "sourceType": "WWJG",
            "supplierCode": "CO00049541",
            "totalVolume": 1,
            "totalWeight": 1,
            "warehouseCode": warehouseCode || "DCN",
            "warehouseOutCode": warehouseCode || "DCN"
        };
        
        // 更新预览
        this.jsonPreview.textContent = JSON.stringify(previewData, null, 2);
    }

    handleSubmit(e) {
        e.preventDefault();
        
        // 验证表单
        if (!this.form.checkValidity()) {
            e.stopPropagation();
            this.form.classList.add('was-validated');
            this.showToast('请填写所有必填字段', 'error');
            console.log('表单验证失败，存在必填字段未填写');
            return;
        }
        
        // 获取表单数据
        const formData = new FormData(this.form);
        const formValues = Object.fromEntries(formData.entries());
        
        // 显示加载状态
        this.submitBtn.disabled = true;
        this.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>处理中...';
        
        // 提交请求
        console.log('开始提交库存调整请求，表单数据:', formValues);
        console.log('当前选择的API环境:', this.apiEnvSelect.value);
        
        fetch('/inventory_adjustment/submit', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log('接口响应状态码:', response.status);
            console.log('接口响应头信息:', response.headers);
            
            if (!response.ok) {
                throw new Error(`HTTP错误! 状态码: ${response.status}`);
            }
            
            return response.json().then(data => ({
                data: data,
                response: response
            }));
        })
        .then(({ data, response }) => {
            console.log('接口调用成功，完整响应数据:', data);
            
            // 显示结果
            this.resultCard.style.display = 'block';
            
            if (data.status === 'success') {
                this.resultStatus.className = 'badge bg-success';
                this.resultStatus.textContent = '成功';
                this.resultContent.textContent = JSON.stringify(data, null, 2);
                this.showToast(data.message || '请求成功', 'success');
                console.log('请求成功，返回消息:', data.message);
            } else {
                this.resultStatus.className = 'badge bg-danger';
                this.resultStatus.textContent = '失败';
                this.resultContent.textContent = JSON.stringify(data, null, 2);
                this.showToast(data.message || '请求失败', 'error');
                console.log('请求失败，返回状态:', data.status, '返回消息:', data.message);
            }
        })
        .catch(error => {
            console.error('接口调用失败，错误详情:', error);
            this.resultCard.style.display = 'block';
            this.resultStatus.className = 'badge bg-danger';
            this.resultStatus.textContent = '错误';
            this.resultContent.textContent = `请求处理失败: ${error.message}`;
            this.showToast('网络请求失败: ' + error.message, 'error');
        })
        .finally(() => {
            // 恢复按钮状态
            this.submitBtn.disabled = false;
            this.submitBtn.innerHTML = '<i class="fas fa-paper-plane me-1"></i>生成';
            console.log('请求处理完成，按钮状态已恢复');
        });
    }

    showToast(message, type = 'info') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white ${this.getToastClass(type)} border-0 position-fixed bottom-5 right-5 z-50`;
        toast.role = 'alert';
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        const iconClass = this.getToastIcon(type);
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="${iconClass} mr-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        // 添加到body
        document.body.appendChild(toast);
        
        // 显示toast
        const bootstrapToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 3000
        });
        bootstrapToast.show();
        
        // 自动移除
        setTimeout(() => {
            toast.remove();
        }, 3500);
    }

    getToastClass(type) {
        const classes = {
            success: 'bg-success',
            error: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-info'
        };
        return classes[type] || classes.info;
    }

    getToastIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new InventoryAdjustmentManager();
});