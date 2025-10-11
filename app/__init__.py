# author:音十
# time: 2025/7/31 14:56
# app/__init__.py
from flask import Flask, redirect, url_for
from config import config
from app.routes import order_download, order_delivery, dashboard, refund_order, return_order_notice, stockout_push, return_order_entry, exchange_order, allocation_out, allocation_in, inventory_entry, inventory_out, inventory_adjustment  # 导入蓝图
import atexit


def create_app() -> Flask:
    """
    创建Flask应用（工厂函数）
    """
    app = Flask(__name__)
    app.config.from_object(config)

    # 添加一个特殊路由来提供根目录下的logo.svg文件
    from flask import send_file
    import os
    @app.route('/logo.svg')
    def serve_logo():
        """提供根目录下的logo.svg文件"""
        logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logo.svg')
        return send_file(logo_path, mimetype='image/svg+xml')

    # 注册蓝图（订单下载：URL前缀/order_download）
    app.register_blueprint(order_download.order_download_bp)
    # 注册蓝图（销售订单发货：URL前缀/order_delivery）
    app.register_blueprint(order_delivery.order_delivery_bp)
    # 注册蓝图（仪表盘：URL前缀/dashboard）
    app.register_blueprint(dashboard.dashboard_bp)
    # 注册蓝图（退款单生成：URL前缀/refund_order）
    app.register_blueprint(refund_order.refund_order_bp)
    # 注册蓝图（通知单入库：URL前缀/return_order_notice）
    app.register_blueprint(return_order_notice.return_order_notice_bp)
    # 注册蓝图（出库单推送：URL前缀/stockout_push）
    app.register_blueprint(stockout_push.stockout_push_bp)
    # 注册蓝图（退货单入库：URL前缀/return_order_entry）
    app.register_blueprint(return_order_entry.return_order_entry_bp)
    # 注册蓝图（换货单生成：URL前缀/exchange_order）
    app.register_blueprint(exchange_order.exchange_order_bp)
    # 注册蓝图（调拨出库：URL前缀/allocation_out）
    app.register_blueprint(allocation_out.allocation_out_bp)
    # 注册蓝图（调拨入库：URL前缀/allocation_in）
    app.register_blueprint(allocation_in.allocation_in_bp)
    # 注册蓝图（其他入库：URL前缀/inventory_entry）
    app.register_blueprint(inventory_entry.inventory_entry_bp)
    # 注册蓝图（其他出库：URL前缀/inventory_out）
    app.register_blueprint(inventory_out.inventory_out_bp)
    # 注册蓝图（库存调整：URL前缀/inventory_adjustment）
    app.register_blueprint(inventory_adjustment.inventory_adjustment_bp)
    
    # 根路径路由 - 重定向到仪表盘
    @app.route('/')
    def index():
        return redirect(url_for('dashboard.index'))

    # 注册应用关闭时的清理函数
    @atexit.register
    def cleanup():
        """应用关闭时清理资源"""
        from app.utils.rabbitmq import close_rabbitmq_connection
        close_rabbitmq_connection()

    return app