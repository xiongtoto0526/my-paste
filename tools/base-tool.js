/**
 * 工具基础类
 * 所有工具应该继承此类并实现相关方法
 */
class BaseTool {
	/**
	 * 构造函数
	 * @param {string} id - 工具唯一标识
	 * @param {string} name - 工具名称
	 * @param {Object} container - 工具容器 DOM 元素
	 * @param {Object} options - 工具配置选项
	 */
	constructor(id, name, container, options = {}) {
		this.id = id
		this.name = name
		this.container = container
		this.options = options
		this.isInitialized = false
	}

	/**
	 * 初始化工具
	 * 子类应该重写此方法来执行自定义初始化逻辑
	 */
	async init() {
		try {
			this.isInitialized = true
			console.log(`[Tool] ${this.name} initialized`)
		} catch (error) {
			console.error(`[Tool] ${this.name} init failed`, error)
			throw error
		}
	}

	/**
	 * 渲染工具 UI
	 * 子类应该重写此方法来生成工具的 HTML 内容
	 * @returns {string} HTML 字符串
	 */
	render() {
		return `<div class="tool-placeholder">${this.name} - 工具开发中</div>`
	}

	/**
	 * 挂载工具到容器
	 */
	mount() {
		if (!this.container) {
			console.error(`[Tool] ${this.name} mount failed: no container`)
			return
		}

		const html = this.render()
		this.container.innerHTML = html

		// 调用挂载后的生命周期钩子
		this.onMounted?.()
	}

	/**
	 * 卸载工具
	 */
	unmount() {
		if (this.container) {
			this.container.innerHTML = ''
		}

		// 调用卸载前的生命周期钩子
		this.onUnmounted?.()
	}

	/**
	 * 销毁工具
	 * 子类应该重写此方法来清理资源、事件监听等
	 */
	destroy() {
		this.unmount()
		console.log(`[Tool] ${this.name} destroyed`)
	}

	/**
	 * 从 storage 加载工具数据
	 * @param {string} key - 存储键
	 * @returns {Promise<any>} 存储的数据
	 */
	async loadData(key) {
		try {
			const data = await chrome.storage.local.get(key)
			return data[key] || null
		} catch (error) {
			console.error(`[Tool] ${this.name} loadData failed`, error)
			return null
		}
	}

	/**
	 * 保存工具数据到 storage
	 * @param {string} key - 存储键
	 * @param {any} value - 要保存的数据
	 * @returns {Promise<void>}
	 */
	async saveData(key, value) {
		try {
			await chrome.storage.local.set({ [key]: value })
		} catch (error) {
			console.error(`[Tool] ${this.name} saveData failed`, error)
			throw error
		}
	}

	/**
	 * 获取工具存储键前缀
	 * @returns {string} 存储键前缀
	 */
	getStorageKeyPrefix() {
		return `TOOL_${this.id.toUpperCase()}`
	}

	/**
	 * 显示 toast 消息
	 * @param {string} message - 消息内容
	 * @param {number} duration - 显示时长（毫秒）
	 */
	showToast(message, duration = 1400) {
		const toast = document.getElementById('toast')
		if (toast) {
			toast.textContent = message
			setTimeout(() => {
				if (toast.textContent === message) {
					toast.textContent = ''
				}
			}, duration)
		}
	}

	/**
	 * 生命周期钩子：工具挂载后
	 * 子类可以重写此方法
	 */
	onMounted() {}

	/**
	 * 生命周期钩子：工具卸载前
	 * 子类可以重写此方法
	 */
	onUnmounted() {}
}
