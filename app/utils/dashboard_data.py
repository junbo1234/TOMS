# -*- coding: utf-8 -*-
# time: 2025/8/1 11:30
# file: dashboard_data.py
# 仪表盘数据管理模块
import time
import json
from datetime import datetime
from typing import List, Dict, Any


class DashboardDataManager:
    """仪表盘数据管理器"""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DashboardDataManager, cls).__new__(cls)
            # 初始化数据存储
            cls._instance.rabbitmq_logs = []  # RabbitMQ请求记录
            cls._instance.memo_history = []  # 备忘录历史记录
            cls._instance.menu_stats = {}  # 菜单请求次数统计
        return cls._instance

    def log_rabbitmq_request(self, queue_name: str, message: Dict[str, Any], success: bool):
        """记录RabbitMQ请求"""
        log_entry = {
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'queue_name': queue_name,
            'message': message,
            'success': success,
            'message_str': json.dumps(message, ensure_ascii=False)
        }
        self.rabbitmq_logs.append(log_entry)
        # 限制日志数量，保持最新的1000条
        if len(self.rabbitmq_logs) > 1000:
            self.rabbitmq_logs.pop(0)



    def save_memo(self, content: str):
        """保存备忘录内容"""
        if content.strip():
            memo_entry = {
                'id': len(self.memo_history),
                'content': content.strip(),
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }
            self.memo_history.append(memo_entry)
            # 限制历史记录数量，保持最新的20条
            if len(self.memo_history) > 20:
                self.memo_history.pop(0)

    def get_memo(self) -> str:
        """获取最新的备忘录内容（为兼容旧接口）"""
        if self.memo_history:
            return self.memo_history[-1]['content']
        return ""

    def get_memo_history(self) -> List[Dict[str, Any]]:
        """获取备忘录历史记录"""
        return self.memo_history

    def delete_memo(self, memo_id: int) -> bool:
        """删除指定ID的备忘录"""
        for i, entry in enumerate(self.memo_history):
            if entry['id'] == memo_id:
                self.memo_history.pop(i)
                return True
        return False

    def increment_menu_count(self, menu_name: str):
        """增加菜单请求次数"""
        if menu_name not in self.menu_stats:
            self.menu_stats[menu_name] = 0
        self.menu_stats[menu_name] += 1

    def get_menu_stats(self) -> Dict[str, int]:
        """获取菜单请求统计"""
        return self.menu_stats


def get_dashboard_data_manager() -> DashboardDataManager:
    """获取仪表盘数据管理器实例"""
    return DashboardDataManager()