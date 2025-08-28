import logging
import datetime
import json
from flask import Blueprint, render_template, request, jsonify
from app.utils.rabbitmq import push_message
from .. import config

logger = logging.getLogger(__name__)

# ==================== 蓝图定义 ====================
stockout_push_bp = Blueprint('stockout_push', __name__, url_prefix='/stockout_push')


# ==================== 辅助函数 ====================

def transform_form_data(data):
    # 提取基础信息 - 支持从根级别或callbackResponse.deliveryOrder获取
    delivery_order_code = data.get('deliveryOrderCode') or data.get('callbackResponse', {}).get('deliveryOrder', {}).get('deliveryOrderCode')
    warehouse_code = data.get('warehouseCode') or data.get('callbackResponse', {}).get('deliveryOrder', {}).get('warehouseCode')
    
    # 增加日志以便调试
    logger.info(f"接收到的数据: {data}")
    logger.info(f"提取的delivery_order_code: {delivery_order_code}")
    logger.info(f"提取的warehouse_code: {warehouse_code}")
    
    # 获取当前时间
    current_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # 构建订单行
    order_lines = []
    # 尝试从不同位置获取商品编码和数量，确保itemCode不为空
    # 1. 尝试从表单直接获取数组
    item_codes = data.get('itemCodes', [])
    actual_qtys = data.get('actualQtys', [])
    
    # 2. 如果没有，尝试从callbackResponse.orderLines获取
    if not item_codes:
        order_lines_data = data.get('callbackResponse', {}).get('orderLines', [])
        for item in order_lines_data:
            if isinstance(item, dict):
                item_codes.append(item.get('itemCode', ''))
                actual_qtys.append(item.get('actualQty', ''))
    
    # 3. 确保至少有一个商品
    if not item_codes:
        item_codes = ['']  # 提供一个空字符串，确保循环至少执行一次
        actual_qtys = ['1']  # 默认数量为1
    
    for i, code in enumerate(item_codes):
        # 获取数量，如果没有则默认为1
        qty = actual_qtys[i] if i < len(actual_qtys) else '1'
            
        order_lines.append({
            'actualQty': str(qty),  # 确保actualQty为字符串
            'inventoryType': 'ZP',
            'itemCode': code or '',  # 确保itemCode不为None
            'orderLineNo': '',  # 空字符串
            'ownerCode': 'XIER'
        })
    
    # 构建最终数据结构
    # 先创建空结构，然后合并预设值，最后设置我们的值以确保不会被覆盖
    transformed_data = {}
    callback_response = {}
    delivery_order = {}
    
    # 合并预设值
    if hasattr(config, 'STOCKOUT_PUSH_PRESET'):
        transformed_data = {**config.STOCKOUT_PUSH_PRESET}
        callback_response = {**config.STOCKOUT_PUSH_PRESET.get('callbackResponse', {})}
        delivery_order = {**config.STOCKOUT_PUSH_PRESET.get('callbackResponse', {}).get('deliveryOrder', {})}
    
    # 设置根级别字段
    transformed_data['outOrderCode'] = ''  # 根级别outOrderCode设为空字符串
    transformed_data['type'] = 2
    
    # 设置callbackResponse字段
    callback_response['apiMethodName'] = 'stockout.confirm'
    callback_response['responseClass'] = 'com.qimen.api.response.StockoutConfirmResponse'
    callback_response['version'] = '2.0'
    callback_response['outOrderCode'] = delivery_order_code  # 确保callbackResponse层级有outOrderCode
    callback_response['orderLines'] = order_lines
    
    # 设置deliveryOrder字段
    delivery_order['confirmType'] = 0
    delivery_order['deliveryOrderCode'] = delivery_order_code
    delivery_order['warehouseCode'] = warehouse_code
    delivery_order['operateTime'] = current_time
    delivery_order['orderConfirmTime'] = current_time
    delivery_order['orderType'] = 'PTCK'
    delivery_order['outBizCode'] = delivery_order_code  # 确保outBizCode与deliveryOrderCode一致
    delivery_order['ownerCode'] = 'XIER'
    delivery_order['status'] = 'DELIVERED'
    
    # 组装数据结构
    callback_response['deliveryOrder'] = delivery_order
    transformed_data['callbackResponse'] = callback_response
    
    logger.info(f"转换后的JSON数据: {json.dumps(transformed_data, ensure_ascii=False)}")
    
    return transformed_data


# ==================== 路由函数 ====================
@stockout_push_bp.route('/')
def index():
    # 出库单推送页面
    return render_template('stockout_push.html', preset=config.STOCKOUT_PUSH_PRESET)


@stockout_push_bp.route('/api/stockout_push', methods=['POST'])
def submit():
    # 出库单推送接口：推送数据到RabbitMQ
    try:
        # 1. 获取表单数据
        data = request.get_json()
        if not data:
            return jsonify({
                'status': 'error',
                'message': '请求数据为空'
            }), 400

        # 2. 转换表单数据格式
        transformed_data = transform_form_data(data)

        # 3. 验证必填字段
        delivery_order = transformed_data['callbackResponse']['deliveryOrder']
        required_fields = {
            'deliveryOrderCode': delivery_order.get('deliveryOrderCode'),
            'warehouseCode': delivery_order.get('warehouseCode')
        }

        missing_fields = [field for field, value in required_fields.items() if not value]
        if missing_fields:
            error_msg = f"缺少必填字段: {', '.join(missing_fields)}"
            logger.warning(f"出库单推送验证失败: {error_msg}")
            return jsonify({
                'status': 'error',
                'message': error_msg
            }), 400

        # 4. 推送消息到RabbitMQ
        logger.info(f"最终推送给RabbitMQ的报文: {json.dumps(transformed_data, ensure_ascii=False)}")
        logger.info(f"推送队列名称: {config.STOCKOUT_PUSH_QUEUE}")
        success = push_message(config.STOCKOUT_PUSH_QUEUE, transformed_data)
        logger.info(f"推送结果: {success}")

        if success:
            logger.info(f"出库单推送消息成功: {delivery_order.get('deliveryOrderCode')}")
            return jsonify({
                'status': 'success',
                'message': '出库单推送成功',
                'queue': config.STOCKOUT_PUSH_QUEUE,
                'delivery_order_code': delivery_order.get('deliveryOrderCode')
            }), 200
        else:
            logger.error(f"出库单推送消息失败: {delivery_order.get('deliveryOrderCode')}")
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
        logger.error(f"出库单推送处理异常: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'系统错误: {str(e)}'
        }), 500