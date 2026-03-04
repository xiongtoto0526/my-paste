const STORAGE_KEY = 'records'
const NOTE_STORAGE_KEY = 'notes'
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
	notes: [],
	query: '',
	activeTab: 'clipboard',
	editingNoteId: '',
	config: DEFAULT_CONFIG
}

const tabClipboard = document.getElementById('tabClipboard')
const tabNotes = document.getElementById('tabNotes')
const panelClipboard = document.getElementById('panelClipboard')
const panelNotes = document.getElementById('panelNotes')
const searchInput = document.getElementById('searchInput')
const listElement = document.getElementById('list')
const noteInput = document.getElementById('noteInput')
const addNoteBtn = document.getElementById('addNoteBtn')
const noteListElement = document.getElementById('noteList')
const toastElement = document.getElementById('toast')
const openStandaloneBtn = document.getElementById('openStandaloneBtn')
const exportDataBtn = document.getElementById('exportDataBtn')
const openProjectBtn = document.getElementById('openProjectBtn')

function getQueryParam(name) {
	const params = new URLSearchParams(window.location.search)
	return params.get(name) || ''
}

function isStandaloneView() {
	return getQueryParam('mode') === 'tab'
}

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

function formatExportTimestamp(date) {
	const year = String(date.getFullYear())
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	const hour = String(date.getHours()).padStart(2, '0')
	const minute = String(date.getMinutes()).padStart(2, '0')
	const second = String(date.getSeconds()).padStart(2, '0')

	return `${year}${month}${day}-${hour}${minute}${second}`
}

function triggerDownload(filename, content) {
	const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
	const objectUrl = URL.createObjectURL(blob)
	const anchor = document.createElement('a')
	anchor.href = objectUrl
	anchor.download = filename
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
	URL.revokeObjectURL(objectUrl)
}

async function exportAllData() {
	const data = await chrome.storage.local.get([STORAGE_KEY, NOTE_STORAGE_KEY])
	const payload = {
		exportedAt: new Date().toISOString(),
		records: normalizeRecordsByDomain(data[STORAGE_KEY] || state.recordsByDomain),
		notes: normalizeNotes(data[NOTE_STORAGE_KEY] || state.notes)
	}
	const json = JSON.stringify(payload, null, 2)
	const filename = `my-paste-export-${formatExportTimestamp(new Date())}.json`

	triggerDownload(filename, json)
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
	if (openStandaloneBtn) {
		if (isStandaloneView()) {
			openStandaloneBtn.style.display = 'none'
		} else {
			openStandaloneBtn.style.display = 'inline-flex'
			openStandaloneBtn.addEventListener('click', () => {
				const baseUrl = chrome.runtime.getURL('popup.html')
				const targetUrl = `${baseUrl}?mode=tab&tab=${encodeURIComponent(state.activeTab)}`

				if (chrome.tabs && typeof chrome.tabs.create === 'function') {
					chrome.tabs.create({ url: targetUrl })
				} else {
					window.open(targetUrl, '_blank')
				}
			})
		}
	}

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

function normalizeNotes(notes) {
	if (!Array.isArray(notes)) {
		return []
	}

	return notes
		.filter((note) => note && typeof note === 'object')
		.map((note) => {
			const content = typeof note.content === 'string' ? note.content.trim() : ''
			const createdAt = Number.isFinite(note.createdAt) ? note.createdAt : Date.now()

			return {
				id: typeof note.id === 'string' && note.id ? note.id : `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
				content,
				createdAt
			}
		})
		.filter((note) => note.content)
		.sort((a, b) => b.createdAt - a.createdAt)
}

async function loadNotes() {
	const data = await chrome.storage.local.get(NOTE_STORAGE_KEY)
	state.notes = normalizeNotes(data[NOTE_STORAGE_KEY])
}

async function persistNotes() {
	await chrome.storage.local.set({ [NOTE_STORAGE_KEY]: state.notes })
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
							<button class="delete-btn" data-action="delete" data-id="${record.id}" data-domain="${group.domain}" aria-label="删除记录" title="删除记录">×</button>
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

function renderNotes() {
	if (!noteListElement) {
		return
	}

	if (state.notes.length === 0) {
		noteListElement.innerHTML = '<li class="empty note-empty">暂无便签</li>'
		return
	}

	noteListElement.innerHTML = state.notes
		.map((note) => {
			const content = escapeHtml(note.content)
			const time = escapeHtml(formatTime(note.createdAt))
			const isEditing = state.editingNoteId === note.id

			return `
				<li class="note-item" data-note-id="${note.id}">
					<div class="note-row">
						${
							isEditing
								? `<input class="note-edit-input" type="text" value="${content}" data-note-action="edit-input" data-note-id="${note.id}" autocomplete="off" />`
								: `<button class="note-content-btn" type="button" data-note-action="edit" data-note-id="${note.id}">${content}</button>`
						}
						<button class="note-delete-btn" type="button" data-note-action="delete" data-note-id="${note.id}" aria-label="删除便签" title="删除便签">×</button>
					</div>
					<span class="note-time">${time}</span>
				</li>
			`
		})
		.join('')

	if (state.editingNoteId) {
		requestAnimationFrame(() => {
			const input = noteListElement.querySelector(`.note-edit-input[data-note-id="${state.editingNoteId}"]`)
			if (!(input instanceof HTMLInputElement)) {
				return
			}

			input.focus()
			input.select()
		})
	}
}

function findNoteIndex(noteId) {
	return state.notes.findIndex((note) => note.id === noteId)
}

function startEditingNote(noteId) {
	if (!noteId) {
		return
	}

	const index = findNoteIndex(noteId)
	if (index < 0) {
		return
	}

	state.editingNoteId = noteId
	renderNotes()
}

async function saveEditingNote(noteId, rawContent) {
	if (!noteId) {
		return
	}

	const index = findNoteIndex(noteId)
	if (index < 0) {
		state.editingNoteId = ''
		renderNotes()
		return
	}

	const nextContent = rawContent.trim()
	if (!nextContent) {
		showToast('便签内容不能为空')
		renderNotes()
		return
	}

	const current = state.notes[index]
	state.editingNoteId = ''

	if (current.content === nextContent) {
		renderNotes()
		return
	}

	state.notes[index] = {
		...current,
		content: nextContent
	}

	await persistNotes()
	renderNotes()
	showToast('便签已更新')
}

function cancelEditingNote() {
	if (!state.editingNoteId) {
		return
	}

	state.editingNoteId = ''
	renderNotes()
}

async function deleteNote(noteId) {
	const nextNotes = state.notes.filter((note) => note.id !== noteId)
	if (nextNotes.length === state.notes.length) {
		return
	}

	state.notes = nextNotes
	if (state.editingNoteId === noteId) {
		state.editingNoteId = ''
	}

	await persistNotes()
	renderNotes()
	showToast('便签已删除')
}

async function onNoteListClick(event) {
	const target = event.target
	if (!(target instanceof HTMLElement)) {
		return
	}

	const actionTarget = target.closest('[data-note-action]')
	if (!(actionTarget instanceof HTMLElement)) {
		return
	}

	const action = actionTarget.dataset.noteAction
	const noteId = actionTarget.dataset.noteId
	if (!noteId) {
		return
	}

	if (action === 'delete') {
		await deleteNote(noteId)
		return
	}

	if (action === 'edit') {
		startEditingNote(noteId)
	}
}

async function onNoteListKeydown(event) {
	const target = event.target
	if (!(target instanceof HTMLInputElement) || !target.classList.contains('note-edit-input')) {
		return
	}

	const noteId = target.dataset.noteId || ''
	if (!noteId) {
		return
	}

	if (event.key === 'Escape') {
		event.preventDefault()
		cancelEditingNote()
		return
	}

	if (event.key === 'Enter') {
		event.preventDefault()
		await saveEditingNote(noteId, target.value)
	}
}

async function onNoteListFocusOut(event) {
	const target = event.target
	if (!(target instanceof HTMLInputElement) || !target.classList.contains('note-edit-input')) {
		return
	}

	const noteId = target.dataset.noteId || ''
	if (!noteId || state.editingNoteId !== noteId) {
		return
	}

	await saveEditingNote(noteId, target.value)
}

function setActiveTab(nextTab) {
	state.activeTab = nextTab === 'notes' ? 'notes' : 'clipboard'

	const isClipboard = state.activeTab === 'clipboard'

	if (tabClipboard) {
		tabClipboard.classList.toggle('active', isClipboard)
		tabClipboard.setAttribute('aria-selected', isClipboard ? 'true' : 'false')
	}

	if (tabNotes) {
		tabNotes.classList.toggle('active', !isClipboard)
		tabNotes.setAttribute('aria-selected', !isClipboard ? 'true' : 'false')
	}

	if (panelClipboard) {
		panelClipboard.classList.toggle('active', isClipboard)
		panelClipboard.hidden = !isClipboard
	}

	if (panelNotes) {
		panelNotes.classList.toggle('active', !isClipboard)
		panelNotes.hidden = isClipboard
	}
}

function setupTabs() {
	const queryTab = getQueryParam('tab')
	const initialTab = queryTab === 'notes' ? 'notes' : 'clipboard'

	if (tabClipboard) {
		tabClipboard.addEventListener('click', () => setActiveTab('clipboard'))
	}

	if (tabNotes) {
		tabNotes.addEventListener('click', () => setActiveTab('notes'))
	}

	setActiveTab(initialTab)
}

async function submitNote() {
	if (!(noteInput instanceof HTMLInputElement)) {
		return
	}

	const content = noteInput.value.trim()
	if (!content) {
		return
	}

	state.notes.unshift({
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		content,
		createdAt: Date.now()
	})

	await persistNotes()
	renderNotes()
	noteInput.value = ''
	showToast('便签已添加')
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
	if (isStandaloneView()) {
		document.body.classList.add('standalone-view')
	}

	state.config = getConfig()
	setupQuickActions()
	setupTabs()
	await loadRecords()
	await loadNotes()
	render()
	renderNotes()

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
	addNoteBtn.addEventListener('click', () => {
		submitNote().catch(() => {
			showToast('保存便签失败，请重试')
		})
	})
	if (exportDataBtn) {
		exportDataBtn.addEventListener('click', () => {
			exportAllData()
				.then(() => {
					showToast('数据已导出')
				})
				.catch(() => {
					showToast('导出失败，请重试')
				})
		})
	}
	noteListElement.addEventListener('click', (event) => {
		onNoteListClick(event).catch(() => {
			showToast('操作失败，请重试')
		})
	})
	noteListElement.addEventListener('keydown', (event) => {
		onNoteListKeydown(event).catch(() => {
			showToast('保存便签失败，请重试')
		})
	})
	noteListElement.addEventListener('focusout', (event) => {
		onNoteListFocusOut(event).catch(() => {
			showToast('保存便签失败，请重试')
		})
	})
	noteInput.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter') {
			return
		}

		event.preventDefault()
		submitNote().catch(() => {
			showToast('保存便签失败，请重试')
		})
	})
}

init().catch((error) => {
	console.error('[MyPaste] popup init failed', error)
	listElement.innerHTML = '<div class="empty">加载失败，请重试</div>'
})
