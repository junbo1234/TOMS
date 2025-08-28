# 测试数据生成平台

# 测试数据生成平台

一个基于Flask的测试数据生成平台，支持多种订单类型的创建和消息推送，通过RabbitMQ进行消息队列处理，适用于OMS系统的测试数据生成。

## 项目结构

```
测试数据生成平台/
├── app/                          # 应用主目录
│   ├── __init__.py              # Flask应用工厂
│   ├── routes/                  # 路由模块
│   │   ├── dashboard.py         # 仪表盘路由
│   │   ├── exchange_order.py    # 换货单路由
│   │   ├── order_delivery.py    # 销售订单发货路由
│   │   ├── order_download.py    # 订单下载路由
│   │   ├── refund_order.py      # 退款单生成路由
│   │   ├── return_order_entry.py # 退货单入库路由
│   │   ├── return_order_notice.py # 通知单入库路由
│   │   └── stockout_push.py     # 出库单推送路由
│   ├── static/                  # 静态资源
│   │   ├── CSS/                 # 样式文件
│   │   └── js/                  # JavaScript文件
│   ├── templates/               # 模板文件
│   └── utils/                   # 工具模块
│       ├── dashboard_data.py    # 仪表盘数据工具
│       └── rabbitmq.py          # RabbitMQ工具类
├── .env                         # 环境变量配置文件
├── .env.example                 # 环境变量示例
├── .idea/                       # IDE配置
├── .venv/                       # 虚拟环境
├── __pycache__/                 # 编译缓存
├── config.py                    # 配置文件
├── README.md                    # 项目说明
├── requirements.txt             # 依赖包列表
└── run.py                       # 应用启动文件
```

## 功能特性

### 1. 订单下载功能
- 支持动态生成订单数据
- 可配置商品明细数量
- 实时JSON预览
- 消息推送到RabbitMQ队列 `oms_sales_order_download_queue`

### 2. 销售订单回传功能
- 支持JSON格式数据提交
- 数据验证和错误处理
- 消息推送到RabbitMQ队列 `sale_order_add_back`

### 3. 退款单生成功能
- 退款信息表单提交
- 自动计算退款金额
- 消息推送到RabbitMQ队列 `oms_return_order_download_queue`

### 4. 通知单入库功能
- 退货通知信息管理
- 消息推送到RabbitMQ队列 `sale_return_plan_add_back_b2c`

### 5. 出库单推送功能
- 出库信息表单提交
- 消息推送到RabbitMQ队列 `purchase_return_plan_add_back`

### 6. 退货单入库功能
- 退货入库信息管理
- 消息推送到RabbitMQ队列 `sale_return_plan_add_back`

### 7. 换货单生成功能
- 换货信息表单提交
- 支持换入换出商品明细配置
- 实时JSON预览与校验
- 消息推送到RabbitMQ队列 `oms_exchange_order_download_queue`

### 8. RabbitMQ集成
- 连接池管理
- 自动重试机制
- 消息持久化
- 死信队列支持

## 安装和配置

### 1. 安装依赖
```bash
# 创建虚拟环境（可选）
python3 -m venv .venv
# 激活虚拟环境
# macOS/Linux
source .venv/bin/activate
# Windows
# .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 环境配置
复制 `.env.example` 为 `.env` 文件，并配置以下参数：

```bash
# RabbitMQ配置
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=oms_test

# Flask配置
FLASK_ENV=development
FLASK_DEBUG=True
```

### 3. 启动应用
```bash
python run.py
```

应用将在 `http://192.168.52.42:5000` 启动（绑定到本地IP，确保局域网可访问）

## 局域网访问配置

为确保在VPN环境下局域网内其他电脑也能访问本应用，已在 `run.py` 中明确绑定到本地IP：

```python
# run.py 中的配置
app.run(
    host='192.168.52.42',  # 明确绑定到本地网络IP
    port=config.PORT,
    debug=config.DEBUG
)
```

其他电脑可通过 `http://192.168.52.42:5000` 访问本应用。如果需要修改绑定IP，可在 `run.py` 中调整 `host` 参数。

## API接口

### 1. 公共接口

**页面访问：**
- GET `/` - 首页（重定向到仪表盘）
- GET `/dashboard/` - 仪表盘页面

### 2. 订单下载接口

**页面访问：**
- GET `/order_download/` - 订单下载页面

**数据提交：**
- POST `/order_download/submit` - 提交订单数据

**请求参数：**
```json
{
  "address": "收货地址",
  "platformOrderNo": "平台订单号",
  "storeId": "店铺ID",
  "platformPayTime": "支付时间",
  "detail_count": "明细数量",
  "sku0": "商品SKU",
  "platformNo0": "平台商品编号",
  "qty0": "购买数量"
}
```

### 3. 销售订单回传接口

**页面访问：**
- GET `/order_delivery/` - 销售订单发货页面

**数据提交：**
- POST `/order_delivery/submit` - 提交销售订单发货数据

### 4. 退款单生成接口

**页面访问：**
- GET `/refund_order/` - 退款单生成页面

**数据提交：**
- POST `/refund_order/submit` - 提交退款单数据

### 5. 通知单入库接口

**页面访问：**
- GET `/return_order_notice/` - 通知单入库页面

**数据提交：**
- POST `/return_order_notice/submit` - 提交通知单入库数据

### 6. 出库单推送接口

**页面访问：**
- GET `/stockout_push/` - 出库单推送页面

**数据提交：**
- POST `/stockout_push/submit` - 提交出库单数据

### 7. 退货单入库接口

**页面访问：**
- GET `/return_order_entry/` - 退货单入库页面

**数据提交：**
- POST `/return_order_entry/submit` - 提交退货单入库数据

### 8. 换货单生成接口

**页面访问：**
- GET `/exchange_order/` - 换货单生成页面

**数据提交：**
- POST `/exchange_order/submit` - 提交换货单数据

## 更新日志

### 2025-08-01
- 优化了局域网访问配置，明确绑定到本地IP
- 修复了换货单JSON预览中platformNo字段为空的问题
- 完善了API接口文档

### 2025-07-31
- 完成基础功能开发，包括订单下载、销售订单回传等
- 集成RabbitMQ消息队列
- 实现了动态表单和JSON预览功能

## 注意事项

1. 确保RabbitMQ服务已启动并配置正确
2. 在VPN环境下，可能需要调整网络设置以确保局域网访问正常
3. 开发环境下使用了Flask的调试模式，生产环境请关闭DEBUG模式
4. 本应用仅用于测试目的，请勿在生产环境中使用

### 销售订单回传接口

**页面访问：**
- GET `/order_delivery/` - 销售订单发货页面

**数据提交：**
- POST `/order_delivery/submit` - 提交发货数据

**请求格式：**
```json
{
  "callbackResponse": {
    "apiMethodName": "deliveryorder.confirm",
    "deliveryOrder": {
      "deliveryOrderCode": "订单编码",
      "deliveryOrderId": "订单ID",
      "warehouseCode": "仓库编码"
    }
  }
}
```

## 技术栈

- **后端框架**: Flask 3.1.1
- **消息队列**: RabbitMQ (pika 1.3.2)
- **配置管理**: python-dotenv 1.0.0
- **表单处理**: WTForms 3.2.1

## 优化特性

### 1. 代码结构优化
- 使用蓝图模式分离路由
- 统一的配置管理
- 模块化的工具类

### 2. 错误处理
- 完善的异常捕获
- 详细的错误日志
- 用户友好的错误提示

### 3. 性能优化
- RabbitMQ连接池
- 消息持久化
- 自动重试机制

### 4. 安全性
- 环境变量配置
- 输入验证
- 敏感信息脱敏

## 开发说明

### 添加新功能
1. 在 `app/routes/` 下创建新的路由文件
2. 在 `config.py` 中添加相关配置
3. 在 `app/__init__.py` 中注册蓝图

### 修改配置
- 修改 `config.py` 中的配置项
- 更新 `.env` 文件中的环境变量

### 日志查看
应用运行时会输出详细的日志信息，包括：
- RabbitMQ连接状态
- 消息推送结果
- 错误和异常信息

## 故障排除

### 常见问题

1. **RabbitMQ连接失败**
   - 检查RabbitMQ服务是否启动
   - 验证连接参数是否正确
   - 确认网络连接正常

2. **消息推送失败**
   - 检查队列是否存在
   - 验证队列参数配置
   - 查看错误日志

3. **模板渲染错误**
   - 确认模板文件路径正确
   - 检查模板语法
   - 验证传递的数据格式

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License