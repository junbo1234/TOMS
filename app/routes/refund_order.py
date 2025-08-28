from flask import Blueprint, render_template, request, jsonify
from config import config  # 导入配置实例
from app.utils.rabbitmq import push_message  # 复用RabbitMQ推送工具
import logging
import json

logger = logging.getLogger(__name__)

# ==================== 蓝图定义 ====================
refund_order_bp = Blueprint('refund_order', __name__, url_prefix='/refund_order')


# ==================== 路由函数 ====================
# 退款单生成页面（GET请求）
@refund_order_bp.route('/')
def index():
    """退款单生成页面"""
    return render_template('refund_order.html', preset=config.REFUND_ORDER_PRESET)


# 退款单生成接口（POST请求）
@refund_order_bp.route('/submit', methods=['POST'])
def submit():
    """退款单生成接口"""
    try:
        # 1. 获取用户输入（基础字段）
        platform_order_no = request.form.get('platformOrderNo')
        platform_refund_no = request.form.get('platformRefundNo')
        apply_type = request.form.get('applyType')
        apply_reason = request.form.get('applyReason')
        refund_period = request.form.get('refundPeriod')
        store_id = request.form.get('storeId')
        express_no = request.form.get('expressNo')
        express_name = request.form.get('expressName')
        platform_status = request.form.get('platformStatus')
        oms_status = request.form.get('omsStatus')
        detail_count = int(request.form.get('detail_count', 1))

        # 2. 验证必填字段
        required_fields = {
            'platformOrderNo': platform_order_no,
            'platformRefundNo': platform_refund_no,
            'applyType': apply_type,
            'applyReason': apply_reason,
            'refundPeriod': refund_period,
            'storeId': store_id,
            'expressNo': express_no,
            'expressName': express_name,
            'platformStatus': platform_status,
            'omsStatus': oms_status
        }
        
        missing_fields = [field for field, value in required_fields.items() if not value]
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f'缺少必填字段: {",".join(missing_fields)}'
            }), 400

        # 3. 获取动态明细
        details = []
        platform_no_values = []
        for i in range(detail_count):
            platform_no = request.form.get(f'platformNo{i}')
            apply_num = request.form.get(f'applyNum{i}')
            
            # 验证明细字段
            if not all([platform_no, apply_num,]):
                return jsonify({
                    'status': 'error',
                    'message': f'明细 {i+1} 缺少必填字段'
                }), 400
                
            details.append({
                'platformNo': platform_no,
                'applyNum': apply_num
            })
            platform_no_values.append(platform_no)

        # 4. 合并预设参数与用户输入
        message_data = {
            **config.REFUND_ORDER_PRESET,
            'platformOrderNo': platform_order_no,
            'platformRefundNo': platform_refund_no,
            'applyType': apply_type,
            'applyReason': apply_reason,
            'refundPeriod': refund_period,
            'storeId': store_id,
            'expressNo': express_no,
            'expressName': express_name,
            'platformStatus': platform_status,
            'omsStatus': oms_status,
            # 根层级platformNo设为null
            'platformNo': None,
            # 动态明细
            'salesOrderRefundApplyDetailList': [
                {
                    **config.REFUND_ORDER_PRESET['salesOrderRefundApplyDetailList'][0],
                    'platformNo': detail['platformNo'],
                    'applyNum': detail['applyNum'],
                    'platformStatus': platform_status
                } for detail in details
            ]
        }

        logger.info(f"最终推送给RabbitMQ的报文: {json.dumps(message_data, ensure_ascii=False)}")

        # 5. 推送消息到RabbitMQ
        # 5. 推送消息到RabbitMQ
        success = push_message(config.REFUND_ORDER_QUEUE, message_data)
        
        if success:
            logger.info(f"退款单消息推送成功: {platform_refund_no}")
            return jsonify({
                'status': 'success',
                'message': '消息推送成功',
                'queue': config.REFUND_ORDER_QUEUE,
                'refund_no': platform_refund_no
            })
        else:
            logger.error(f"退款单消息推送失败: {platform_refund_no}")
            return jsonify({
                'status': 'error',
                'message': '消息推送失败，请检查RabbitMQ连接'
            }), 500

    except ValueError as e:
        logger.error(f"参数验证错误: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'参数格式错误: {str(e)}'
        }), 400
    except Exception as e:
        logger.error(f"退款单处理异常: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'系统错误: {str(e)}'
        }), 500