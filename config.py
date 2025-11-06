# author:音十
# time: 2025/7/30 15:51
# config.py
from dotenv import load_dotenv
import os

load_dotenv()  # 加载.env文件

class Config:
    # Flask配置
    DEBUG = False  # 生产环境必须设置为False，提高安全性
    PORT = 5002
    HOST = os.getenv('HOST', '0.0.0.0')  # 默认使用0.0.0.0，可通过.env配置覆盖

    # 队列名称（与RabbitMQ管理界面一致）
    ORDER_DOWNLOAD_QUEUE = 'oms_sales_order_download_queue'  # 订单下载队列
    ORDER_DELIVERY_QUEUE = 'sale_order_add_back'  # 销售订单发货队列
    REFUND_ORDER_QUEUE = 'oms_return_order_download_queue'  # 退款单生成队列
    RETURN_ORDER_NOTICE_QUEUE = 'sale_return_plan_add_back_b2c'  # 通知单入库队列
    STOCKOUT_PUSH_QUEUE = "purchase_return_plan_add_back"    # 队列名称：出库单推送
    RETURN_ORDER_ENTRY_QUEUE = 'sale_return_plan_add_back'  # 退货单入库队列
    EXCHANGE_ORDER_QUEUE = 'oms_exchange_order_download_queue'  # 换货单生成队列
    ALLOCATION_OUT_QUEUE = 'stock_out_back'  # 调拨出库队列
    ALLOCATION_ENTRY_QUEUE = 'entry_order_add_back_other'  # 调拨入库队列
    INVENTORY_ENTRY_QUEUE = 'inventory_return_order_back'  # 其他入库队列

    RABBITMQ_CONFIG = {
        'HOST': os.getenv('RABBITMQ_HOST'),
        'PORT': os.getenv('RABBITMQ_PORT'),
        'USERNAME': os.getenv('RABBITMQ_USERNAME'),
        'PASSWORD': os.getenv('RABBITMQ_PASSWORD'),
        'VHOST': os.getenv('RABBITMQ_VHOST')
    }

    # RabbitMQ连接配置
    RABBITMQ_CONNECTION_TIMEOUT = 10
    RABBITMQ_RETRY_ATTEMPTS = 3
    RABBITMQ_RETRY_DELAY = 2

    # 订单下载预设参数
    ORDER_DOWNLOAD_PRESET = {
        "city": "杭州市",
        "country": "中国",
        "district": "滨江区",
        "mobile": "19957517031",
        "province": "浙江省",
        "receiverName": "听风",
        "salesOrderDetailConvertDTOList": [
            {
                "adjustFee": 5,
                "discountFee": 10,
                "divideOrderFee": 400,
                "isGift": "0",
                "partMjzDiscount": 0,
                "payment": 400,
                "platformOuterProductCode": "202104131345",
                "platformOuterSkuCode": "6941428688156",
                "platformProductId": "516137560",
                "platformProductName": "儿童测试手绘本",
                "platformRefundStatus": "0",
                "platformSkuId": "36520014",
                "platformSkuName": "598195516配件大枕套",
                "platformStatus": 20,
                "price": 400,
                "totalFee": 400,
                "settlementPrice": 400,
                "settlementFee": 400,
                "endTime": "2023-09-01 09:20:53",
                "isVirtualProduct": 0,
                "platformPresellDemand": "A"
            }
        ],
        "salesOrderExtConvertDTO": {
            "hasPostFee": 1,
            "isCod": 1,
            "isSpotOccupancy": 0,
            "isStep": 0,
            "memberName": "tb5369333866",
            "payment": 309,
            "platformCreateTime": "2023-09-01 09:20:53",
            "platformOrderStatus": "WAIT_SELLER_SEND_GOODS",
            "platformUpdateTime": "2023-09-01 09:20:53",
            "postFee": 0,
            "receivedPayment": 0,
            "stepPaidFee": 100,
            "stepStatus": 1,
            "totalFee": 309,
            "sellerMemo": ""
        },
        "storeId": 215,
        "zipCode": "000000"
    }

    # 订单发货预设参数
    ORDER_DELIVERY_PRESET = {
        "callbackResponse": {
            "apiMethodName": "deliveryorder.confirm",
            "deliveryOrder": {
                "confirmType": 0,
                "deliveryOrderCode": "DS210120000000285",
                "deliveryOrderId": "DS210120000000285",
                "orderConfirmTime": "2021-01-05 07:50:33",
                "orderType": "JYCK",
                "outBizCode": "DS210120000000285",
                "status": "DELIVERED",
                "warehouseCode": "26085"
            },
            "orderLines": [
                {
                    "actualQty": "2",
                    "batchCode": "BH36520111703000073",
                    "batchs": [
                        {
                            "actualQty": "2",
                            "batchCode": "BH36520111703000073",
                            "expireDate": "2022-11-16",
                            "inventoryType": "ZP",
                            "productDate": "2019-11-17"
                        }
                    ],
                    "expireDate": "2022-11-16",
                    "inventoryType": "ZP",
                    "itemCode": "6973018410083",
                    "itemId": "6973018410083",
                    "ownerCode": "0212000695",
                    "planQty": "2",
                    "productDate": "2019-11-17"
                }
            ],
            "packages": [
                {
                    "expressCode": "75432830051318",
                    "height": "0",
                    "items": [
                        {
                            "itemCode": "6971062145029",
                            "itemId": "6971062145029",
                            "quantity": 1
                        }
                    ],
                    "length": "0",
                    "logisticsCode": "ZT",
                    "logisticsName": "中通快运",
                    "packageMaterialList": [
                        {
                            "quantity": "1",
                            "type": "BC0011"
                        }
                    ],
                    "volume": "0",
                    "weight": "11.32",
                    "width": "0"
                }
            ],
            "responseClass": "com.qimen.api.response.DeliveryorderConfirmResponse",
            "version": "2.0"
        },
        "type": 2
    }

    # 退款单生成预设参数
    REFUND_ORDER_PRESET = {
        "applyMoney": 400,
        "applyNum": 1,
        "applyReason": "",
        "applyTime": "2021-08-30 19:54:53",
        "applyType": "",
        "buyerExplain": "",
        "isRefundTotal": 0,
        "memberName": "听风",
        "omsStatus": "",
        "platformNo": None,
        "platformOrderNo": "",
        "platformRefundNo": "",
        "platformStatus": "",
        "platformUpdateTime": "2021-08-30 14:54:53",
        "realMoney": 100,
        "refundPeriod": "",
        "expressNo": "",
        "expressName": "",
        "salesOrderRefundApplyDetailList": [
            {
                "applyMoney": 100,
                "applyNum": "",
                "platformNo": "",
                "platformProductId": "null",
                "platformProductName": "BP2011001混合口味维铁营养面尝鲜装",
                "platformStatus": ""
            }
        ],
        "storeId": ""
    }

    # 通知单入库预设参数
    RETURN_ORDER_NOTICE_PRESET = {
        "type": 2, 
        "returnOrderCode": "", 
        "callbackResponse": {
            "apiMethodName": "returnorder.confirm", 
            "orderLines": [
                {
                    "actualQty": "", 
                    "inventoryType": "ZP", 
                    "itemCode": "123124324", 
                    "orderLineNo": "1", 
                    "ownerCode": "XIER"
                }
            ], 
            "extendProps": {
                "CloseStatus": "", 
                "ApiSource": "FLUXWMS"
            }, 
            "responseClass": "com.qimen.api.response.ReturnorderConfirmResponse", 
            "returnOrder": {
                "orderConfirmTime": "2021-03-09 08:35:29", 
                "orderType": "THRK", 
                "outBizCode": "", 
                "ownerCode": "XIER", 
                "remark": "", 
                "returnOrderCode": "", 
                "warehouseCode": ""
            }, 
            "version": "2.0"
        }
    }

    # 2B出库单推送预设参数
    STOCKOUT_PUSH_PRESET = {
        "callbackResponse": {
            "apiMethodName": "stockout.confirm", 
            "deliveryOrder": {
                "confirmType": 0, 
                "deliveryOrderCode": "", 
                "operateTime": "2020-08-15 20:56:17", 
                "orderConfirmTime": "2020-08-15 20:56:17", 
                "orderType": "PTCK", 
                "outBizCode": "", 
                "ownerCode": "XIER", 
                "status": "DELIVERED", 
                "warehouseCode": ""
            }, 
            "orderLines": [
                {
                    "actualQty": "", 
                    "inventoryType": "ZP", 
                    "itemCode": "", 
                    "orderLineNo": "", 
                    "ownerCode": "XIER"
                }
            ], 
            "responseClass": "com.qimen.api.response.StockoutConfirmResponse", 
            "version": "2.0"
        }, 
        "outOrderCode": "", 
        "type": 2
    }


    # 2B退货单入库预设参数
    RETURN_ORDER_ENTRY_PRESET = {
        "callbackResponse": {
            "apiMethodName": "entryorder.confirm",
            "entryOrder": {
                "confirmType": 0,
                "entryOrderCode": "",
                "entryOrderId": "",
                "entryOrderType": "B2BRK",
                "operateTime": "",
                "outBizCode": "",
                "ownerCode": "NEWTESTXIER",
                "remark": "",
                "status": "PARTFULFILLED",
                "warehouseCode": ""
            },
            "orderLines": [
                {
                    "actualQty": "",
                    "batchCode": "",
                    "expireDate": "",
                    "inventoryType": "ZP",
                    "itemCode": "",
                    "itemId": "",
                    "itemName": "儿童折叠滑板车",
                    "orderLineNo": "1",
                    "outBizCode": "",
                    "ownerCode": "NEWTESTXIER",
                    "planQty": "",
                    "produceCode": "",
                    "productDate": ""
                }
            ],
            "responseClass": "com.qimen.api.response.EntryorderConfirmResponse",
            "version": "2.0"
        },
        "outOrderCode": "",
        "type": 2
    }

    # 换货单生成预设参数
    EXCHANGE_ORDER_PRESET = {
        "address": "柘林镇上海化学工业区环华路8号 海关",
        "applyTime": "2022-10-17T15:54:32",
        "applyUpdateTime": "2022-10-17T16:13:06",
        "backExpressNo": "",
        "backExpressName": "",
        "buyerExplain": "",
        "city": "上海市",
        "district": "奉贤区",
        "exchangeReason": "",
        "exchangeSkuList": [
            {
                "applyNum": "",
                "platformInSkuId": "",
                "platformNo": ""
            }
        ],
        "exchangeSkuOutList": [
            {
                "num": "",
                "platformOutSkuCode": ""
            }
        ],
        "isDetailExchange": 0,
        "isPlatformExchange": 0,
        "mark": 3,
        "mobile": "18466653550",
        "platformExchangeNo": "",
        "platformId": "",
        "platformOrderNo": "",
        "platformStatus": "",
        "province": "上海",
        "receiver": "陈华 -6395",
        "storeId": ""
    }
    
    # 调拨出库预设参数
    ALLOCATION_OUT_PRESET = {
        "type": 2,
        "callbackResponse": {
            "apiMethodName": "stockout.confirm",
            "deliveryOrder": {
                "confirmType": 0,
                "deliveryOrderCode": "",
                "operateTime": "2021-03-17 16:57:15",
                "orderConfirmTime": "2021-03-17 16:57:15",
                "orderType": "DBCK",
                "outBizCode": "",
                "ownerCode": "XIER",
                "status": "PARTDELIVERED",
                "warehouseCode": ""
            },
            "orderLines": [
                {
                    "actualQty": "",
                    "inventoryType": "ZP",
                    "itemCode": "",
                    "orderLineNo": "",
                    "ownerCode": "XIER"
                }
            ],
            "responseClass": "com.qimen.api.response.StockoutConfirmResponse",
            "version": "2.0"
        }
    }
    
    # 调拨入库预设参数
    ALLOCATION_ENTRY_PRESET = {
        "callbackResponse": {
            "apiMethodName": "entryorder.confirm",
            "entryOrder": {
                "confirmType": 0,
                "entryOrderCode": "",
                "entryOrderId": "",
                "entryOrderType": "DBRK",
                "operateTime": "",
                "outBizCode": "",
                "ownerCode": "XIER",
                "remark": "",
                "status": "PARTFULFILLED",
                "warehouseCode": ""
            },
            "orderLines": [
                {
                    "actualQty": "",
                    "inventoryType": "ZP",
                    "itemCode": "",
                    "orderLineNo": "",
                    "ownerCode": "XIER"
                }
            ],
            "responseClass": "com.qimen.api.response.EntryorderConfirmResponse",
            "version": "2.0"
        },
        "type": 2
    }

    # 其他出库预设参数
    INVENTORY_OUT_PRESET = {
        "type": 2,
        "callbackResponse": {
            "apiMethodName": "stockout.confirm",
            "deliveryOrder": {
                "confirmType": 0,
                "deliveryOrderCode": "GSO20250808126164",
                "operateTime": "2021-03-17 16:57:15",
                "orderConfirmTime": "2021-03-17 16:57:15",
                "orderType": "DBCK",
                "outBizCode": "GSO20250808126164",
                "ownerCode": "XIER",
                "status": "PARTDELIVERED",
                "warehouseCode": "DCN"
            },
            "orderLines": [
                {
                    "actualQty": "100",
                    "inventoryType": "ZP",
                    "itemCode": "6937334127735",
                    "orderLineNo": "1",
                    "ownerCode": "XIER"
                }
            ],
            "responseClass": "com.qimen.api.response.StockoutConfirmResponse",
            "version": "2.0"
        }
    }

    # 其他入库预设参数
    INVENTORY_ENTRY_PRESET = {
        "callbackResponse": {
            "apiMethodName": "taobao.qimen.entryorder.confirm",
            "entryOrder": {
                "confirmType": 0,
                "entryOrderCode": "GSI20250808044945",
                "entryOrderId": "GSI20250808044945",
                "entryOrderType": "CGRK",
                "operateTime": "2025-08-08 10:58:44",
                "outBizCode": "GSI20250808044945",
                "ownerCode": "xier",
                "remark": "",
                "status": "PARTFULFILLED",
                "warehouseCode": "DCN"
            },
            "orderLines": [
                {
                    "actualQty": 2000,
                    "inventoryType": "ZP",
                    "itemCode": "6937334127735",
                    "orderLineNo": "",
                    "ownerCode": "xier"
                }
            ],
            "responseClass": "com.qimen.api.response.EntryorderConfirmResponse",
            "version": "2.0"
        },
        "entryOrderCode": "GSI20250808044945",
        "type": 2
    }


# 创建配置实例
config = Config()