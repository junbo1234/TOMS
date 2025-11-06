# 测试数据生成平台 (TOMS)

一个基于Flask的高效测试数据生成平台，专为OMS系统测试设计，支持多种订单类型的创建、配置和消息推送，通过RabbitMQ实现可靠的消息队列处理。

## 项目概述

TOMS (Test Order Management System) 是一个功能完整的测试数据生成平台，旨在为OMS系统提供标准化、可配置的测试数据。平台采用模块化设计，支持多种业务场景的数据生成，并通过RabbitMQ实现与被测系统的高效集成。

## 项目特点

- **全类型订单支持**：涵盖销售订单、退款单、退货单、换货单、调拨单等12种订单类型
- **可视化配置**：直观的Web界面，支持动态表单和实时JSON预览
- **可靠消息传递**：基于RabbitMQ的高可靠消息队列，支持消息持久化和重试机制
- **灵活的预设参数**：可配置的默认参数，提高测试效率
- **实时统计分析**：内置仪表盘，提供菜单访问统计和备忘录功能
- **局域网共享**：支持在局域网内多用户协作使用

## 项目结构

```
TOMS/
├── app/                          # 应用主目录
│   ├── __init__.py              # Flask应用工厂
│   ├── routes/                  # 路由模块
│   │   ├── dashboard.py         # 仪表盘路由
│   │   ├── allocation_in.py     # 调拨入库路由
│   │   ├── allocation_out.py    # 调拨出库路由
│   │   ├── exchange_order.py    # 换货单路由
│   │   ├── inventory_entry.py   # 其他入库路由
│   │   ├── inventory_out.py     # 其他出库路由
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
├── .gitignore                   # Git忽略文件
├── config.py                    # 配置文件
├── README.md                    # 项目说明
├── requirements.txt             # 依赖包列表
└── run.py                       # 应用启动文件
```

## 功能模块详解

### 1. 仪表盘
- 提供系统导航和功能入口
- 菜单访问统计和可视化展示
- 备忘录功能，支持快速记录测试要点
- 店铺ID查询功能，通过店铺Code查询对应的店铺ID和名称

### 2. 订单下载
- 动态生成销售订单数据
- 支持多商品明细配置
- 实时JSON预览
- 消息推送到 `oms_sales_order_download_queue` 队列

### 3. 销售订单发货
- 销售订单发货信息配置
- 物流信息自定义
- 消息推送到 `sale_order_add_back` 队列

### 4. 退款单生成
- 退款信息表单提交
- 自动计算退款金额
- 消息推送到 `oms_return_order_download_queue` 队列

### 5. 通知单入库
- 退货通知信息管理
- 退货原因和商品明细配置
- 消息推送到 `sale_return_plan_add_back_b2c` 队列

### 6. 出库单推送
- 出库信息表单提交
- 仓库和物流信息配置
- 消息推送到 `purchase_return_plan_add_back` 队列

### 7. 退货单入库
- 退货入库信息管理
- 退货商品状态和数量配置
- 消息推送到 `sale_return_plan_add_back` 队列

### 8. 换货单生成
- 换货信息表单提交
- 支持换入换出商品明细配置
- 实时JSON预览与校验
- 消息推送到 `oms_exchange_order_download_queue` 队列

### 9. 调拨入库
- 调拨入库信息管理
- 支持多商品明细配置
- 实时JSON预览
- 消息推送到 `entry_order_add_back_other` 队列

### 10. 调拨出库
- 调拨出库信息管理
- 支持多商品明细配置
- 实时JSON预览
- 消息推送到 `stock_out_back` 队列

### 11. 其他入库
- 其他入库信息管理
- 入库类型和商品明细配置
- 消息推送到 `inventory_return_order_back` 队列

### 12. 其他出库
- 其他出库信息管理
- 出库类型和商品明细配置
- 消息推送到对应队列

### 13. RabbitMQ消息队列
- 连接池管理和自动重连
- 消息发布确认和重试机制
- 消息持久化存储
- 死信队列支持
- 详细的日志记录

## 安装和配置

### 1. 安装依赖
```bash
# 创建虚拟环境（可选但推荐）
python3 -m venv .venv

# 激活虚拟环境
# macOS/Linux
source .venv/bin/activate
# Windows
# .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 3. 启动应用
```bash
python run.py
```

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

**仪表盘API：**
- POST `/dashboard/increment_menu_count` - 增加菜单访问计数
- GET `/dashboard/get_menu_stats` - 获取菜单访问统计
- POST `/dashboard/save_memo` - 保存备忘录
- GET `/dashboard/get_memo` - 获取备忘录

### 2. 业务接口

| 功能模块 | 页面访问 | 数据提交 | 推送队列 |
|---------|---------|---------|---------|
| 订单下载 | GET `/order_download/` | POST `/order_download/submit` | `oms_sales_order_download_queue` |
| 销售订单发货 | GET `/order_delivery/` | POST `/order_delivery/submit` | `sale_order_add_back` |
| 退款单生成 | GET `/refund_order/` | POST `/refund_order/submit` | `oms_return_order_download_queue` |
| 通知单入库 | GET `/return_order_notice/` | POST `/return_order_notice/submit` | `sale_return_plan_add_back_b2c` |
| 出库单推送 | GET `/stockout_push/` | POST `/stockout_push/submit` | `purchase_return_plan_add_back` |
| 退货单入库 | GET `/return_order_entry/` | POST `/return_order_entry/submit` | `sale_return_plan_add_back` |
| 换货单生成 | GET `/exchange_order/` | POST `/exchange_order/submit` | `oms_exchange_order_download_queue` |
| 调拨入库 | GET `/allocation_in/` | POST `/allocation_in/submit` | `entry_order_add_back_other` |
| 调拨出库 | GET `/allocation_out/` | POST `/allocation_out/submit` | `stock_out_back` |
| 其他入库 | GET `/inventory_entry/` | POST `/inventory_entry/submit` | `inventory_return_order_back` |
| 其他出库 | GET `/inventory_out/` | POST `/inventory_out/submit` | - |

## 技术栈

- **后端框架**：Flask 3.x
- **消息队列**：RabbitMQ
- **前端框架**：Bootstrap 5
- **HTTP客户端**：requests
- **数据可视化**：自定义统计图表
- **部署环境**：Python 3.8+

## 项目优化建议

### 1. 代码结构优化

#### 路由模块化重构
当前每个业务路由文件都包含相似的代码模式（表单验证、数据处理、消息推送），建议：

```python
# 推荐实现：创建基础路由类
class BaseOrderRoute:
    def __init__(self, queue_name, preset_config, template_name):
        self.queue_name = queue_name
        self.preset_config = preset_config
        self.template_name = template_name
    
    def validate_form(self, form_data):
        # 通用表单验证逻辑
        pass
    
    def process_data(self, form_data):
        # 数据处理逻辑
        pass
    
    def push_to_rabbitmq(self, data):
        # 消息推送逻辑
        pass
```

#### 配置管理优化
当前配置文件过于庞大，包含大量预设数据，建议：

1. 将预设数据分离到单独的配置文件
2. 使用YAML或JSON格式存储复杂配置结构
3. 实现配置热加载机制

### 2. 功能增强

#### 用户权限管理
增加基于角色的访问控制(RBAC)，区分管理员、普通用户等角色权限。

#### 数据模板管理
实现可保存、复用的数据模板功能：
```python
# 示例：数据模板管理接口
def save_template(name, template_data):
    # 保存数据模板到数据库或文件系统
    pass

def load_template(name):
    # 加载数据模板
    pass
```

#### 批量数据生成
支持批量生成测试数据，提高测试效率：
```python
def generate_batch_data(template, count):
    """根据模板批量生成count条数据"""
    results = []
    for i in range(count):
        data = generate_data_from_template(template, i)
        results.append(data)
    return results
```

#### 历史记录与回放
添加消息历史记录功能，支持查看和重新推送历史消息：
```python
# 保存消息历史
def save_message_history(queue_name, message, status):
    timestamp = datetime.now()
    # 保存消息到历史记录存储（数据库或文件）
    pass

# 重新推送历史消息
def replay_message_history(history_id):
    # 从历史记录加载消息并重新推送
    pass
```

### 3. 性能与稳定性优化

#### RabbitMQ连接池优化
当前的连接管理可以进一步优化：
```python
# 改进的连接池实现
class RabbitMQConnectionPool:
    def __init__(self, config, pool_size=5):
        self.config = config
        self.pool_size = pool_size
        self.connections = []
        self._lock = threading.Lock()
        self.initialize_pool()
    
    def initialize_pool(self):
        # 初始化连接池
        pass
    
    def get_connection(self):
        # 从池中获取连接
        pass
    
    def release_connection(self, connection):
        # 释放连接回池
        pass
```

#### 异步消息处理
使用异步处理模式提高系统吞吐量：
```python
# 使用线程池处理消息推送
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=10)

def async_push_message(queue_name, message):
    future = executor.submit(push_message, queue_name, message)
    future.add_done_callback(lambda f: handle_push_result(f.result()))
```

#### 错误处理与监控
增强系统监控和错误处理机制：

1. 添加应用性能监控
2. 实现详细的日志分级管理
3. 增加健康检查接口
4. 添加系统运行状态仪表盘

### 4. 前端体验优化

#### 响应式设计增强
优化在不同设备上的用户体验：

1. 完善移动端适配
2. 优化表单交互体验
3. 添加表单验证实时反馈

#### 数据可视化增强
增加更多的数据展示和分析功能：

1. 添加消息推送统计图表
2. 实现数据生成报表功能
3. 添加消息成功率分析

#### 交互效率优化
提升用户操作效率：

1. 增加快捷键支持
2. 优化表单填充体验
3. 添加拖拽排序功能

## 开发注意事项

1. **环境配置**：确保正确配置 `.env` 文件中的RabbitMQ连接参数
2. **依赖管理**：定期更新 `requirements.txt` 中的依赖版本
3. **日志管理**：关注系统日志，特别是RabbitMQ连接和消息推送相关的日志
4. **安全考虑**：在生产环境中修改默认密码和访问控制
5. **性能监控**：定期检查系统性能，特别是在高负载情况下

## 更新日志

### 最新更新
- 在仪表盘添加店铺ID查询功能，支持通过店铺Code查询店铺ID和名称
- 修复菜单名称映射问题，确保所有菜单ID都能正确显示对应的中文名称
- 向项目添加requests库依赖，增强HTTP请求能力

### 2025-08-01
- 优化了局域网访问配置，明确绑定到本地IP
- 修复了换货单JSON预览中platformNo字段为空的问题
- 完善了API接口文档
- 重构了项目结构，优化了代码组织

### 2025-07-31
- 完成基础功能开发，包括订单下载、销售订单回传等
- 集成RabbitMQ消息队列
- 实现了动态表单和JSON预览功能

## 贡献指南

欢迎对本项目进行贡献！如果您有任何问题或建议，请提交Issue或Pull Request。

## 版权声明

© 2025 测试数据生成平台 - TOMS. 保留所有权利。