/**
 * Token Assistor Tool
 * 快速获取 dev/prod token 的工具
 */
class TokenAssistorTool extends BaseTool {
	static name = 'Token Assistor'
	static cmsDevTokenCacheKey = 'MY_PASTE_CMS_DEV_TOKEN_CACHE'
	static cmsProdTokenCacheKey = 'MY_PASTE_CMS_PROD_TOKEN_CACHE'

	constructor(id, name, container, options = {}) {
		super(id, name, container, options)
		this.isLoading = false
		this.devBtnHandler = null
		this.prodBtnHandler = null
		this.cmsDevBtnHandler = null
		this.cmsProdBtnHandler = null
	}

	async init() {
		await super.init()
	}

	render() {
		return `
			<div class="tool-token-assistor">
				<div class="tool-description">快速获取开发和生产环境的 Token</div>
				
				<div class="token-actions">
					<div class="token-group">
						<div class="token-group-title">App</div>
						<button type="button" class="token-btn token-dev-btn" ${this.isLoading ? 'disabled' : ''}>
							${this.isLoading ? '获取中...' : '获取 Dev Token'}
						</button>
						<button type="button" class="token-btn token-prod-btn" ${this.isLoading ? 'disabled' : ''}>
							${this.isLoading ? '获取中...' : '获取 Prod Token'}
						</button>
					</div>
					<div class="token-divider" aria-hidden="true"></div>
					<div class="token-group">
						<div class="token-group-title">CMS</div>
						<button type="button" class="token-btn token-cms-dev-btn" ${this.isLoading ? 'disabled' : ''}>
							${this.isLoading ? '获取中...' : '获取 Dev Token'}
						</button>
						<button type="button" class="token-btn token-cms-prod-btn" ${this.isLoading ? 'disabled' : ''}>
							${this.isLoading ? '获取中...' : '获取 Prod Token'}
						</button>
					</div>
				</div>
			</div>
		`
	}

	onMounted() {
		const devBtn = this.container.querySelector('.token-dev-btn')
		const prodBtn = this.container.querySelector('.token-prod-btn')
		const cmsDevBtn = this.container.querySelector('.token-cms-dev-btn')
		const cmsProdBtn = this.container.querySelector('.token-cms-prod-btn')

		// 创建绑定的处理器函数（用于后续移除）
		this.devBtnHandler = () => this.getToken('dev')
		this.prodBtnHandler = () => this.getToken('prod')
		this.cmsDevBtnHandler = () => this.getCmsDevToken()
		this.cmsProdBtnHandler = () => this.getCmsProdToken()

		if (devBtn) {
			devBtn.addEventListener('click', this.devBtnHandler)
		}

		if (prodBtn) {
			prodBtn.addEventListener('click', this.prodBtnHandler)
		}

		if (cmsDevBtn) {
			cmsDevBtn.addEventListener('click', this.cmsDevBtnHandler)
		}

		if (cmsProdBtn) {
			cmsProdBtn.addEventListener('click', this.cmsProdBtnHandler)
		}
	}

	onUnmounted() {
		const devBtn = this.container.querySelector('.token-dev-btn')
		const prodBtn = this.container.querySelector('.token-prod-btn')
		const cmsDevBtn = this.container.querySelector('.token-cms-dev-btn')
		const cmsProdBtn = this.container.querySelector('.token-cms-prod-btn')

		if (devBtn && this.devBtnHandler) {
			devBtn.removeEventListener('click', this.devBtnHandler)
		}

		if (prodBtn && this.prodBtnHandler) {
			prodBtn.removeEventListener('click', this.prodBtnHandler)
		}

		if (cmsDevBtn && this.cmsDevBtnHandler) {
			cmsDevBtn.removeEventListener('click', this.cmsDevBtnHandler)
		}

		if (cmsProdBtn && this.cmsProdBtnHandler) {
			cmsProdBtn.removeEventListener('click', this.cmsProdBtnHandler)
		}
	}

	async getCmsDevToken() {
		if (this.isLoading) {
			return
		}

		this.isLoading = true
		this.updateUI()

		try {
			const targetOrigin = 'https://dev.cms.litnotes.ai'
			const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
			const activeTab = Array.isArray(tabs) ? tabs[0] : null

			if (!activeTab || typeof activeTab.id !== 'number' || typeof activeTab.url !== 'string') {
				throw new Error('无法读取当前标签页')
			}

			let activeOrigin = ''
			try {
				activeOrigin = new URL(activeTab.url).origin
			} catch (_error) {
				activeOrigin = ''
			}

			if (activeOrigin !== targetOrigin) {
				this.showToast('请先打开 https://dev.cms.litnotes.ai/', 4500)
				return
			}

			const token = await this.readCmsTokenFromTab(
				activeTab.id,
				TokenAssistorTool.cmsDevTokenCacheKey,
				targetOrigin
			)
			if (typeof token !== 'string' || token.trim().length === 0) {
				throw new Error('未在该站点 localStorage 中找到 token')
			}

			await this.copyToClipboard(token)
			this.showToast('CMS Dev Token 获取成功，已复制到剪切板')
		} catch (error) {
			console.error('[TokenAssistor] Failed to get cms dev token:', error)
			const errorMsg = error instanceof Error ? error.message : 'Unknown error'
			this.showToast(`CMS Dev Token 获取失败: ${errorMsg}`, 4500)
		} finally {
			this.isLoading = false
			this.mount() // 重新渲染按钮状态
		}
	}

	async getCmsProdToken() {
		if (this.isLoading) {
			return
		}

		this.isLoading = true
		this.updateUI()

		try {
			const targetOrigin = 'https://cms.litnotes.ai'
			const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
			const activeTab = Array.isArray(tabs) ? tabs[0] : null

			if (!activeTab || typeof activeTab.id !== 'number' || typeof activeTab.url !== 'string') {
				throw new Error('无法读取当前标签页')
			}

			let activeOrigin = ''
			try {
				activeOrigin = new URL(activeTab.url).origin
			} catch (_error) {
				activeOrigin = ''
			}

			if (activeOrigin !== targetOrigin) {
				this.showToast('请先打开 https://cms.litnotes.ai/', 4500)
				return
			}

			const token = await this.readCmsTokenFromTab(
				activeTab.id,
				TokenAssistorTool.cmsProdTokenCacheKey,
				targetOrigin
			)
			if (typeof token !== 'string' || token.trim().length === 0) {
				throw new Error('未在该站点 localStorage 中找到 token')
			}

			await this.copyToClipboard(token)
			this.showToast('CMS Prod Token 获取成功，已复制到剪切板')
		} catch (error) {
			console.error('[TokenAssistor] Failed to get cms prod token:', error)
			const errorMsg = error instanceof Error ? error.message : 'Unknown error'
			this.showToast(`CMS Prod Token 获取失败: ${errorMsg}`, 4500)
		} finally {
			this.isLoading = false
			this.mount() // 重新渲染按钮状态
		}
	}

	async readCmsTokenFromTab(tabId, cacheKey, targetOrigin) {
		if (
			chrome.scripting &&
			typeof chrome.scripting.executeScript === 'function'
		) {
			const results = await chrome.scripting.executeScript({
				target: { tabId },
				func: () => localStorage.getItem('token')
			})

			const tokenFromScript = Array.isArray(results) ? results[0]?.result : null
			if (typeof tokenFromScript === 'string' && tokenFromScript.trim()) {
				return tokenFromScript
			}
		}

		if (chrome.tabs && typeof chrome.tabs.sendMessage === 'function') {
			try {
				const response = await chrome.tabs.sendMessage(tabId, {
					type: 'MY_PASTE_READ_LOCAL_STORAGE_TOKEN'
				})

				if (!response?.ok) {
					throw new Error(response?.error || '读取 token 失败')
				}

				if (typeof response.token === 'string' && response.token.trim()) {
					return response.token
				}
			} catch (error) {
				console.warn('[TokenAssistor] tabs.sendMessage fallback failed', error)
			}
		}

		const cache = await this.loadData(cacheKey)
		const cachedToken = typeof cache?.token === 'string' ? cache.token.trim() : ''
		if (cachedToken) {
			return cachedToken
		}

		throw new Error(`无法读取页面 token，请刷新 ${targetOrigin}/ 页面后重试`)
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
		const cmsDevBtn = this.container.querySelector('.token-cms-dev-btn')
		const cmsProdBtn = this.container.querySelector('.token-cms-prod-btn')

		if (devBtn) {
			devBtn.disabled = this.isLoading
		}
		if (prodBtn) {
			prodBtn.disabled = this.isLoading
		}
		if (cmsDevBtn) {
			cmsDevBtn.disabled = this.isLoading
		}
		if (cmsProdBtn) {
			cmsProdBtn.disabled = this.isLoading
		}
	}

	destroy() {
		this.onUnmounted()
		super.destroy()
	}
}
