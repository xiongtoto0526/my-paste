# My Paste (Chrome Extension)

按网站分组记录网页中的复制文本（本地版，Manifest V3）。

## 功能

- 监听网页内 `copy` 事件
- 仅记录 `text/plain`
- 忽略密码输入框、空文本
- 内容长度限制 5000 字符
- 按 domain 分组存储到 `chrome.storage.local`
- 每个 domain 最多保留 100 条（自动删除最旧）
- 支持配置置顶网站排序（例如 `localhost:5100`、`localhost:5200`）
- Popup 支持：搜索、复制、删除单条、清空域名

## 配置文件

- 文件：`config.js`
- 当前可用配置：

```js
window.APP_CONFIG = {
   quickActions: {
      openProject: {
         enabled: true,
         label: '打开项目',
         path: '/Users/xmaster/Documents/code/vibe/my-paste'
      }
   },
   sort: {
      pinnedDomains: ['localhost:5100', 'localhost:5200']
   },
   filter: {
      hiddenDomains: ['example.com']
   },
   tags: {
      domainTags: {
         'localhost:5100': { text: 'API', color: 'blue' },
         'localhost:5200': { text: 'Admin', color: 'purple' }
      }
   }
}
```

- `pinnedDomains` 中的域名会按数组顺序在 popup 中置顶
- `hiddenDomains` 中的域名会在 popup 中完全隐藏
- `domainTags` 可给指定域名添加标签，显示在域名前面
- `domainTags[domain].color` 支持枚举值：`slate`、`blue`、`green`、`amber`、`red`、`purple`
- `quickActions.openProject` 可在 popup 顶部提供一键打开 VS Code 项目入口
- 未来可在该文件继续增加更多配置项

## 本地测试（Chrome）

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目根目录：`my-paste/`
5. 打开任意网站（如 `https://example.com`）
6. 在网页里选中文本并复制（⌘C）
7. 点击浏览器工具栏扩展图标，打开 `My Paste` popup
8. 验证：
   - 能看到对应 domain 分组
   - 点击记录可复制回剪贴板
   - 删除单条与清空域名可生效
   - 搜索框可实时过滤内容

## 调试

- 查看 background 日志：`chrome://extensions/` -> 本扩展 -> `service worker` -> Inspect
- 查看 content script 日志：在目标网页打开 DevTools Console
- 查看存储数据：DevTools -> Application -> Storage -> Extension Storage

## Copilot 可视化调试 Skill

- 已接入 Skill：`.github/skills/visual-debug-with-playwright/SKILL.md`
- 用途：在 Playwright MCP 浏览器里通过 `Alt` 悬停/点击可视化定位元素，并在页面内提交修改反馈给 Copilot。

### 前置条件

1. 在 VS Code 中启用可用的 Playwright MCP Server。
2. 使用 Copilot 的 Agent 模式（Ask 模式无法执行 MCP 浏览器工具）。

### 使用方式

1. 在 Chat 中发起：`/visual-debug-with-playwright`，并说明目标 URL。
2. 等待 Agent 打开页面并注入 inspector。
3. 在页面中按住 `Alt` 悬停元素；`Alt + Click` 选中元素并打开反馈面板。
4. 填写改动需求并提交。
5. 回到 Chat 让 Copilot `check feedback`，Agent 会读取提交并执行代码修改。
