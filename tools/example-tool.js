/**
 * 示例工具
 * 演示如何创建一个自定义工具
 * 
 * 使用方式：
 * toolsManager.registerTool('example', ExampleTool, {
 *   title: '自定义标题'
 * })
 */
class ExampleTool extends BaseTool {
	static name = 'Example Tool'

	constructor(id, name, container, options = {}) {
		super(id, name, container, options)
	}

	async init() {
		// 初始化工具
		await super.init()

		// 从 storage 加载数据
		const data = await this.loadData(`${this.getStorageKeyPrefix()}_DATA`)
		console.log(`[${this.name}] Loaded data:`, data)
	}

	render() {
		return `
			<div class="tool-example">
				<div class="tool-description">
					<p>这是一个示例工具，展示如何创建自定义工具。</p>
					<p>你可以将此文件复制为新工具的模板。</p>
				</div>
				<div class="tool-actions">
					<button type="button" class="tool-btn tool-save-btn">保存数据</button>
					<button type="button" class="tool-btn tool-clear-btn">清除数据</button>
				</div>
				<div class="tool-status">
					<p>状态：<span class="status-text">就绪</span></p>
				</div>
			</div>
		`
	}

	onMounted() {
		// 绑定事件监听器
		const saveBtn = this.container.querySelector('.tool-save-btn')
		const clearBtn = this.container.querySelector('.tool-clear-btn')

		if (saveBtn) {
			saveBtn.addEventListener('click', () => this.handleSave())
		}

		if (clearBtn) {
			clearBtn.addEventListener('click', () => this.handleClear())
		}
	}

	onUnmounted() {
		// 移除事件监听器
		const saveBtn = this.container.querySelector('.tool-save-btn')
		const clearBtn = this.container.querySelector('.tool-clear-btn')

		if (saveBtn) {
			saveBtn.removeEventListener('click', () => this.handleSave())
		}

		if (clearBtn) {
			clearBtn.removeEventListener('click', () => this.handleClear())
		}
	}

	async handleSave() {
		try {
			const data = {
				timestamp: Date.now(),
				message: '数据已保存'
			}

			await this.saveData(`${this.getStorageKeyPrefix()}_DATA`, data)
			this.showToast('数据保存成功')
			this.updateStatus('✓ 已保存')
		} catch (error) {
			console.error('Save failed:', error)
			this.showToast('数据保存失败')
			this.updateStatus('✗ 保存失败')
		}
	}

	async handleClear() {
		try {
			await this.saveData(`${this.getStorageKeyPrefix()}_DATA`, null)
			this.showToast('数据已清除')
			this.updateStatus('✓ 已清除')
		} catch (error) {
			console.error('Clear failed:', error)
			this.showToast('数据清除失败')
			this.updateStatus('✗ 清除失败')
		}
	}

	updateStatus(text) {
		const statusText = this.container.querySelector('.status-text')
		if (statusText) {
			statusText.textContent = text
		}
	}

	destroy() {
		// 清理资源
		this.onUnmounted()
		super.destroy()
	}
}
