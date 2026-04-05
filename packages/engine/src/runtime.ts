import type {
  EngineProvider,
  EngineProviderMessage,
  EngineRunTurnInput,
  EngineRuntime,
  EngineTurnEvent
} from './types.js'

export type CreateEngineRuntimeOptions = {
  providers: EngineProvider[]
  defaultProvider: string
}

export class ProviderEngineRuntime implements EngineRuntime {
  private readonly providersByName = new Map<string, EngineProvider>()
  private readonly defaultProvider: string

  constructor(options: CreateEngineRuntimeOptions) {
    this.defaultProvider = options.defaultProvider

    for (const provider of options.providers) {
      this.providersByName.set(provider.name, provider)
    }
  }

  private resolveProvider(providerName?: string): EngineProvider {
    const resolved = this.providersByName.get(providerName ?? this.defaultProvider)
    if (!resolved) {
      throw new Error(
        `Provider "${providerName ?? this.defaultProvider}" not found. ` +
          `Available: ${[...this.providersByName.keys()].join(', ')}`
      )
    }
    return resolved
  }

  async *runTurn(input: EngineRunTurnInput): AsyncGenerator<EngineTurnEvent> {
    const provider = this.resolveProvider(input.provider)

    const history: EngineProviderMessage[] = input.history ?? []
    const messages: EngineProviderMessage[] = [...history, { role: 'user', content: input.prompt }]

    for await (const chunk of provider.run({ model: input.model, messages })) {
      if (chunk.type === 'token') {
        yield { type: 'token', value: chunk.value }
        continue
      }

      yield {
        type: 'done',
        summary: `Provider ${provider.name} completed turn for session ${input.sessionId}`
      }
    }
  }
}
