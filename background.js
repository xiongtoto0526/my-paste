const STORAGE_KEY = 'records'
const DOMAIN_LIMIT = 100
const MESSAGE_TYPE = 'MY_CLIPBOARD_RECORD'
const LEGACY_MESSAGE_TYPE = 'MY_PASTE_RECORD'

function createId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function getRecordsByDomain() {
	const data = await chrome.storage.local.get(STORAGE_KEY)
	return data[STORAGE_KEY] || {}
}

async function saveRecord(message) {
	const recordsByDomain = await getRecordsByDomain()
	const domain = message.domain || 'unknown'
	const currentList = Array.isArray(recordsByDomain[domain]) ? recordsByDomain[domain] : []

	const nextRecord = {
		id: createId(),
		content: message.content,
		url: message.url,
		domain,
		createdAt: message.createdAt
	}

	const nextList = [...currentList, nextRecord]
		.sort((a, b) => b.createdAt - a.createdAt)
		.slice(0, DOMAIN_LIMIT)

	recordsByDomain[domain] = nextList
	await chrome.storage.local.set({
		[STORAGE_KEY]: recordsByDomain
	})
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (!message || (message.type !== MESSAGE_TYPE && message.type !== LEGACY_MESSAGE_TYPE)) {
		return false
	}

	saveRecord(message)
		.then(() => sendResponse({ ok: true }))
		.catch((error) => {
			console.error('[MyPaste] saveRecord failed', error)
			sendResponse({ ok: false })
		})

	return true
})
