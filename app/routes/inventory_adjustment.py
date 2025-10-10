from flask import Blueprint, render_template, request, jsonify
import logging
import json
import requests
import uuid
from datetime import datetime
import time
from config import config

# 设置当前模块的日志级别为DEBUG
existing_logger = logging.getLogger()
existing_logger.setLevel(logging.DEBUG)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# ==================== 蓝图定义 ====================
inventory_adjustment_bp = Blueprint('inventory_adjustment', __name__, url_prefix='/inventory_adjustment')

# ==================== 路由函数 ====================
# 库存调整页面（GET请求）
@inventory_adjustment_bp.route('/')
def index():
    """库存调整页面"""
    return render_template('inventory_adjustment.html')

# 库存调整接口（POST请求）
@inventory_adjustment_bp.route('/submit', methods=['POST'])
def submit():
    """库存调整提交接口"""
    try:
        # 记录请求开始
        logger.info(f"收到库存调整请求，请求方法: POST, 客户端IP: {request.remote_addr}")
        
        # 1. 获取用户输入
        sku_code = request.form.get('skuCode')
        quantity = int(request.form.get('quantity', 0))
        warehouse_code = request.form.get('warehouseCode')
        api_env = request.form.get('apiEnv', 'test')  # 默认测试环境
        
        # 详细记录用户输入
        logger.info(f"用户输入参数: sku_code={sku_code}, quantity={quantity}, warehouse_code={warehouse_code}, api_env={api_env}")
        
        # 2. 验证必填字段
        required_fields = {
            'skuCode': sku_code,
            'quantity': quantity,
            'warehouseCode': warehouse_code
        }
        
        missing_fields = [field for field, value in required_fields.items() if not value]
        if missing_fields:
            logger.warning(f'请求验证失败: 缺少必填字段 {", ".join(missing_fields)}')
            return jsonify({
                'status': 'error',
                'message': f'缺少必填字段: {", ".join(missing_fields)}'
            }), 400
        
        # 3. 选择API地址
        api_url = (
            'https://gateway-test.babycare.com/open/srm/purchase/saveArrival'
            if api_env == 'test' else
            'https://gateway-uat.babycare.com/open/srm/purchase/saveArrival'
        )
        
        logger.info(f"根据环境选择API地址: {api_url}")
        
        # 4. 生成动态参数
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        # 使用更可靠的方式生成唯一business_no
        business_no = str(uuid.uuid4()).replace('-', '')[:13]  # 生成13位唯一编号
        # 确保source_code唯一性，添加时间戳后几位
        time_suffix = str(int(time.time() * 1000))[-5:]
        source_code = f"{business_no}{time_suffix}"  # 生成唯一的sourceCode
        
        logger.debug(f"生成动态参数: business_no={business_no}, source_code={source_code}, current_time={current_time}")
        
        # 5. 构建请求参数
        request_data = {
            "appointmentNo": "",
            "businessNo": business_no,
            "checkMethod": "20",
            "detailList": [
                {
                    "actualArrivalNumber": quantity,
                    "batchCode": "1",
                    "lineNo": "1",
                    "planArrivalNumber": quantity,
                    "productDate": "2025-07-01",
                    "sampleQuality": 7,
                    "skuCode": sku_code,
                    "sourceCode": source_code,
                    "volume": 1,
                    "weight": 1
                }
            ],
            "forecastArrivalTime": current_time,
            "forecastDeliveryTime": current_time,
            "isCallCar": 0,
            "orderCreator": "LY",
            "remark": "LY",
            "sourceType": "WWJG",
            "supplierCode": "CO00049541",
            "totalVolume": 1,
            "totalWeight": 1,
            "warehouseCode": warehouse_code,
            "warehouseOutCode": warehouse_code
        }
        
        # 6. 记录请求日志
        logger.info(f"提交库存调整请求: URL={api_url}, 参数={json.dumps(request_data)}")
        
        # 7. 调用外部API（实际环境中会取消注释）
        try:
            # 实际API调用
            logger.info(f"开始调用外部API: {api_url}")
            headers = {'Content-Type': 'application/json'}
            response = requests.post(api_url, json=request_data, headers=headers, timeout=30)
            logger.info(f"外部API响应状态码: {response.status_code}")
            response.raise_for_status()
            result = response.json()
            logger.info(f"外部API调用成功，返回数据: {json.dumps(result)[:500]}...")
        except Exception as api_error:
            logger.error(f"外部API调用失败: {str(api_error)}")
            raise
        
        # 8. 构建并返回响应
        response_data = {
            'status': 'success',
            'message': '库存调整请求已成功提交',
            'data': result,
            'requestParams': request_data,
            'timestamp': datetime.now().isoformat(),
            'requestId': str(uuid.uuid4())
        }
        
        logger.info(f"请求处理成功，返回状态: success")
        return jsonify(response_data)
        
    except ValueError as val_error:
        logger.error(f"数据验证错误: {str(val_error)}")
        return jsonify({
            'status': 'error',
            'message': f'数据格式错误: {str(val_error)}',
            'requestParams': request_data if 'request_data' in locals() else {}
        }), 400
    except Exception as e:
        logger.error(f"库存调整请求处理失败: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'请求处理失败: {str(e)}',
            'requestParams': request_data if 'request_data' in locals() else {},
            'errorType': str(type(e).__name__)
        }), 500

# 获取预设参数接口
@inventory_adjustment_bp.route('/get-preset', methods=['GET'])
def get_preset():
    """获取预设参数"""
    try:
        logger.debug("开始处理获取预设参数请求")
        logger.debug(f"请求方法: {request.method}")
        logger.debug(f"请求参数: {request.args}")
        
        # 生成示例数据用于前端预览
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        business_no = str(uuid.uuid4().fields[-1])[:13]
        source_code = f"{business_no}112"
        
        logger.debug(f"生成预设数据: business_no={business_no}, source_code={source_code}, current_time={current_time}")
        
        preset_data = {
            "appointmentNo": "",
            "businessNo": business_no,
            "checkMethod": "20",
            "detailList": [
                {
                    "actualArrivalNumber": 150000,
                    "batchCode": "1",
                    "lineNo": "1",
                    "planArrivalNumber": 150000,
                    "productDate": "2025-07-01",
                    "sampleQuality": 7,
                    "skuCode": "6926523473692",
                    "sourceCode": source_code,
                    "volume": 1,
                    "weight": 1
                }
            ],
            "forecastArrivalTime": current_time,
            "forecastDeliveryTime": current_time,
            "isCallCar": 0,
            "orderCreator": "LY",
            "remark": "LY",
            "sourceType": "WWJG",
            "supplierCode": "CO00049541",
            "totalVolume": 1,
            "totalWeight": 1,
            "warehouseCode": "DCN",
            "warehouseOutCode": "DCN"
        }
        
        logger.info("预设参数生成成功，准备返回数据")
        logger.debug(f"返回的预设数据: {json.dumps(preset_data, ensure_ascii=False)}")
        
        return jsonify({
            'status': 'success',
            'data': preset_data
        })
        
    except Exception as e:
        logger.error(f"获取预设参数失败: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'获取预设参数失败: {str(e)}',
            'errorType': str(type(e).__name__)
        }), 500