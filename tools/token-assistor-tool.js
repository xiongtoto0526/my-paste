/**
 * Token Assistor Tool
 * 快速获取 dev/prod token 的工具
 */
class TokenAssistorTool extends BaseTool {
	static name = 'Token Assistor'

	constructor(id, name, container, options = {}) {
		super(id, name, container, options)
		this.isLoading = false
		this.devBtnHandler = null
		this.prodBtnHandler = null
		console.log('[TokenAssistorTool] Constructor called', id, name)
	}

	async init() {
		await super.init()
		console.log('[TokenAssistorTool] init() completed')
	}

	render() {
		return `
			<div class="tool-token-assistor">
				<div class="tool-title">Token Assistor</div>
				<div class="tool-description">快速获取开发和生产环境的 Token</div>
				
				<div class="token-actions">
					<button type="button" class="token-btn token-dev-btn" ${this.isLoading ? 'disabled' : ''}>
						${this.isLoading ? '获取中...' : '获取 Dev Token'}
					</button>
					<button type="button" class="token-btn token-prod-btn" ${this.isLoading ? 'disabled' : ''}>
						${this.isLoading ? '获取中...' : '获取 Prod Token'}
					</button>
				</div>
			</div>
		`
	}

	onMounted() {
		const devBtn = this.container.querySelector('.token-dev-btn')
		const prodBtn = this.container.querySelector('.token-prod-btn')

		// 创建绑定的处理器函数（用于后续移除）
		this.devBtnHandler = () => this.getToken('dev')
		this.prodBtnHandler = () => this.getToken('prod')

		if (devBtn) {
			devBtn.addEventListener('click', this.devBtnHandler)
		}

		if (prodBtn) {
			prodBtn.addEventListener('click', this.prodBtnHandler)
		}
	}

	onUnmounted() {
		const devBtn = this.container.querySelector('.token-dev-btn')
		const prodBtn = this.container.querySelector('.token-prod-btn')

		if (devBtn && this.devBtnHandler) {
			devBtn.removeEventListener('click', this.devBtnHandler)
		}

		if (prodBtn && this.prodBtnHandler) {
			prodBtn.removeEventListener('click', this.prodBtnHandler)
		}
	}

	async getToken(env) {
		if (this.isLoading) {
			return
		}

		this.isLoading = true
		this.updateUI()

		try {
			const baseUrl = env === 'dev' 
				? 'https://dev-api.litnotes.ai' 
				: 'https://api.litnotes.ai'

			const url = `${baseUrl}/api/auth/login/email`

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
					'accept': 'application/json'
				},
				body: JSON.stringify({
					email: 'xiongtoto0526@126.com',
					password: 'Xht876222@'
				})
			})

			if (!response.ok) {
				throw new Error(`HTTP Error: ${response.status}`)
			}

			const result = await response.json()
			const token = result?.data?.token

			if (!token) {
				throw new Error('Token not found in response')
			}

			// 复制到剪切板
			await this.copyToClipboard(token)

			// 显示成功信息
			const envLabel = env === 'dev' ? 'Dev' : 'Prod'
			this.showToast(`${envLabel} Token 获取成功，已复制到剪切板`)

			console.log(`[TokenAssistor] ${envLabel} token acquired successfully`)
		} catch (error) {
			console.error(`[TokenAssistor] Failed to get ${env} token:`, error)
			const envLabel = env === 'dev' ? 'Dev' : 'Prod'
			const errorMsg = error instanceof Error ? error.message : 'Unknown error'
			this.showToast(`${envLabel} Token 获取失败: ${errorMsg}`, 4500)
		} finally {
			this.isLoading = false
			this.mount() // 重新渲染按钮状态
		}
	}

	async copyToClipboard(text) {
		try {
			// 使用 Clipboard API
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(text)
				return
			}

			// 备选方案：使用传统方法
			const textarea = document.createElement('textarea')
			textarea.value = text
			textarea.style.position = 'fixed'
			textarea.style.opacity = '0'
			document.body.appendChild(textarea)
			textarea.select()
			document.execCommand('copy')
			document.body.removeChild(textarea)
		} catch (error) {
			console.error('[TokenAssistor] Failed to copy to clipboard:', error)
			throw new Error('Failed to copy to clipboard')
		}
	}

	updateUI() {
		const devBtn = this.container.querySelector('.token-dev-btn')
		const prodBtn = this.container.querySelector('.token-prod-btn')

		if (devBtn) {
			devBtn.disabled = this.isLoading
		}
		if (prodBtn) {
			prodBtn.disabled = this.isLoading
		}
	}

	destroy() {
		this.onUnmounted()
		super.destroy()
	}
}
