import type { EngineProvider, EngineProviderChunk, EngineProviderRunInput } from '../types.js'

async function* emitByWords(text: string): AsyncGenerator<EngineProviderChunk> {
  const words = text.split(/\s+/).filter(Boolean)
  for (const word of words) {
    yield { type: 'token', value: `${word} ` }
    await new Promise(resolve => setTimeout(resolve, 15))
  }
  yield { type: 'done' }
}

export function createMockProvider(): EngineProvider {
  return {
    name: 'mock',
    async *run(input: EngineProviderRunInput): AsyncGenerator<EngineProviderChunk> {
      const userPrompt = [...input.messages].reverse().find(message => message.role === 'user')?.content ?? ''
      const response = `Mock provider (${input.model ?? 'default-model'}): ${userPrompt.slice(0, 240)}`
      yield* emitByWords(response)
    }
  }
}
