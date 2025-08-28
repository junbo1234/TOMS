from flask import Blueprint, request, jsonify, render_template
from config import config  # 导入配置实例
from app.utils.rabbitmq import push_message  # 复用RabbitMQ推送工具
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

# ==================== 蓝图定义 ====================
return_order_entry_bp = Blueprint('return_order_entry', __name__, url_prefix='/return_order_entry')


# ==================== 路由函数 ====================
# 退货单入库页面（GET请求）
@return_order_entry_bp.route('/')
def index():
    """退货单入库页面"""
    return render_template('return_order_entry.html', preset=config.RETURN_ORDER_ENTRY_PRESET)


# 获取退货单入库预设参数
@return_order_entry_bp.route('/preset')
def get_preset():
    """获取退货单入库预设参数"""
    return jsonify({
        'status': 'success',
        'preset': config.RETURN_ORDER_ENTRY_PRESET
    })


# 退货单入库接口（POST请求）
@return_order_entry_bp.route('/submit', methods=['POST'])
def submit():
    """退货单入库接口"""
    try:
        # 1. 获取用户输入（JSON格式）
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': '请求数据不能为空'
            }), 400

        # 2. 验证必填字段
        entry_order_code = data.get('callbackResponse', {}).get('entryOrder', {}).get('entryOrderCode')
        warehouse_code = data.get('callbackResponse', {}).get('entryOrder', {}).get('warehouseCode')
        detail_count = data.get('detail_count', 0)

        required_fields = {
            'entryOrderCode': entry_order_code,
            'warehouseCode': warehouse_code,
            'detail_count': detail_count
        }
        
        missing_fields = [field for field, value in required_fields.items() if not value]
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f'缺少必填字段: {", ".join(missing_fields)}'
            }), 400

        # 3. 处理时间字段
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        entry_order = data.get('callbackResponse', {}).get('entryOrder', {})
        entry_order['orderConfirmTime'] = current_time
        entry_order['operateTime'] = current_time

        # 4. 生成动态明细
        order_lines = []
        detail_count = int(detail_count)
        for i in range(detail_count):
            line_data = data.get(f'detail_{i}', {})
            item_code = line_data.get('itemCode')
            plan_qty = line_data.get('planQty')
            actual_qty = line_data.get('actualQty', plan_qty)

            if not item_code or not plan_qty:
                missing = []
                if not item_code: missing.append('itemCode')
                if not plan_qty: missing.append('planQty')
                return jsonify({
                    'status': 'error',
                    'message': f'明细 {i+1} 缺少必填字段: {", ".join(missing)}'
                }), 400

            order_line = {
                'orderLineNo': str(i+1),
                'itemCode': item_code,
                'itemId': item_code,
                'planQty': plan_qty,
                'actualQty': actual_qty,
                'inventoryType': 'ZP',
                'ownerCode': 'NEWTESTXIER'
            }
            order_lines.append(order_line)

        # 5. 更新数据结构
        callback_response = data.get('callbackResponse', {})

        # 6. 生成符合预览结构的orderLines
        formatted_order_lines = []
        for i, line in enumerate(order_lines):
            # 获取前端提交的原始明细数据
            original_detail = data.get(f'detail_{i}', {})
            
            # 构建符合预览结构的明细
            formatted_line = {
                'actualQty': line['actualQty'],
                'batchCode': '',
                'expireDate': '',
                'inventoryType': line['inventoryType'],
                'itemCode': line['itemCode'],
                'itemId': '',  # 预览JSON中itemId为空
                'itemName': original_detail.get('itemName', '儿童折叠滑板车'),  # 从原始数据获取或使用默认值
                'orderLineNo': line['orderLineNo'],
                'outBizCode': '',
                'ownerCode': line['ownerCode'],
                'planQty': line['planQty'],
                'produceCode': '',
                'productDate': ''
            }
            formatted_order_lines.append(formatted_line)

        callback_response['orderLines'] = formatted_order_lines

        # 7. 创建只包含预览结构中字段的最终数据
        final_data = {
            'callbackResponse': callback_response,
            'outOrderCode': data.get('outOrderCode', ''),
            'type': data.get('type', 2)
        }

        # 8. 推送消息到RabbitMQ
        queue_name = config.RETURN_ORDER_ENTRY_QUEUE
        push_success = push_message(queue_name, final_data)

        if push_success:
            return jsonify({
                'status': 'success',
                'message': '退货单入库数据已成功推送至队列',
                'data': {
                    'entry_order_code': entry_order_code,
                    'warehouse_code': warehouse_code
                }
            })
        else:
            return jsonify({
                'status': 'error',
                'message': '退货单入库数据推送至队列失败，请查看终端日志获取详细信息'
            }), 500    
    except ValueError as e:
        logger.error(f'ValueError: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'数据验证错误: {str(e)}'
        }), 400
    except Exception as e:
        logger.error(f'Exception: {str(e)}')
        return jsonify({
            'status': 'error',
            'message': f'系统错误: {str(e)}'
        }), 500