import type { EngineProvider, EngineProviderChunk, EngineProviderRunInput } from '../types.js'

export type OpenAICompatibleProviderOptions = {
  name?: string
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
}

export type OpenAIApiKeyVerificationResult = {
  ok: boolean
  statusCode: number | null
  message: string
}

async function* parseSSE(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<EngineProviderChunk> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      const line = frame
        .split('\n')
        .map(current => current.trim())
        .find(current => current.startsWith('data:'))

      if (!line) continue
      const payload = line.slice('data:'.length).trim()

      if (payload === '[DONE]') {
        yield { type: 'done' }
        return
      }

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>
        }

        const token = parsed.choices?.[0]?.delta?.content
        if (token) {
          yield { type: 'token', value: token }
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }

  yield { type: 'done' }
}

export function createOpenAICompatibleProvider(
  options: OpenAICompatibleProviderOptions = {}
): EngineProvider {
  const baseUrl = options.baseUrl ?? process.env.FORGE_OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  const apiKey = options.apiKey ?? process.env.FORGE_OPENAI_API_KEY
  const defaultModel = options.defaultModel ?? process.env.FORGE_OPENAI_MODEL ?? 'gpt-4o-mini'

  return {
    name: options.name ?? 'openai-compatible',
    async *run(input: EngineProviderRunInput): AsyncGenerator<EngineProviderChunk> {
      if (!apiKey) {
        throw new Error(
          'FORGE_OPENAI_API_KEY is required for provider "openai-compatible". ' +
            'Use provider "mock" if you want local-only testing.'
        )
      }

      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: input.model ?? defaultModel,
          stream: true,
          messages: input.messages.map(message => ({
            role: message.role,
            content: message.content
          }))
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        const hint =
          response.status === 401
            ? ' OpenAI API key inválida o expirada. Verificá con POST /providers/openai/auth/api-key/verify.'
            : ''
        throw new Error(`OpenAI-compatible request failed (${response.status}): ${errorText}${hint}`)
      }

      if (!response.body) {
        throw new Error('OpenAI-compatible response stream is empty')
      }

      yield* parseSSE(response.body)
    }
  }
}

export async function verifyOpenAICompatibleApiKey(
  options: OpenAICompatibleProviderOptions = {}
): Promise<OpenAIApiKeyVerificationResult> {
  const baseUrl = options.baseUrl ?? process.env.FORGE_OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  const apiKey = options.apiKey ?? process.env.FORGE_OPENAI_API_KEY

  if (!apiKey?.trim()) {
    return {
      ok: false,
      statusCode: null,
      message: 'No API key configured'
    }
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    })

    if (response.ok) {
      return {
        ok: true,
        statusCode: response.status,
        message: 'API key válida'
      }
    }

    const body = await response.text().catch(() => '')
    return {
      ok: false,
      statusCode: response.status,
      message: `OpenAI verify failed (${response.status}): ${body.slice(0, 300)}`
    }
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}
