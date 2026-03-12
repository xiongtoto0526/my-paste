# My Paste 产品规格（当前实现版）

## 1. 产品目标

My Paste 是一个本地 Chrome 扩展，用于：

- 按网站分组记录网页复制文本
- 在 Popup 内快速检索、复制、删除历史记录
- 提供轻量记事本（便签）
- 提供便签提醒能力（小时/分钟/秒）

所有数据默认仅存储于本地 `chrome.storage.local`。

---

## 2. 功能范围

### 2.1 剪贴板记录（Tab1）

- 监听网页复制文本并入库
- 按 `domain` 分组展示
- 支持搜索过滤（防抖）
- 支持：点击复制、删除单条、按域名清空
- 支持配置置顶域名、隐藏域名、域名标签

### 2.2 记事本（Tab2）

- 支持新增便签（输入 + 回车/按钮）
- 支持便签列表展示（倒序）
- 支持便签编辑（点击进入编辑、Enter 保存、Esc 取消、失焦保存）
- 支持便签删除（hover 显示删除按钮）

### 2.3 便签提醒

- 每条便签 hover 显示提醒图标
- 点击提醒图标展开设置区
- 输入数值 + 选择单位（小时 / 分钟 / 秒）
- 到期后更新提醒状态：`已提醒`（或 `已过期`）
- 运行中显示倒计时剩余时间（秒级刷新）

### 2.4 快捷操作

- 顶部按钮：`打开项目`（可配置）
- 顶部按钮：`导出数据`（JSON）
- 顶部按钮：`新标签打开`（独立页面展示 popup）

### 2.5 快捷键

- 支持 `commands._execute_action`
- 默认：
	- macOS: `Command+Shift+Y`
	- Windows/Linux: `Ctrl+Shift+Y`

### 2.6 AI 雷达（更新订阅）

- 支持定时轮询 AI 产品 RSS 更新（默认 30 分钟）
- 首期内置 Copilot 源：`https://github.blog/changelog/label/copilot/feed/`
- 内置 Gemini 源（HTML 监控）：`https://ai.google.dev/gemini-api/docs/changelog`
- 支持扩展源配置（Cursor / Claude AI / Google Gemini）
- 检测到新条目后发送系统通知（去重，避免重复通知同一条）
- Popup 提供雷达状态展示与“立即检查”按钮
- Popup 支持点击源标签跳转到对应更新页面（如 Copilot/Gemini）

---

## 3. Popup 信息架构

## 3.1 Tab 结构

- Tab1：`剪贴板`
- Tab2：`记事本`
- 默认进入 Tab1
- 独立标签页模式支持通过 query 参数指定初始 tab

## 3.2 剪贴板页布局

- 顶部操作区（新标签打开 / 导出数据 / 打开项目）
- 搜索输入框
- 分组记录列表
- toast 区

## 3.3 记事本页布局

- 便签输入区（输入框 + 添加按钮）
- 便签列表
- 每项支持操作：编辑、提醒、删除
- 便签元信息区显示时间与提醒状态

---

## 4. 数据模型

## 4.1 Storage Keys

- `records`: 剪贴板记录（按域名分组）
- `notes`: 便签列表
- `noteReminders`: 提醒任务映射（以 alarmName 为 key）
- `aiRadarConfig`: AI 雷达配置（轮询间隔、源列表）
- `aiRadarState`: AI 雷达状态（每个源最近检查/最近条目/错误）

## 4.2 records

```ts
type RecordsByDomain = {
	[domain: string]: Array<{
		id: string
		content: string
		url: string
		domain: string
		createdAt: number
	}>
}
```

约束：

- 每个域名最多保留 100 条
- 按 `createdAt` 倒序

## 4.3 notes

```ts
type Note = {
	id: string
	content: string
	createdAt: number
}
```

## 4.4 noteReminders

```ts
type ReminderMap = {
	[alarmName: string]: {
		noteId: string
		content: string
		createdAt: number
		triggerAt: number
		status?: 'pending' | 'fired'
		firedAt?: number
	}
}
```

## 4.5 aiRadarConfig

```ts
type AiRadarConfig = {
	enabled: boolean
	intervalMinutes: number
	sources: Array<{
		id: string
		name: string
		type: 'rss' | 'html'
		feedUrl?: string
		pageUrl?: string
		enabled: boolean
	}>
}
```

约束：

- `intervalMinutes` 最小 5，最大 720
- 源 `id` 必须唯一（建议使用小写）
- `type='rss'` 时使用 `feedUrl` 轮询
- `type='html'` 时使用 `pageUrl` 轮询
- `pageUrl` 可用于 Popup 标签点击跳转（若缺失则回退使用 `feedUrl`）
- 缺少对应 URL 的源不会参与轮询

## 4.6 aiRadarState

```ts
type AiRadarState = {
	sources: {
		[sourceId: string]: {
			lastSeenId?: string
			lastSeenTitle?: string
			lastSeenLink?: string
			lastPublishedAt?: string
			lastCheckedAt?: number
			lastNotifiedAt?: number
			lastError?: string
		}
	}
	lastCheckedAt?: number
	updatedAt?: number
}
```

---

## 5. 通知与提醒机制

- Popup 设置提醒后，通过 `runtime message` 请求 background 创建提醒
- background 使用 `chrome.alarms.create` 注册任务
- 到期后 background 处理 `alarms.onAlarm`：
	- 更新 `noteReminders` 中该提醒状态
	- 调用 `chrome.notifications.create` 发送通知
- Popup 通过：
	- 初始化加载 `noteReminders`
	- 监听 `chrome.storage.onChanged`
	- 本地秒级刷新倒计时文案
	实时展示提醒状态

提醒状态展示规则：

- `pending + triggerAt > now`：显示 `剩余 xx`
- `fired`：显示 `已提醒`
- `pending 且 triggerAt <= now`：显示 `已过期`

### 5.1 AI 雷达通知机制

- background 注册周期任务：`ai-radar-poll`
- 周期触发后按配置拉取每个已启用源（支持 RSS/HTML）
- 若最新条目 `id` 与该源 `lastSeenId` 不同，则判定为新更新：
	- 更新 `aiRadarState.sources[sourceId]`
	- 调用 `chrome.notifications.create` 发送通知
- Popup 点击“立即检查”通过 `runtime message` 触发同一检查逻辑
- 拉取或解析失败时记录 `lastError`，不会中断其他源检查

去重规则：

- 首次检查仅写入 `lastSeenId`，不通知
- 后续仅在 `lastSeenId` 变化时通知

---

## 6. 配置项（config.js）

支持配置：

- `quickActions.openProject.enabled`
- `quickActions.openProject.label`
- `quickActions.openProject.path`
- `sort.pinnedDomains`
- `filter.hiddenDomains`
- `tags.domainTags`

---

## 7. 权限说明（Manifest V3）

当前使用权限：

- `storage`
- `activeTab`
- `alarms`
- `notifications`

并使用：

- `host_permissions: ["<all_urls>"]`

---

## 8. 导出能力

点击 `导出数据` 后下载 JSON 文件：

- 文件名：`my-paste-export-YYYYMMDD-HHMMSS.json`
- 包含：
	- `exportedAt`
	- `records`
	- `notes`

---

## 9. 已知依赖与运行前提

- 提醒通知依赖操作系统与浏览器通知设置（macOS 通知中心 / Chrome 通知权限）
- manifest 权限更新后需手动重新加载扩展
- `chrome.notifications` 必须可访问有效图标资源

---

## 10. 验收清单（当前版本）

- [x] 剪贴板记录按域名分组展示
- [x] 搜索、复制、删除、按域名清空
- [x] 双 Tab（剪贴板 / 记事本）
- [x] 便签新增、编辑、删除
- [x] 提醒设置（小时/分钟/秒）
- [x] 倒计时 + 已提醒/已过期状态
- [x] 导出 JSON
- [x] 新标签页独立打开
- [x] 快捷键唤起扩展
- [x] AI 雷达定时检查 Copilot 更新并通知
- [x] Popup 展示 AI 雷达状态并支持立即检查

---

## 11. 兼容性说明

- 旧行为：扩展仅支持剪贴板记录与便签提醒。
- 新行为：在保留原有行为的前提下，新增 AI 雷达定时检查与通知。
- 若 `aiRadarConfig.enabled=false`，雷达任务关闭，行为回退为旧版本（无 AI 雷达）。
