#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""其他出库功能后端逻辑"""

from flask import Blueprint, render_template, request, jsonify, current_app
from datetime import datetime
from config import config
from app.utils.rabbitmq import push_message
import logging
import json

logger = logging.getLogger(__name__)

inventory_out_bp = Blueprint('inventory_out', __name__, url_prefix='/inventory_out')


@inventory_out_bp.route('/')
def index():
    """渲染其他出库页面"""
    try:
        # 获取预设参数
        try:
            preset_params = config.INVENTORY_OUT_PRESET
            # 添加详细的日志信息
            logger.info(f"其他出库页面加载，预设参数: {preset_params}")
        except AttributeError:
            preset_params = {}
            logger.warning("其他出库预设参数未找到，使用空字典")
        
        # 动态明细字段配置
        detail_fields = [
            {
                'idPrefix': 'itemCode',
                'namePrefix': 'itemCode',
                'label': '商品SKU',
                'placeholder': '请输入商品SKU',
                'type': 'text',
                'required': True,
                'icon': 'fas fa-barcode'
            },
            {
                'idPrefix': 'actualQty',
                'namePrefix': 'actualQty',
                'label': '实际数量',
                'placeholder': '请输入实际数量',
                'type': 'number',
                'min': '1',
                'required': True,
                'icon': 'fas fa-boxes'
            }
        ]

        return render_template(
            'inventory_out.html',
            preset=preset_params,
            detail_fields=detail_fields,
            page_title='其他出库',
            page_type='inventory_out'
        )
    except Exception as e:
        logger.error(f"加载其他出库页面失败: {str(e)}")
        return jsonify({'status': 'error', 'message': '页面加载失败，请稍后重试'}), 500


@inventory_out_bp.route('/submit', methods=['POST'])
def submit():
    """处理其他出库表单提交"""
    try:
        # 获取表单数据
        form_data = request.form.to_dict()
        logger.info(f"其他出库表单提交，数据: {form_data}")

        # 表单验证 - 手动验证必填字段
        delivery_order_code = form_data.get('deliveryOrderCode')
        detail_count_str = form_data.get('detail_count')
        
        # 检查必填字段
        required_fields = {}
        if not delivery_order_code or len(delivery_order_code) > 100:
            required_fields['deliveryOrderCode'] = '物流单号不能为空且长度不能超过100个字符'
        
        if not detail_count_str:
            required_fields['detail_count'] = '明细数量不能为空'
        else:
            try:
                detail_count = int(detail_count_str)
                if detail_count < 1 or detail_count > 100:
                    required_fields['detail_count'] = '明细数量必须在1到100之间'
            except ValueError:
                required_fields['detail_count'] = '明细数量必须为整数'
        
        if required_fields:
            logger.warning(f"表单验证失败: {required_fields}")
            return jsonify({'status': 'error', 'message': required_fields}), 400

        # 获取预设参数
        try:
            preset_params = config.INVENTORY_OUT_PRESET
        except AttributeError:
            preset_params = {}
            logger.warning("库存出库预设参数未找到，使用空字典")
        
        # 获取当前时间
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # 构建完整的订单数据
        order_data = {
            'type': 2,
            'callbackResponse': {
                'apiMethodName': 'stockout.confirm',
                'deliveryOrder': {
                    'confirmType': 0,
                    'deliveryOrderCode': form_data['deliveryOrderCode'],
                    'operateTime': current_time,
                    'orderConfirmTime': current_time,
                    'orderType': 'DBCK',
                    'outBizCode': form_data['deliveryOrderCode'],
                    'ownerCode': 'XIER',
                    'status': 'PARTDELIVERED',
                    'warehouseCode': 'DCN'
                },
                'orderLines': [],
                'responseClass': 'com.qimen.api.response.StockoutConfirmResponse',
                'version': '2.0'
            }
        }

        # 添加明细数据
        detail_count = int(form_data['detail_count'])
        order_lines = []

        for i in range(detail_count):
            # 验证明细字段
            item_code_key = f'itemCode{i}'
            actual_qty_key = f'actualQty{i}'

            if item_code_key not in form_data or not form_data[item_code_key]:
                logger.warning(f"明细 {i+1} 商品SKU缺失")
                return jsonify({'status': 'error', 'message': f'明细 {i+1} 商品SKU不能为空'}), 400

            if actual_qty_key not in form_data or not form_data[actual_qty_key]:
                logger.warning(f"明细 {i+1} 实际数量缺失")
                return jsonify({'status': 'error', 'message': f'明细 {i+1} 实际数量不能为空'}), 400

            try:
                actual_qty = int(form_data[actual_qty_key])
                if actual_qty < 0:
                    raise ValueError()
            except ValueError:
                logger.warning(f"明细 {i+1} 实际数量格式错误")
                return jsonify({'status': 'error', 'message': f'明细 {i+1} 实际数量必须为非负整数'}), 400

            line = {
                'actualQty': str(actual_qty),
                'inventoryType': 'ZP',
                'itemCode': form_data[item_code_key],
                'orderLineNo': str(i + 1),
                'ownerCode': 'XIER'
            }
            order_lines.append(line)

        order_data['callbackResponse']['orderLines'] = order_lines

        # 记录组装后的订单数据
        logger.info(f"组装后的订单数据: {json.dumps(order_data, ensure_ascii=False, indent=2)}")

        # 推送RabbitMQ
        rabbitmq_queue = 'stock_out_back'
        try:
            # 推送消息到RabbitMQ
            success = push_message(rabbitmq_queue, order_data)
            if not success:
                raise Exception('消息推送返回失败状态')
            logger.info(f"消息已成功推送到RabbitMQ队列: {rabbitmq_queue}")

            # 记录操作日志
            log_operation('inventory_out', form_data['deliveryOrderCode'], 'success', order_data)

            return jsonify({
                'status': 'success',
                'message': '其他出库请求已成功提交',
                'data': order_data
            })

        except Exception as e:
            logger.error(f"RabbitMQ推送失败: {str(e)}")
            # 记录失败日志
            log_operation('inventory_out', form_data['deliveryOrderCode'], 'failed', str(e))
            return jsonify({'status': 'error', 'message': f'推送失败: {str(e)}'}), 500

    except Exception as e:
        logger.error(f"处理其他出库请求失败: {str(e)}")
        return jsonify({'status': 'error', 'message': f'系统错误: {str(e)}'}), 500


def merge_preset(target, preset):
    """合并预设参数，target中的值优先级更高"""
    if isinstance(target, dict) and isinstance(preset, dict):
        for key, value in preset.items():
            if key in target:
                target[key] = merge_preset(target[key], value)
            else:
                target[key] = value
    return target


def log_operation(operation_type, order_code, status, details=None):
    """记录操作日志"""
    try:
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'operation_type': operation_type,
            'order_code': order_code,
            'status': status,
            'details': details
        }
        logger.info(f"操作日志: {json.dumps(log_entry, ensure_ascii=False)}")
    except Exception as e:
        # 即使日志记录失败也不影响主流程
        current_app.logger.error(f"记录操作日志失败: {str(e)}")