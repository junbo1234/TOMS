

#!/bin/bash

# 一键修复SSH配置文件脚本

# 设置中文环境
export LANG=zh_CN.UTF-8

echo "=== SSH配置文件修复工具 ==="
echo "此工具将帮助您修复SSH配置文件中的语法错误"
echo "并配置GitHub通过443端口连接"
echo ""

# 检查是否以root权限运行
if [ "$(id -u)" -eq 0 ]; then
    echo "❌ 错误：请不要以root权限运行此脚本"
    exit 1
fi

# 定义配置文件路径
CONFIG_FILE="$HOME/.ssh/config"
CONFIG_BACKUP="$HOME/.ssh/config.backup.$(date +%Y%m%d_%H%M%S)"

# 检查.ssh目录是否存在，不存在则创建
if [ ! -d "$HOME/.ssh" ]; then
    echo "⚠️  .ssh目录不存在，正在创建..."
    mkdir -p "$HOME/.ssh"
    chmod 700 "$HOME/.ssh"
fi

# 备份现有的配置文件（如果存在）
if [ -f "$CONFIG_FILE" ]; then
    echo "💾 正在备份现有配置文件到 $CONFIG_BACKUP"
    cp "$CONFIG_FILE" "$CONFIG_BACKUP"
fi

# 创建正确的SSH配置
echo "✏️ 正在创建新的SSH配置文件..."
cat > "$CONFIG_FILE" << 'EOF'
# GitHub SSH配置 - 通过443端口连接
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

# 设置正确的文件权限
echo "🔒 正在设置正确的文件权限..."
chmod 600 "$CONFIG_FILE"

# 检查SSH密钥是否存在
echo "🔍 正在检查SSH密钥..."

# 显示可用的公钥
has_public_key=false

if [ -f "$HOME/.ssh/id_ed25519.pub" ]; then
    echo "✅ 找到了ED25519密钥"
    has_public_key=true
fi

if [ -f "$HOME/.ssh/id_rsa.pub" ]; then
    echo "✅ 找到了RSA密钥"
    has_public_key=true
fi

if [ "$has_public_key" = false ]; then
    echo "⚠️  未找到SSH公钥，建议生成新密钥："
    echo "  ssh-keygen -t ed25519 -C "your_email@example.com""
fi

# 测试SSH连接
echo ""
echo "📡 测试SSH连接到GitHub..."

# 执行测试但不显示完整输出，只显示结果
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo "✅ SSH连接测试成功！您现在可以尝试推送代码了。"
    echo ""
    echo "📝 推送代码命令："
    echo "  cd /Users/junbo.zjb/Downloads/TOMS"
    echo "  git push -u origin main"
else
    echo "❌ SSH连接测试失败，请参考以下建议："
    echo "  1. 确保您的SSH公钥已添加到GitHub账户"
    echo "  2. 检查网络连接是否正常"
    echo "  3. 查看详细错误日志：ssh -vT git@github.com"
    echo "  4. 参考SSH配置文件故障排除指南.md"
fi

# 使脚本可执行
chmod +x "$0"

# 完成提示
echo ""
echo "=== 修复完成 ==="
echo "如果仍然遇到问题，请运行详细的诊断命令："
echo "  ssh -vT git@github.com"
echo "并查看SSH配置文件故障排除指南.md获取更多帮助。"