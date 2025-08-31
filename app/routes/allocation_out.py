# app/routes/allocation_out.py
from flask import Blueprint, render_template, request, jsonify
from config import config  # 导入配置实例
from app.utils.rabbitmq import push_message  # 复用RabbitMQ推送工具
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

# ==================== 蓝图定义 ====================
allocation_out_bp = Blueprint('allocation_out', __name__, url_prefix='/allocation_out')


# ==================== 路由函数 ====================
# 调拨出库页面（GET请求）
@allocation_out_bp.route('/')
def index():
    """调拨出库页面"""
    return render_template('allocation_out.html', preset=config.ALLOCATION_OUT_PRESET)


# 调拨出库接口（POST请求）
@allocation_out_bp.route('/submit', methods=['POST'])
def submit():
    """调拨出库接口"""
    try:
        # 1. 获取用户输入（基础字段）
        delivery_order_code = request.form.get('deliveryOrderCode')
        warehouse_code = request.form.get('warehouseCode')
        detail_count = int(request.form.get('detail_count', 1))

        # 2. 验证必填字段
        required_fields = {
            'deliveryOrderCode': delivery_order_code,
            'warehouseCode': warehouse_code
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
            
            # 验证数量是否为数字
            try:
                int(actual_qty)
            except ValueError:
                return jsonify({
                    'status': 'error',
                    'message': f'明细 {i+1} 的实际数量必须为数字'
                }), 400
                
            details.append({
                'itemCode': item_code,
                'actualQty': actual_qty
            })

        # 4. 获取当前时间
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # 5. 合并预设参数与用户输入（生成最终消息）
        message_data = {
            **config.ALLOCATION_OUT_PRESET,
            'callbackResponse': {
                **config.ALLOCATION_OUT_PRESET['callbackResponse'],
                'deliveryOrder': {
                    **config.ALLOCATION_OUT_PRESET['callbackResponse']['deliveryOrder'],
                    'deliveryOrderCode': delivery_order_code,
                    'outBizCode': delivery_order_code,
                    'warehouseCode': warehouse_code,
                    'operateTime': current_time,
                    'orderConfirmTime': current_time
                },
                'orderLines': [
                    {
                        **config.ALLOCATION_OUT_PRESET['callbackResponse']['orderLines'][0],
                        'itemCode': detail['itemCode'],
                        'actualQty': detail['actualQty']
                    } for detail in details
                ]
            }
        }

        print("收到的 request.form:", dict(request.form))
        print('最终推送给RabbitMQ的报文:', json.dumps(message_data, ensure_ascii=False))

        # 6. 推送消息到RabbitMQ
        logger.info(f"开始推送调拨出库消息到队列: {config.ALLOCATION_OUT_QUEUE}")
        success = push_message(config.ALLOCATION_OUT_QUEUE, message_data)
        
        if success:
            logger.info(f"调拨出库消息推送成功: {delivery_order_code}")
            return jsonify({
                'status': 'success',
                'message': '消息推送成功',
                'queue': config.ALLOCATION_OUT_QUEUE,
                'order_no': delivery_order_code
            })
        else:
            logger.error(f"调拨出库消息推送失败: {delivery_order_code}")
            logger.error(f"队列名称: {config.ALLOCATION_OUT_QUEUE}")
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
        logger.error(f"调拨出库处理异常: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'系统错误: {str(e)}'
        }), 500


# 调拨出库预览接口（GET请求）
@allocation_out_bp.route('/preview', methods=['GET'])
def preview():
    """调拨出库预览接口"""
    try:
        # 获取用户输入
        delivery_order_code = request.args.get('deliveryOrderCode', '')
        warehouse_code = request.args.get('warehouseCode', '')
        detail_count = int(request.args.get('detail_count', 1))
        
        # 获取当前时间
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # 组装预览数据
        preview_data = {
            **config.ALLOCATION_OUT_PRESET,
            'callbackResponse': {
                **config.ALLOCATION_OUT_PRESET['callbackResponse'],
                'deliveryOrder': {
                    **config.ALLOCATION_OUT_PRESET['callbackResponse']['deliveryOrder'],
                    'deliveryOrderCode': delivery_order_code,
                    'outBizCode': delivery_order_code,
                    'warehouseCode': warehouse_code,
                    'operateTime': current_time,
                    'orderConfirmTime': current_time
                }
            }
        }
        
        # 处理明细数据
        order_lines = []
        for i in range(detail_count):
            item_code = request.args.get(f'itemCode{i}', '')
            actual_qty = request.args.get(f'actualQty{i}', '')
            
            order_line = {
                **config.ALLOCATION_OUT_PRESET['callbackResponse']['orderLines'][0],
                'itemCode': item_code,
                'actualQty': actual_qty
            }
            order_lines.append(order_line)
            
        preview_data['callbackResponse']['orderLines'] = order_lines
        
        return jsonify({
            'status': 'success',
            'data': preview_data
        })
        
    except Exception as e:
        logger.error(f"调拨出库预览异常: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'预览失败: {str(e)}'
        }), 500