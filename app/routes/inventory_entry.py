# app/routes/inventory_entry.py
from flask import Blueprint, render_template, request, jsonify
from config import config  # 导入配置实例
from app.utils.rabbitmq import push_message  # 复用RabbitMQ推送工具
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

# ==================== 蓝图定义 ====================
inventory_entry_bp = Blueprint('inventory_entry', __name__, url_prefix='/inventory_entry')


# ==================== 路由函数 ====================
# 其他入库页面（GET请求）
@inventory_entry_bp.route('/')
def index():
    """其他入库页面"""
    return render_template('inventory_entry.html', preset=config.INVENTORY_ENTRY_PRESET)


# 其他入库接口（POST请求）
@inventory_entry_bp.route('/submit', methods=['POST'])
def submit():
    """其他入库接口"""
    try:
        # 1. 获取用户输入（基础字段）
        entry_order_code = request.form.get('entryOrderCode')
        detail_count = int(request.form.get('detail_count', 1))

        # 2. 验证必填字段
        required_fields = {
            'entryOrderCode': entry_order_code
        }
        
        missing_fields = [field for field, value in required_fields.items() if not value]
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f'缺少必填字段: {", ".join(missing_fields)}'
            }), 400

        # 3. 获取动态明细（itemCode、actualQty）
        details = []
        for i in range(detail_count):
            item_code = request.form.get(f'itemCode{i}')
            actual_qty = request.form.get(f'actualQty{i}')
            
            # 验证明细字段
            if not all([item_code, actual_qty]):
                return jsonify({
                    'status': 'error',
                    'message': f'明细 {i+1} 缺少必填字段'
                }), 400
                
            details.append({
                'itemCode': item_code,
                'actualQty': actual_qty
            })

        # 4. 获取当前时间
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # 5. 合并预设参数与用户输入（生成最终消息）
        message_data = {
            **config.INVENTORY_ENTRY_PRESET,
            'entryOrderCode': entry_order_code,
            'callbackResponse': {
                **config.INVENTORY_ENTRY_PRESET['callbackResponse'],
                'entryOrder': {
                    **config.INVENTORY_ENTRY_PRESET['callbackResponse']['entryOrder'],
                    'entryOrderCode': entry_order_code,
                    'entryOrderId': entry_order_code,
                    'outBizCode': entry_order_code,
                    'operateTime': current_time
                },
                'orderLines': [
                    {
                        **{k: v for k, v in config.INVENTORY_ENTRY_PRESET['callbackResponse']['orderLines'][0].items()},
                        'itemCode': detail['itemCode'],
                        'actualQty': int(detail['actualQty'])
                    } for detail in details
                ]
            }
        }

        print("收到的 request.form:", dict(request.form))
        print('最终推送给RabbitMQ的报文:', json.dumps(message_data, ensure_ascii=False))

        # 6. 推送消息到RabbitMQ
        logger.info(f"开始推送其他入库消息到队列: {config.INVENTORY_ENTRY_QUEUE}")
        success = push_message(config.INVENTORY_ENTRY_QUEUE, message_data)
        
        if success:
            logger.info(f"其他入库消息推送成功: {entry_order_code}")
            return jsonify({
                'status': 'success',
                'message': '消息推送成功',
                'queue': config.INVENTORY_ENTRY_QUEUE,
                'order_no': entry_order_code
            })
        else:
            logger.error(f"其他入库消息推送失败: {entry_order_code}")
            logger.error(f"队列名称: {config.INVENTORY_ENTRY_QUEUE}")
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
        logger.error(f"其他入库处理异常: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'系统错误: {str(e)}'
        }), 500