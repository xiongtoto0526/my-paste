/**
 * AI 咨询工具（复用 example 工具位）
 */
class ExampleTool extends BaseTool {
	static name = 'AI咨询'

	constructor(id, name, container, options = {}) {
		super(id, name, container, options)
		this.isLoading = false
		this.fetchBtnHandler = null
		this.responseData = null
	}

	async init() {
		await super.init()
		const cached = await this.loadData(`${this.getStorageKeyPrefix()}_CONSULT_RESULT`)
		if (cached && typeof cached === 'object') {
			this.responseData = cached
			return
		}

		if (typeof cached === 'string') {
			try {
				this.responseData = JSON.parse(cached)
			} catch (_error) {
				this.responseData = null
			}
		}
	}

	render() {
		return `
			<div class="tool-ai-consult">
				<div class="tool-description">获取 AI 咨询历史并以列表卡片展示关键信息</div>
				<div class="token-actions">
					<div class="token-group">
						<div class="token-group-title">AI 咨询</div>
						<button type="button" class="token-btn ai-consult-fetch-btn" ${this.isLoading ? 'disabled' : ''}>
							${this.isLoading ? '获取中...' : '获取咨询'}
						</button>
					</div>
				</div>
				<div class="tool-status ai-consult-result-wrap">
					${this.renderListCards()}
				</div>
			</div>
		`
	}

	renderListCards() {
		if (this.isLoading) {
			return `
				<div class="ai-consult-loading-card" role="status" aria-live="polite">
					<span class="ai-consult-spinner" aria-hidden="true"></span>
					<span>查询中，请稍候...</span>
				</div>
			`
		}

		if (this.responseData?.error) {
			return `<div class="ai-consult-empty">${this.escapeHtml(this.responseData.error)}</div>`
		}

		const items = Array.isArray(this.responseData?.items) ? this.responseData.items : []
		if (items.length === 0) {
			return '<div class="ai-consult-empty">点击“获取咨询”后显示最近 10 条记录</div>'
		}

		const sortedItems = [...items].sort((a, b) => this.getTimeValue(b?.publishedAt) - this.getTimeValue(a?.publishedAt))

		const updatedAt = this.responseData?.updatedAt ? this.formatDateTime(this.responseData.updatedAt) : '-'
		const total = Number.isFinite(this.responseData?.total) ? this.responseData.total : items.length
		const cardsHtml = sortedItems
			.map((item) => {
				const name = this.escapeHtml(item?.name || '未知来源')
				const publishedAt = this.escapeHtml(item?.publishedAt || '-')
				const createdAt = this.escapeHtml(this.formatDateTime(item?.createdAt))
				const sourceUrl = typeof item?.sourceUrl === 'string' ? item.sourceUrl : ''
				const sourceUrlEscaped = this.escapeHtml(sourceUrl)

				return `
					<li class="ai-consult-card">
						<div class="ai-consult-card-title">${name}</div>
						<div class="ai-consult-card-meta">发布时间：${publishedAt}</div>
						<div class="ai-consult-card-meta">入库时间：${createdAt}</div>
						<div class="ai-consult-card-link-wrap">
							<a class="ai-consult-card-link" href="${sourceUrlEscaped}" target="_blank" rel="noopener noreferrer">${sourceUrlEscaped}</a>
						</div>
					</li>
				`
			})
			.join('')

		return `
			<div class="ai-consult-head-meta">最近 ${items.length} / 总数 ${total}，更新于 ${this.escapeHtml(updatedAt)}</div>
			<ul class="ai-consult-card-list">${cardsHtml}</ul>
		`
	}

	onMounted() {
		const fetchBtn = this.container.querySelector('.ai-consult-fetch-btn')
		this.fetchBtnHandler = () => this.handleFetchConsult()

		if (fetchBtn && this.fetchBtnHandler) {
			fetchBtn.addEventListener('click', this.fetchBtnHandler)
		}
	}

	onUnmounted() {
		const fetchBtn = this.container.querySelector('.ai-consult-fetch-btn')

		if (fetchBtn && this.fetchBtnHandler) {
			fetchBtn.removeEventListener('click', this.fetchBtnHandler)
		}
	}

	async handleFetchConsult() {
		if (this.isLoading) {
			return
		}

		this.isLoading = true
		this.mount()

		try {
			const response = await fetch('https://my-ai-radar.vercel.app/history?limit=10', {
				method: 'GET',
				headers: {
					'x-api-key': '29d64040c2aa79163b10a91709778baff4ae2e6a75c52609e9d18b124299a62f'
				}
			})

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`)
			}

			const json = await response.json()
			this.responseData = json
			await this.saveData(`${this.getStorageKeyPrefix()}_CONSULT_RESULT`, this.responseData)
			this.showToast('咨询获取成功')
		} catch (error) {
			console.error('[AIConsult] Fetch failed:', error)
			const errorMsg = error instanceof Error ? error.message : 'Unknown error'
			this.responseData = { error: `咨询获取失败: ${errorMsg}`, items: [] }
			this.showToast(`咨询获取失败: ${errorMsg}`, 4500)
		} finally {
			this.isLoading = false
			this.mount()
		}
	}

	formatDateTime(value) {
		if (!value) {
			return '-'
		}

		const time = new Date(value)
		if (Number.isNaN(time.getTime())) {
			return String(value)
		}

		return time.toLocaleString()
	}

	getTimeValue(value) {
		if (!value) {
			return 0
		}

		const time = new Date(value).getTime()
		return Number.isNaN(time) ? 0 : time
	}

	escapeHtml(text) {
		return String(text)
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#039;')
	}

	destroy() {
		this.onUnmounted()
		super.destroy()
	}
}
