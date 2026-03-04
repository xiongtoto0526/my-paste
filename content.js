const MAX_CONTENT_LENGTH = 5000
const MESSAGE_TYPE = 'MY_CLIPBOARD_RECORD'
const STORAGE_KEY = 'records'
const DOMAIN_LIMIT = 100

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

document.addEventListener('copy', (event) => {
	if (isPasswordTarget(event.target)) {
		return
	}

	const rawContent = getCopiedText(event)
	const content = rawContent.trim()

	if (!content) {
		return
	}

	const payload = {
		type: MESSAGE_TYPE,
		content: content.slice(0, MAX_CONTENT_LENGTH),
		url: window.location.href,
		domain: window.location.host || window.location.hostname,
		createdAt: Date.now()
	}

	chrome.runtime.sendMessage(payload, async () => {
		if (chrome.runtime.lastError) {
			try {
				await saveRecordDirectly(payload)
			} catch (_error) {
			}
		}
	})
})
