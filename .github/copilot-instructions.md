# Copilot 全局规范

本文件只放跨文件、跨场景都必须遵守的硬约束。

## 全局硬约束

1. 如果是新增功能，必须同步更新 `docs/spec.md`。
2. 所有新增工具必须遵循工具系统架构规范（见下文）。
3. 涉及多文件或行为变化的较大改动后，必须先执行 `npm run verify`（至少包含语法检查与 popup 冒烟测试）并确认通过，再提交给用户 review。
4. 对于你不清楚的问题，请如实回答，必要时多给用户提问，以明确需求细节，如果确认解决不了，也请如实说明。

## 工具系统架构规范

### 目录结构

所有工具必须放在 `tools/` 目录下，命名规范：`[tool-name]-tool.js`

```
tools/
├── base-tool.js           # 基础工具类（不可修改）
├── tools-manager.js       # 工具管理器（不可修改）
├── example-tool.js        # 示例工具（参考实现）
├── [your-tool]-tool.js    # 你的工具（新增工具格式）
└── README.md              # 工具开发文档
```

### 工具开发约束

#### 1. 工具类实现要求

所有工具类**必须**继承 `BaseTool`，并实现以下方法：

```javascript
class YourToolTool extends BaseTool {
  static name = 'Your Tool'  // 必须定义 static name

  constructor(id, name, container, options = {}) {
    super(id, name, container, options)
  }

  async init() {
    await super.init()  // 必须调用 super.init()
    // 自定义初始化逻辑
  }

  render() {
    // 必须返回 HTML 字符串
    return `<div>...</div>`
  }

  // 其他可选方法...
}
```

#### 2. 文件集成要求

新增工具必须：
- [ ] 在 `popup.html` 中添加 `<script src="tools/xxx-tool.js"></script>`
- [ ] 在 `config.js` 的 `tools.enabled` 数组中注册工具 ID（格式：`kebab-case`）
- [ ] 在 `popup.js` 的 `setupToolsSystem()` 函数中调用 `toolsManager.registerTool()`
- [ ] 遵循现有的样式规范（见 `styles.css` 中的 `.tool-*` 类）

#### 3. 命名规范

| 内容 | 规范 | 示例 |
|------|------|------|
| 文件名 | `[tool-name]-tool.js` | `counter-tool.js` |
| 类名 | `[CapitalCase]Tool` 或 `[CapitalCase]ToolTool` | `CounterTool` |
| 工具 ID | `kebab-case` | `counter`, `text-utils` |
| Storage 键 | `TOOL_[ID]_` 前缀 | `TOOL_COUNTER_DATA` |

#### 4. 必须的代码模式

**配置注册**：
```javascript
// popup.html
<script src="tools/counter-tool.js"></script>

// config.js
tools: {
  enabled: ['counter'],  // 添加到这里
}

// popup.js setupToolsSystem()
if (enabledTools.includes('counter')) {
  toolsManager.registerTool('counter', CounterTool, {
    // 工具配置...
  })
}
```

**数据存储**：
```javascript
// 保存数据
await this.saveData(`${this.getStorageKeyPrefix()}_DATA`, data)

// 加载数据
const data = await this.loadData(`${this.getStorageKeyPrefix()}_DATA`)
```

**用户反馈**：
```javascript
// 显示 toast 消息
this.showToast('操作成功')
this.showToast('操作失败', 4500)  // 支持自定义时long
```

#### 5. 样式规范

工具样式必须使用以下约定的类名：

- `.tool-[name]` - 工具容器
- `.tool-title` - 工具标题
- `.tool-description` - 工具描述
- `.tool-actions` - 工具操作按钮区
- `.tool-btn` - 工具按钮
- `.tool-status` - 工具状态显示
- `.tool-placeholder` - 工具占位符

参考 `styles.css` 中的示例工具样式。

#### 6. 禁止事项

- ❌ 不能修改 `base-tool.js` 或 `tools-manager.js`
- ❌ 不能直接修改 `.tools-container` 的 DOM 结构
- ❌ 不能在工具间直接共享全局变量（应使用 `storage` API）
- ❌ 不能在 `onMounted()` 中进行异步操作（应在 `init()` 完成）
- ❌ 工具类名不能与现有工具重复

### 工具开发检查清单

新增工具时必须检查：

- [ ] 工具文件放在 `tools/` 目录
- [ ] 文件名遵循 `[tool-name]-tool.js` 格式
- [ ] 类名遵循 `[CapitalCase]Tool` 格式
- [ ] 继承自 `BaseTool`
- [ ] 实现了 `init()`, `render()` 方法
- [ ] 正确调用 `super.init()`
- [ ] 在 `popup.html` 中添加 script 标签
- [ ] 在 `config.js` 中注册工具 ID
- [ ] 在 `popup.js` 中注册工具到管理器
- [ ] 样式类名遵循 `.tool-*` 规范
- [ ] 已在 `tools/README.md` 中记录工具说明（可选但推荐）
- [ ] 所有事件监听在 `onUnmounted()` 中清理
- [ ] 数据存储使用 `getStorageKeyPrefix()` 前缀

## 分层说明

- 本文件：全局规则（始终生效）。
- `.github/instructions/*.instructions.md`：按 `applyTo` 的局部规则。

**遵守以上规范是代码合并前提。**
