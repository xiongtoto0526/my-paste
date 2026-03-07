const MAX_CONTENT_LENGTH = 5000
const MESSAGE_TYPE = 'MY_CLIPBOARD_RECORD'
const STORAGE_KEY = 'records'
const DOMAIN_LIMIT = 100
const DEDUP_WINDOW_MS = 300
const KEYBOARD_COPY_DELAY_MS = 80

let lastRecordSignature = ''
let lastRecordTime = 0
let keyboardCopyTimer = null

function isPasswordTarget(target) {
	if (!(target instanceof Element)) {
		return false
	}

	const input = target.closest('input, textarea')
	return input instanceof HTMLInputElement && input.type === 'password'
}

function getPlainTextFromClipboard(event) {
	if (!event.clipboardData) {
		return ''
	}

	const content = event.clipboardData.getData('text/plain')
	return typeof content === 'string' ? content : ''
}

function getSelectedTextFromEditable(target) {
	const editable = target instanceof Element ? target.closest('input, textarea') : null

	if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
		const start = editable.selectionStart ?? 0
		const end = editable.selectionEnd ?? 0
		return editable.value.slice(start, end)
	}

	return ''
}

function getCopiedText(event) {
	const fromClipboardData = getPlainTextFromClipboard(event)
	if (fromClipboardData.trim()) {
		return fromClipboardData
	}

	const selectedText = window.getSelection ? window.getSelection().toString() : ''
	if (selectedText.trim()) {
		return selectedText
	}

	return getSelectedTextFromEditable(event.target)
}

function getCopiedTextFallback() {
	const selectedText = window.getSelection ? window.getSelection().toString() : ''
	if (selectedText.trim()) {
		return selectedText
	}

	const activeElement = document.activeElement
	return getSelectedTextFromEditable(activeElement)
}

function createId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function saveRecordDirectly(payload) {
	const data = await chrome.storage.local.get(STORAGE_KEY)
	const recordsByDomain = data[STORAGE_KEY] || {}
	const domain = payload.domain || 'unknown'
	const currentList = Array.isArray(recordsByDomain[domain]) ? recordsByDomain[domain] : []

	const nextRecord = {
		id: createId(),
		content: payload.content,
		url: payload.url,
		domain,
		createdAt: payload.createdAt
	}

	recordsByDomain[domain] = [...currentList, nextRecord]
		.sort((a, b) => b.createdAt - a.createdAt)
		.slice(0, DOMAIN_LIMIT)

	await chrome.storage.local.set({ [STORAGE_KEY]: recordsByDomain })
}

function shouldSkipDuplicate(content) {
	const now = Date.now()
	const signature = `${window.location.href}::${content}`

	if (signature === lastRecordSignature && now - lastRecordTime < DEDUP_WINDOW_MS) {
		return true
	}

	lastRecordSignature = signature
	lastRecordTime = now
	return false
}

function dispatchPayload(payload) {
	try {
		if (!chrome?.runtime?.id || typeof chrome.runtime.sendMessage !== 'function') {
			return
		}

		chrome.runtime.sendMessage(payload, async () => {
			try {
				if (!chrome.runtime.lastError) {
					return
				}

				try {
					await saveRecordDirectly(payload)
				} catch (_error) {
				}
			} catch (_error) {
			}
		})
	} catch (_error) {
	}
}

function onCopy(event) {
	if (isPasswordTarget(event.target)) {
		return
	}

	const rawContent = getCopiedText(event)
	const content = rawContent.trim()

	if (!content) {
		return
	}

	if (shouldSkipDuplicate(content)) {
		return
	}

	const payload = {
		type: MESSAGE_TYPE,
		content: content.slice(0, MAX_CONTENT_LENGTH),
		url: window.location.href,
		domain: window.location.host || window.location.hostname,
		createdAt: Date.now()
	}

	dispatchPayload(payload)
}

window.addEventListener('copy', onCopy, true)

function onKeyboardCopy(event) {
	if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'c') {
		return
	}

	if (keyboardCopyTimer) {
		clearTimeout(keyboardCopyTimer)
	}

	keyboardCopyTimer = setTimeout(() => {
		const content = getCopiedTextFallback().trim()
		if (!content || shouldSkipDuplicate(content)) {
			return
		}

		const payload = {
			type: MESSAGE_TYPE,
			content: content.slice(0, MAX_CONTENT_LENGTH),
			url: window.location.href,
			domain: window.location.host || window.location.hostname,
			createdAt: Date.now()
		}

		dispatchPayload(payload)
	}, KEYBOARD_COPY_DELAY_MS)
}

window.addEventListener('keydown', onKeyboardCopy, true)
