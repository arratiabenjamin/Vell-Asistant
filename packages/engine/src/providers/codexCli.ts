import { spawn } from 'node:child_process'
import type { EngineProvider, EngineProviderChunk, EngineProviderRunInput } from '../types.js'

function extractJsonLines(content: string): unknown[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('{') && line.endsWith('}'))
    .map(line => {
      try {
        return JSON.parse(line) as unknown
      } catch {
        return null
      }
    })
    .filter((item): item is unknown => item !== null)
}

function chunkWords(text: string): string[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map(word => `${word} `)
}

export type CodexCliProviderOptions = {
  command?: string
}

export function createCodexCliProvider(options: CodexCliProviderOptions = {}): EngineProvider {
  const command = options.command ?? 'codex'

  return {
    name: 'openai-chatgpt',
    async *run(input: EngineProviderRunInput): AsyncGenerator<EngineProviderChunk> {
      const prompt = [...input.messages].reverse().find(message => message.role === 'user')?.content ?? ''

      const args = ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', prompt]
      if (input.model?.trim()) {
        args.splice(1, 0, '--model', input.model.trim())
      }

      const processResult = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
        (resolve, reject) => {
          const child = spawn(command, args, {
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe']
          })

          let stdout = ''
          let stderr = ''
          child.stdout.on('data', chunk => {
            stdout += String(chunk)
          })
          child.stderr.on('data', chunk => {
            stderr += String(chunk)
          })
          child.on('error', reject)
          child.on('close', code => resolve({ code, stdout, stderr }))
        }
      )

      if (processResult.code !== 0) {
        throw new Error(
          `codex exec failed (code ${processResult.code ?? 'unknown'}): ${processResult.stderr || processResult.stdout}`
        )
      }

      const events = extractJsonLines(processResult.stdout) as Array<{
        type?: string
        item?: { type?: string; text?: string }
      }>

      const finalText =
        events.find(
          event => event.type === 'item.completed' && event.item?.type === 'agent_message'
        )?.item?.text ?? ''

      for (const token of chunkWords(finalText)) {
        yield { type: 'token', value: token }
      }

      yield { type: 'done' }
    }
  }
}
