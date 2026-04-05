export type EngineProviderMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type EngineProviderRunInput = {
  model?: string
  messages: EngineProviderMessage[]
}

export type EngineProviderChunk =
  | { type: 'token'; value: string }
  | { type: 'done' }

export type EngineProvider = {
  name: string
  run(input: EngineProviderRunInput): AsyncGenerator<EngineProviderChunk>
}

export type EngineRunTurnInput = {
  sessionId: string
  prompt: string
  provider: string
  model?: string
  history?: EngineProviderMessage[]
}

export type EngineTurnEvent =
  | { type: 'token'; value: string }
  | { type: 'done'; summary: string }

export interface EngineRuntime {
  runTurn(input: EngineRunTurnInput): AsyncGenerator<EngineTurnEvent>
}
