const STORAGE_KEY = 'records'
const TAG_COLORS = {
	slate: 'tag-slate',
	blue: 'tag-blue',
	green: 'tag-green',
	amber: 'tag-amber',
	red: 'tag-red',
	purple: 'tag-purple'
}

const DEFAULT_CONFIG = {
	quickActions: {
		openProject: {
			enabled: false,
			label: '打开项目',
			path: ''
		}
	},
	sort: {
		pinnedDomains: []
	},
	filter: {
		hiddenDomains: []
	},
	tags: {
		domainTags: {}
	}
}

const state = {
	recordsByDomain: {},
	query: '',
	config: DEFAULT_CONFIG
}

const searchInput = document.getElementById('searchInput')
const listElement = document.getElementById('list')
const toastElement = document.getElementById('toast')
const openProjectBtn = document.getElementById('openProjectBtn')

function escapeHtml(text) {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;')
}

function formatTime(timestamp) {
	return new Date(timestamp).toLocaleString()
}

function debounce(fn, wait) {
	let timer
	return (...args) => {
		clearTimeout(timer)
		timer = setTimeout(() => fn(...args), wait)
	}
}

function showToast(message) {
	toastElement.textContent = message
	setTimeout(() => {
		if (toastElement.textContent === message) {
			toastElement.textContent = ''
		}
	}, 1400)
}

function normalizeTagColor(color) {
	return TAG_COLORS[color] ? color : 'blue'
}

function normalizeDomainTags(rawDomainTags) {
	if (!rawDomainTags || typeof rawDomainTags !== 'object') {
		return {}
	}

	const normalized = {}

	Object.entries(rawDomainTags).forEach(([domain, tagConfig]) => {
		if (typeof domain !== 'string' || !domain.trim()) {
			return
		}

		if (typeof tagConfig === 'string') {
			const text = tagConfig.trim()
			if (!text) {
				return
			}

			normalized[domain] = { text, color: 'blue' }
			return
		}

		if (!tagConfig || typeof tagConfig !== 'object') {
			return
		}

		const text = typeof tagConfig.text === 'string' ? tagConfig.text.trim() : ''
		if (!text) {
			return
		}

		const color = normalizeTagColor(typeof tagConfig.color === 'string' ? tagConfig.color.trim() : '')
		normalized[domain] = { text, color }
	})

	return normalized
}

function getConfig() {
	const globalConfig = window.APP_CONFIG || {}
	const openProjectEnabled = Boolean(globalConfig?.quickActions?.openProject?.enabled)
	const openProjectLabel =
		typeof globalConfig?.quickActions?.openProject?.label === 'string' &&
		globalConfig.quickActions.openProject.label.trim()
			? globalConfig.quickActions.openProject.label.trim()
			: DEFAULT_CONFIG.quickActions.openProject.label
	const openProjectPath =
		typeof globalConfig?.quickActions?.openProject?.path === 'string'
			? globalConfig.quickActions.openProject.path.trim()
			: ''
	const pinnedDomains = Array.isArray(globalConfig?.sort?.pinnedDomains)
		? globalConfig.sort.pinnedDomains.filter((item) => typeof item === 'string' && item.trim())
		: []
	const hiddenDomains = Array.isArray(globalConfig?.filter?.hiddenDomains)
		? globalConfig.filter.hiddenDomains.filter((item) => typeof item === 'string' && item.trim())
		: []
	const domainTags = normalizeDomainTags(globalConfig?.tags?.domainTags)

	return {
		quickActions: {
			openProject: {
				enabled: openProjectEnabled,
				label: openProjectLabel,
				path: openProjectPath
			}
		},
		sort: {
			pinnedDomains
		},
		filter: {
			hiddenDomains
		},
		tags: {
			domainTags
		}
	}
}

function toVscodeFileUrl(path) {
	if (!path) {
		return ''
	}

	const normalizedPath = path.startsWith('/') ? path : `/${path}`
	return `vscode://file${encodeURI(normalizedPath)}`
}

function setupQuickActions() {
	if (!openProjectBtn) {
		return
	}

	const openProjectConfig = state.config.quickActions.openProject
	openProjectBtn.textContent = openProjectConfig.label

	if (!openProjectConfig.enabled || !openProjectConfig.path) {
		openProjectBtn.style.display = 'none'
		return
	}

	openProjectBtn.style.display = 'inline-flex'
	openProjectBtn.addEventListener('click', () => {
		const deepLink = toVscodeFileUrl(openProjectConfig.path)
		if (!deepLink) {
			showToast('项目路径未配置')
			return
		}

		try {
			window.open(deepLink, '_blank')
			showToast('已尝试打开 VS Code 项目')
		} catch (_error) {
			showToast('打开失败，请检查 VS Code 协议')
		}
	})
}

function extractHost(url) {
	try {
		return new URL(url).host
	} catch (_error) {
		return ''
	}
}

function normalizeDomain(record) {
	const hostFromUrl = extractHost(record.url)
	if (hostFromUrl) {
		return hostFromUrl
	}

	return record.domain || 'unknown'
}

function normalizeRecordsByDomain(recordsByDomain) {
	const normalized = {}

	Object.values(recordsByDomain).forEach((records) => {
		if (!Array.isArray(records)) {
			return
		}

		records.forEach((record) => {
			const domain = normalizeDomain(record)
			const nextRecord = {
				...record,
				domain
			}

			if (!Array.isArray(normalized[domain])) {
				normalized[domain] = []
			}

			normalized[domain].push(nextRecord)
		})
	})

	Object.keys(normalized).forEach((domain) => {
		normalized[domain] = normalized[domain].sort((a, b) => b.createdAt - a.createdAt)
	})

	return normalized
}

async function loadRecords() {
	const data = await chrome.storage.local.get(STORAGE_KEY)
	state.recordsByDomain = normalizeRecordsByDomain(data[STORAGE_KEY] || {})
}

async function persistRecords() {
	await chrome.storage.local.set({ [STORAGE_KEY]: state.recordsByDomain })
}

function getFilteredGroups() {
	const pinnedDomains = state.config.sort.pinnedDomains
	const hiddenDomains = state.config.filter.hiddenDomains
	const hiddenSet = new Set(hiddenDomains)
	const pinnedOrder = new Map(pinnedDomains.map((domain, index) => [domain, index]))

	const groups = Object.entries(state.recordsByDomain)
		.filter(([domain]) => !hiddenSet.has(domain))
		.map(([domain, records]) => {
			const normalized = Array.isArray(records) ? records : []
			const sorted = [...normalized].sort((a, b) => b.createdAt - a.createdAt)

			if (!state.query) {
				return { domain, records: sorted }
			}

			const query = state.query.toLowerCase()
			const filtered = sorted.filter((item) => item.content.toLowerCase().includes(query))
			return { domain, records: filtered }
		})
		.filter((group) => group.records.length > 0)

	groups.sort((a, b) => {
		const rankA = pinnedOrder.has(a.domain) ? pinnedOrder.get(a.domain) : Number.POSITIVE_INFINITY
		const rankB = pinnedOrder.has(b.domain) ? pinnedOrder.get(b.domain) : Number.POSITIVE_INFINITY

		if (rankA !== rankB) {
			return rankA - rankB
		}

		return b.records[0].createdAt - a.records[0].createdAt
	})

	return groups
}

function render() {
	const groups = getFilteredGroups()

	if (groups.length === 0) {
		listElement.innerHTML = '<div class="empty">暂无记录</div>'
		return
	}

	const html = groups
		.map((group) => {
			const tagConfig = state.config.tags.domainTags[group.domain]
			const tagHtml = tagConfig
				? `<span class="domain-tag ${TAG_COLORS[tagConfig.color]}">${escapeHtml(tagConfig.text)}</span>`
				: ''
			const recordsHtml = group.records
				.map((record) => {
					const preview = escapeHtml(record.content)
					const meta = `${escapeHtml(formatTime(record.createdAt))} · ${escapeHtml(record.url)}`

					return `
						<li class="record">
							<button class="copy-btn" data-action="copy" data-id="${record.id}" data-domain="${group.domain}">
								<span class="content">${preview}</span>
								<span class="meta">${meta}</span>
							</button>
							<button class="delete-btn" data-action="delete" data-id="${record.id}" data-domain="${group.domain}">删除</button>
						</li>
					`
				})
				.join('')

			return `
				<section class="group">
					<div class="group-header">
						<div class="domain-row">${tagHtml}<div class="domain">${escapeHtml(group.domain)}</div></div>
						<button class="clear-btn" data-action="clear-domain" data-domain="${group.domain}">清空</button>
					</div>
					<ul class="records">${recordsHtml}</ul>
				</section>
			`
		})
		.join('')

	listElement.innerHTML = html
}

async function copyText(content) {
	await navigator.clipboard.writeText(content)
}

async function onListClick(event) {
	const target = event.target
	if (!(target instanceof HTMLElement)) {
		return
	}

	const actionTarget = target.closest('[data-action]')
	if (!(actionTarget instanceof HTMLElement)) {
		return
	}

	const action = actionTarget.dataset.action
	const domain = actionTarget.dataset.domain
	const id = actionTarget.dataset.id

	if (!domain) {
		return
	}

	if (action === 'clear-domain') {
		delete state.recordsByDomain[domain]
		await persistRecords()
		render()
		showToast('已清空该网站记录')
		return
	}

	if (!id) {
		return
	}

	const list = Array.isArray(state.recordsByDomain[domain]) ? state.recordsByDomain[domain] : []
	const record = list.find((item) => item.id === id)

	if (!record) {
		return
	}

	if (action === 'copy') {
		try {
			await copyText(record.content)
			showToast('已复制到剪贴板')
		} catch (_error) {
			showToast('复制失败，请重试')
		}
		return
	}

	if (action === 'delete') {
		const nextList = list.filter((item) => item.id !== id)

		if (nextList.length === 0) {
			delete state.recordsByDomain[domain]
		} else {
			state.recordsByDomain[domain] = nextList
		}

		await persistRecords()
		render()
		showToast('记录已删除')
	}
}

async function init() {
	state.config = getConfig()
	setupQuickActions()
	await loadRecords()
	render()

	const onSearchInput = debounce((event) => {
		const target = event.target
		if (!(target instanceof HTMLInputElement)) {
			return
		}

		state.query = target.value.trim()
		render()
	}, 200)

	searchInput.addEventListener('input', onSearchInput)
	listElement.addEventListener('click', onListClick)
}

init().catch((error) => {
	console.error('[MyPaste] popup init failed', error)
	listElement.innerHTML = '<div class="empty">加载失败，请重试</div>'
})
