from flask import Blueprint, request, render_template, jsonify, current_app
from config import config  # 导入配置实例
from app.utils.rabbitmq import push_message  # 复用RabbitMQ推送工具
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

# ==================== 蓝图定义 ====================
return_order_notice_bp = Blueprint('return_order_notice', __name__, url_prefix='/return_order_notice')


# ==================== 路由函数 ====================
# 通知单入库页面（GET请求）
@return_order_notice_bp.route('/')
def index():
    """通知单入库页面"""
    return render_template('return_order_notice.html', preset=config.RETURN_ORDER_NOTICE_PRESET)


# 通知单入库接口（POST请求）
@return_order_notice_bp.route('/submit', methods=['POST'])
def submit():
    """通知单入库接口"""
    try:
        # 1. 获取用户输入（基础字段）
        return_order_code = request.form.get('returnOrderCode')
        close_status = request.form.get('CloseStatus')
        warehouse_code = request.form.get('warehouseCode')
        detail_count = int(request.form.get('detail_count', 1))

        # 2. 验证必填字段
        required_fields = {
            'returnOrderCode': return_order_code,
            'warehouseCode': warehouse_code
        }
        
        missing_fields = [field for field, value in required_fields.items() if not value]
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f'缺少必填字段: {missing_fields}'
            })
        
        # 处理CloseStatus字段，如果为空则赋值为空字符串
        close_status = close_status if close_status else ''

        # 3. 获取商品明细
        order_lines = []
        for i in range(1, detail_count + 1):
            item_code = request.form.get(f'itemCode{i}')
            actual_qty = request.form.get(f'actualQty{i}')
            
            # 验证明细必填字段
            if not item_code or not actual_qty:
                return jsonify({
                    'status': 'error',
                    'message': f'第{i}行明细缺少必填字段: 商品编码或数量'
                })
            
            order_lines.append({
                'itemCode': item_code,
                'actualQty': actual_qty,
                'inventoryType': 'ZP',
                'orderLineNo': str(i),
                'ownerCode': 'XIER'
            })

        # 4. 合并参数
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        final_params = {
            'type': 2,
            'returnOrderCode': return_order_code,
            'callbackResponse': {
                'apiMethodName': 'returnorder.confirm',
                'orderLines': order_lines,
                'extendProps': {
                    'CloseStatus': close_status,
                    'ApiSource': 'FLUXWMS'
                },
                'responseClass': 'com.qimen.api.response.ReturnorderConfirmResponse',
                'returnOrder': {
                    'orderConfirmTime': current_time,
                    'orderType': 'THRK',
                    'outBizCode': '',
                    'ownerCode': 'XIER',
                    'remark': '',
                    'returnOrderCode': return_order_code,
                    'warehouseCode': warehouse_code
                },
                'version': '2.0'
            }
        }

        # 5. 推送消息到RabbitMQ
        queue_name = current_app.config.get('RETURN_ORDER_NOTICE_QUEUE', 'sale_return_plan_add_back_b2c')
        push_message(queue_name, final_params)

        return jsonify({
            'status': 'success',
            'message': '通知单入库成功',
            'data': final_params
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'处理失败: {str(e)}'
        })