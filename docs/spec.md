# My Paste 产品规格

## 1. 产品目标

My Paste 是一个本地 Chrome 扩展，用于：

- 提供轻量记事本（便签）
- 提供便签提醒能力（小时/分钟/秒）
- 提供小工具容器（可扩展的工具集）

所有数据默认仅存储于本地 `chrome.storage.local`。

---

## 2. 功能范围

### 2.1 记事本（Tab: 记事本）

- 支持新增便签（输入 + 回车/按钮）
- 支持便签列表展示（倒序）
- 支持便签编辑（点击进入编辑、Enter 保存、Esc 取消、失焦保存）
- 支持便签删除（hover 显示删除按钮）

### 2.2 便签提醒

- 每条便签 hover 显示提醒图标
- 点击提醒图标展开设置区
- 输入数值 + 选择单位（小时 / 分钟 / 秒）
- 到期后更新提醒状态：`已提醒`（或 `已过期`）
- 运行中显示倒计时剩余时间（秒级刷新）

### 2.3 小工具容器（Tab: 小工具）

- 提供可扩展的小工具容器
- 每个工具以折叠面板展示，初始化时默认展开全部已启用工具
- 点击工具面板标题后展开，显示工具内容与操作按钮
- `Token Assistor` 按钮分为 `App` 与 `CMS` 两组
- 每组按钮上下排列，两组之间使用竖线分隔
- `AI咨询` 使用与 `Token Assistor` 一致的按钮区视觉布局
- 顶部右侧提供 `全屏查看` 图标按钮
- 点击 `全屏查看` 后在新浏览器 Tab 打开扩展独立页面入口（`popup.html?mode=tab`）
- 可通过 config.js 配置工具及展示顺序

### 2.4 Token Assistor 工具

- 提供四个操作按钮：`获取 Dev Token`、`获取 Prod Token`、`获取 CMS Dev Token`、`获取 CMS Prod Token`
- `App` 组包含：`获取 Dev Token`、`获取 Prod Token`
- `CMS` 组包含：`获取 Dev Token`、`获取 Prod Token`（由组标题提供 CMS 上下文）
- 点击 `获取 Dev Token` / `获取 Prod Token` 后调用对应环境登录接口获取 token
- 点击 `获取 CMS Dev Token` 后先检查当前激活标签页域名是否为 `https://dev.cms.litnotes.ai/`
- 点击 `获取 CMS Prod Token` 后先检查当前激活标签页域名是否为 `https://cms.litnotes.ai/`
- 域名匹配时，读取对应页面 `localStorage.token` 并复制到剪切板
- 若实时读取失败，则回退使用扩展缓存的对应 CMS token（由页面 content script 同步）
- 若域名不匹配，则提示用户先打开对应站点
- token 获取成功后自动复制到剪切板并提示成功
- 失败时提示错误信息

### 2.5 AI咨询 工具

- 使用 `example` 工具位，面板标题展示为 `AI咨询`
- 提供按钮：`获取咨询`
- 点击后请求：`GET https://my-ai-radar.vercel.app/history?limit=10`
- 请求头固定携带：`x-api-key`
- 返回结果以 list-card 形式展示关键信息（名称、发布时间、入库时间、来源链接）
- list-card 按 `publishedAt` 倒序排列（最新在前）
- 查询中在结果区显示菊花占位（loading card）
- 请求失败时展示错误信息（toast + JSON 错误对象）

### 2.6 快捷键

- 支持 `commands._execute_action`
- 默认：
	- macOS: `Command+Shift+Y`
	- Windows/Linux: `Ctrl+Shift+Y`

---

## 3. Popup 信息架构

### 3.1 Tab 结构

- Tab1: `小工具`（待扩展）
- Tab2: `记事本`
- 右上角：`全屏查看` 图标按钮（新开 tab 进入独立视图）
- 默认进入 Tab1
- 独立标签页模式支持通过 query 参数指定初始 tab

### 3.2 小工具页布局

- 工具折叠面板列表
- 面板标题区（工具名 + 展开/收起箭头）
- 面板内容区（仅展开时显示）
- 面板内容区不重复展示工具标题（避免冗余）
- `Token Assistor` 面板内按钮区按左右两组展示，每组内部垂直排列

### 3.3 记事本页布局

- 便签输入区（输入框 + 添加按钮）
- 便签列表
- 每项支持操作：编辑、提醒、删除
- 便签元信息区显示时间与提醒状态

---

## 4. 数据模型

### 4.1 Storage Keys

- `notes`: 便签列表
- `noteReminders`: 提醒任务映射（以 alarmName 为 key）

### 4.2 notes

```ts
type Note = {
	id: string
	content: string
	createdAt: number
}
```

### 4.3 noteReminders

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

---

## 5. 提醒机制

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

---

## 6. 配置项（config.js）

当前使用工具配置控制启用与顺序：

```js
window.APP_CONFIG = {
	tools: {
		enabled: ['token-assistor', 'example'],
		default: {}
	}
}
```

说明：`example` 工具 ID 当前对应 `AI咨询` 工具实现。

---

## 7. 权限说明（Manifest V3）

当前使用权限：

- `storage`
- `activeTab`
- `tabs`
- `scripting`
- `alarms`
- `notifications`

---

## 8. 已知依赖与运行前提

- 提醒通知依赖操作系统与浏览器通知设置（macOS 通知中心 / Chrome 通知权限）
- manifest 权限更新后需手动重新加载扩展
- `chrome.notifications` 必须可访问有效图标资源

---

## 9. 验收清单

- [x] 记事本新增、编辑、删除
- [x] 提醒设置（小时/分钟/秒）
- [x] 倒计时 + 已提醒/已过期状态
- [x] 快捷键唤起扩展
- [x] 小工具折叠面板（默认展开全部已启用工具，点击可展开/收起）
- [x] 工具按钮两列布局（每行最多 2 个）
- [x] Token Assistor 工具（Dev/Prod/CMS Dev/CMS Prod token 获取与复制）
- [x] AI咨询 工具（获取咨询历史并展示 JSON）

---

## 10. 变更日志

### v1.3.0
- 将示例工具改造为 `AI咨询`
- 新增 `获取咨询` 按钮，请求 AI Radar 历史接口并展示 JSON 返回

### v1.2.0
- 小工具区域升级为折叠面板结构
- 工具按钮布局统一为每行 2 个、从左到右排列
- 新增 Token Assistor 工具（Dev/Prod/CMS Dev/CMS Prod token 获取与剪切板复制）

### v1.1.0
- 移除剪贴板记录功能
- 移除 AI 雷达功能
- 将剪贴板 Tab 改为小工具 Tab
- 简化数据模型和配置项
