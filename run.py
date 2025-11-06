# author:音十
# time: 2025/7/31 14:56
# run.py
from app import create_app
from config import config

app = create_app()

if __name__ == '__main__':
    # 开发环境使用，但建议在生产环境使用WSGI服务器
    # 例如: gunicorn -w 4 -b 0.0.0.0:5002 wsgi:app
    app.run(
        host=config.HOST,
        port=config.PORT,
        debug=False  # 生产环境必须设置为False
    )