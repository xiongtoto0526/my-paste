# 工具系统说明

## 概述

My Paste 的工具系统采用模块化设计，允许你轻松添加新的功能工具。每个工具是独立的模块，可以独立开发、测试和维护。

## 目录结构

```
tools/
├── base-tool.js          # 基础工具类（所有工具继承）
├── tools-manager.js      # 工具管理器（负责工具生命周期）
├── example-tool.js       # 示例工具（参考实现）
└── [your-tool].js        # 你的自定义工具
```

## 快速开始

### 1. 创建新工具

复制 `example-tool.js` 为 `your-tool.js`，并修改类名：

```javascript
class YourTool extends BaseTool {
  static name = 'Your Tool'

  constructor(id, name, container, options = {}) {
    super(id, name, container, options)
  }

  async init() {
    await super.init()
    // 初始化你的工具逻辑
  }

  render() {
    // 返回工具的 HTML
    return `<div>Your Tool Content</div>`
  }

  onMounted() {
    // 工具挂载后的初始化（绑定事件等）
  }

  onUnmounted() {
    // 工具卸载前的清理
  }

  destroy() {
    // 销毁工具，清理资源
    super.destroy()
  }
}
```

### 2. 在 popup.html 中引入工具脚本

在 `popup.html` 中添加你的工具脚本：

```html
<!-- 工具脚本 -->
<script src="tools/example-tool.js"></script>
<script src="tools/your-tool.js"></script>
```

### 3. 在 config.js 中注册工具

在 `config.js` 中的 `tools.enabled` 数组中添加你的工具 ID：

```javascript
window.APP_CONFIG = {
  tools: {
    enabled: ['example', 'your-tool'],
    default: {}
  }
}
```

### 4. 在 popup.js 中注册工具

在 `setupToolsSystem()` 函数中注册你的工具：

```javascript
function setupToolsSystem() {
  // ... 现有代码 ...

  // 注册你的工具
  if (enabledTools.includes('your-tool')) {
    toolsManager.registerTool('your-tool', YourTool, {
      // 工具配置选项
      option1: 'value1'
    })
  }
}
```

## BaseTool API

### 属性

- `id` (string) - 工具唯一标识
- `name` (string) - 工具名称
- `container` (HTMLElement) - 工具容器元素
- `options` (Object) - 工具配置选项
- `isInitialized` (boolean) - 工具是否已初始化

### 方法

#### 生命周期方法

- `async init()` - 初始化工具（必须调用 `super.init()`）
- `render()` - 返回工具的 HTML 字符串
- `mount()` - 挂载工具到容器（自动调用 `render()`）
- `unmount()` - 从容器卸载工具
- `destroy()` - 销毁工具和清理资源

#### 数据存储方法

- `async loadData(key)` - 从 storage 加载数据
- `async saveData(key, value)` - 保存数据到 storage
- `getStorageKeyPrefix()` - 获取工具的存储键前缀

#### 工具交互方法

- `showToast(message, duration)` - 显示 toast 消息

#### 生命周期钩子

- `onMounted()` - 工具挂载后的钩子（可重写）
- `onUnmounted()` - 工具卸载前的钩子（可重写）

## ToolsManager API

### 方法

- `registerTool(id, toolClass, options)` - 注册工具
- `async initializeTool(id)` - 初始化指定工具
- `async showTool(id)` - 显示指定工具
- `hideTool(id)` - 隐藏指定工具
- `getTool(id)` - 获取工具实例
- `getRegisteredToolIds()` - 获取所有已注册的工具 ID
- `destroyTool(id)` - 销毁指定工具
- `destroyAll()` - 销毁所有工具
- `getStatus()` - 获取管理器状态

## 工具开发示例

### 简单计数器工具

```javascript
class CounterTool extends BaseTool {
  static name = 'Counter'

  constructor(id, name, container, options = {}) {
    super(id, name, container, options)
    this.count = 0
  }

  async init() {
    await super.init()
    const data = await this.loadData(`${this.getStorageKeyPrefix()}_COUNT`)
    this.count = data || 0
  }

  render() {
    return `
      <div style="padding: 20px; text-align: center;">
        <h3>计数器</h3>
        <div style="font-size: 24px; margin: 20px 0;">${this.count}</div>
        <button type="button" class="counter-inc">增加</button>
        <button type="button" class="counter-dec">减少</button>
        <button type="button" class="counter-reset">重置</button>
      </div>
    `
  }

  onMounted() {
    const incBtn = this.container.querySelector('.counter-inc')
    const decBtn = this.container.querySelector('.counter-dec')
    const resetBtn = this.container.querySelector('.counter-reset')

    incBtn?.addEventListener('click', () => this.increment())
    decBtn?.addEventListener('click', () => this.decrement())
    resetBtn?.addEventListener('click', () => this.reset())
  }

  increment() {
    this.count++
    this.saveData(`${this.getStorageKeyPrefix()}_COUNT`, this.count)
    this.mount() // 重新渲染
    this.showToast(`计数：${this.count}`)
  }

  decrement() {
    this.count--
    this.saveData(`${this.getStorageKeyPrefix()}_COUNT`, this.count)
    this.mount()
    this.showToast(`计数：${this.count}`)
  }

  reset() {
    this.count = 0
    this.saveData(`${this.getStorageKeyPrefix()}_COUNT`, this.count)
    this.mount()
    this.showToast('已重置')
  }
}
```

## 最佳实践

1. **模块独立** - 每个工具应该是独立的，不依赖其他工具
2. **状态管理** - 使用 `storage` API 来持久化工具数据
3. **事件清理** - 在 `onUnmounted()` 中移除事件监听器
4. **错误处理** - 使用 try-catch 处理异步操作
5. **UI 一致性** - 遵循扩展的设计样式，使用现有的 CSS 类
6. **文档齐全** - 为你的工具添加清晰的注释和文档

## 常见问题

### Q: 如何在工具之间共享数据？
A: 可以使用 `chrome.storage.local` 来存储共享数据，工具通过约定的键名来访问。

### Q: 如何添加工具配置选项？
A: 在注册工具时传入配置对象，然后在 `this.options` 中访问。

### Q: 如何调试工具？
A: 使用浏览器的开发者工具（F12），在控制台查看日志（带 `[Tool]` 或 `[ToolsManager]` 前缀）。

### Q: 如何测试工具？
A: 在 `config.js` 中启用工具，然后在扩展的 popup 中测试。

## 更多帮助

参考 `example-tool.js` 获取完整的工具实现示例。
