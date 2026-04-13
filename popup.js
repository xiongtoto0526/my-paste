const NOTE_STORAGE_KEY = 'notes'
const REMINDER_STORAGE_KEY = 'noteReminders'
const REMINDER_ALARM_PREFIX = 'note-reminder-'
const CREATE_REMINDER_MESSAGE_TYPE = 'MY_PASTE_CREATE_REMINDER'

const state = {
	notes: [],
	activeTab: 'notes',
	editingNoteId: '',
	remindingNoteId: '',
	reminderUnitByNote: {},
	reminderMetaByNote: {},
	reminderAtByNote: {}
}

let reminderTicker = null

const tabTools = document.getElementById('tabTools')
const tabNotes = document.getElementById('tabNotes')
const openStandaloneBtn = document.getElementById('openStandaloneBtn')
const panelTools = document.getElementById('panelTools')
const panelNotes = document.getElementById('panelNotes')
const noteInput = document.getElementById('noteInput')
const addNoteBtn = document.getElementById('addNoteBtn')
const noteListElement = document.getElementById('noteList')
const toastElement = document.getElementById('toast')

function getQueryParam(name) {
	const params = new URLSearchParams(window.location.search)
	return params.get(name) || ''
}

function isStandaloneView() {
	return getQueryParam('mode') === 'tab'
}

function buildStandaloneUrl() {
	const nextTab = state.activeTab === 'notes' ? 'notes' : 'tools'
	const search = new URLSearchParams({ mode: 'tab', tab: nextTab })
	return `${chrome.runtime.getURL('popup.html')}?${search.toString()}`
}

function openStandaloneTab() {
	const url = buildStandaloneUrl()

	if (chrome.tabs && typeof chrome.tabs.create === 'function') {
		chrome.tabs.create({ url })
		return
	}

	window.open(url, '_blank', 'noopener,noreferrer')
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

function showToast(message, duration = 1400) {
	toastElement.textContent = message
	setTimeout(() => {
		if (toastElement.textContent === message) {
			toastElement.textContent = ''
		}
	}, duration)
}

function showErrorToast(message) {
	showToast(message, 4500)
}

function formatReminderError(error) {
	const message = typeof error?.message === 'string' ? error.message : ''
	if (!message) {
		return '设置提醒失败，请重试'
	}

	if (message.includes('message port closed before a response was received')) {
		return '后台正在重启，已自动重试；若仍失败请重载扩展'
	}

	if (message.includes('Receiving end does not exist')) {
		return '扩展已更新，请重载扩展后重试'
	}

	if (message.includes('invalid reminder payload')) {
		return '提醒参数无效，请检查小时数'
	}

	if (message.includes('create reminder failed')) {
		return '设置提醒失败，请重试'
	}

	return `设置提醒失败：${message}`
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

function buildReminderStatus(reminderMap) {
	const status = {}
	const now = Date.now()

	Object.values(reminderMap || {}).forEach((reminder) => {
		if (!reminder || typeof reminder !== 'object') {
			return
		}

		const noteId = typeof reminder.noteId === 'string' ? reminder.noteId : ''
		const triggerAt = Number.isFinite(reminder.triggerAt) ? reminder.triggerAt : 0
		if (!noteId || !triggerAt) {
			return
		}

		const reminderStatus = reminder.status === 'fired' || reminder.firedAt ? 'fired' : triggerAt > now ? 'pending' : 'expired'
		const firedAt = Number.isFinite(reminder.firedAt) ? reminder.firedAt : 0

		if (!status[noteId] || triggerAt > status[noteId].triggerAt) {
			status[noteId] = {
				triggerAt,
				status: reminderStatus,
				firedAt
			}
		}
	})

	return status
}

async function loadReminderStatus() {
	const data = await chrome.storage.local.get(REMINDER_STORAGE_KEY)
	state.reminderMetaByNote = buildReminderStatus(data[REMINDER_STORAGE_KEY])
	state.reminderAtByNote = Object.fromEntries(
		Object.entries(state.reminderMetaByNote).map(([noteId, meta]) => [noteId, meta.triggerAt])
	)
}

function formatRemainingTime(milliseconds) {
	const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	if (hours > 0) {
		return `${hours}小时${String(minutes).padStart(2, '0')}分${String(seconds).padStart(2, '0')}秒`
	}

	if (minutes > 0) {
		return `${minutes}分${String(seconds).padStart(2, '0')}秒`
	}

	return `${seconds}秒`
}

function getReminderBadgeView(noteId) {
	const meta = state.reminderMetaByNote[noteId]
	if (!meta) {
		return null
	}

	if (meta.status === 'fired') {
		return {
			status: 'fired',
			label: '已提醒',
			title: '提醒已触发'
		}
	}

	const remaining = meta.triggerAt - Date.now()
	if (remaining > 0) {
		const label = formatRemainingTime(remaining)
		return {
			status: 'pending',
			label: `剩余 ${label}`,
			title: `剩余 ${label}`
		}
	}

	return {
		status: 'expired',
		label: '已过期',
		title: '提醒已过期'
	}
}

function getReminderBadge(noteId) {
	const view = getReminderBadgeView(noteId)
	if (!view) {
		return ''
	}

	const className =
		view.status === 'fired'
			? 'note-reminder-badge note-reminder-badge-fired'
			: view.status === 'expired'
				? 'note-reminder-badge note-reminder-badge-expired'
				: 'note-reminder-badge'

	return `<span class="${className}" data-note-id="${noteId}" title="${escapeHtml(view.title)}">${escapeHtml(view.label)}</span>`
}

function refreshReminderBadgesInPlace() {
	if (!noteListElement || state.activeTab !== 'notes') {
		return
	}

	const badgeElements = noteListElement.querySelectorAll('.note-reminder-badge[data-note-id]')
	badgeElements.forEach((badgeElement) => {
		if (!(badgeElement instanceof HTMLElement)) {
			return
		}

		const noteId = badgeElement.dataset.noteId || ''
		if (!noteId) {
			return
		}

		const view = getReminderBadgeView(noteId)
		if (!view) {
			badgeElement.remove()
			return
		}

		badgeElement.textContent = view.label
		badgeElement.title = view.title
		badgeElement.classList.toggle('note-reminder-badge-fired', view.status === 'fired')
		badgeElement.classList.toggle('note-reminder-badge-expired', view.status === 'expired')
	})
}

function setupReminderRefresh() {
	if (!reminderTicker) {
		reminderTicker = setInterval(() => {
			refreshReminderBadgesInPlace()
		}, 1000)
	}

	if (chrome.storage?.onChanged && typeof chrome.storage.onChanged.addListener === 'function') {
		chrome.storage.onChanged.addListener((changes, areaName) => {
			if (areaName !== 'local') {
				return
			}

			if (changes[REMINDER_STORAGE_KEY]) {
				state.reminderMetaByNote = buildReminderStatus(changes[REMINDER_STORAGE_KEY].newValue)
				state.reminderAtByNote = Object.fromEntries(
					Object.entries(state.reminderMetaByNote).map(([noteId, meta]) => [noteId, meta.triggerAt])
				)
				renderNotes()
			}
		})
	}
}

function getReminderDraftFromInput(noteId) {
	const input = noteListElement.querySelector(`.note-reminder-input[data-note-id="${noteId}"]`)
	if (!(input instanceof HTMLInputElement)) {
		return null
	}

	const rawValue = Number.parseFloat(input.value)
	if (!Number.isFinite(rawValue) || rawValue <= 0) {
		return null
	}

	const unitSelect = noteListElement.querySelector(`.note-reminder-unit[data-note-id="${noteId}"]`)
	const unit = unitSelect instanceof HTMLSelectElement ? unitSelect.value : 'hour'
	const unitMap = {
		hour: { toHours: 1, label: '小时' },
		minute: { toHours: 1 / 60, label: '分钟' },
		second: { toHours: 1 / 3600, label: '秒' }
	}
	const unitConfig = unitMap[unit] || unitMap.hour

	return {
		hours: rawValue * unitConfig.toHours,
		displayValue: rawValue,
		unit,
		unitLabel: unitConfig.label
	}
}

async function createReminderInPopup(note, hours) {
	if (typeof chrome.alarms?.create !== 'function') {
		throw new Error('popup alarms api unavailable')
	}

	const when = Date.now() + hours * 60 * 60 * 1000
	const alarmName = `${REMINDER_ALARM_PREFIX}${note.id}-${Date.now()}`

	await chrome.alarms.create(alarmName, { when })

	const data = await chrome.storage.local.get(REMINDER_STORAGE_KEY)
	const reminderMap = data[REMINDER_STORAGE_KEY] || {}
	reminderMap[alarmName] = {
		noteId: note.id,
		content: note.content,
		createdAt: Date.now(),
		triggerAt: when
	}
	await chrome.storage.local.set({ [REMINDER_STORAGE_KEY]: reminderMap })

	return { triggerAt: when }
}

function isMessagePortClosedError(error) {
	const message = typeof error?.message === 'string' ? error.message : ''
	return (
		message.includes('message port closed before a response was received') ||
		message.includes('Receiving end does not exist')
	)
}

async function createNoteReminder(noteId, reminderDraft) {
	if (typeof chrome.runtime?.sendMessage !== 'function') {
		showToast('当前环境不支持提醒功能')
		return
	}

	const index = findNoteIndex(noteId)
	if (index < 0) {
		showToast('便签不存在')
		return
	}

	if (!reminderDraft || !Number.isFinite(reminderDraft.hours) || reminderDraft.hours <= 0) {
		showToast('请输入有效提醒时长')
		return
	}

	if (reminderDraft.hours > 24 * 365) {
		showToast('提醒时长过长，请缩短')
		return
	}

	const note = state.notes[index]
	const hours = reminderDraft.hours
	let result

	try {
		result = await new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(
			{
				type: CREATE_REMINDER_MESSAGE_TYPE,
				noteId: note.id,
				content: note.content,
				hours
			},
			(response) => {
				const runtimeError = chrome.runtime.lastError
				if (runtimeError) {
					reject(new Error(runtimeError.message || 'runtime sendMessage failed'))
					return
				}

				if (!response || !response.ok || !Number.isFinite(response.triggerAt)) {
					reject(new Error(response?.error || 'create reminder failed'))
					return
				}

				resolve(response)
			}
		)
		})
	} catch (error) {
		if (!isMessagePortClosedError(error)) {
			throw error
		}

		result = await createReminderInPopup(note, hours)
	}

	state.reminderAtByNote[note.id] = result.triggerAt
	state.reminderUnitByNote[note.id] = reminderDraft.unit
	state.reminderMetaByNote[note.id] = {
		triggerAt: result.triggerAt,
		status: 'pending',
		firedAt: 0
	}

	state.remindingNoteId = ''
	renderNotes()
	showToast(`已设置 ${reminderDraft.displayValue} ${reminderDraft.unitLabel} 后提醒`)
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
			const isReminding = state.remindingNoteId === note.id
			const reminderUnit = state.reminderUnitByNote[note.id] || 'hour'
			const reminderBadgeHtml = getReminderBadge(note.id)

			return `
				<li class="note-item" data-note-id="${note.id}">
					<div class="note-row">
						${
							isEditing
								? `<input class="note-edit-input" type="text" value="${content}" data-note-action="edit-input" data-note-id="${note.id}" autocomplete="off" />`
								: `<button class="note-content-btn" type="button" data-note-action="edit" data-note-id="${note.id}">${content}</button>`
						}
						<div class="note-actions">
							<button class="note-reminder-btn note-action-btn" type="button" data-note-action="remind-open" data-note-id="${note.id}" aria-label="设置提醒" title="设置提醒">⏰</button>
							<button class="note-delete-btn note-action-btn" type="button" data-note-action="delete" data-note-id="${note.id}" aria-label="删除便签" title="删除便签">×</button>
						</div>
					</div>
					${
						isReminding
							? `<div class="note-reminder-panel">
								<input class="note-reminder-input" type="number" min="1" step="1" placeholder="输入数字" data-note-id="${note.id}" autocomplete="off" />
								<select class="note-reminder-unit" data-note-id="${note.id}">
									<option value="hour" ${reminderUnit === 'hour' ? 'selected' : ''}>小时</option>
									<option value="minute" ${reminderUnit === 'minute' ? 'selected' : ''}>分钟</option>
									<option value="second" ${reminderUnit === 'second' ? 'selected' : ''}>秒</option>
								</select>
								<button class="note-reminder-save-btn" type="button" data-note-action="remind-save" data-note-id="${note.id}">设置</button>
							</div>`
							: ''
					}
					<div class="note-meta-row">
						${reminderBadgeHtml}
						<span class="note-time">${time}</span>
					</div>
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

	if (state.remindingNoteId) {
		requestAnimationFrame(() => {
			const input = noteListElement.querySelector(`.note-reminder-input[data-note-id="${state.remindingNoteId}"]`)
			if (!(input instanceof HTMLInputElement)) {
				return
			}

			input.focus()
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
	state.remindingNoteId = ''
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

function toggleNoteReminderPanel(noteId) {
	if (!noteId) {
		return
	}

	if (state.remindingNoteId === noteId) {
		state.remindingNoteId = ''
		renderNotes()
		return
	}

	const index = findNoteIndex(noteId)
	if (index < 0) {
		return
	}

	state.editingNoteId = ''
	state.remindingNoteId = noteId
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
	if (state.remindingNoteId === noteId) {
		state.remindingNoteId = ''
	}
	delete state.reminderMetaByNote[noteId]
	delete state.reminderAtByNote[noteId]

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

	if (action === 'remind-open') {
		toggleNoteReminderPanel(noteId)
		return
	}

	if (action === 'remind-save') {
		const reminderDraft = getReminderDraftFromInput(noteId)
		if (!reminderDraft) {
			showToast('请输入大于 0 的时长')
			return
		}

		await createNoteReminder(noteId, reminderDraft)
		return
	}

	if (action === 'edit') {
		startEditingNote(noteId)
	}
}

async function onNoteListKeydown(event) {
	const target = event.target
	if (!(target instanceof HTMLInputElement)) {
		return
	}

	const noteId = target.dataset.noteId || ''
	if (!noteId) {
		return
	}

	if (target.classList.contains('note-reminder-input')) {
		if (event.key === 'Escape') {
			event.preventDefault()
			state.remindingNoteId = ''
			renderNotes()
			return
		}

		if (event.key === 'Enter') {
			event.preventDefault()
			const reminderDraft = getReminderDraftFromInput(noteId)
			if (!reminderDraft) {
				showToast('请输入大于 0 的时长')
				return
			}

			await createNoteReminder(noteId, reminderDraft)
		}

		return
	}

	if (!target.classList.contains('note-edit-input')) {
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
	state.activeTab = nextTab === 'notes' ? 'notes' : 'tools'

	const isTools = state.activeTab === 'tools'

	if (tabTools) {
		tabTools.classList.toggle('active', isTools)
		tabTools.setAttribute('aria-selected', isTools ? 'true' : 'false')
	}

	if (tabNotes) {
		tabNotes.classList.toggle('active', !isTools)
		tabNotes.setAttribute('aria-selected', !isTools ? 'true' : 'false')
	}

	if (panelTools) {
		panelTools.classList.toggle('active', isTools)
		panelTools.hidden = !isTools
	}

	if (panelNotes) {
		panelNotes.classList.toggle('active', !isTools)
		panelNotes.hidden = isTools
	}
}

let toolsManager = null

/**
 * 初始化工具系统
 */
function setupToolsSystem() {
	const toolsContainer = document.querySelector('.tools-container')
	if (!toolsContainer) {
		console.error('[MyPaste] Tools container not found')
		return
	}

	// 创建工具管理器
	toolsManager = new ToolsManager(toolsContainer, window.APP_CONFIG?.tools || {})

	// 从配置中获取启用的工具列表
	const enabledTools = window.APP_CONFIG?.tools?.enabled || []
	const toolDefinitions = {
		example: {
			toolClass: ExampleTool,
			options: {
				title: 'AI咨询'
			}
		},
		'token-assistor': {
			toolClass: typeof TokenAssistorTool === 'undefined' ? null : TokenAssistorTool,
			options: {
				title: 'Token Assistor'
			}
		}
	}

	// 按配置顺序注册工具，确保第一个启用工具会优先显示
	enabledTools.forEach((toolId) => {
		const def = toolDefinitions[toolId]
		if (!def) {
			console.warn(`[MyPaste] Unknown tool id: ${toolId}`)
			return
		}

		if (!def.toolClass) {
			console.error(`[MyPaste] Tool class not available: ${toolId}`)
			return
		}

		toolsManager.registerTool(toolId, def.toolClass, def.options)
	})

	// 如果没有启用的工具，显示占位符
	if (toolsManager.getRegisteredToolIds().length === 0) {
		// 如果没有启用的工具，显示占位符
		toolsContainer.innerHTML = '<div class="tool-placeholder">暂无启用的工具</div>'
	} else {
		const registeredToolIds = toolsManager.getRegisteredToolIds()
		const defaultToolId = registeredToolIds.includes('example')
			? 'example'
			: registeredToolIds[0]

		toolsManager.showTool(defaultToolId).catch((error) => {
			console.error(`[MyPaste] Failed to show default tool ${defaultToolId}`, error)
		})
	}

	console.log('[MyPaste] Tools system initialized', toolsManager.getStatus())
}

function setupTabs() {
	const queryTab = getQueryParam('tab')
	const initialTab = queryTab === 'notes' ? 'notes' : 'tools'

	if (tabTools) {
		tabTools.addEventListener('click', () => setActiveTab('tools'))
	}

	if (tabNotes) {
		tabNotes.addEventListener('click', () => setActiveTab('notes'))
	}

	if (openStandaloneBtn) {
		openStandaloneBtn.addEventListener('click', openStandaloneTab)
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

async function init() {
	if (isStandaloneView()) {
		document.body.classList.add('standalone-view')
	}

	setupTabs()
	setupToolsSystem()
	await loadNotes()
	await loadReminderStatus()
	setupReminderRefresh()
	renderNotes()

	addNoteBtn.addEventListener('click', () => {
		submitNote().catch(() => {
			showErrorToast('保存便签失败，请重试')
		})
	})
	noteListElement.addEventListener('click', (event) => {
		onNoteListClick(event).catch((error) => {
			showErrorToast(formatReminderError(error))
		})
	})
	noteListElement.addEventListener('keydown', (event) => {
		onNoteListKeydown(event).catch(() => {
			showErrorToast('保存便签失败，请重试')
		})
	})
	noteListElement.addEventListener('focusout', (event) => {
		onNoteListFocusOut(event).catch(() => {
			showErrorToast('保存便签失败，请重试')
		})
	})
	noteInput.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter') {
			return
		}

		event.preventDefault()
		submitNote().catch(() => {
			showErrorToast('保存便签失败，请重试')
		})
	})
}

init().catch((error) => {
	console.error('[MyPaste] popup init failed', error)
	toastElement.innerHTML = '<div class="error">加载失败，请重试</div>'
})
