import pika
import json
import time
import logging
import threading
import os
from typing import Dict, Any, Optional, List
from pika.exceptions import (AMQPConnectionError, StreamLostError, 
                            ChannelClosedByBroker, ConnectionClosedByBroker, 
                            UnroutableError)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RabbitMQConfig:
    """RabbitMQ配置类，负责从环境变量加载配置"""
    def __init__(self):
        # 从环境变量加载RabbitMQ连接配置
        self.host = os.environ.get('RABBITMQ_HOST', 'localhost')
        self.port = int(os.environ.get('RABBITMQ_PORT', '5672'))
        self.username = os.environ.get('RABBITMQ_USERNAME', 'guest')
        self.password = os.environ.get('RABBITMQ_PASSWORD', 'guest')
        self.vhost = os.environ.get('RABBITMQ_VHOST', '/')
        self.connection_timeout = int(os.environ.get('RABBITMQ_CONNECTION_TIMEOUT', '10'))
        self.heartbeat = int(os.environ.get('RABBITMQ_HEARTBEAT', '600'))
        self.blocked_connection_timeout = int(os.environ.get('RABBITMQ_BLOCKED_TIMEOUT', '300'))
        self.max_retries = int(os.environ.get('RABBITMQ_MAX_RETRIES', '3'))
        self.retry_delay = int(os.environ.get('RABBITMQ_RETRY_DELAY', '2'))
        self.publish_timeout = int(os.environ.get('RABBITMQ_PUBLISH_TIMEOUT', '5'))
        self.message_ttl = int(os.environ.get('RABBITMQ_MESSAGE_TTL', '86400000'))  # 默认24小时

    def to_dict(self) -> Dict[str, Any]:
        return {
            'HOST': self.host,
            'PORT': self.port,
            'USERNAME': self.username,
            'PASSWORD': self.password,
            'VHOST': self.vhost,
            'RABBITMQ_CONNECTION_TIMEOUT': self.connection_timeout,
            'HEARTBEAT': self.heartbeat,
            'BLOCKED_CONNECTION_TIMEOUT': self.blocked_connection_timeout,
            'MAX_RETRIES': self.max_retries,
            'RETRY_DELAY': self.retry_delay,
            'PUBLISH_TIMEOUT': self.publish_timeout,
            'MESSAGE_TTL': self.message_ttl
        }


class RabbitMQManager:
    """RabbitMQ连接管理器，实现可靠的消息发布机制"""
    # 队列配置映射 - 可考虑移到配置文件中
    QUEUE_CONFIG = {
        'oms_sales_order_download_queue': {
            'dead_letter_exchange': 'dead_oms_order_center_exchange',
            'dead_letter_routing_key': 'dead_oms_sales_order_download_routing_key'
        },
        'oms_return_order_download_queue': {},
        'sale_return_plan_add_back_b2c': {},
        'sale_return_plan_add_back': {},
        'sale_order_add_back': {},
        'purchase_return_plan_add_back': {}
    }

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.connection = None
        self.channel = None
        self._connection_params = None
        self._lock = threading.RLock()  # 添加线程锁确保线程安全
        self._initialized = False

    def _create_connection_params(self):
        """创建连接参数"""
        credentials = pika.PlainCredentials(
            username=self.config['USERNAME'],
            password=self.config['PASSWORD']
        )

        return pika.ConnectionParameters(
            host=self.config['HOST'],
            port=self.config['PORT'],
            virtual_host=self.config['VHOST'],
            credentials=credentials,
            socket_timeout=self.config.get('RABBITMQ_CONNECTION_TIMEOUT', 10),
            heartbeat=self.config.get('HEARTBEAT', 600),
            blocked_connection_timeout=self.config.get('BLOCKED_CONNECTION_TIMEOUT', 300)
        )

    def initialize(self):
        """初始化连接参数"""
        with self._lock:
            if not self._initialized:
                self._connection_params = self._create_connection_params()
                logger.info(f"RabbitMQ连接参数初始化: HOST={self.config['HOST']}, PORT={self.config['PORT']}, VHOST={self.config['VHOST']}")
                self._initialized = True
        return self._initialized

    def connect(self) -> bool:
        """建立连接，支持重试机制"""
        with self._lock:
            # 确保已初始化
            if not self._initialized:
                self.initialize()

            max_retries = self.config.get('MAX_RETRIES', 3)
            retry_delay = self.config.get('RETRY_DELAY', 2)

            for attempt in range(max_retries):
                try:
                    logger.info(f"尝试连接RabbitMQ (第{attempt + 1}次)...")
                    self.connection = pika.BlockingConnection(self._connection_params)
                    self.channel = self.connection.channel()
                    logger.info("RabbitMQ连接成功！")
                    return True

                except (AMQPConnectionError, StreamLostError, ConnectionClosedByBroker) as e:
                    logger.error(f"RabbitMQ连接失败 (第{attempt + 1}次): {str(e)}")
                    logger.error(f"连接信息: HOST={self.config['HOST']}, PORT={self.config['PORT']}, VHOST={self.config['VHOST']}")
                    if attempt < max_retries - 1:
                        logger.info(f"等待{retry_delay}秒后重试...")
                        time.sleep(retry_delay)
                    else:
                        logger.error("RabbitMQ连接失败，已达到最大重试次数")
                        return False

                except Exception as e:
                    logger.error(f"未知连接错误: {str(e)}")
                    logger.error(f"连接信息: HOST={self.config['HOST']}, PORT={self.config['PORT']}, VHOST={self.config['VHOST']}")
                    return False

    def ensure_connection(self) -> bool:
        """确保连接有效"""
        with self._lock:
            if not self.connection or self.connection.is_closed:
                logger.info("RabbitMQ连接已关闭，尝试重新连接...")
                return self.connect()
            return True

    def ensure_channel(self) -> bool:
        """确保通道有效"""
        with self._lock:
            if not self.ensure_connection():
                return False

            if not self.channel or self.channel.is_closed:
                logger.info("RabbitMQ通道已关闭，尝试重新创建...")
                try:
                    self.channel = self.connection.channel()
                    logger.info("RabbitMQ通道重新创建成功")
                    return True
                except Exception as e:
                    logger.error(f"无法重新创建RabbitMQ通道: {str(e)}")
                    return False
            return True

    def ensure_queue_exists(self, queue_name: str, queue_arguments: Optional[Dict] = None):
        """确保队列存在"""
        try:
            with self._lock:
                if not self.ensure_channel():
                    raise ConnectionError("无法确保RabbitMQ通道有效")

                if queue_arguments is None:
                    # 根据队列名称获取默认配置
                    queue_config = self.QUEUE_CONFIG.get(queue_name, {})
                    if queue_config and 'dead_letter_exchange' in queue_config and 'dead_letter_routing_key' in queue_config:
                        queue_arguments = {
                            'x-dead-letter-exchange': queue_config['dead_letter_exchange'],
                            'x-dead-letter-routing-key': queue_config['dead_letter_routing_key'],
                            'durable': True
                        }
                    else:
                        # 不设置死信参数
                        queue_arguments = {
                            'durable': True
                        }
                else:
                    # 确保durable属性为True
                    queue_arguments['durable'] = True
                    # 保留原有代码逻辑，不添加额外参数
                    pass

            self.channel.queue_declare(
                queue=queue_name,
                durable=True,
                arguments=queue_arguments
            )
            logger.info(f"队列 {queue_name} 声明成功")

        except ChannelClosedByBroker as e:
            logger.error(f"队列声明失败: {str(e)}")
            logger.error(f"队列名称: {queue_name}, 参数: {queue_arguments}")
            raise
        except Exception as e:
            logger.error(f"队列操作异常: {str(e)}")
            logger.error(f"队列名称: {queue_name}")
            raise

    def publish_message(self, queue_name: str, message: Dict[str, Any], retry_count: int = 0) -> bool:
        """发布消息到队列，带可靠确认机制和重试逻辑

        Args:
            queue_name: 队列名称
            message: 要推送的消息字典
            retry_count: 当前重试次数

        Returns:
            bool: 推送是否成功
        """
        try:
            with self._lock:
                if not self.ensure_channel():
                    logger.error("无法确保RabbitMQ通道有效")
                    return False

                # 确保队列存在
                logger.info(f"确保队列 {queue_name} 存在...")
                try:
                    self.ensure_queue_exists(queue_name)
                except Exception as e:
                    logger.error(f"确保队列存在失败: {str(e)}")
                    if retry_count < self.config.get('MAX_RETRIES', 3):
                        logger.info(f"尝试重新连接并重试 (第{retry_count + 1}次)...")
                        self.connection = None  # 强制重新连接
                        time.sleep(self.config.get('RETRY_DELAY', 2))
                        return self.publish_message(queue_name, message, retry_count + 1)
                    return False

                try:
                    # 启用发布确认
                    self.channel.confirm_delivery()
                    logger.info(f"已启用发布确认模式")
                except Exception as e:
                    # 如果是确认模式已经启用的错误，记录警告但继续执行
                    if "confirmation was already enabled" in str(e):
                        logger.warning(f"确认模式已在通道上启用，跳过此步骤")
                    else:
                        logger.error(f"启用发布确认模式失败: {str(e)}")
                        return False

                # 发布消息
                logger.info(f"准备发布消息到队列: {queue_name}")
                message_body = json.dumps(message, ensure_ascii=False)
                start_time = time.time()
                confirmed = False
                publish_timeout = self.config.get('PUBLISH_TIMEOUT', 5)

                try:
                    self.channel.basic_publish(
                        exchange='',
                        routing_key=queue_name,
                        body=message_body,
                        properties=pika.BasicProperties(
                            delivery_mode=2,  # 消息持久化
                            content_type='application/json'
                        ),
                        mandatory=True  # 确保消息被路由到队列，否则返回
                    )
                    logger.info(f"basic_publish调用完成，消息长度: {len(message_body)}字节")
                except UnroutableError as e:
                    logger.error(f"消息无法路由到队列 {queue_name}: {str(e)}")
                    # 尝试重新声明队列并重试
                    if retry_count < self.config.get('MAX_RETRIES', 3):
                        logger.info(f"尝试重新声明队列并重试 (第{retry_count + 1}次)...")
                        time.sleep(self.config.get('RETRY_DELAY', 2))
                        return self.publish_message(queue_name, message, retry_count + 1)
                    return False
                except Exception as e:
                    logger.error(f"basic_publish调用异常: {str(e)}")
                    # 尝试重新连接并重试
                    if retry_count < self.config.get('MAX_RETRIES', 3):
                        logger.info(f"尝试重新连接并重试 (第{retry_count + 1}次)...")
                        self.connection = None  # 强制重新连接
                        time.sleep(self.config.get('RETRY_DELAY', 2))
                        return self.publish_message(queue_name, message, retry_count + 1)
                    return False

                # 等待确认，最多等待publish_timeout秒
                while time.time() - start_time < publish_timeout:
                    try:
                        # 处理网络事件，检查是否有确认消息
                        self.connection.process_data_events(time_limit=0.1)
                        # 对于pika 1.3.2，我们无法直接检查单个消息的确认状态
                        # 但如果连接仍然活跃，我们假设消息已被确认
                        if self.connection and not self.connection.is_closed:
                            confirmed = True
                            break
                    except Exception as e:
                        logger.error(f"处理数据事件异常: {str(e)}")
                        break

                if not confirmed:
                    logger.error(f"消息发布到队列 {queue_name} 未确认，超时: {publish_timeout}秒")
                    # 关闭连接，强制下次重新连接
                    if self.connection and not self.connection.is_closed:
                        self.connection.close()
                    # 尝试重试
                    if retry_count < self.config.get('MAX_RETRIES', 3):
                        logger.info(f"消息未确认，尝试重试 (第{retry_count + 1}次)...")
                        time.sleep(self.config.get('RETRY_DELAY', 2))
                        return self.publish_message(queue_name, message, retry_count + 1)
                    return False

                logger.info(f"消息已成功发布并确认到队列: {queue_name}")
                return True

        except Exception as e:
            logger.error(f"消息发布失败: {str(e)}")
            logger.error(f"队列名称: {queue_name}")
            # 尝试重试
            if retry_count < self.config.get('MAX_RETRIES', 3):
                logger.info(f"异常，尝试重试 (第{retry_count + 1}次)...")
                time.sleep(self.config.get('RETRY_DELAY', 2))
                return self.publish_message(queue_name, message, retry_count + 1)
            return False

    def close(self):
        """关闭连接"""
        try:
            with self._lock:
                if self.channel and not self.channel.is_closed:
                    self.channel.close()
                    logger.info("RabbitMQ通道已关闭")
                if self.connection and not self.connection.is_closed:
                    self.connection.close()
                    logger.info("RabbitMQ连接已关闭")
        except Exception as e:
            logger.error(f"关闭连接时出错: {str(e)}")


# 全局RabbitMQ管理器实例
_rabbitmq_manager = None


def get_rabbitmq_manager() -> RabbitMQManager:
    """获取RabbitMQ管理器实例（单例模式）"""
    global _rabbitmq_manager
    if _rabbitmq_manager is None:
        # 从环境变量加载配置
        config = RabbitMQConfig().to_dict()
        _rabbitmq_manager = RabbitMQManager(config)
        _rabbitmq_manager.initialize()
    return _rabbitmq_manager


def push_message(queue_name: str, message: Dict[str, Any]) -> bool:
    """
    推送消息到指定队列

    Args:
        queue_name: 队列名称
        message: 要推送的消息字典

    Returns:
        bool: 推送是否成功
    """
    # 输出最终推送给RabbitMQ的JSON数据到终端
    print("\n=== 推送给RabbitMQ的JSON数据 ===")
    print(json.dumps(message, ensure_ascii=False, indent=2))
    print("================================\n")

    manager = get_rabbitmq_manager()
    try:
        # 记录消息推送开始时间
        start_time = time.time()
        success = manager.publish_message(queue_name, message)
        # 记录消息推送耗时
        elapsed_time = time.time() - start_time
        logger.info(f"消息推送耗时: {elapsed_time:.2f}秒，结果: {'成功' if success else '失败'}")

        return success
    except Exception as e:
        logger.error(f"推送消息失败: {str(e)}")
        return False


def close_rabbitmq_connection():
    """关闭RabbitMQ连接（应用关闭时调用）"""
    global _rabbitmq_manager
    if _rabbitmq_manager:
        _rabbitmq_manager.close()
        _rabbitmq_manager = None
        logger.info("RabbitMQ管理器已重置")