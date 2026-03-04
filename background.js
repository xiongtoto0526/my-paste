const STORAGE_KEY = 'records'
const REMINDER_STORAGE_KEY = 'noteReminders'
const DOMAIN_LIMIT = 100
const MESSAGE_TYPE = 'MY_CLIPBOARD_RECORD'
const LEGACY_MESSAGE_TYPE = 'MY_PASTE_RECORD'
const CREATE_REMINDER_MESSAGE_TYPE = 'MY_PASTE_CREATE_REMINDER'
const REMINDER_ALARM_PREFIX = 'note-reminder-'
const NOTIFICATION_ICON_PATH = 'assets/notification-icon.png'

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

async function createReminder(message) {
	const noteId = typeof message.noteId === 'string' ? message.noteId.trim() : ''
	const content = typeof message.content === 'string' ? message.content : ''
	const hours = Number.parseFloat(message.hours)

	if (!noteId || !Number.isFinite(hours) || hours <= 0 || hours > 24 * 365) {
		throw new Error('invalid reminder payload')
	}

	const when = Date.now() + hours * 60 * 60 * 1000
	const alarmName = `${REMINDER_ALARM_PREFIX}${noteId}-${Date.now()}`

	await chrome.alarms.create(alarmName, { when })

	const data = await chrome.storage.local.get(REMINDER_STORAGE_KEY)
	const reminderMap = data[REMINDER_STORAGE_KEY] || {}
	reminderMap[alarmName] = {
		noteId,
		content,
		createdAt: Date.now(),
		triggerAt: when,
		status: 'pending'
	}
	await chrome.storage.local.set({ [REMINDER_STORAGE_KEY]: reminderMap })

	return {
		alarmName,
		triggerAt: when
	}
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (!message) {
		return false
	}

	if (message.type === CREATE_REMINDER_MESSAGE_TYPE) {
		createReminder(message)
			.then((result) => sendResponse({ ok: true, ...result }))
			.catch((error) => {
				console.error('[MyPaste] createReminder failed', error)
				sendResponse({ ok: false, error: error instanceof Error ? error.message : 'create reminder failed' })
			})

		return true
	}

	if (message.type !== MESSAGE_TYPE && message.type !== LEGACY_MESSAGE_TYPE) {
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

function trimReminderContent(content) {
	if (typeof content !== 'string') {
		return ''
	}

	const normalized = content.trim()
	if (!normalized) {
		return ''
	}

	if (normalized.length <= 70) {
		return normalized
	}

	return `${normalized.slice(0, 70)}...`
}

async function markReminderFired(alarmName) {
	const data = await chrome.storage.local.get(REMINDER_STORAGE_KEY)
	const reminderMap = data[REMINDER_STORAGE_KEY] || {}
	const reminder = reminderMap[alarmName]

	if (reminder && typeof reminder === 'object') {
		reminderMap[alarmName] = {
			...reminder,
			status: 'fired',
			firedAt: Date.now()
		}
		await chrome.storage.local.set({ [REMINDER_STORAGE_KEY]: reminderMap })
	}

	return reminder
}

async function onReminderAlarm(alarm) {
	if (!alarm?.name || !alarm.name.startsWith(REMINDER_ALARM_PREFIX)) {
		return
	}

	const reminder = await markReminderFired(alarm.name)
	const contentPreview = trimReminderContent(reminder?.content)
	const message = contentPreview ? `便签提醒：${contentPreview}` : '你有一条便签提醒到时间了'

	try {
		await chrome.notifications.create(`my-paste-reminder-${Date.now()}`, {
			type: 'basic',
			iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
			title: 'My Paste 提醒',
			message
		})
	} catch (error) {
		console.error('[MyPaste] notifications.create failed', error)
	}
}

chrome.alarms.onAlarm.addListener((alarm) => {
	onReminderAlarm(alarm).catch((error) => {
		console.error('[MyPaste] reminder alarm failed', error)
	})
})
