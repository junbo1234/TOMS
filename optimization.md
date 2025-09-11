# TOMS项目优化建议文档

## 一、代码结构优化

### 1. 路由模块化重构

当前项目中每个业务路由文件都包含相似的代码模式（表单验证、数据处理、消息推送），存在大量重复代码。建议通过创建基础路由类来实现代码复用。

**实现建议：**

创建 `app/routes/base_route.py` 文件：
```python
from flask import Blueprint, render_template, request, jsonify
import json
import time
from app.utils.rabbitmq import push_message
from app.utils.dashboard_data import DashboardDataManager

class BaseOrderRoute:
    def __init__(self, route_name, template_name, queue_name, preset_config):
        self.route_name = route_name
        self.template_name = template_name
        self.queue_name = queue_name
        self.preset_config = preset_config
        self.blueprint = Blueprint(route_name, __name__, url_prefix=f'/{route_name}')
        self.dashboard_manager = DashboardDataManager()
        self._register_routes()
    
    def _register_routes(self):
        @self.blueprint.route('/')
        def index():
            self.dashboard_manager.increment_menu_count(self.route_name)
            return render_template(self.template_name)
        
        @self.blueprint.route('/submit', methods=['POST'])
        def submit():
            try:
                form_data = request.form.to_dict()
                # 验证表单数据
                self.validate_form(form_data)
                
                # 处理数据
                message_data = self.process_data(form_data)
                
                # 推送消息
                result = self.push_to_rabbitmq(message_data)
                
                if result:
                    return jsonify({'status': 'success', 'message': '数据提交成功'})
                else:
                    return jsonify({'status': 'error', 'message': '数据提交失败'})
            except Exception as e:
                return jsonify({'status': 'error', 'message': str(e)})
    
    def validate_form(self, form_data):
        # 基础表单验证，子类可以重写此方法进行特定验证
        required_fields = ['storeId', 'platformOrderNo']
        for field in required_fields:
            if field not in form_data or not form_data[field]:
                raise ValueError(f'{field} 是必填字段')
    
    def process_data(self, form_data):
        # 基础数据处理逻辑，子类应该重写此方法
        message_data = self.preset_config.copy()
        # 合并表单数据到预设配置中
        for key, value in form_data.items():
            if key not in ['detail_count'] and not key.startswith('sku') and not key.startswith('qty'):
                # 查找并替换嵌套结构中的值
                self._update_nested_dict(message_data, key, value)
        return message_data
    
    def _update_nested_dict(self, d, key, value):
        # 递归更新嵌套字典中的值
        for k, v in d.items():
            if k == key:
                d[k] = value
            elif isinstance(v, dict):
                self._update_nested_dict(v, key, value)
            elif isinstance(v, list):
                for item in v:
                    if isinstance(item, dict):
                        self._update_nested_dict(item, key, value)
    
    def push_to_rabbitmq(self, message_data):
        # 消息推送逻辑
        try:
            print(f"准备推送消息到队列 {self.queue_name}:")
            print(json.dumps(message_data, ensure_ascii=False, indent=2))
            start_time = time.time()
            
            result = push_message(self.queue_name, message_data)
            
            end_time = time.time()
            print(f"消息推送耗时: {end_time - start_time:.4f} 秒")
            
            if result:
                print(f"消息成功推送到队列 {self.queue_name}")
            else:
                print(f"消息推送失败")
            
            return result
        except Exception as e:
            print(f"消息推送异常: {str(e)}")
            return False
```

**使用示例：**

修改 `app/routes/order_download.py` 文件：
```python
from app.routes.base_route import BaseOrderRoute
from config import ORDER_DOWNLOAD_PRESET

class OrderDownloadRoute(BaseOrderRoute):
    def __init__(self):
        super().__init__(
            route_name='order_download',
            template_name='order_download.html',
            queue_name='oms_sales_order_download_queue',
            preset_config=ORDER_DOWNLOAD_PRESET
        )
    
    def validate_form(self, form_data):
        # 调用父类的基础验证
        super().validate_form(form_data)
        
        # 添加订单下载特有的验证
        if 'platformPayTime' not in form_data or not form_data['platformPayTime']:
            raise ValueError('支付时间是必填字段')
    
    def process_data(self, form_data):
        # 调用父类的基础处理逻辑
        message_data = super().process_data(form_data)
        
        # 处理动态明细
        detail_count = int(form_data.get('detail_count', 1))
        new_details = []
        
        for i in range(detail_count):
            sku_key = f'sku{i}'
            qty_key = f'qty{i}'
            platform_no_key = f'platformNo{i}'
            
            if sku_key in form_data and qty_key in form_data:
                sku = form_data[sku_key]
                qty = int(form_data[qty_key])
                platform_no = form_data.get(platform_no_key, '')
                
                # 验证必填字段
                if not sku or qty <= 0:
                    raise ValueError(f'商品{i+1}的SKU和数量为必填项，且数量必须大于0')
                
                # 创建新的明细项
                detail_item = message_data['items'][0].copy()  # 复制预设的明细结构
                detail_item['skuCode'] = sku
                detail_item['itemQuantity'] = qty
                detail_item['platformSkuCode'] = platform_no
                
                new_details.append(detail_item)
        
        # 更新明细列表
        if new_details:
            message_data['items'] = new_details
        
        return message_data

# 创建路由实例
order_download_route = OrderDownloadRoute()
# 导出蓝图供应用注册
blueprint = order_download_route.blueprint
```

### 2. 配置管理优化

当前配置文件过于庞大，包含大量预设数据，建议将预设数据分离到单独的配置文件中。

**实现建议：**

创建 `app/config/presets/` 目录用于存放各种预设配置文件：

1. 创建 `app/config/base_config.py` 文件：
```python
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# Flask基础配置
class FlaskConfig:
    DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    PORT = int(os.environ.get('FLASK_PORT', 5000))
    SECRET_KEY = os.environ.get('FLASK_SECRET_KEY', 'dev_key')

# RabbitMQ配置
class RabbitMQConfig:
    HOST = os.environ.get('RABBITMQ_HOST', 'localhost')
    PORT = int(os.environ.get('RABBITMQ_PORT', 5672))
    USERNAME = os.environ.get('RABBITMQ_USERNAME', 'guest')
    PASSWORD = os.environ.get('RABBITMQ_PASSWORD', 'guest')
    VHOST = os.environ.get('RABBITMQ_VHOST', '/')
    CONNECTION_TIMEOUT = int(os.environ.get('RABBITMQ_TIMEOUT', 30))
    RETRY_ATTEMPTS = int(os.environ.get('RABBITMQ_RETRY', 3))
    RETRY_DELAY = int(os.environ.get('RABBITMQ_RETRY_DELAY', 1))

# 队列名称常量
class QueueNames:
    ORDER_DOWNLOAD_QUEUE = 'oms_sales_order_download_queue'
    ORDER_DELIVERY_QUEUE = 'sale_order_add_back'
    REFUND_ORDER_QUEUE = 'oms_return_order_download_queue'
    RETURN_ORDER_NOTICE_QUEUE = 'sale_return_plan_add_back_b2c'
    STOCKOUT_PUSH_QUEUE = 'purchase_return_plan_add_back'
    RETURN_ORDER_ENTRY_QUEUE = 'sale_return_plan_add_back'
    EXCHANGE_ORDER_QUEUE = 'oms_exchange_order_download_queue'
    ALLOCATION_IN_QUEUE = 'entry_order_add_back_other'
    ALLOCATION_OUT_QUEUE = 'stock_out_back'
    INVENTORY_ENTRY_QUEUE = 'inventory_return_order_back'
```

2. 创建 `app/config/presets/order_presets.py` 文件：
```python
# 订单下载预设参数
ORDER_DOWNLOAD_PRESET = {
    "platformCode": "",
    "platformOrderNo": "",
    "storeId": "",
    "shopName": "",
    "platformPayTime": "",
    "buyer": {
        "buyerId": "",
        "buyerName": "",
        "buyerPhone": ""
    },
    "recipient": {
        "recipientName": "",
        "recipientPhone": "",
        "province": "",
        "city": "",
        "district": "",
        "address": ""
    },
    "items": [
        {
            "itemId": "",
            "skuCode": "",
            "itemName": "",
            "itemQuantity": 1,
            "platformSkuCode": ""
        }
    ]
}

# 其他订单类型的预设参数...
```

3. 更新 `config.py` 文件：
```python
from app.config.base_config import FlaskConfig, RabbitMQConfig, QueueNames
from app.config.presets.order_presets import *

# 导出配置以供应用使用
DEBUG = FlaskConfig.DEBUG
PORT = FlaskConfig.PORT
SECRET_KEY = FlaskConfig.SECRET_KEY

# RabbitMQ配置
def get_rabbitmq_config():
    return {
        'host': RabbitMQConfig.HOST,
        'port': RabbitMQConfig.PORT,
        'username': RabbitMQConfig.USERNAME,
        'password': RabbitMQConfig.PASSWORD,
        'vhost': RabbitMQConfig.VHOST,
        'connection_timeout': RabbitMQConfig.CONNECTION_TIMEOUT,
        'retry_attempts': RabbitMQConfig.RETRY_ATTEMPTS,
        'retry_delay': RabbitMQConfig.RETRY_DELAY
    }
```

## 二、功能增强实现

### 1. 用户权限管理

**实现建议：**

创建 `app/utils/auth.py` 文件：
```python
from functools import wraps
from flask import session, redirect, url_for, request

# 用户角色
ROLES = {
    'ADMIN': 'admin',
    'USER': 'user'
}

# 模拟用户数据（实际应用中应该从数据库读取）
USERS = {
    'admin': {
        'password': 'admin123',  # 实际应用中应使用哈希密码
        'role': ROLES['ADMIN']
    },
    'user1': {
        'password': 'user123',
        'role': ROLES['USER']
    }
}

# 登录装饰器
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            return redirect(url_for('auth.login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

# 角色装饰器
def role_required(required_role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'username' not in session:
                return redirect(url_for('auth.login', next=request.url))
            
            username = session['username']
            user_role = USERS.get(username, {}).get('role', '')
            
            if user_role != required_role:
                return '无权限访问此页面', 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# 验证用户凭据
def authenticate(username, password):
    if username in USERS and USERS[username]['password'] == password:
        return True
    return False

# 获取用户角色
def get_user_role(username):
    return USERS.get(username, {}).get('role', '')
```

创建 `app/routes/auth.py` 文件：
```python
from flask import Blueprint, render_template, request, redirect, url_for, session
from app.utils.auth import authenticate, ROLES

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        if authenticate(username, password):
            session['username'] = username
            next_page = request.args.get('next') or url_for('dashboard.index')
            return redirect(next_page)
        else:
            return render_template('login.html', error='用户名或密码错误')
    
    return render_template('login.html')

@auth_bp.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('auth.login'))
```

### 2. 数据模板管理

**实现建议：**

创建 `app/utils/template_manager.py` 文件：
```python
import json
import os
import uuid
from datetime import datetime

# 模板存储目录
TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'templates_data')

# 确保模板目录存在
os.makedirs(TEMPLATE_DIR, exist_ok=True)

class TemplateManager:
    @staticmethod
    def save_template(name, template_data, template_type, username='system'):
        """保存数据模板"""
        template_id = str(uuid.uuid4())
        template_file = os.path.join(TEMPLATE_DIR, f'{template_id}.json')
        
        template_info = {
            'id': template_id,
            'name': name,
            'type': template_type,
            'data': template_data,
            'created_by': username,
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        with open(template_file, 'w', encoding='utf-8') as f:
            json.dump(template_info, f, ensure_ascii=False, indent=2)
        
        return template_id
    
    @staticmethod
    def load_template(template_id):
        """加载数据模板"""
        template_file = os.path.join(TEMPLATE_DIR, f'{template_id}.json')
        
        if not os.path.exists(template_file):
            raise FileNotFoundError(f'模板 {template_id} 不存在')
        
        with open(template_file, 'r', encoding='utf-8') as f:
            template_info = json.load(f)
        
        return template_info
    
    @staticmethod
    def get_all_templates(template_type=None, username=None):
        """获取所有模板列表"""
        templates = []
        
        for filename in os.listdir(TEMPLATE_DIR):
            if filename.endswith('.json'):
                file_path = os.path.join(TEMPLATE_DIR, filename)
                with open(file_path, 'r', encoding='utf-8') as f:
                    template_info = json.load(f)
                
                # 根据条件过滤
                if template_type and template_info['type'] != template_type:
                    continue
                if username and template_info['created_by'] != username:
                    continue
                
                templates.append(template_info)
        
        # 按创建时间排序
        templates.sort(key=lambda x: x['created_at'], reverse=True)
        
        return templates
    
    @staticmethod
    def delete_template(template_id):
        """删除模板"""
        template_file = os.path.join(TEMPLATE_DIR, f'{template_id}.json')
        
        if os.path.exists(template_file):
            os.remove(template_file)
            return True
        
        return False
    
    @staticmethod
    def update_template(template_id, name=None, template_data=None, username=None):
        """更新模板"""
        template_info = TemplateManager.load_template(template_id)
        
        if name:
            template_info['name'] = name
        if template_data:
            template_info['data'] = template_data
        if username:
            template_info['updated_by'] = username
        
        template_info['updated_at'] = datetime.now().isoformat()
        
        template_file = os.path.join(TEMPLATE_DIR, f'{template_id}.json')
        with open(template_file, 'w', encoding='utf-8') as f:
            json.dump(template_info, f, ensure_ascii=False, indent=2)
        
        return template_info
```

## 三、性能与稳定性优化

### 1. RabbitMQ连接池优化

**实现建议：**

优化 `app/utils/rabbitmq.py` 文件，实现更高效的连接池管理：

```python
import pika
import time
import json
import logging
import threading
import atexit
from queue import Queue
from pika.exchange_type import ExchangeType
from config import get_rabbitmq_config

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('RabbitMQ')

class RabbitMQConnectionPool:
    def __init__(self, config, pool_size=5):
        self.config = config
        self.pool_size = pool_size
        self.connections = Queue(maxsize=pool_size)
        self._lock = threading.Lock()
        self._initialized = False
        self._initialize_pool()
    
    def _initialize_pool(self):
        """初始化连接池"""
        with self._lock:
            if self._initialized:
                return
            
            for _ in range(self.pool_size):
                try:
                    connection = self._create_connection()
                    if connection:
                        self.connections.put(connection)
                except Exception as e:
                    logger.error(f'初始化连接池失败: {str(e)}')
            
            self._initialized = True
    
    def _create_connection(self):
        """创建新的RabbitMQ连接"""
        try:
            credentials = pika.PlainCredentials(
                username=self.config['username'],
                password=self.config['password']
            )
            
            parameters = pika.ConnectionParameters(
                host=self.config['host'],
                port=self.config['port'],
                virtual_host=self.config['vhost'],
                credentials=credentials,
                connection_attempts=self.config['retry_attempts'],
                retry_delay=self.config['retry_delay'],
                socket_timeout=self.config['connection_timeout']
            )
            
            connection = pika.BlockingConnection(parameters)
            logger.info(f'成功连接到RabbitMQ: {self.config["host"]}:{self.config["port"]}')
            return connection
        except Exception as e:
            logger.error(f'创建RabbitMQ连接失败: {str(e)}')
            return None
    
    def get_connection(self):
        """从连接池获取连接"""
        try:
            # 尝试从队列获取连接
            connection = self.connections.get_nowait()
            
            # 检查连接是否有效
            if connection.is_closed:
                logger.info('连接已关闭，创建新连接')
                connection = self._create_connection()
            
            return connection
        except Exception:
            # 队列为空，创建新连接
            logger.info('连接池为空，创建新连接')
            return self._create_connection()
    
    def release_connection(self, connection):
        """释放连接回连接池"""
        try:
            if connection and not connection.is_closed:
                self.connections.put(connection, block=False)
                return True
            return False
        except Exception as e:
            logger.error(f'释放连接失败: {str(e)}')
            try:
                if connection and not connection.is_closed:
                    connection.close()
            except:
                pass
            return False
    
    def close_all_connections(self):
        """关闭所有连接"""
        while not self.connections.empty():
            try:
                connection = self.connections.get_nowait()
                if connection and not connection.is_closed:
                    connection.close()
            except Exception as e:
                logger.error(f'关闭连接失败: {str(e)}')

class RabbitMQManager:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(RabbitMQManager, cls).__new__(cls)
                cls._instance._initialize()
            return cls._instance
    
    def _initialize(self):
        """初始化RabbitMQ管理器"""
        config = get_rabbitmq_config()
        self.connection_pool = RabbitMQConnectionPool(config)
        self.channels = {}
        self.channel_locks = {}
    
    def get_channel(self, queue_name):
        """获取指定队列的通道"""
        with self._lock:
            if queue_name not in self.channels or self.channels[queue_name].is_closed:
                connection = self.connection_pool.get_connection()
                if not connection:
                    return None
                
                try:
                    channel = connection.channel()
                    self.channels[queue_name] = channel
                    self.channel_locks[queue_name] = threading.Lock()
                    # 确保队列存在
                    self._ensure_queue_exists(channel, queue_name)
                except Exception as e:
                    logger.error(f'创建通道失败: {str(e)}')
                    self.connection_pool.release_connection(connection)
                    return None
            
            return self.channels[queue_name]
    
    def _ensure_queue_exists(self, channel, queue_name):
        """确保队列存在"""
        try:
            # 声明主队列（持久化）
            channel.queue_declare(
                queue=queue_name,
                durable=True,
                arguments={
                    'x-dead-letter-exchange': '',
                    'x-dead-letter-routing-key': f'{queue_name}_dlq'
                }
            )
            
            # 声明死信队列
            channel.queue_declare(
                queue=f'{queue_name}_dlq',
                durable=True
            )
        except Exception as e:
            logger.error(f'声明队列失败: {str(e)}')
    
    def publish_message(self, queue_name, message_data, exchange=''):
        """发布消息到指定队列"""
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                channel = self.get_channel(queue_name)
                if not channel:
                    raise Exception('获取通道失败')
                
                with self.channel_locks[queue_name]:
                    # 启用发布确认
                    channel.confirm_delivery()
                    
                    # 将消息转换为JSON字符串
                    message_body = json.dumps(message_data, ensure_ascii=False)
                    
                    # 发布消息（持久化）
                    channel.basic_publish(
                        exchange=exchange,
                        routing_key=queue_name,
                        body=message_body.encode('utf-8'),
                        properties=pika.BasicProperties(
                            delivery_mode=2,  # 持久化消息
                            content_type='application/json',
                            content_encoding='utf-8'
                        )
                    )
                
                logger.info(f'消息成功发布到队列 {queue_name}')
                return True
            except Exception as e:
                retry_count += 1
                logger.error(f'发布消息失败 (尝试 {retry_count}/{max_retries}): {str(e)}')
                
                # 重置通道，强制下一次获取新通道
                with self._lock:
                    if queue_name in self.channels:
                        try:
                            self.channels[queue_name].close()
                        except:
                            pass
                        del self.channels[queue_name]
                
                if retry_count < max_retries:
                    time.sleep(1)  # 重试前等待1秒
        
        logger.error(f'消息发布失败，已达到最大重试次数')
        return False
    
    def close(self):
        """关闭管理器"""
        with self._lock:
            # 关闭所有通道
            for channel in self.channels.values():
                try:
                    if not channel.is_closed:
                        channel.close()
                except Exception as e:
                    logger.error(f'关闭通道失败: {str(e)}')
            
            # 清空通道字典
            self.channels.clear()
            self.channel_locks.clear()
            
            # 关闭所有连接
            self.connection_pool.close_all_connections()

# 创建RabbitMQ管理器单例
def get_rabbitmq_manager():
    return RabbitMQManager()

# 推送消息函数
def push_message(queue_name, message_data):
    """推送消息到RabbitMQ队列"""
    try:
        # 获取RabbitMQ管理器实例
        rabbitmq_manager = get_rabbitmq_manager()
        
        # 记录开始时间
        start_time = time.time()
        
        # 发布消息
        result = rabbitmq_manager.publish_message(queue_name, message_data)
        
        # 记录结束时间
        end_time = time.time()
        
        # 打印消息和耗时信息
        logger.info(f"推送消息到队列 {queue_name} 耗时: {end_time - start_time:.4f} 秒")
        logger.debug(f"消息内容: {json.dumps(message_data, ensure_ascii=False, indent=2)}")
        
        return result
    except Exception as e:
        logger.error(f'推送消息异常: {str(e)}')
        return False

# 应用关闭时清理RabbitMQ连接
@atexit.register
def close_rabbitmq_connection():
    """应用关闭时关闭RabbitMQ连接"""
    try:
        rabbitmq_manager = get_rabbitmq_manager()
        rabbitmq_manager.close()
        logger.info('已关闭所有RabbitMQ连接')
    except Exception as e:
        logger.error(f'关闭RabbitMQ连接失败: {str(e)}')
```

### 2. 异步消息处理

**实现建议：**

创建 `app/utils/async_worker.py` 文件：
```python
import threading
import time
import logging
from concurrent.futures import ThreadPoolExecutor
from app.utils.rabbitmq import push_message

# 配置日志
logger = logging.getLogger('AsyncWorker')

class AsyncTask:
    def __init__(self, task_id, task_type, task_data, callback=None):
        self.task_id = task_id
        self.task_type = task_type
        self.task_data = task_data
        self.status = 'pending'  # pending, running, completed, failed
        self.result = None
        self.error = None
        self.created_at = time.time()
        self.started_at = None
        self.completed_at = None
        self.callback = callback

class AsyncWorker:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(AsyncWorker, cls).__new__(cls)
                cls._instance._initialize()
            return cls._instance
    
    def _initialize(self):
        """初始化异步工作器"""
        self.executor = ThreadPoolExecutor(max_workers=10)
        self.tasks = {}
        self.task_lock = threading.Lock()
    
    def submit_task(self, task_type, task_data, callback=None):
        """提交异步任务"""
        import uuid
        task_id = str(uuid.uuid4())
        
        with self.task_lock:
            task = AsyncTask(task_id, task_type, task_data, callback)
            self.tasks[task_id] = task
        
        # 提交任务到线程池
        future = self.executor.submit(self._execute_task, task)
        future.add_done_callback(lambda f: self._task_done_callback(f, task))
        
        return task_id
    
    def _execute_task(self, task):
        """执行任务"""
        with self.task_lock:
            task.status = 'running'
            task.started_at = time.time()
        
        try:
            if task.task_type == 'push_message':
                # 执行消息推送任务
                queue_name = task.task_data.get('queue_name')
                message_data = task.task_data.get('message_data')
                
                if not queue_name or not message_data:
                    raise ValueError('缺少必要的任务数据')
                
                result = push_message(queue_name, message_data)
                return result
            else:
                raise ValueError(f'未知的任务类型: {task.task_type}')
        except Exception as e:
            logger.error(f'执行任务 {task.task_id} 失败: {str(e)}')
            with self.task_lock:
                task.status = 'failed'
                task.error = str(e)
            raise
    
    def _task_done_callback(self, future, task):
        """任务完成回调"""
        with self.task_lock:
            task.completed_at = time.time()
            
            try:
                result = future.result()
                task.status = 'completed'
                task.result = result
                
                # 调用用户回调（如果有）
                if task.callback:
                    try:
                        task.callback(task)
                    except Exception as e:
                        logger.error(f'执行任务回调失败: {str(e)}')
            except Exception as e:
                task.status = 'failed'
                task.error = str(e)
    
    def get_task_status(self, task_id):
        """获取任务状态"""
        with self.task_lock:
            if task_id not in self.tasks:
                return None
            
            task = self.tasks[task_id]
            # 返回任务状态的副本
            return {
                'task_id': task.task_id,
                'task_type': task.task_type,
                'status': task.status,
                'result': task.result,
                'error': task.error,
                'created_at': task.created_at,
                'started_at': task.started_at,
                'completed_at': task.completed_at
            }
    
    def shutdown(self):
        """关闭工作器"""
        self.executor.shutdown(wait=True)

# 创建异步工作器单例
def get_async_worker():
    return AsyncWorker()

# 异步推送消息函数
def async_push_message(queue_name, message_data, callback=None):
    """异步推送消息到RabbitMQ队列"""
    worker = get_async_worker()
    task_data = {
        'queue_name': queue_name,
        'message_data': message_data
    }
    return worker.submit_task('push_message', task_data, callback)
```

## 四、前端体验优化

### 1. 表单验证增强

**实现建议：**

创建 `app/static/js/form_validation.js` 文件：
```javascript
/**
 * 表单验证工具类
 */
class FormValidator {
    constructor(formId, rules) {
        this.form = document.getElementById(formId);
        this.rules = rules;
        this.errors = {};
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (!this.form) return;
        
        // 为每个必填字段添加实时验证
        for (const fieldName in this.rules) {
            const field = this.form.querySelector(`[name="${fieldName}"]`);
            if (field) {
                field.addEventListener('blur', () => this.validateField(fieldName));
                field.addEventListener('input', () => this.clearError(fieldName));
            }
        }
        
        // 表单提交验证
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.validateForm()) {
                // 获取表单数据
                const formData = this.getFormData();
                
                // 提交表单数据
                this.submitForm(formData);
            }
        });
    }
    
    validateField(fieldName) {
        const field = this.form.querySelector(`[name="${fieldName}"]`);
        if (!field) return true;
        
        const value = field.value.trim();
        const fieldRules = this.rules[fieldName];
        
        // 必填验证
        if (fieldRules.required && value === '') {
            this.setError(fieldName, fieldRules.message || `${fieldName} 是必填项`);
            return false;
        }
        
        // 数字验证
        if (fieldRules.number && !/^\d+$/.test(value)) {
            this.setError(fieldName, fieldRules.message || `${fieldName} 必须是数字`);
            return false;
        }
        
        // 最小长度验证
        if (fieldRules.minLength && value.length < fieldRules.minLength) {
            this.setError(fieldName, fieldRules.message || `${fieldName} 长度不能少于 ${fieldRules.minLength} 个字符`);
            return false;
        }
        
        // 自定义验证函数
        if (fieldRules.validator && typeof fieldRules.validator === 'function') {
            const result = fieldRules.validator(value);
            if (result !== true) {
                this.setError(fieldName, result || fieldRules.message || `${fieldName} 验证失败`);
                return false;
            }
        }
        
        this.clearError(fieldName);
        return true;
    }
    
    validateForm() {
        let isValid = true;
        
        // 验证所有字段
        for (const fieldName in this.rules) {
            if (!this.validateField(fieldName)) {
                isValid = false;
            }
        }
        
        // 显示总体错误信息
        const errorContainer = document.getElementById('form_errors');
        if (!isValid && errorContainer) {
            errorContainer.innerHTML = '<div class="alert alert-danger">请修正表单中的错误后再提交</div>';
            errorContainer.style.display = 'block';
        } else if (errorContainer) {
            errorContainer.style.display = 'none';
        }
        
        return isValid;
    }
    
    setError(fieldName, message) {
        this.errors[fieldName] = message;
        
        const field = this.form.querySelector(`[name="${fieldName}"]`);
        if (field) {
            field.classList.add('is-invalid');
            
            // 查找或创建错误提示元素
            let errorElement = field.parentNode.querySelector(`.error-${fieldName}`);
            if (!errorElement) {
                errorElement = document.createElement('div');
                errorElement.className = `invalid-feedback error-${fieldName}`;
                field.parentNode.appendChild(errorElement);
            }
            
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }
    
    clearError(fieldName) {
        delete this.errors[fieldName];
        
        const field = this.form.querySelector(`[name="${fieldName}"]`);
        if (field) {
            field.classList.remove('is-invalid');
            
            const errorElement = field.parentNode.querySelector(`.error-${fieldName}`);
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        }
    }
    
    getFormData() {
        const formData = {};
        const formElements = this.form.elements;
        
        for (let i = 0; i < formElements.length; i++) {
            const element = formElements[i];
            if (element.name && element.nodeName !== 'BUTTON') {
                formData[element.name] = element.value;
            }
        }
        
        return formData;
    }
    
    async submitForm(formData) {
        try {
            // 显示加载状态
            this.showLoading(true);
            
            // 提交数据到服务器
            const response = await fetch(this.form.action, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            // 处理响应结果
            if (result.status === 'success') {
                this.showSuccess(result.message);
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            this.showError('提交失败，请重试');
        } finally {
            // 隐藏加载状态
            this.showLoading(false);
        }
    }
    
    showLoading(show) {
        const loadingElement = document.getElementById('form_loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
        
        const submitButton = this.form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = show;
        }
    }
    
    showSuccess(message) {
        const successContainer = document.getElementById('form_success');
        if (successContainer) {
            successContainer.innerHTML = `<div class="alert alert-success">${message}</div>`;
            successContainer.style.display = 'block';
            
            // 3秒后隐藏成功提示
            setTimeout(() => {
                successContainer.style.display = 'none';
            }, 3000);
        }
    }
    
    showError(message) {
        const errorContainer = document.getElementById('form_errors');
        if (errorContainer) {
            errorContainer.innerHTML = `<div class="alert alert-danger">${message}</div>`;
            errorContainer.style.display = 'block';
        }
    }
}

// 初始化表单验证
function initFormValidation() {
    // 订单下载表单验证
    if (document.getElementById('order_download_form')) {
        new FormValidator('order_download_form', {
            platformOrderNo: {
                required: true,
                message: '平台订单号是必填项'
            },
            storeId: {
                required: true,
                message: '店铺ID是必填项'
            },
            platformPayTime: {
                required: true,
                message: '支付时间是必填项'
            },
            sku0: {
                required: true,
                message: '至少需要填写一个商品SKU'
            },
            qty0: {
                required: true,
                number: true,
                validator: (value) => parseInt(value) > 0,
                message: '商品数量必须是大于0的数字'
            }
        });
    }
    
    // 其他表单验证...
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormValidation);
} else {
    initFormValidation();
}
```

## 五、性能监控与日志优化

### 1. 应用性能监控

**实现建议：**

创建 `app/utils/monitoring.py` 文件：
```python
import time
import logging
import functools
import threading
from collections import defaultdict

# 配置日志
logger = logging.getLogger('PerformanceMonitor')

class PerformanceMonitor:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(PerformanceMonitor, cls).__new__(cls)
                cls._instance._initialize()
            return cls._instance
    
    def _initialize(self):
        """初始化性能监控器"""
        self.metrics = defaultdict(lambda: {
            'count': 0,
            'total_time': 0,
            'min_time': float('inf'),
            'max_time': 0,
            'errors': 0
        })
        self.metrics_lock = threading.Lock()
    
    def record_metric(self, metric_name, execution_time, success=True):
        """记录指标数据"""
        with self.metrics_lock:
            metric = self.metrics[metric_name]
            metric['count'] += 1
            metric['total_time'] += execution_time
            metric['min_time'] = min(metric['min_time'], execution_time)
            metric['max_time'] = max(metric['max_time'], execution_time)
            if not success:
                metric['errors'] += 1
    
    def get_metrics_summary(self):
        """获取指标摘要"""
        summary = {}
        with self.metrics_lock:
            for metric_name, metric_data in self.metrics.items():
                count = metric_data['count']
                if count > 0:
                    summary[metric_name] = {
                        'count': count,
                        'avg_time': metric_data['total_time'] / count if count > 0 else 0,
                        'min_time': metric_data['min_time'],
                        'max_time': metric_data['max_time'],
                        'error_rate': metric_data['errors'] / count if count > 0 else 0
                    }
        return summary
    
    def reset_metrics(self):
        """重置所有指标"""
        with self.metrics_lock:
            self.metrics.clear()

# 性能监控装饰器
def performance_monitor(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        monitor = PerformanceMonitor()
        start_time = time.time()
        
        try:
            result = func(*args, **kwargs)
            success = True
            return result
        except Exception as e:
            success = False
            raise
        finally:
            execution_time = time.time() - start_time
            monitor.record_metric(func.__name__, execution_time, success)
            
            # 记录详细日志
            if execution_time > 1.0:  # 如果执行时间超过1秒，记录警告日志
                logger.warning(f'函数 {func.__name__} 执行耗时: {execution_time:.4f} 秒')
            else:
                logger.debug(f'函数 {func.__name__} 执行耗时: {execution_time:.4f} 秒')
    
    return wrapper

# 创建性能监控器单例
def get_performance_monitor():
    return PerformanceMonitor()
```

### 2. 日志管理优化

**实现建议：**

创建 `app/utils/logger_config.py` 文件：
```python
import logging
import os
import datetime
from logging.handlers import RotatingFileHandler

# 日志目录
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logs')

# 确保日志目录存在
os.makedirs(LOG_DIR, exist_ok=True)

def setup_logging(log_level=logging.INFO):
    """配置应用日志系统"""
    # 获取根日志器
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # 清除已有的处理器
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # 创建格式化器
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 创建控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # 创建文件处理器（按大小滚动）
    today = datetime.date.today().strftime('%Y-%m-%d')
    log_file = os.path.join(LOG_DIR, f'app_{today}.log')
    
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)
    
    # 创建错误日志处理器
    error_log_file = os.path.join(LOG_DIR, f'error_{today}.log')
    error_handler = RotatingFileHandler(
        error_log_file,
        maxBytes=5*1024*1024,  # 5MB
        backupCount=5,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    root_logger.addHandler(error_handler)
    
    # 创建RabbitMQ专门的日志处理器
    rabbitmq_log_file = os.path.join(LOG_DIR, f'rabbitmq_{today}.log')
    rabbitmq_handler = RotatingFileHandler(
        rabbitmq_log_file,
        maxBytes=5*1024*1024,  # 5MB
        backupCount=5,
        encoding='utf-8'
    )
    rabbitmq_handler.setLevel(logging.INFO)
    rabbitmq_handler.setFormatter(formatter)
    
    # 获取RabbitMQ日志器并配置
    rabbitmq_logger = logging.getLogger('RabbitMQ')
    rabbitmq_logger.setLevel(logging.INFO)
    for handler in rabbitmq_logger.handlers[:]:
        rabbitmq_logger.removeHandler(handler)
    rabbitmq_logger.addHandler(rabbitmq_handler)
    
    # 设置Flask的日志级别
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    
    return root_logger

# 应用日志工具函数
def log_info(logger_name, message):
    logger = logging.getLogger(logger_name)
    logger.info(message)

def log_warning(logger_name, message):
    logger = logging.getLogger(logger_name)
    logger.warning(message)

def log_error(logger_name, message, exc_info=False):
    logger = logging.getLogger(logger_name)
    logger.error(message, exc_info=exc_info)

def log_debug(logger_name, message):
    logger = logging.getLogger(logger_name)
    logger.debug(message)
```

## 六、健康检查接口

**实现建议：**

创建 `app/routes/health.py` 文件：
```python
from flask import Blueprint, jsonify
import time
import pika
from app.utils.rabbitmq import get_rabbitmq_manager
from app.utils.performance_monitor import get_performance_monitor
from config import get_rabbitmq_config

health_bp = Blueprint('health', __name__, url_prefix='/health')

@health_bp.route('/')
def health_check():
    """健康检查接口"""
    # 检查系统状态
    status = {
        'status': 'UP',
        'timestamp': time.time(),
        'components': {
            'application': check_application(),
            'rabbitmq': check_rabbitmq()
        },
        'performance': get_performance_monitor().get_metrics_summary()
    }
    
    # 确定总体状态
    all_healthy = all(comp['status'] == 'UP' for comp in status['components'].values())
    if not all_healthy:
        status['status'] = 'DOWN'
    
    # 根据状态设置HTTP状态码
    http_status = 200 if status['status'] == 'UP' else 503
    
    return jsonify(status), http_status

@health_bp.route('/application')
def application_health():
    """应用健康检查接口"""
    return jsonify(check_application())

@health_bp.route('/rabbitmq')
def rabbitmq_health():
    """RabbitMQ健康检查接口"""
    return jsonify(check_rabbitmq())

@health_bp.route('/metrics')
def metrics():
    """性能指标接口"""
    metrics = get_performance_monitor().get_metrics_summary()
    return jsonify(metrics)

def check_application():
    """检查应用自身状态"""
    try:
        # 执行简单的计算检查CPU状态
        start_time = time.time()
        # 简单的计算任务
        _ = [i*i for i in range(1000)]
        compute_time = time.time() - start_time
        
        return {
            'status': 'UP',
            'compute_time_ms': compute_time * 1000
        }
    except Exception as e:
        return {
            'status': 'DOWN',
            'error': str(e)
        }

def check_rabbitmq():
    """检查RabbitMQ连接状态"""
    try:
        config = get_rabbitmq_config()
        
        # 直接使用pika检查连接，避免使用连接池
        credentials = pika.PlainCredentials(
            username=config['username'],
            password=config['password']
        )
        
        parameters = pika.ConnectionParameters(
            host=config['host'],
            port=config['port'],
            virtual_host=config['vhost'],
            credentials=credentials,
            connection_attempts=1,
            retry_delay=0,
            socket_timeout=2
        )
        
        start_time = time.time()
        connection = pika.BlockingConnection(parameters)
        connection.close()
        connect_time = time.time() - start_time
        
        # 检查连接池状态
        rabbitmq_manager = get_rabbitmq_manager()
        
        return {
            'status': 'UP',
            'host': config['host'],
            'port': config['port'],
            'connect_time_ms': connect_time * 1000
        }
    except Exception as e:
        return {
            'status': 'DOWN',
            'host': config.get('host', 'unknown'),
            'error': str(e)
        }
```

更新 `app/__init__.py` 文件，注册健康检查蓝图：
```python
# ... 其他导入 ...
from app.routes.health import health_bp

# 在create_app函数中注册蓝图
def create_app():
    # ... 现有代码 ...
    
    # 注册健康检查蓝图
    app.register_blueprint(health_bp)
    
    # ... 其他代码 ...
```

## 七、总结

以上优化建议涵盖了TOMS项目的多个方面，包括代码结构、功能增强、性能优化和用户体验。实施这些优化可以显著提高项目的可维护性、扩展性和稳定性，同时提供更好的用户体验。

建议按照以下优先级逐步实施优化：

1. **代码结构优化**：重构路由系统，实现基础路由类，优化配置管理
2. **性能与稳定性优化**：改进RabbitMQ连接池，实现异步消息处理
3. **功能增强**：添加用户权限管理，实现数据模板功能
4. **前端体验优化**：增强表单验证，优化用户界面
5. **监控与日志优化**：添加性能监控，优化日志管理

通过这些优化，TOMS项目将成为一个更加成熟、可靠和高效的测试数据生成平台。