# author:音十
# time: 2025/7/31 14:56
# run.py
from app import create_app
from config import config

app = create_app()

if __name__ == '__main__':
    app.run(
        host=config.HOST,
        port=config.PORT,
        debug=config.DEBUG
    )