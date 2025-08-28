# -*- coding: utf-8 -*-
# time: 2025/8/1 10:15
# file: dashboard.py
# 仪表盘路由文件
from flask import Blueprint, render_template, request, jsonify
from app.utils.dashboard_data import DashboardDataManager

# 创建仪表盘蓝图
dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/dashboard')

dashboard_manager = DashboardDataManager()


@dashboard_bp.route('/')
def index():
    return render_template('base.html')


@dashboard_bp.route('/increment_menu_count', methods=['POST'])
def increment_menu_count():
    data = request.json
    menu_id = data.get('menu_id')
    if menu_id:
        dashboard_manager.increment_menu_count(menu_id)
        return jsonify({'success': True})
    return jsonify({'success': False}), 400


@dashboard_bp.route('/get_menu_stats')
def get_menu_stats():
    stats = dashboard_manager.get_menu_stats()
    return jsonify({'stats': stats})


@dashboard_bp.route('/save_memo', methods=['POST'])
def save_memo():
    data = request.json
    memo = data.get('memo')
    dashboard_manager.save_memo(memo)
    return jsonify({'success': True})


@dashboard_bp.route('/get_memo')
def get_memo():
    memo = dashboard_manager.get_memo()
    return jsonify({'memo': memo})


@dashboard_bp.route('/get_rabbitmq_logs')
def get_rabbitmq_logs():
    logs = dashboard_manager.get_rabbitmq_logs()
    return jsonify({'logs': logs})