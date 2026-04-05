import { readdir, readFile, stat } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import type {
  ListDirToolResponse,
  ReadFileToolResponse,
  SearchTextToolResponse
} from '@forge/shared'

function resolveInsideProject(projectPath: string, targetPath = '.'): string {
  const normalizedRoot = resolve(projectPath)
  const resolved = resolve(normalizedRoot, targetPath)
  const allowedPrefix = normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`

  if (resolved !== normalizedRoot && !resolved.startsWith(allowedPrefix)) {
    throw new Error('Path escapes project root')
  }

  return resolved
}

export async function listDirTool(projectPath: string, targetPath = '.'): Promise<ListDirToolResponse> {
  const absolute = resolveInsideProject(projectPath, targetPath)
  const dirents = await readdir(absolute, { withFileTypes: true })

  const entries = await Promise.all(
    dirents
      .filter(entry => !entry.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 200)
      .map(async entry => {
        const full = resolve(absolute, entry.name)
        const fileStat = await stat(full).catch(() => null)
        return {
          name: entry.name,
          type: entry.isDirectory()
            ? ('dir' as const)
            : entry.isFile()
              ? ('file' as const)
              : entry.isSymbolicLink()
                ? ('symlink' as const)
                : ('other' as const),
          size: fileStat?.isFile() ? fileStat.size : null
        }
      })
  )

  return {
    basePath: relative(projectPath, absolute) || '.',
    entries
  }
}

export async function readFileTool(
  projectPath: string,
  targetPath: string,
  maxBytes = 64_000
): Promise<ReadFileToolResponse> {
  const absolute = resolveInsideProject(projectPath, targetPath)
  const content = await readFile(absolute, 'utf8')
  const truncated = Buffer.byteLength(content, 'utf8') > maxBytes

  return {
    path: relative(projectPath, absolute),
    truncated,
    content: truncated ? content.slice(0, maxBytes) : content
  }
}

type SearchHit = {
  path: string
  line: number
  snippet: string
}

async function walkFiles(rootPath: string, maxFiles: number): Promise<string[]> {
  const result: string[] = []
  const queue = [rootPath]

  while (queue.length > 0 && result.length < maxFiles) {
    const current = queue.shift()
    if (!current) break

    const dirents = await readdir(current, { withFileTypes: true }).catch(() => [])
    for (const entry of dirents) {
      if (entry.name.startsWith('.')) continue

      const fullPath = resolve(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(fullPath)
        continue
      }
      if (entry.isFile()) {
        result.push(fullPath)
      }
      if (result.length >= maxFiles) break
    }
  }

  return result
}

export async function searchTextTool(
  projectPath: string,
  query: string,
  targetPath = '.',
  maxResults = 50,
  caseSensitive = false
): Promise<SearchTextToolResponse> {
  const absolute = resolveInsideProject(projectPath, targetPath)
  const files = await walkFiles(absolute, 3_000)
  const hits: SearchHit[] = []
  const needle = caseSensitive ? query : query.toLowerCase()

  for (const file of files) {
    if (hits.length >= maxResults) break

    const fileStat = await stat(file).catch(() => null)
    if (!fileStat?.isFile()) continue
    if (fileStat.size > 512_000) continue

    const content = await readFile(file, 'utf8').catch(() => null)
    if (!content) continue
    if (content.includes('\u0000')) continue

    const lines = content.split('\n')
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const current = lines[lineIndex]
      const haystack = caseSensitive ? current : current.toLowerCase()
      if (!haystack.includes(needle)) continue

      hits.push({
        path: relative(projectPath, file),
        line: lineIndex + 1,
        snippet: current.slice(0, 220)
      })

      if (hits.length >= maxResults) break
    }
  }

  return {
    query,
    hits
  }
}
