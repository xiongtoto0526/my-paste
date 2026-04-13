#!/usr/bin/env node

import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const rootDir = process.cwd()
const ignoreDirs = new Set(['.git', '.venv', 'node_modules', 'dist', 'build'])

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) {
        continue
      }

      files.push(...(await walk(fullPath)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath)
    }
  }

  return files
}

function runNodeCheck(filePath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--check', filePath], {
      stdio: 'pipe'
    })

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('close', (code) => {
      resolve({ code, stderr })
    })
  })
}

async function main() {
  const rootStat = await stat(rootDir)
  if (!rootStat.isDirectory()) {
    throw new Error(`Invalid workspace directory: ${rootDir}`)
  }

  const jsFiles = await walk(rootDir)
  if (jsFiles.length === 0) {
    console.log('No .js files found.')
    return
  }

  const failures = []

  for (const filePath of jsFiles) {
    const result = await runNodeCheck(filePath)
    if (result.code !== 0) {
      failures.push({ filePath, stderr: result.stderr.trim() })
      continue
    }

    const relative = path.relative(rootDir, filePath)
    console.log(`OK  ${relative}`)
  }

  if (failures.length > 0) {
    console.error(`\nSyntax check failed: ${failures.length} file(s).`)
    for (const failure of failures) {
      const relative = path.relative(rootDir, failure.filePath)
      console.error(`\n[${relative}]`)
      console.error(failure.stderr || 'Unknown syntax error')
    }
    process.exit(1)
  }

  console.log(`\nSyntax check passed: ${jsFiles.length} file(s).`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
