# app/routes/order_download.py（优化后）
from flask import Blueprint, render_template, request, jsonify
from config import config  # 导入配置实例
from app.utils.rabbitmq import push_message  # 复用RabbitMQ推送工具
import logging
import json

logger = logging.getLogger(__name__)

# ==================== 蓝图定义 ====================
order_download_bp = Blueprint('order_download', __name__, url_prefix='/order_download')


# ==================== 路由函数 ====================
# 订单下载页面（GET请求）
@order_download_bp.route('/')
def index():
    """订单下载页面"""
    return render_template('order_download.html', preset=config.ORDER_DOWNLOAD_PRESET)


# 订单下载接口（POST请求）
@order_download_bp.route('/submit', methods=['POST'])
def submit():
    """订单下载接口"""
    try:
        # 1. 获取用户输入（基础字段）
        address = request.form.get('address')
        platform_order_no = request.form.get('platformOrderNo')
        store_id = request.form.get('storeId')
        platform_pay_time = request.form.get('platformPayTime')
        detail_count = int(request.form.get('detail_count', 1))

        # 2. 验证必填字段
        required_fields = {
            'address': address,
            'platformOrderNo': platform_order_no,
            'storeId': store_id,
            'platformPayTime': platform_pay_time
        }
        
        missing_fields = [field for field, value in required_fields.items() if not value]
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f'缺少必填字段: {", ".join(missing_fields)}'
            }), 400

        # 3. 获取动态明细（platformOuterSkuCode、platformNo、qty、isGift）
        details = []
        for i in range(detail_count):
            platform_outer_sku_code = request.form.get(f'platformOuterSkuCode{i}')
            platform_no = request.form.get(f'platformNo{i}')
            qty = request.form.get(f'qty{i}')
            is_gift = request.form.get(f'isGift{i}', '0')
            
            # 验证明细字段
            if not all([platform_outer_sku_code, platform_no, qty]):
                return jsonify({
                    'status': 'error',
                    'message': f'明细 {i+1} 缺少必填字段'
                }), 400
                
            details.append({
                'platformOuterSkuCode': platform_outer_sku_code,
                'platformNo': platform_no,
                'qty': qty,
                'isGift': is_gift
            })

        # 4. 合并预设参数与用户输入（生成最终消息）
        message_data = {
            **config.ORDER_DOWNLOAD_PRESET,
            'address': address,
            'platformOrderNo': platform_order_no,
            'storeId': store_id,
            'platformPayTime': platform_pay_time,
            # 动态明细：替换预设中的platformOuterSkuCode、platformNo、qty
            'salesOrderDetailConvertDTOList': [
                {
                    **{k: v for k, v in config.ORDER_DOWNLOAD_PRESET['salesOrderDetailConvertDTOList'][0].items() if k != 'sku'},
                    'platformOuterSkuCode': detail['platformOuterSkuCode'],
                    'platformNo': detail['platformNo'],
                    'qty': detail['qty'],
                    'isGift': detail['isGift']
                } for detail in details
            ],
            # 支付时间：更新到扩展字段
            'salesOrderExtConvertDTO': {
                **config.ORDER_DOWNLOAD_PRESET['salesOrderExtConvertDTO'],
                'platformPayTime': platform_pay_time
            }
        }

        print("收到的 request.form:", dict(request.form))
        print('最终推送给RabbitMQ的报文:', json.dumps(message_data, ensure_ascii=False))

        # 5. 推送消息到RabbitMQ
        logger.info(f"开始推送订单下载消息到队列: {config.ORDER_DOWNLOAD_QUEUE}")
        success = push_message(config.ORDER_DOWNLOAD_QUEUE, message_data)
        
        if success:
            logger.info(f"订单下载消息推送成功: {platform_order_no}")
            return jsonify({
                'status': 'success',
                'message': '消息推送成功',
                'queue': config.ORDER_DOWNLOAD_QUEUE,
                'order_no': platform_order_no
            })
        else:
            logger.error(f"订单下载消息推送失败: {platform_order_no}")
            logger.error(f"队列名称: {config.ORDER_DOWNLOAD_QUEUE}")
            logger.error(f"消息内容: {json.dumps(message_data, ensure_ascii=False)}")
            return jsonify({
                'status': 'error',
                'message': '消息推送失败，请检查RabbitMQ连接和终端日志'
            }), 500

    except ValueError as e:
        logger.error(f"参数验证错误: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'参数格式错误: {str(e)}'
        }), 400
    except Exception as e:
        logger.error(f"订单下载处理异常: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'系统错误: {str(e)}'
        }), 500