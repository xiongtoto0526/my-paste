# Reminder 功能说明

## 1. 功能目标

为记事本便签提供本地提醒能力，支持快速测试与可视化状态追踪：

- 在便签项上设置提醒（小时 / 分钟 / 秒）
- 到期后触发 Chrome 通知
- 在 UI 中显示倒计时、已提醒、已过期状态

---

## 2. 用户交互

在 `记事本` Tab 中，每条便签支持以下交互：

1. Hover 便签项显示提醒图标（⏰）
2. 点击提醒图标，展开提醒设置区
3. 输入数字并选择单位：`小时` / `分钟` / `秒`
4. 点击“设置”或按 Enter 提交

提交成功后：

- 显示 toast：`已设置 X 单位后提醒`
- 便签右侧元信息显示 `剩余 xx`
- 到期后状态更新为 `已提醒`（或 `已过期`）

---

## 3. 技术实现

## 3.1 Popup 侧（`popup.js`）

- 提供提醒面板渲染与输入校验
- 将提醒请求通过 `chrome.runtime.sendMessage` 发送给 background
- 在消息端口异常时，尝试 fallback 到 popup 侧创建 alarm
- 维护提醒状态映射并展示 badge：
	- `pending`：显示倒计时
	- `fired`：显示 `已提醒`
	- `expired`：显示 `已过期`
- 通过 `chrome.storage.onChanged` 同步后台状态
- 使用定时器每秒刷新倒计时文本（原位更新，避免整页重渲）

## 3.2 Background 侧（`background.js`）

- 接收消息类型：`MY_PASTE_CREATE_REMINDER`
- 校验参数并创建 `chrome.alarms`
- 保存提醒映射到 `chrome.storage.local.noteReminders`
- 在 `chrome.alarms.onAlarm` 中：
	- 标记提醒为 `fired`
	- 调用 `chrome.notifications.create` 发送通知

---

## 4. 数据结构

存储 key：`noteReminders`

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

说明：

- `alarmName` 作为唯一键，格式前缀：`note-reminder-`
- UI 会按 `noteId` 聚合并显示“最近一个提醒状态”

---

## 5. 权限要求

`manifest.json` 需要：

- `alarms`
- `notifications`
- `storage`

注意：修改权限后必须在 `chrome://extensions` 手动重载扩展。

---

## 6. 通知图标

通知使用扩展内本地图标：

- `assets/notification-icon.png`

不建议使用不稳定的远程 URL 或异常 data URL，避免 `Unable to download all specified images` 报错。

---

## 7. 常见问题排查

## 7.1 到点显示“已提醒”但没有通知弹窗

优先排查系统通知策略：

- macOS 通知设置中 `Google Chrome` 是否允许通知
- 通知样式是否是“横幅/提醒”（不是“无”）
- 是否处于勿扰/专注模式

## 7.2 控制台报错：message port closed

说明 popup 到 background 的消息链路中断。处理方式：

- 重载扩展
- 重新打开 popup
- 功能已内置 fallback，仍失败再看 `service worker` 控制台日志

## 7.3 控制台报错：Unable to download all specified images

说明通知图标不可解码，需替换为有效 PNG 并重载扩展。

---

## 8. 验收步骤

1. 在记事本新增一条便签
2. 设置 `10 秒` 提醒
3. 观察 UI 状态：`剩余 10秒` → `已提醒`
4. 确认系统层出现 Chrome 通知
5. 打开 `service worker` 控制台确认无 `notifications.create` 错误

