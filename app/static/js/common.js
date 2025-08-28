// 监听菜单点击事件（阻止默认跳转，生成标签页）
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const url = this.href; // 页面路径（如order_download.html）
        const title = this.textContent; // 标签标题（如“订单下载”）
        addTab(url, title); // 生成/激活标签页
    });
});

// 添加标签页（核心函数）
function addTab(url, title) {
    // 1. 检查标签是否已存在（避免重复打开）
    const existingTab = document.querySelector(`.tab[data-url="${url}"]`);
    if (existingTab) {
        activateTab(existingTab); // 激活已存在的标签
        return;
    }

    // 2. 创建新标签（含关闭按钮）
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.url = url; // 存储页面路径（用于关联内容）
    tab.innerHTML = `
        <span class="tab-title">${title}</span>
        <span class="tab-close">×</span>
    `;
    document.querySelector('.tabs').appendChild(tab);

    // 3. 创建内容容器（加载页面内容）
    const content = document.createElement('div');
    content.className = 'tab-content';
    content.dataset.url = url;
    content.style.display = 'none'; // 默认隐藏
    document.querySelector('.tab-content-container').appendChild(content);

    // 4. 加载页面内容（Ajax异步加载）
    fetch(url)
        .then(response => response.text())
        .then(html => {
            content.innerHTML = html; // 将页面内容插入容器
            activateTab(tab); // 激活新标签
            saveTabState(); // 保存标签状态（刷新后恢复）
        })
        .catch(error => {
            console.error('页面加载失败:', error);
            content.innerHTML = '<p class="text-danger">页面加载失败，请重试！</p>';
        });

    // 5. 监听标签关闭事件
    tab.querySelector('.tab-close').addEventListener('click', function() {
        removeTab(tab); // 移除标签页
    });
}

// 激活标签页（切换内容显示）
function activateTab(tab) {
    // 1. 移除所有标签的“激活状态”
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    // 2. 标记当前标签为“激活”
    tab.classList.add('active');

    // 3. 隐藏所有内容容器
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    // 4. 显示当前标签对应的内容容器
    const content = document.querySelector(`.tab-content[data-url="${tab.dataset.url}"]`);
    if (content) {
        content.style.display = 'block';
    }

    // 保存激活状态（刷新后恢复）
    saveTabState();
}

// 监听标签点击事件（切换激活状态）
document.querySelector('.tabs').addEventListener('click', function(e) {
    const tab = e.target.closest('.tab');
    if (tab) {
        activateTab(tab);
    }
});

// 移除标签页（含内容容器）
function removeTab(tab) {
    const url = tab.dataset.url;
    // 1. 移除标签
    tab.remove();
    // 2. 移除对应的内容容器
    const content = document.querySelector(`.tab-content[data-url="${url}"]`);
    if (content) {
        content.remove();
    }
    // 3. 激活最后一个标签（避免内容区为空）
    const lastTab = document.querySelector('.tab:last-child');
    if (lastTab) {
        activateTab(lastTab);
    }
    // 4. 保存标签状态
    saveTabState();
}

// 保存标签状态到sessionStorage（刷新后保留）
function saveTabState() {
    const tabs = Array.from(document.querySelectorAll('.tab')).map(tab => ({
        url: tab.dataset.url,
        title: tab.querySelector('.tab-title').textContent
    }));
    const activeTab = document.querySelector('.tab.active');
    const activeTabUrl = activeTab ? activeTab.dataset.url : '';
    // 存储到sessionStorage（页面关闭后失效，如需持久化可改用localStorage）
    sessionStorage.setItem('tabs', JSON.stringify(tabs));
    sessionStorage.setItem('activeTabUrl', activeTabUrl);
}

// 页面加载时恢复标签状态
window.addEventListener('load', function() {
    const savedTabs = JSON.parse(sessionStorage.getItem('tabs')) || [];
    const activeTabUrl = sessionStorage.getItem('activeTabUrl');

    // 恢复已打开的标签
    savedTabs.forEach(tab => {
        addTab(tab.url, tab.title);
    });

    // 恢复激活的标签
    if (activeTabUrl) {
        const activeTab = document.querySelector(`.tab[data-url="${activeTabUrl}"]`);
        if (activeTab) {
            activateTab(activeTab);
        }
    } else {
        // 默认打开首页（若未保存状态）
        addTab('index.html', '首页');
    }
});