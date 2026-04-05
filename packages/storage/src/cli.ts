import { getLogger } from '@forge/observability'
import { closeStorage, initializeStorage } from './index.js'

function printUsage(): void {
  console.log('Usage: pnpm --filter @forge/storage migrate [--db <path>]')
}

function parseArgs(argv: string[]): { command: string | null; dbPath?: string } {
  const command = argv[0] ?? null
  let dbPath: string | undefined

  for (let i = 1; i < argv.length; i += 1) {
    const current = argv[i]
    if (current === '--db') {
      dbPath = argv[i + 1]
      i += 1
    }
  }

  return { command, dbPath }
}

function main(): void {
  const { command, dbPath } = parseArgs(process.argv.slice(2))

  if (command !== 'migrate') {
    printUsage()
    process.exitCode = 1
    return
  }

  const logger = getLogger('storage:cli')
  const storage = initializeStorage({ dbPath, logger })
  const health = storage.db.prepare('SELECT COUNT(*) AS total FROM schema_migrations').get() as { total: number }

  console.log(`✅ SQLite ready at ${storage.dbPath}`)
  console.log(`✅ Migrations applied (total): ${health.total}`)

  closeStorage(storage)
}

main()
