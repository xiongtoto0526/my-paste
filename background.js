const STORAGE_KEY = 'records'
const REMINDER_STORAGE_KEY = 'noteReminders'
const AI_RADAR_CONFIG_KEY = 'aiRadarConfig'
const AI_RADAR_STATE_KEY = 'aiRadarState'
const DOMAIN_LIMIT = 100
const MESSAGE_TYPE = 'MY_CLIPBOARD_RECORD'
const LEGACY_MESSAGE_TYPE = 'MY_PASTE_RECORD'
const CREATE_REMINDER_MESSAGE_TYPE = 'MY_PASTE_CREATE_REMINDER'
const CHECK_AI_RADAR_NOW_MESSAGE_TYPE = 'MY_PASTE_AI_RADAR_CHECK_NOW'
const UPDATE_AI_RADAR_CONFIG_MESSAGE_TYPE = 'MY_PASTE_AI_RADAR_UPDATE_CONFIG'
const REMINDER_ALARM_PREFIX = 'note-reminder-'
const AI_RADAR_ALARM_NAME = 'ai-radar-poll'
const NOTIFICATION_ICON_PATH = 'assets/notification-icon.png'

const DEFAULT_AI_RADAR_CONFIG = {
	enabled: true,
	intervalMinutes: 30,
	sources: [
		{
			id: 'copilot',
			name: 'GitHub Copilot',
			type: 'rss',
			feedUrl: 'https://github.blog/changelog/label/copilot/feed/',
			pageUrl: 'https://github.blog/changelog/label/copilot',
			enabled: true
		},
		{
			id: 'cursor',
			name: 'Cursor',
			type: 'rss',
			feedUrl: '',
			enabled: false
		},
		{
			id: 'claude',
			name: 'Claude AI',
			type: 'rss',
			feedUrl: '',
			enabled: false
		},
		{
			id: 'gemini',
			name: 'Google Gemini',
			type: 'html',
			pageUrl: 'https://ai.google.dev/gemini-api/docs/changelog',
				enabled: true
		}
	]
}

function createId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeAiRadarConfig(rawConfig) {
	const config = rawConfig && typeof rawConfig === 'object' ? rawConfig : {}
	const enabled = typeof config.enabled === 'boolean' ? config.enabled : DEFAULT_AI_RADAR_CONFIG.enabled
	const parsedInterval = Number.parseInt(config.intervalMinutes, 10)
	const intervalMinutes = Number.isFinite(parsedInterval)
		? Math.min(720, Math.max(5, parsedInterval))
		: DEFAULT_AI_RADAR_CONFIG.intervalMinutes
	const inputSources = Array.isArray(config.sources) ? config.sources : DEFAULT_AI_RADAR_CONFIG.sources
	const sources = inputSources
		.map((source) => {
			if (!source || typeof source !== 'object') {
				return null
			}

			const id = typeof source.id === 'string' ? source.id.trim().toLowerCase() : ''
			if (!id) {
				return null
			}

			const name = typeof source.name === 'string' && source.name.trim() ? source.name.trim() : id
			const type = source.type === 'html' ? 'html' : 'rss'
			const feedUrl = typeof source.feedUrl === 'string' ? source.feedUrl.trim() : ''
			const pageUrl = typeof source.pageUrl === 'string' ? source.pageUrl.trim() : ''
			const sourceEnabled = typeof source.enabled === 'boolean' ? source.enabled : false

			return {
				id,
				name,
				type,
				feedUrl,
				pageUrl,
				enabled: sourceEnabled
			}
		})
		.filter(Boolean)

	return {
		enabled,
		intervalMinutes,
		sources
	}
}

async function getAiRadarConfig() {
	const data = await chrome.storage.local.get(AI_RADAR_CONFIG_KEY)
	const hasStoredConfig = Object.prototype.hasOwnProperty.call(data, AI_RADAR_CONFIG_KEY)
	const normalized = normalizeAiRadarConfig(hasStoredConfig ? data[AI_RADAR_CONFIG_KEY] : DEFAULT_AI_RADAR_CONFIG)

	if (!hasStoredConfig) {
		await chrome.storage.local.set({ [AI_RADAR_CONFIG_KEY]: normalized })
	}

	return normalized
}

async function setAiRadarConfig(config) {
	const normalized = normalizeAiRadarConfig(config)
	await chrome.storage.local.set({ [AI_RADAR_CONFIG_KEY]: normalized })
	return normalized
}

async function getAiRadarState() {
	const data = await chrome.storage.local.get(AI_RADAR_STATE_KEY)
	const state = data[AI_RADAR_STATE_KEY]
	if (!state || typeof state !== 'object') {
		return { sources: {}, updatedAt: 0 }
	}

	const sources = state.sources && typeof state.sources === 'object' ? state.sources : {}
	const updatedAt = Number.isFinite(state.updatedAt) ? state.updatedAt : 0

	return {
		sources,
		updatedAt
	}
}

async function saveAiRadarState(state) {
	await chrome.storage.local.set({
		[AI_RADAR_STATE_KEY]: {
			...state,
			updatedAt: Date.now()
		}
	})
}

function decodeXmlEntities(value) {
	if (typeof value !== 'string') {
		return ''
	}

	return value
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&apos;', "'")
		.replaceAll('&amp;', '&')
		.trim()
}

function parseTagContent(text, tagName) {
	if (typeof text !== 'string' || !text) {
		return ''
	}

	const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const match = text.match(new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, 'i'))
	if (!match || typeof match[1] !== 'string') {
		return ''
	}

	return decodeXmlEntities(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1'))
}

function extractLatestRssItem(xmlText) {
	if (typeof xmlText !== 'string' || !xmlText.trim()) {
		return null
	}

	const itemMatch = xmlText.match(/<item[\s\S]*?<\/item>/i)
	if (!itemMatch || typeof itemMatch[0] !== 'string') {
		return null
	}

	const itemText = itemMatch[0]
	const title = parseTagContent(itemText, 'title')
	const guid = parseTagContent(itemText, 'guid')
	const link = parseTagContent(itemText, 'link')
	const publishedAt = parseTagContent(itemText, 'pubDate')
	const id = guid || link || title

	if (!id) {
		return null
	}

	return {
		id,
		title: title || '新版本更新',
		link,
		publishedAt
	}
}

function stripHtmlTags(value) {
	if (typeof value !== 'string') {
		return ''
	}

	return decodeXmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function toAbsoluteUrl(rawUrl, baseUrl) {
	if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
		return ''
	}

	try {
		return new URL(rawUrl, baseUrl).toString()
	} catch (_error) {
		return ''
	}
}

function extractLatestHtmlItem(htmlText, pageUrl) {
	if (typeof htmlText !== 'string' || !htmlText.trim()) {
		return null
	}

	const mainMatch = htmlText.match(/<main[\s\S]*?<\/main>/i)
	const scope = mainMatch && typeof mainMatch[0] === 'string' ? mainMatch[0] : htmlText
	const headingMatch = scope.match(/<(h2|h3)[^>]*>([\s\S]*?)<\/\1>/i)
	if (headingMatch && typeof headingMatch[2] === 'string') {
		const headingTitle = stripHtmlTags(headingMatch[2])
		if (headingTitle) {
			return {
				id: `html-heading:${headingTitle}`,
				title: headingTitle,
				link: pageUrl,
				publishedAt: ''
			}
		}
	}

	const linkMatch = scope.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
	if (!linkMatch) {
		return null
	}

	const link = toAbsoluteUrl(linkMatch[1], pageUrl)
	const title = stripHtmlTags(linkMatch[2])
	const id = link || title
	if (!id) {
		return null
	}

	return {
		id,
		title: title || '页面更新',
		link,
		publishedAt: ''
	}
}

function getSourceUrl(source) {
	if (!source || typeof source !== 'object') {
		return ''
	}

	if (source.type === 'html') {
		return typeof source.pageUrl === 'string' ? source.pageUrl : ''
	}

	return typeof source.feedUrl === 'string' ? source.feedUrl : ''
}

async function ensureAiRadarAlarm() {
	const config = await getAiRadarConfig()

	if (!config.enabled) {
		await chrome.alarms.clear(AI_RADAR_ALARM_NAME)
		return
	}

	await chrome.alarms.create(AI_RADAR_ALARM_NAME, {
		periodInMinutes: config.intervalMinutes
	})
}

function getLatestCheckedAt(sourceStateMap) {
	return Object.values(sourceStateMap || {}).reduce((max, sourceState) => {
		const value = Number.isFinite(sourceState?.lastCheckedAt) ? sourceState.lastCheckedAt : 0
		return Math.max(max, value)
	}, 0)
}

async function notifyAiRadarUpdate(source, item) {
	const summary = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : '检测到新版本更新'
	await chrome.notifications.create(`my-paste-ai-radar-${source.id}-${Date.now()}`, {
		type: 'basic',
		iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
		title: `[AI 雷达] ${source.name} 有新更新`,
		message: summary
	})
}

async function runAiRadarCheck() {
	const config = await getAiRadarConfig()
	if (!config.enabled) {
		return { checkedSources: 0, notifiedSources: 0, skipped: true }
	}

	const state = await getAiRadarState()
	const sourceStateMap = state.sources && typeof state.sources === 'object' ? state.sources : {}
	let checkedSources = 0
	let notifiedSources = 0

	for (const source of config.sources) {
		const sourceUrl = getSourceUrl(source).trim()
		if (!source.enabled || !sourceUrl) {
			continue
		}

		const prevState = sourceStateMap[source.id] && typeof sourceStateMap[source.id] === 'object' ? sourceStateMap[source.id] : {}
		const nextState = {
			...prevState,
			lastCheckedAt: Date.now(),
			lastError: ''
		}

		checkedSources += 1

		try {
			const response = await fetch(sourceUrl, { cache: 'no-store' })
			if (!response.ok) {
				throw new Error(`fetch failed: ${response.status}`)
			}

			const responseText = await response.text()
			const latestItem = source.type === 'html'
				? extractLatestHtmlItem(responseText, sourceUrl)
				: extractLatestRssItem(responseText)
			if (latestItem) {
				const hasNewRelease = prevState.lastSeenId && prevState.lastSeenId !== latestItem.id

				nextState.lastSeenId = latestItem.id
				nextState.lastSeenTitle = latestItem.title
				nextState.lastSeenLink = latestItem.link
				nextState.lastPublishedAt = latestItem.publishedAt

				if (hasNewRelease) {
					await notifyAiRadarUpdate(source, latestItem)
					nextState.lastNotifiedAt = Date.now()
					notifiedSources += 1
				}
			}
		} catch (error) {
			nextState.lastError = error instanceof Error ? error.message : 'unknown error'
			console.error('[MyPaste] AI radar check failed', source.id, error)
		}

		sourceStateMap[source.id] = nextState
	}

	await saveAiRadarState({
		sources: sourceStateMap,
		lastCheckedAt: getLatestCheckedAt(sourceStateMap)
	})

	return {
		checkedSources,
		notifiedSources,
		skipped: false
	}
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

	if (message.type === CHECK_AI_RADAR_NOW_MESSAGE_TYPE) {
				runAiRadarCheck()
			.then((result) => sendResponse({ ok: true, ...result }))
			.catch((error) => {
				console.error('[MyPaste] runAiRadarCheck failed', error)
				sendResponse({ ok: false, error: error instanceof Error ? error.message : 'run ai radar failed' })
			})

		return true
	}

	if (message.type === UPDATE_AI_RADAR_CONFIG_MESSAGE_TYPE) {
		setAiRadarConfig(message.config)
			.then(async (config) => {
				await ensureAiRadarAlarm()
				sendResponse({ ok: true, config })
			})
			.catch((error) => {
				console.error('[MyPaste] update ai radar config failed', error)
				sendResponse({ ok: false, error: error instanceof Error ? error.message : 'update ai radar config failed' })
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
	if (alarm?.name === AI_RADAR_ALARM_NAME) {
		runAiRadarCheck()
			.then(() => {})
			.catch((error) => {
				console.error('[MyPaste] ai radar alarm failed', error)
			})
		return
	}

	onReminderAlarm(alarm).catch((error) => {
		console.error('[MyPaste] reminder alarm failed', error)
	})
})

chrome.runtime.onInstalled.addListener(() => {
	ensureAiRadarAlarm().catch((error) => {
		console.error('[MyPaste] ensureAiRadarAlarm onInstalled failed', error)
	})
})

chrome.runtime.onStartup.addListener(() => {
	ensureAiRadarAlarm().catch((error) => {
		console.error('[MyPaste] ensureAiRadarAlarm onStartup failed', error)
	})
})

ensureAiRadarAlarm().catch((error) => {
	console.error('[MyPaste] ensureAiRadarAlarm bootstrap failed', error)
})
