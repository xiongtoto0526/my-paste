## Plan: Chrome 粘贴记录插件 — 分步实现

**概述：** 将 spec 拆分为 9 个渐进式任务，每个任务产出可验证的增量成果。前一个任务是后一个的基础，按顺序实现即可在每一步都能加载插件并验证。

**Steps**

1. **task-1-01-scaffolding.md — 项目脚手架**
   - 创建插件目录结构：`manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, `styles.css`
   - 编写 `manifest.json`（MV3），配置 `permissions: ["storage", "activeTab"]`，`host_permissions: ["<all_urls>"]`，注册 content script 和 service worker
   - 所有 JS 文件写空壳/console.log 占位
   - **验证：** Chrome 加载未打包扩展，无报错，点击图标弹出空白 popup

2. **task-1-02-paste-listener.md — Content Script 监听粘贴**
   - 在 `content.js` 中添加 `document.addEventListener("paste")` 监听
   - 提取 `text/plain` 内容，忽略图片/文件
   - 过滤：跳过 password 类型 input、跳过空文本、截断超过 5000 字符
   - 通过 `chrome.runtime.sendMessage` 将 `{ content, url, domain, createdAt }` 发送给 background
   - **验证：** 在任意网页粘贴文本，background console 能打印收到的消息

3. **task-1-03-background-storage.md — Background 接收并存储数据**
   - 在 `background.js` 中监听 `chrome.runtime.onMessage`
   - 生成唯一 `id`（用 `crypto.randomUUID()` 或时间戳+随机数）
   - 按 `domain` 分组写入 `chrome.storage.local`，数据结构遵循 spec 的 `StorageSchema`
   - 实现 per-domain 100 条上限，超出删除最旧记录
   - **验证：** 粘贴后在 DevTools > Application > Extension Storage 中查看数据正确存储

4. **task-1-04-popup-layout.md — Popup 基础 UI 布局**
   - 编写 `popup.html` 基础结构：搜索框 + 分组列表容器
   - 编写 `styles.css`：设定 popup 尺寸（约 360×500px）、分组折叠样式、列表项样式、滚动
   - 此步只做静态 HTML/CSS，用硬编码 mock 数据验证布局
   - **验证：** 点击插件图标，看到美观的分组列表布局

5. **task-1-05-popup-render.md — Popup 动态渲染数据**
   - 在 `popup.js` 中读取 `chrome.storage.local`
   - 按 domain 分组渲染，每组内按 `createdAt` 倒序
   - 显示内容预览（截断长文本）、时间、来源 URL
   - 空状态提示（无记录时显示引导文案）
   - **验证：** 先在几个网站粘贴文本，打开 popup 能看到按域名分组的真实记录

6. **task-1-06-interactions.md — 交互功能：复制、删除、清空**
   - 点击记录 → `navigator.clipboard.writeText()` 复制到剪贴板，显示 toast 提示
   - 每条记录旁的删除按钮 → 从 storage 中移除该条
   - 每个 domain 分组的「清空」按钮 → 删除该 domain 下所有记录
   - 操作后实时更新 UI（无需刷新 popup）
   - **验证：** 复制、删除、清空均正常工作，刷新 popup 数据一致

7. **task-1-07-search.md — 搜索过滤功能**
   - 搜索框输入时实时过滤 `content` 文本（大小写不敏感）
   - 只显示匹配的记录，domain 分组动态隐藏/显示
   - 清空搜索框恢复全部显示
   - 加防抖（debounce ~200ms）
   - **验证：** 输入关键词，列表实时过滤；清空搜索框恢复

8. **task-1-08-edge-cases.md — 边界处理与健壮性**
   - 重复粘贴相同内容的去重策略（可选：同 domain 下相同 content 在 N 秒内不重复记录）
   - Storage 容量接近上限时的降级处理
   - content script 注入时机保障（`document_idle` vs `document_end`）
   - popup 打开性能优化：大量数据时的虚拟滚动或分页加载
   - **验证：** 快速连续粘贴、大量数据场景下插件无异常

9. **task-1-09-testing.md — 端到端验收测试**
   - 按 spec 第八节验收标准逐条验证
   - 测试场景清单：普通网页、SPA、iframe 页面、password 输入框
   - 性能检查：插件加载 < 200ms，popup 打开 < 100ms
   - 确认不修改页面 DOM、不请求额外权限
   - 编写 README.md 说明安装和使用方式

**Verification**
- 每个 task 完成后都有独立的验证步骤，可立即在 Chrome 中手动测试
- 最终按 spec 验收标准 5 条逐一通过

**Decisions**
- 使用纯 JS（非 TypeScript），与 spec 一致，减少构建复杂度
- 不引入任何框架/构建工具，保持零依赖
- 任务粒度按「加载插件后可独立验证」原则拆分
