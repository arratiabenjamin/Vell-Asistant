import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import type { WriteFileToolResponse } from '@forge/shared'

function resolveInsideProject(projectPath: string, targetPath: string): string {
  const normalizedRoot = resolve(projectPath)
  const resolved = resolve(normalizedRoot, targetPath)
  const allowedPrefix = normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`

  if (resolved !== normalizedRoot && !resolved.startsWith(allowedPrefix)) {
    throw new Error('Path escapes project root')
  }

  return resolved
}

export function assertWritePathAllowed(projectPath: string, targetPath: string): void {
  void resolveInsideProject(projectPath, targetPath)
}

export async function writeFileTool(
  projectPath: string,
  targetPath: string,
  content: string
): Promise<WriteFileToolResponse> {
  const absolute = resolveInsideProject(projectPath, targetPath)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, content, 'utf8')

  return {
    path: relative(projectPath, absolute),
    bytesWritten: Buffer.byteLength(content, 'utf8')
  }
}
