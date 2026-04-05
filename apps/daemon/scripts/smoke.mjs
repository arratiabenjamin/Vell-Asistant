#!/usr/bin/env node

const baseUrl = process.env.FORGE_DAEMON_URL?.trim() || 'http://127.0.0.1:4545'
const authToken = process.env.FORGE_DAEMON_TOKEN?.trim() || null

function mergeHeaders(initHeaders = {}) {
  const headers = new Headers(initHeaders)
  if (authToken) {
    headers.set('x-forge-token', authToken)
  }
  return headers
}

async function request(path, init = {}, parseJson = true) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: mergeHeaders(init.headers || {})
  })

  const text = await response.text()
  let body = null
  if (text.trim()) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText} on ${path}: ${JSON.stringify(body)}`)
  }

  return parseJson ? body : text
}

async function waitForHealth(timeoutMs = 30_000) {
  const started = Date.now()

  while (Date.now() - started <= timeoutMs) {
    try {
      const health = await fetch(`${baseUrl}/health`)
      if (health.ok) return
    } catch {
      // retry
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  throw new Error(`Daemon health check timed out after ${timeoutMs}ms (${baseUrl}/health)`)
}

async function main() {
  await waitForHealth()

  const health = await request('/health')
  if (health?.status !== 'ok') {
    throw new Error(`Unexpected health status: ${JSON.stringify(health)}`)
  }

  if (authToken) {
    const unauthorized = await fetch(`${baseUrl}/status`)
    if (unauthorized.status !== 401) {
      throw new Error(`Expected 401 without token, got ${unauthorized.status}`)
    }
  }

  const status = await request('/status')
  if (typeof status?.activeSessions !== 'number') {
    throw new Error(`Invalid /status payload: ${JSON.stringify(status)}`)
  }

  const created = await request('/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'smoke', provider: 'mock' })
  })

  const sessionId = created?.id
  if (!sessionId) {
    throw new Error(`Invalid /sessions response: ${JSON.stringify(created)}`)
  }

  const prompt = await request(`/sessions/${sessionId}/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'respond with: ok' })
  })

  const assistantContent = prompt?.assistantMessage?.content || ''
  if (!assistantContent.toLowerCase().includes('ok')) {
    throw new Error(`Unexpected assistant response: ${JSON.stringify(prompt)}`)
  }

  const projectPath = process.cwd()
  await request(`/sessions/${sessionId}/project/select`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectPath })
  })

  const dir = await request(`/sessions/${sessionId}/tools/list_dir`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: '.' })
  })

  if (!Array.isArray(dir?.entries)) {
    throw new Error(`Invalid list_dir response: ${JSON.stringify(dir)}`)
  }

  console.log('✅ daemon smoke passed')
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`❌ daemon smoke failed: ${message}`)
  process.exit(1)
})
