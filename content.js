// Content script - 用于注入页面功能
// 可以在此添加其他内容脚本相关的功能

const READ_LOCAL_STORAGE_TOKEN_MESSAGE_TYPE = 'MY_PASTE_READ_LOCAL_STORAGE_TOKEN'
const CMS_DEV_ORIGIN = 'https://dev.cms.litnotes.ai'
const CMS_DEV_TOKEN_CACHE_KEY = 'MY_PASTE_CMS_DEV_TOKEN_CACHE'
const CMS_PROD_ORIGIN = 'https://cms.litnotes.ai'
const CMS_PROD_TOKEN_CACHE_KEY = 'MY_PASTE_CMS_PROD_TOKEN_CACHE'

const CMS_TOKEN_CACHE_KEY_BY_ORIGIN = {
	[CMS_DEV_ORIGIN]: CMS_DEV_TOKEN_CACHE_KEY,
	[CMS_PROD_ORIGIN]: CMS_PROD_TOKEN_CACHE_KEY
}

async function syncCmsDevTokenToExtensionStorage() {
	const cacheKey = CMS_TOKEN_CACHE_KEY_BY_ORIGIN[window.location.origin]
	if (!cacheKey) {
		return
	}

	try {
		const token = localStorage.getItem('token')
		if (typeof token === 'string' && token.trim()) {
			await chrome.storage.local.set({
				[cacheKey]: {
					token,
					updatedAt: Date.now()
				}
			})
		}
	} catch (error) {
		console.warn('[MyPaste] sync cms dev token failed', error)
	}
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (!message || message.type !== READ_LOCAL_STORAGE_TOKEN_MESSAGE_TYPE) {
		return false
	}

	try {
		const token = localStorage.getItem('token')
		syncCmsDevTokenToExtensionStorage().catch(() => {})
		sendResponse({ ok: true, token })
	} catch (error) {
		console.error('[MyPaste] read localStorage token failed', error)
		sendResponse({
			ok: false,
			error: error instanceof Error ? error.message : 'read localStorage token failed'
		})
	}

	return true
})

syncCmsDevTokenToExtensionStorage().catch(() => {})
