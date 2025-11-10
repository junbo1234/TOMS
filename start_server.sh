#!/bin/bash

# 作者: 音十
# 时间: 2025/8/1 10:30
# 用途: 自动清理端口并启动Gunicorn服务

# 第一步：激活虚拟环境
echo "第一步：激活虚拟环境..."
source myenv/bin/activate

# 第二步：清理端口5002上的进程
echo "第二步：清理端口5002上的进程..."
sudo kill -9 $(lsof -t -i:5002 2>/dev/null) 2>/dev/null || echo "端口5002上没有运行的进程"

# 等待一小段时间确保进程完全终止
sleep 1

# 第三步：进入TOMS目录
echo "第三步：进入TOMS目录..."
cd TOMS/

# 第四步：启动Gunicorn服务
echo "第四步：启动Gunicorn服务..."
gunicorn -w 4 -b 0.0.0.0:5002 wsgi:app