import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProjectContextResponse } from '@forge/shared'

async function exists(path: string): Promise<boolean> {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

export async function buildProjectContext(projectPath: string): Promise<ProjectContextResponse> {
  const topLevelDirents = await readdir(projectPath, { withFileTypes: true })

  let name: string | null = null
  const packageJsonPath = join(projectPath, 'package.json')
  if (await exists(packageJsonPath)) {
    try {
      const parsed = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { name?: string }
      name = parsed.name ?? null
    } catch {
      name = null
    }
  }

  const detectedStacks: string[] = []
  if (await exists(packageJsonPath)) detectedStacks.push('node')
  if (await exists(join(projectPath, 'pnpm-lock.yaml'))) detectedStacks.push('pnpm')
  if (await exists(join(projectPath, 'bun.lock'))) detectedStacks.push('bun')
  if (await exists(join(projectPath, 'pyproject.toml'))) detectedStacks.push('python')
  if (await exists(join(projectPath, 'go.mod'))) detectedStacks.push('go')
  if (await exists(join(projectPath, 'Cargo.toml'))) detectedStacks.push('rust')

  return {
    projectPath,
    name,
    detectedStacks,
    topLevelEntries: topLevelDirents
      .map(entry => entry.name)
      .filter(name => !name.startsWith('.'))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 50)
  }
}
