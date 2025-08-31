#!/bin/bash

# 配置GitHub SSH通过443端口连接的便捷脚本

# 检查是否以root权限运行
if [ "$(id -u)" -eq 0 ]; then
    echo "错误：请不要以root权限运行此脚本"
    exit 1
fi

# 检查.ssh目录是否存在，不存在则创建
if [ ! -d "$HOME/.ssh" ]; then
    echo "创建.ssh目录..."
    mkdir -p "$HOME/.ssh"
    chmod 700 "$HOME/.ssh"
fi

# 创建或更新SSH配置文件
CONFIG_FILE="$HOME/.ssh/config"

# 备份现有配置文件（如果存在）
if [ -f "$CONFIG_FILE" ]; then
    echo "备份现有的SSH配置文件到$CONFIG_FILE.bak..."
    cp "$CONFIG_FILE" "$CONFIG_FILE.bak"
fi

# 检查是否已包含GitHub配置
if grep -q "^Host github\.com" "$CONFIG_FILE" 2>/dev/null; then
    echo "检测到现有的GitHub SSH配置，将其替换..."
    # 删除现有的GitHub配置
    sed -i '' '/^Host github\.com$/,/^$/d' "$CONFIG_FILE"
fi

# 添加GitHub通过443端口的配置
echo "添加GitHub通过443端口的SSH配置..."
cat >> "$CONFIG_FILE" << EOF
Host github.com
  Hostname ssh.github.com
  Port 443
  User git
  PreferredAuthentications publickey
  IdentityFile ~/.ssh/id_ed25519
  IdentityFile ~/.ssh/id_rsa
  IdentitiesOnly yes
  TCPKeepAlive yes
  ServerAliveInterval 60
EOF

# 设置文件权限
chmod 600 "$CONFIG_FILE"

# 显示公钥内容，方便用户复制到GitHub
echo "\n您的SSH公钥（请复制此内容添加到GitHub账户）："
if [ -f "$HOME/.ssh/id_ed25519.pub" ]; then
    echo "\n--- ED25519公钥 ---"
    cat "$HOME/.ssh/id_ed25519.pub"
else
    echo "未找到ED25519公钥"
fi

if [ -f "$HOME/.ssh/id_rsa.pub" ]; then
    echo "\n--- RSA公钥 ---"
    cat "$HOME/.ssh/id_rsa.pub"
else
    echo "未找到RSA公钥"
fi

# 提示用户如何使用
cat << EOF

配置已完成！现在您可以：
1. 将上面显示的SSH公钥添加到您的GitHub账户
   (Settings > SSH and GPG keys > New SSH key)
2. 测试连接：ssh -T git@github.com
3. 推送代码：git push -u origin main

如果仍然遇到连接问题，请参考GitHub推送指南.md文件中的其他解决方案。
EOF

# 使脚本可执行
chmod +x "$0"