# app/routes/allocation_in.py
from flask import Blueprint, render_template, request, jsonify
from config import config  # 导入配置实例
from app.utils.rabbitmq import push_message  # 复用RabbitMQ推送工具
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

# ==================== 蓝图定义 ====================
allocation_in_bp = Blueprint('allocation_in', __name__, url_prefix='/allocation_in')


# ==================== 路由函数 ====================
# 调拨入库页面（GET请求）
@allocation_in_bp.route('/')
def index():
    """调拨入库页面"""
    return render_template('allocation_in.html', preset=config.ALLOCATION_ENTRY_PRESET)


# 调拨入库接口（POST请求）
@allocation_in_bp.route('/submit', methods=['POST'])
def submit():
    """调拨入库接口"""
    try:
        # 1. 获取JSON数据
        try:
            request_data = request.get_json()
            if not request_data:
                return jsonify({
                    'success': False,
                    'message': '请求数据格式错误，请提交JSON格式数据'
                }), 400
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'解析JSON数据失败: {str(e)}'
            }), 400

        # 2. 验证必填字段
        if not request_data.get('callbackResponse'):
            return jsonify({
                'success': False,
                'message': '请求数据结构错误'
            }), 400

        entry_order = request_data['callbackResponse'].get('entryOrder', {})
        entry_order_code = entry_order.get('entryOrderCode')
        warehouse_code = entry_order.get('warehouseCode')

        required_fields = {
            'entryOrderCode': entry_order_code,
            'warehouseCode': warehouse_code
        }
        
        missing_fields = [field for field, value in required_fields.items() if not value]
        if missing_fields:
            return jsonify({
                'success': False,
                'message': f"缺少必填字段: {', '.join(missing_fields)}"
            }), 400

        # 3. 验证订单行数据
        order_lines = request_data['callbackResponse'].get('orderLines', [])
        if not order_lines:
            return jsonify({
                'success': False,
                'message': '订单行数据不能为空'
            }), 400

        # 验证订单行中的必填字段
        for i, line in enumerate(order_lines):
            if not line.get('itemCode'):
                return jsonify({
                    'success': False,
                    'message': f'明细 {i+1} 缺少SKU编码'
                }), 400
            
            if not line.get('actualQty'):
                return jsonify({
                    'success': False,
                    'message': f'明细 {i+1} 缺少实际数量'
                }), 400
            
            try:
                # 验证数量为数字
                float(line['actualQty'])
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': f'明细 {i+1} 的实际数量必须为数字'
                }), 400

        # 4. 使用前端提交的JSON数据作为最终消息
        message_data = request_data
        
        # 更新操作时间为当前时间
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        message_data['callbackResponse']['entryOrder']['operateTime'] = current_time

        print('最终推送给RabbitMQ的报文:', json.dumps(message_data, ensure_ascii=False))

        # 5. 推送消息到RabbitMQ
        logger.info(f"开始推送调拨入库消息到队列: {config.ALLOCATION_ENTRY_QUEUE}")
        success = push_message(config.ALLOCATION_ENTRY_QUEUE, message_data)
        
        if success:
            logger.info(f"调拨入库消息推送成功: {entry_order_code}")
            return jsonify({
                'success': True,
                'message': '消息推送成功',
                'queue': config.ALLOCATION_ENTRY_QUEUE,
                'entry_order_code': entry_order_code
            })
        else:
            logger.error(f"调拨入库消息推送失败: {entry_order_code}")
            logger.error(f"队列名称: {config.ALLOCATION_ENTRY_QUEUE}")
            logger.error(f"消息内容: {json.dumps(message_data, ensure_ascii=False)}")
            return jsonify({
                'success': False,
                'message': '消息推送失败，请稍后重试'
            }), 500

    except ValueError as e:
        logger.error(f"参数验证错误: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'参数格式错误: {str(e)}'
        }), 400
    except Exception as e:
        logger.error(f"调拨入库处理异常: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'系统错误: {str(e)}'
        }), 500