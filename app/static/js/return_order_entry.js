/**
 * 退货单入库管理器 - 重构版
 * 负责处理退货单入库页面的所有交互逻辑
 */
console.log('return_order_entry.js 文件已加载');

class ReturnOrderEntryManager {
  constructor() {
    // 初始化表单元素
    this.form = document.getElementById('entry-form');
    this.detailCountInput = document.getElementById('detail-count');
    this.detailCountBadge = document.getElementById('detail-count-badge');
    this.detailFieldsContainer = document.getElementById('detail-fields');
    this.previewBtn = document.getElementById('preview-btn');
    this.resetBtn = document.getElementById('reset-btn');
    this.jsonPreview = document.getElementById('json-preview');
    this.copyBtn = document.getElementById('copy-json');
    this.expandBtn = document.getElementById('expand-json');
    this.successModal = new bootstrap.Modal(document.getElementById('successModal'));
    this.errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
    this.errorMessage = document.getElementById('error-message');

    // 初始化预设数据
    this.presetData = null;
    this.isJsonExpanded = false;

    // 绑定事件
    this.bindEvents();

    // 初始化页面
    this.init();
  }

  /**
   * 初始化页面
   */
  async init() {
    console.log('ReturnOrderEntryManager.init() 方法开始执行');
    try {
      console.log('1. 开始初始化ReturnOrderEntryManager');
      // 加载预设数据
      console.log('2. 开始加载预设数据');
      await this.fetchPreset();
      console.log('3. 预设数据加载成功:', this.presetData);

      // 生成初始明细
      console.log('4. 开始生成商品明细');
      this.generateDetails();
      console.log('5. 商品明细生成完成');

      // 恢复保存的表单数据（如果有）
      console.log('6. 开始恢复表单数据');
      this.restoreFormData();
      console.log('7. 表单数据恢复完成');

      // 更新JSON预览
      console.log('8. 开始更新JSON预览');
      this.updateJsonPreview();
      console.log('9. JSON预览更新完成');
    } catch (error) {
      console.error('初始化失败:', error);
      this.showToast('初始化失败: ' + error.message, 'error');
    }
    console.log('ReturnOrderEntryManager.init() 方法执行完成');
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 明细数量变化事件
    this.detailCountInput.addEventListener('change', () => this.handleDetailCountChange());

    // 表单提交事件
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // 预览按钮点击事件
    this.previewBtn.addEventListener('click', () => this.updateJsonPreview(true));

    // 重置按钮点击事件
    this.resetBtn.addEventListener('click', () => this.resetForm());

    // 复制JSON按钮点击事件
    this.copyBtn.addEventListener('click', () => this.copyJson());

    // 展开/折叠JSON按钮点击事件
    this.expandBtn.addEventListener('click', () => this.toggleJsonExpand());

    // 实时监听表单变化，更新JSON预览
    this.form.addEventListener('input', this.debounce(() => this.updateJsonPreview(), 300));
  }

  /**
   * 获取预设参数
   */
  async fetchPreset() {
    try {
      const response = await fetch('/return_order_entry/preset');
      if (!response.ok) throw new Error('获取预设数据失败');

      const data = await response.json();
      if (data.status !== 'success') throw new Error(data.message || '获取预设数据失败');

      this.presetData = data.preset;
      console.log('预设数据加载成功:', this.presetData);
    } catch (error) {
      console.error('获取预设数据失败:', error);
      throw error;
    }
  }

  /**
   * 处理明细数量变化
   */
  handleDetailCountChange() {
    const count = parseInt(this.detailCountInput.value) || 1;
    this.detailCountBadge.textContent = `${count} 项`;
    this.generateDetails();
    this.updateJsonPreview();
  }

  /**
   * 生成商品明细字段
   */
  generateDetails() {
    console.log('generateDetails方法被调用');
    // 清空现有明细
    this.detailFieldsContainer.innerHTML = '';
    console.log('已清空现有明细');

    const count = parseInt(this.detailCountInput.value) || 1;
    console.log('要生成的明细行数:', count);
    console.log('detailFieldsContainer是否存在:', !!this.detailFieldsContainer);
    // 如果没有配置，则使用默认字段配置
    let fieldsConfig = [];
    try {
      console.log('尝试解析data-fields属性');
      fieldsConfig = JSON.parse(this.detailCountInput.dataset.fields) || [];
      console.log('字段配置解析成功:', fieldsConfig);
    } catch (error) {
      console.error('解析字段配置失败，使用默认配置:', error);
      // 默认字段配置
      fieldsConfig = [
        { idPrefix: 'itemCode', namePrefix: 'itemCode', label: '商品编码', icon: 'fas fa-barcode', required: true },
        { idPrefix: 'planQty', namePrefix: 'planQty', label: '计划数量', icon: 'fas fa-calculator', required: true, type: 'number', min: 0 },
        { idPrefix: 'actualQty', namePrefix: 'actualQty', label: '实际数量', icon: 'fas fa-box-open', required: true, type: 'number', min: 0 }
      ];
      console.log('使用默认字段配置:', fieldsConfig);
    }

    // 创建表头
    console.log('开始创建表头');
    const headerRow = document.createElement('div');
    headerRow.className = 'row mb-2 font-weight-bold text-center';
    fieldsConfig.forEach((field) => {
      const headerCol = document.createElement('div');
      headerCol.className = 'col-md';
      headerCol.textContent = field.label + (field.required ? ' *' : '');
      headerRow.appendChild(headerCol);
    });
    this.detailFieldsContainer.appendChild(headerRow);
    console.log('表头已添加到容器');
    console.log('当前容器子元素数量:', this.detailFieldsContainer.children.length);

    // 生成每行明细
    console.log('开始生成', count, '行明细');
    for (let i = 0; i < count; i++) {
      console.log('生成第', i+1, '行明细');
      const row = document.createElement('div');
      row.className = 'row mb-3 align-items-center detail-row';
      row.dataset.index = i;

      fieldsConfig.forEach((field) => {
        const col = document.createElement('div');
        col.className = 'col-md';

        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';

        const inputGroupText = document.createElement('span');
        inputGroupText.className = 'input-group-text';
        inputGroupText.innerHTML = `<i class="${field.icon}"></i>`;

        const input = document.createElement('input');
        input.type = field.type || 'text';
        input.className = 'form-control';
        input.id = `${field.idPrefix}${i}`;
        input.name = `${field.namePrefix}${i}`;
        input.placeholder = field.placeholder || '';
        input.required = field.required || false;
        if (field.min !== undefined) input.min = field.min;

        // 如果是实际数量，默认与计划数量相同
        if (field.idPrefix === 'actualQty') {
          const planQtyId = `planQty${i}`;
          input.addEventListener('focus', () => {
            if (!input.value) {
              const planQtyInput = document.getElementById(planQtyId);
              if (planQtyInput) input.value = planQtyInput.value;
            }
          });
        }

        // 如果是日期类型，设置默认值为今天
        if (field.type === 'date' && !input.value) {
          const today = new Date().toISOString().slice(0, 10);
          input.value = today;
        }

        inputGroup.appendChild(inputGroupText);
        inputGroup.appendChild(input);
        col.appendChild(inputGroup);
        row.appendChild(col);
      });

      this.detailFieldsContainer.appendChild(row);
      console.log('第', i+1, '行明细已添加到容器');
    }
    console.log('明细生成完成，容器子元素总数:', this.detailFieldsContainer.children.length);
    if (this.detailFieldsContainer.children.length <= 1) {
      console.error('没有生成任何明细行或只生成了表头');
      this.showToast('商品明细生成异常，请检查配置', 'warning');
    }
  }

  /**
   * 处理表单提交
   */
  async handleSubmit(e) {
    e.preventDefault();

    // 验证表单
    if (!this.form.checkValidity()) {
      e.stopPropagation();
      this.form.classList.add('was-validated');
      this.showToast('请填写所有必填字段', 'warning');
      return;
    }

    try {
      // 禁用提交按钮，防止重复提交
      const submitBtn = this.form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>处理中...';

      // 收集表单数据
      const formData = this.collectFormData();

      // 提交数据
      const response = await fetch('/return_order_entry/submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(formData)
      });

      // 创建用于打印的JSON对象（不包含detail_count和detail_i字段）
      const printData = {
        callbackResponse: formData.callbackResponse,
        outOrderCode: formData.outOrderCode,
        type: formData.type
      };

      // 打印最终推送给RabbitMQ的JSON（仅包含必要字段）
      console.log('最终推送给RabbitMQ的JSON数据:', printData);


      const result = await response.json();

      if (result.status === 'success') {
        this.showToast('退货单入库数据已成功推送', 'success');
        this.successModal.show();
        this.saveFormData(); // 保存表单数据
      } else {
        throw new Error(result.message || '提交失败');
      }
    } catch (error) {
      console.error('提交失败:', error);
      this.errorMessage.textContent = error.message;
      this.errorModal.show();
    } finally {
      // 恢复提交按钮状态
      const submitBtn = this.form.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>生成并推送数据';
    }
  }

  /**
   * 收集表单数据
   */
  collectFormData() {
    const now = new Date();
    const formattedDateTime = now.toISOString().replace('T', ' ').slice(0, 19);
    const formattedDate = now.toISOString().slice(0, 10);
    const entryOrderCode = document.getElementById('entryOrderCode').value || `RO${now.getTime()}`;

    const data = {
      callbackResponse: {
        apiMethodName: "entryorder.confirm",
        entryOrder: {
          confirmType: 0,
          entryOrderCode: entryOrderCode,
          entryOrderId: entryOrderCode,
          entryOrderType: "B2BRK",
          operateTime: formattedDateTime,
          outBizCode: entryOrderCode,
          ownerCode: "NEWTESTXIER",
          remark: "",
          status: "PARTFULFILLED",
          warehouseCode: document.getElementById('warehouseCode').value || "DCN"
        },
        orderLines: [],
        responseClass: "com.qimen.api.response.EntryorderConfirmResponse",
        version: "2.0",
        outOrderCode: entryOrderCode
      },
      outOrderCode: "",
      type: 2,
      detail_count: this.detailCountInput ? parseInt(this.detailCountInput.value) || 1 : 1
    };

    // 收集明细数据
    const count = data.detail_count;
    for (let i = 0; i < count; i++) {
      const itemCodeElem = document.getElementById(`itemCode${i}`);
      const planQtyElem = document.getElementById(`planQty${i}`);
      const actualQtyElem = document.getElementById(`actualQty${i}`);

      if (itemCodeElem && planQtyElem && actualQtyElem) {
        // 添加到orderLines数组（满足用户提供的结构）
        data.callbackResponse.orderLines.push({
          actualQty: actualQtyElem.value || planQtyElem.value,
          batchCode: "",
          expireDate: "",
          inventoryType: "ZP",
          itemCode: itemCodeElem.value,
          itemId: "",
          itemName: "儿童折叠滑板车", // 默认名称
          orderLineNo: String(i + 1),
          outBizCode: "",
          ownerCode: "NEWTESTXIER",
          planQty: planQtyElem.value,
          produceCode: "",
          productDate: ""
        });

        // 添加到detail_i字段（满足后端API要求）
        data[`detail_${i}`] = {
          itemCode: itemCodeElem.value,
          planQty: planQtyElem.value,
          actualQty: actualQtyElem.value || planQtyElem.value
        };
      } else {
        console.warn(`未找到明细项 ${i} 的必要字段，跳过该明细`);
      }
    }

    return data;
  }

  /**
   * 更新JSON预览
   */
  updateJsonPreview(forceExpand = false) {
    try {
      // 收集表单数据
      const formData = this.collectFormData();

      // 创建符合模板结构的预览数据
      const previewData = {
        callbackResponse: formData.callbackResponse,
        outOrderCode: formData.outOrderCode,
        type: formData.type
      };

      // 格式化JSON
      const jsonString = JSON.stringify(previewData, null, 2);

      // 更新预览
      if (forceExpand || this.isJsonExpanded) {
        this.jsonPreview.textContent = jsonString;
      } else {
        // 只显示前几行
        const lines = jsonString.split('\n');
        const previewLines = lines.slice(0, 15);
        if (lines.length > 15) {
          previewLines.push('// ... 更多内容请点击展开 ...');
        }
        this.jsonPreview.textContent = previewLines.join('\n');
      }

      // 高亮JSON
      hljs.highlightElement(this.jsonPreview);
    } catch (error) {
      console.error('更新JSON预览失败:', error);
      this.jsonPreview.textContent = '// 生成预览失败: ' + error.message;
    }
  }

  /**
   * 切换JSON展开/折叠状态
   */
  toggleJsonExpand() {
    this.isJsonExpanded = !this.isJsonExpanded;
    this.expandBtn.innerHTML = this.isJsonExpanded
      ? '<i class="fas fa-compress me-1"></i>折叠'
      : '<i class="fas fa-expand me-1"></i>展开';
    this.updateJsonPreview();
  }

  /**
   * 复制JSON到剪贴板
   */
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

  /**
   * 重置表单
   */
  resetForm() {
    this.form.reset();
    this.form.classList.remove('was-validated');
    this.detailCountInput.value = 1;
    this.detailCountBadge.textContent = '1 项';
    this.generateDetails();
    this.updateJsonPreview();
    localStorage.removeItem('returnOrderEntryFormData');
    this.showToast('表单已重置', 'info');
  }

  /**
   * 保存表单数据到本地存储
   */
  saveFormData() {
    try {
      const formData = this.collectFormData();
      localStorage.setItem('returnOrderEntryFormData', JSON.stringify(formData));
    } catch (error) {
      console.error('保存表单数据失败:', error);
    }
  }

  /**
   * 从本地存储恢复表单数据
   */
  restoreFormData() {
    try {
      const savedData = localStorage.getItem('returnOrderEntryFormData');
      if (savedData) {
        const formData = JSON.parse(savedData);

        // 恢复基础字段
        if (formData.callbackResponse && formData.callbackResponse.entryOrder) {
          document.getElementById('entryOrderCode').value = formData.callbackResponse.entryOrder.entryOrderCode || '';
          document.getElementById('warehouseCode').value = formData.callbackResponse.entryOrder.warehouseCode || '';
          document.getElementById('ownerCode').value = formData.callbackResponse.entryOrder.ownerCode || '';
          document.getElementById('orderType').value = formData.callbackResponse.entryOrder.orderType || '';
          document.getElementById('sourceOrderCode').value = formData.callbackResponse.entryOrder.sourceOrderCode || '';
          document.getElementById('entryTime').value = formData.callbackResponse.entryOrder.entryTime || '';
        }

        // 恢复明细数量
        if (formData.detail_count) {
          this.detailCountInput.value = formData.detail_count;
          this.detailCountBadge.textContent = `${formData.detail_count} 项`;
          this.generateDetails();

          // 恢复明细数据
          const count = parseInt(formData.detail_count) || 0;
          for (let i = 0; i < count; i++) {
            const detail = formData[`detail_${i}`];
            if (detail) {
              document.getElementById(`itemCode${i}`).value = detail.itemCode || '';
              document.getElementById(`planQty${i}`).value = detail.planQty || '';
              document.getElementById(`actualQty${i}`).value = detail.actualQty || '';
              document.getElementById(`batchCode${i}`).value = detail.batchCode || '';
              document.getElementById(`productDate${i}`).value = detail.productDate || '';
              document.getElementById(`expireDate${i}`).value = detail.expireDate || '';
              document.getElementById(`shelfCode${i}`).value = detail.shelfCode || '';
            }
          }
        }
      }
    } catch (error) {
      console.error('恢复表单数据失败:', error);
    }
  }

  /**
   * 显示提示消息
   */
  showToast(message, type = 'info') {
    // 创建toast元素
    const toastContainer = document.createElement('div');
    toastContainer.className = `toast position-fixed top-0 end-0 m-4 bg-${type} text-white`;
    toastContainer.role = 'alert';
    toastContainer.ariaLive = 'assertive';
    toastContainer.ariaAtomic = 'true';
    toastContainer.innerHTML = `
      <div class="toast-header bg-${type} text-white border-0">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
        <strong class="me-auto">${type === 'success' ? '成功' : type === 'error' ? '错误' : type === 'warning' ? '警告' : '信息'}</strong>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    `;

    document.body.appendChild(toastContainer);

    // 显示toast
    const toast = new bootstrap.Toast(toastContainer);
    toast.show();

    // 自动关闭后移除元素
    setTimeout(() => {
      toastContainer.remove();
    }, 5000); // 5秒后自动移除

    // 手动关闭按钮事件监听
    const closeBtn = toastContainer.querySelector('.btn-close');
    closeBtn.addEventListener('click', () => {
      toastContainer.remove();
    });
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
}

console.log('等待DOM加载完成...');
// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM加载完成，开始初始化ReturnOrderEntryManager');
  try {
    const returnOrderEntryManager = new ReturnOrderEntryManager();
    console.log('ReturnOrderEntryManager 实例创建成功');
  } catch (error) {
    console.error('创建ReturnOrderEntryManager实例失败:', error);
  }

});