# author:音十
# time: 2025/8/1 10:00
# wsgi.py - 用于生产环境部署的WSGI入口文件

from app import create_app
from config import config

# 创建Flask应用实例
app = create_app()

if __name__ == '__main__':
    # 即使直接运行此文件，也不使用开发服务器
    # 而是提示用户使用WSGI服务器
    print("请使用WSGI服务器部署，例如: gunicorn -w 4 -b 0.0.0.0:5002 wsgi:app")