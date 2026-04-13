#!/usr/bin/env node

import path from 'node:path'
import { pathToFileURL } from 'node:url'

async function loadPlaywright() {
  try {
    const mod = await import('playwright')
    return mod.chromium
  } catch (error) {
    throw new Error(
      'Playwright is not installed. Run: npm install && npx playwright install chromium'
    )
  }
}

async function resolveExtensionId(context) {
  let [background] = context.serviceWorkers()
  if (!background) {
    background = await context.waitForEvent('serviceworker', { timeout: 10000 })
  }

  const workerUrl = background.url()
  const match = workerUrl.match(/chrome-extension:\/\/([a-z]{32})\//)
  if (!match) {
    throw new Error(`Unable to resolve extension id from service worker URL: ${workerUrl}`)
  }

  return match[1]
}

async function main() {
  const chromium = await loadPlaywright()

  const extensionPath = process.cwd()
  const userDataDir = path.join(extensionPath, '.pw-user-data')

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  })

  const runtimeErrors = []

  try {
    const extensionId = await resolveExtensionId(context)
    const page = await context.newPage()

    page.on('pageerror', (err) => {
      runtimeErrors.push(`pageerror: ${err.message}`)
    })

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        runtimeErrors.push(`console.error: ${msg.text()}`)
      }
    })

    const popupUrl = `chrome-extension://${extensionId}/popup.html`
    await page.goto(popupUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })

    await page.waitForSelector('#app', { timeout: 10000 })

    const smokeResult = await page.evaluate(() => ({
      hasToolsTab: Boolean(document.querySelector('#tabTools')),
      hasNotesTab: Boolean(document.querySelector('#tabNotes')),
      hasStandaloneBtn: Boolean(document.querySelector('#openStandaloneBtn')),
      hasToolsPanel: Boolean(document.querySelector('#panelTools')),
      hasNotesPanel: Boolean(document.querySelector('#panelNotes'))
    }))

    if (Object.values(smokeResult).some((ok) => !ok)) {
      throw new Error(`Popup smoke check failed: ${JSON.stringify(smokeResult)}`)
    }

    await page.waitForTimeout(600)

    if (runtimeErrors.length > 0) {
      throw new Error(`Popup runtime errors detected:\n${runtimeErrors.join('\n')}`)
    }

    console.log('Popup smoke test passed.')
  } finally {
    await context.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
