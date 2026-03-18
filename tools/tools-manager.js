/**
 * 工具管理器
 * 负责工具的注册、初始化、卸载和状态管理
 */
class ToolsManager {
	constructor(containerElement, config = {}) {
		this.containerElement = containerElement
		this.config = config
		this.tools = new Map() // id -> tool instance
		this.currentToolId = null
	}

	/**
	 * 注册工具
	 * @param {string} id - 工具 ID
	 * @param {BaseTool} toolClass - 工具类（未实例化）
	 * @param {Object} options - 工具配置选项
	 */
	registerTool(id, toolClass, options = {}) {
		if (this.tools.has(id)) {
			console.warn(`[ToolsManager] Tool ${id} already registered`)
			return
		}

		const title = typeof options.title === 'string' && options.title.trim()
			? options.title.trim()
			: (toolClass.name || id)

		// 创建折叠面板
		const panelElement = document.createElement('section')
		panelElement.className = 'tool-panel'
		panelElement.dataset.toolId = id

		const toggleButton = document.createElement('button')
		toggleButton.type = 'button'
		toggleButton.className = 'tool-panel-toggle'
		toggleButton.setAttribute('aria-expanded', 'false')
		toggleButton.innerHTML = `<span class="tool-panel-title">${title}</span><span class="tool-panel-arrow">▾</span>`

		const panelBody = document.createElement('div')
		panelBody.className = 'tool-panel-body'
		panelBody.hidden = true

		// 创建该工具的容器 div
		const toolContainer = document.createElement('div')
		toolContainer.id = `tool-${id}`
		toolContainer.className = 'tool-content'
		toolContainer.style.display = 'block'

		panelBody.appendChild(toolContainer)
		panelElement.appendChild(toggleButton)
		panelElement.appendChild(panelBody)

		// 实例化工具
		const toolInstance = new toolClass(id, toolClass.name || id, toolContainer, options)
		const handleToggle = () => {
			this.toggleToolPanel(id).catch((error) => {
				console.error(`[ToolsManager] Toggle panel failed for ${id}`, error)
			})
		}
		toggleButton.addEventListener('click', handleToggle)

		this.tools.set(id, {
			id,
			toolClass,
			instance: toolInstance,
			container: toolContainer,
			panelElement,
			panelBody,
			toggleButton,
			handleToggle,
			options,
			initialized: false,
			expanded: false
		})

		// 将容器添加到父容器
		this.containerElement.appendChild(panelElement)

		console.log(`[ToolsManager] Tool ${id} registered`)
	}

	/**
	 * 切换工具面板展开/收起状态
	 * @param {string} id - 工具 ID
	 */
	async toggleToolPanel(id) {
		const toolDef = this.tools.get(id)
		if (!toolDef) {
			return
		}

		if (toolDef.expanded) {
			this.hideTool(id)
			return
		}

		await this.showTool(id)
	}

	/**
	 * 初始化工具
	 * @param {string} id - 工具 ID
	 * @returns {Promise<void>}
	 */
	async initializeTool(id) {
		const toolDef = this.tools.get(id)
		if (!toolDef) {
			console.error(`[ToolsManager] Tool ${id} not found`)
			return
		}

		if (toolDef.initialized) {
			return
		}

		try {
			await toolDef.instance.init()
			toolDef.instance.mount()
			toolDef.initialized = true
			console.log(`[ToolsManager] Tool ${id} initialized`)
		} catch (error) {
			console.error(`[ToolsManager] Failed to init tool ${id}`, error)
			throw error
		}
	}

	/**
	 * 显示工具
	 * @param {string} id - 工具 ID
	 * @returns {Promise<void>}
	 */
	async showTool(id) {
		const toolDef = this.tools.get(id)
		if (!toolDef) {
			console.error(`[ToolsManager] Tool ${id} not found`)
			return
		}

		// 初始化工具（如果还未初始化）
		if (!toolDef.initialized) {
			await this.initializeTool(id)
		}

		// 展开该工具面板
		toolDef.panelBody.hidden = false
		toolDef.panelElement.classList.add('expanded')
		toolDef.toggleButton.setAttribute('aria-expanded', 'true')
		toolDef.expanded = true
		this.currentToolId = id

		console.log(`[ToolsManager] Tool ${id} shown`)
	}

	/**
	 * 隐藏工具
	 * @param {string} id - 工具 ID
	 */
	hideTool(id) {
		const toolDef = this.tools.get(id)
		if (toolDef) {
			toolDef.panelBody.hidden = true
			toolDef.panelElement.classList.remove('expanded')
			toolDef.toggleButton.setAttribute('aria-expanded', 'false')
			toolDef.expanded = false
		}

		if (this.currentToolId === id) {
			this.currentToolId = null
		}
	}

	/**
	 * 获取工具实例
	 * @param {string} id - 工具 ID
	 * @returns {BaseTool|null}
	 */
	getTool(id) {
		const toolDef = this.tools.get(id)
		return toolDef ? toolDef.instance : null
	}

	/**
	 * 获取所有已注册的工具 ID
	 * @returns {string[]}
	 */
	getRegisteredToolIds() {
		return Array.from(this.tools.keys())
	}

	/**
	 * 销毁工具
	 * @param {string} id - 工具 ID
	 */
	destroyTool(id) {
		const toolDef = this.tools.get(id)
		if (!toolDef) {
			return
		}

		toolDef.toggleButton.removeEventListener('click', toolDef.handleToggle)
		toolDef.instance.destroy()
		toolDef.panelElement.remove()
		this.tools.delete(id)

		if (this.currentToolId === id) {
			this.currentToolId = null
		}

		console.log(`[ToolsManager] Tool ${id} destroyed`)
	}

	/**
	 * 销毁所有工具
	 */
	destroyAll() {
		for (const id of this.tools.keys()) {
			this.destroyTool(id)
		}
		console.log('[ToolsManager] All tools destroyed')
	}

	/**
	 * 获取工具管理器状态
	 * @returns {Object}
	 */
	getStatus() {
		return {
			totalTools: this.tools.size,
			registeredTools: this.getRegisteredToolIds(),
			currentToolId: this.currentToolId
		}
	}
}
