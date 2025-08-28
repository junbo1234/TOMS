from flask import Blueprint, render_template, request, jsonify
from config import config  # 导入配置实例
from app.utils.rabbitmq import push_message  # 复用RabbitMQ推送工具
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

# ==================== 蓝图定义 ====================
exchange_order_bp = Blueprint('exchange_order', __name__, url_prefix='/exchange_order')


# ==================== 路由函数 ====================
# 换货单生成页面（GET请求）
@exchange_order_bp.route('/')
def index():
    """换货单生成页面"""
    return render_template('exchange_order.html', preset=config.EXCHANGE_ORDER_PRESET)


# 换货单生成接口（POST请求）
@exchange_order_bp.route('/submit', methods=['POST'])
def submit():
    """换货单生成接口"""
    try:
        # 1. 获取用户输入（基础字段）
        platform_order_no = request.form.get('platformOrderNo')
        platform_exchange_no = request.form.get('platformExchangeNo')
        platform_status = request.form.get('platformStatus')
        platform_id = request.form.get('platformId')
        store_id = request.form.get('storeId')
        apply_num = request.form.get('applyNum')
        platform_in_sku_id = request.form.get('platformInSkuId')
        platform_no = request.form.get('platformNo')
        back_express_no = request.form.get('backExpressNo')
        back_express_name = request.form.get('backExpressName')
        detail_count = int(request.form.get('detail_count', 1))

        # 2. 验证必填字段
        required_fields = {
            'platformOrderNo': platform_order_no,
            'platformExchangeNo': platform_exchange_no,
            'platformStatus': platform_status,
            'platformId': platform_id,
            'storeId': store_id,
            'applyNum': apply_num,
            'platformInSkuId': platform_in_sku_id,
            'platformNo': platform_no
        }
        
        missing_fields = [field for field, value in required_fields.items() if not value]
        if missing_fields:
            return jsonify({
                'status': 'error',
                'message': f'缺少必填字段: {"|".join(missing_fields)}'
            }), 400

        # 3. 获取动态明细
        details = []
        for i in range(detail_count):
            platform_out_sku_code = request.form.get(f'platformOutSkuCode{i}')
            num = request.form.get(f'num{i}')
            
            # 验证明细字段
            if not all([platform_out_sku_code, num,]):
                return jsonify({
                    'status': 'error',
                    'message': f'明细 {i+1} 缺少必填字段'
                }), 400
            
            details.append({
                'platformOutSkuCode': platform_out_sku_code,
                'num': num
            })

        # 4. 获取当前时间，格式为ISO格式
        current_time = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')

        # 5. 合并预设参数与用户输入
        message_data = {
            **config.EXCHANGE_ORDER_PRESET,
            'applyTime': current_time,
            'applyUpdateTime': current_time,
            'platformOrderNo': platform_order_no,
            'platformExchangeNo': platform_exchange_no,
            'platformStatus': platform_status,
            'platformId': platform_id,
            'storeId': store_id,
            'backExpressNo': back_express_no,
            'backExpressName': back_express_name,
            # 处理退回商品信息
            'exchangeSkuList': [{
                'applyNum': apply_num,
                'platformInSkuId': platform_in_sku_id,
                'platformNo': platform_no
            }],
            # 处理换出商品列表
            'exchangeSkuOutList': details
        }

        logger.info(f"最终推送给RabbitMQ的报文: {json.dumps(message_data, ensure_ascii=False)}")

        # 6. 推送消息到RabbitMQ
        success = push_message(config.EXCHANGE_ORDER_QUEUE, message_data)
        
        if success:
            logger.info(f"换货单消息推送成功: {platform_exchange_no}")
            return jsonify({
                'status': 'success',
                'message': '消息推送成功',
                'queue': config.EXCHANGE_ORDER_QUEUE,
                'exchange_no': platform_exchange_no
            })
        else:
            logger.error(f"换货单消息推送失败: {platform_exchange_no}")
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
        logger.error(f"换货单处理异常: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'系统错误: {str(e)}'
        }), 500