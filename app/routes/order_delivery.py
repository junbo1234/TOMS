from email import message
import logging
import datetime
from jinja2.filters import K
from app.utils.rabbitmq import push_message  # 复用RabbitMQ推送工具
import json
from flask import Blueprint, render_template, request, jsonify
from .. import config

logger = logging.getLogger(__name__)

# ==================== 蓝图定义 ====================
order_delivery_bp = Blueprint('order_delivery', __name__, url_prefix='/order_delivery')


# ==================== 辅助函数 ====================
def normalize_numeric_fields(data):
    """规范化JSON数据中的数值字段"""
    if isinstance(data, dict):
        # 处理orderLines
        if 'orderLines' in data.get('callbackResponse', {}):
            for line in data['callbackResponse']['orderLines']:
                # 转换orderLines中的数值字段
                for field in ['actualQty', 'planQty']:
                    if field in line:
                        line[field] = float(line[field]) if isinstance(line[field], str) else line[field]

                # 处理batchs
                if 'batchs' in line:
                    for batch in line['batchs']:
                        if 'actualQty' in batch:
                            batch['actualQty'] = float(batch['actualQty']) if isinstance(batch['actualQty'], str) else batch['actualQty']

        # 处理packages
        if 'packages' in data.get('callbackResponse', {}):
            for pkg in data['callbackResponse']['packages']:
                # 转换packages中的数值字段
                for field in ['height', 'length', 'volume', 'weight', 'width']:
                    if field in pkg:
                        pkg[field] = float(pkg[field]) if isinstance(pkg[field], str) else pkg[field]

                # 处理items
                if 'items' in pkg:
                    for item in pkg['items']:
                        if 'quantity' in item:
                            item['quantity'] = float(item['quantity']) if isinstance(item['quantity'], str) else item['quantity']

                # 处理packageMaterialList
                if 'packageMaterialList' in pkg:
                    for material in pkg['packageMaterialList']:
                        if 'quantity' in material:
                            material['quantity'] = float(material['quantity']) if isinstance(material['quantity'], str) else material['quantity']
    return data


def transform_form_data(data):
    """将表单数据转换为后端期望的格式"""
    # 直接从data中提取deliveryOrder和callbackResponse
    callback_response = data.get('callbackResponse', {})
    delivery_order = callback_response.get('deliveryOrder', {}) or data.get('deliveryOrder', {})

    # 提取基本信息
    delivery_order_code = delivery_order.get('deliveryOrderCode')
    warehouse_code = delivery_order.get('warehouseCode')
    delivery_order_id = delivery_order.get('deliveryOrderId', '')
    out_biz_code = delivery_order.get('outBizCode', '')

    # 构建订单行项目
    order_lines = delivery_order.get('orderLines', []) or callback_response.get('orderLines', [])
    normalized_order_lines = []
    for line in order_lines:
        item_code = line.get('itemCode')
        if not item_code:
            continue

        quantity = line.get('actualQty') or line.get('planQty', 0)
        current_time = datetime.datetime.now()
        expire_date = current_time .strftime('%Y-%m-%d')

        normalized_line = {
            'actualQty': str(quantity),
            'planQty': str(quantity),
            'itemCode': item_code,
            'itemId': '6941428606747',  # 固定itemId，与用户提供的报文一致
            'ownerCode': '0212000695',
            'inventoryType': 'ZP',
            'batchCode': 'BH36520121703000017',  # 固定batchCode格式
            'productDate': '2019-12-17',  # 固定productDate
            'expireDate': expire_date,  # 动态计算expireDate
            'batchs': [{
                'actualQty': str(quantity),
                'batchCode': 'BH36520121703000017',
                'productDate': '2019-12-17',
                'expireDate': expire_date,
                'inventoryType': 'ZP'
            }]
        }
        normalized_order_lines.append(normalized_line)

    # 构建包裹信息
    packages = delivery_order.get('packages', []) or callback_response.get('packages', [])
    normalized_packages = []
    for pkg in packages:
        # 直接从包裹中提取物流信息
        express_code = pkg.get('expressCode')
        logistics_code = pkg.get('logisticsCode')
        logistics_name = pkg.get('logisticsName')

        normalized_pkg = {
            'expressCode': express_code,
            'logisticsCode': logistics_code,
            'logisticsName': logistics_name,
            'height': '0',  # 改为字符串
            'length': '0',  # 改为字符串
            'width': '0',  # 改为字符串
            'weight': '11.32',  # 固定重量
            'volume': '0',  # 改为字符串
            'items': [{
                'itemCode': item.get('itemCode'),
                'itemId': '6941428606747',  # 固定itemId
                'quantity': str(item.get('quantity', 0))
            } for item in pkg.get('items', []) if item.get('itemCode')],
            'packageMaterialList': [{
                'type': 'BC0011',
                'quantity': '1'  # 改为字符串
            }]
        }
        normalized_packages.append(normalized_pkg)

    # 构建完整数据结构
    transformed_data = {
        'callbackResponse': {
            'apiMethodName': 'deliveryorder.confirm',
            'deliveryOrder': {
                'confirmType': 0,
                'deliveryOrderCode': delivery_order_code,
                'deliveryOrderId': delivery_order_id,
                'orderConfirmTime': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'orderType': 'JYCK',
                'outBizCode': out_biz_code,
                'status': 'DELIVERED',
                'warehouseCode': warehouse_code
                # 移除物流信息字段
            },
            'orderLines': normalized_order_lines,
            'packages': normalized_packages,
            'responseClass': 'com.qimen.api.response.DeliveryorderConfirmResponse',
            'version': '2.0'
        },
        'type': 2
    }

    return transformed_data


# ==================== 路由函数 ====================
@order_delivery_bp.route('/')
def index():
    """销售订单发货页面"""
    return render_template('order_delivery.html', preset=config.ORDER_DELIVERY_PRESET)


@order_delivery_bp.route('/submit', methods=['POST'])
def submit():
    """销售订单发货接口：推送整合后的JSON到RabbitMQ"""
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

        # 3. 规范化数值字段类型
        normalized_data = normalize_numeric_fields(transformed_data)

        # 4. 提取回调响应数据并验证必填字段
        callback_response = normalized_data.get('callbackResponse', {})
        delivery_order = callback_response.get('deliveryOrder', {})
        packages = callback_response.get('packages', [])

        # 从deliveryOrder中验证基础必填字段
        required_delivery_fields = {
            'deliveryOrderCode': delivery_order.get('deliveryOrderCode'),
            'warehouseCode': delivery_order.get('warehouseCode')
        }

        # 检查deliveryOrder必填字段
        missing_delivery_fields = [field for field, value in required_delivery_fields.items() if value is None or value == '']
        if missing_delivery_fields:
            field_info = ', '.join([f"{field}={required_delivery_fields[field]}" for field in missing_delivery_fields])
            error_msg = f"缺少必填字段或字段值为空: {field_info}"
            logger.warning(f"订单发货验证失败: {error_msg}")
            return jsonify({
                'status': 'error',
                'message': error_msg
            }), 400

        # 从packages中验证物流必填字段
        if not packages:
            error_msg = "缺少包裹信息"
            logger.warning(f"订单发货验证失败: {error_msg}")
            return jsonify({
                'status': 'error',
                'message': error_msg
            }), 400

        # 获取第一个包裹的物流信息
        first_package = packages[0]
        required_package_fields = {
            'logisticsCode': first_package.get('logisticsCode'),
            'logisticsName': first_package.get('logisticsName'),
            'expressCode': first_package.get('expressCode')
        }

        # 检查packages必填字段
        missing_package_fields = [field for field, value in required_package_fields.items() if value is None or value == '']
        if missing_package_fields:
            field_info = ', '.join([f"{field}={required_package_fields[field]}" for field in missing_package_fields])
            error_msg = f"缺少必填字段或字段值为空: {field_info}"
            logger.warning(f"订单发货验证失败: {error_msg}")
            return jsonify({
                'status': 'error',
                'message': error_msg
            }), 400

        # 5. 推送消息到销售订单发货队列
        success = push_message(config.ORDER_DELIVERY_QUEUE, normalized_data)

        if success:
            logger.info(f"销售订单发货消息推送成功: {delivery_order.get('deliveryOrderCode')}")
            return jsonify({
                'status': 'success',
                'message': '销售订单回传消息推送成功',
                'queue': config.ORDER_DELIVERY_QUEUE,
                'order_code': delivery_order.get('deliveryOrderCode')
            }), 200
        else:
            logger.error(f"销售订单发货消息推送失败: {delivery_order.get('deliveryOrderCode')}")
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
        logger.error(f"销售订单发货处理异常: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'系统错误: {str(e)}'
        }), 500


@order_delivery_bp.route('/test_transform', methods=['GET'])
def test_transform():
    """测试表单数据转换功能"""
    # 模拟表单数据
    test_data = {
        'deliveryOrder': {
            'deliveryOrderCode': 'TEST123456',
            'warehouseCode': 'WH001',
            'logisticsCode': 'ZT',
            'logisticsName': '中通',
            'expressCode': 'EXP123456',
            'orderLines': [
                {
                    'itemCode': '6941428688156',
                    'actualQty': 1
                }
            ],
            'packages': [
                {
                    'height': 10,
                    'length': 20,
                    'width': 15,
                    'weight': 5.5,
                    'items': [
                        {
                            'itemCode': '6941428688156',
                            'quantity': 1
                        }
                    ]
                }
            ]
        }
    }
    
    # 调用转换函数
    transformed_data = transform_form_data(test_data)
    
    # 返回转换结果
    return jsonify({
        'original_data': test_data,
        'transformed_data': transformed_data
    })
