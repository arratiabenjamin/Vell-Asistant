import { spawn } from 'node:child_process'
import type { RunCommandSafeToolResponse } from '@forge/shared'

const MAX_OUTPUT_CHARS = 32_000

const SAFE_COMMANDS: Record<string, { command: string; args: string[] }> = {
  'git status': { command: 'git', args: ['status'] },
  'npm test': { command: 'npm', args: ['test'] },
  'pnpm test': { command: 'pnpm', args: ['test'] },
  'npm run lint': { command: 'npm', args: ['run', 'lint'] },
  'pnpm lint': { command: 'pnpm', args: ['lint'] }
}

function trimOutput(value: string): string {
  if (value.length <= MAX_OUTPUT_CHARS) return value
  return value.slice(0, MAX_OUTPUT_CHARS)
}

export function isSafeCommandAllowed(rawCommand: string): boolean {
  const normalized = rawCommand.trim().replace(/\s+/g, ' ')
  return Boolean(SAFE_COMMANDS[normalized])
}

export async function runCommandSafeTool(
  projectPath: string,
  rawCommand: string
): Promise<RunCommandSafeToolResponse> {
  const normalized = rawCommand.trim().replace(/\s+/g, ' ')
  const allowed = SAFE_COMMANDS[normalized]
  if (!allowed) {
    throw new Error(`Command not allowed by whitelist: ${normalized}`)
  }

  const result = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(allowed.command, allowed.args, {
      cwd: projectPath,
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
    child.on('close', code => resolve({ exitCode: code ?? 1, stdout, stderr }))
  })

  return {
    command: normalized,
    exitCode: result.exitCode,
    stdout: trimOutput(result.stdout),
    stderr: trimOutput(result.stderr)
  }
}
