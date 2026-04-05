import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

type Check = {
  name: string
  ok: boolean
  info: string
  blocker: boolean
  fix?: string
}

function run(command: string): string {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
}

function tryRun(command: string): { ok: boolean; output: string } {
  try {
    return { ok: true, output: run(command) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, output: message }
  }
}

async function checkDaemonHealth(baseUrl: string): Promise<Check> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1200)
    const response = await fetch(`${baseUrl}/health`, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) {
      return {
        name: 'Daemon health endpoint',
        ok: false,
        blocker: false,
        info: `respondió ${response.status}`,
        fix: 'levantá daemon con: pnpm dev:daemon'
      }
    }

    const payload = (await response.json()) as { status?: string; version?: string }
    return {
      name: 'Daemon health endpoint',
      ok: true,
      blocker: false,
      info: `ok (${payload.status ?? 'unknown'}) v${payload.version ?? '-'}`
    }
  } catch {
    return {
      name: 'Daemon health endpoint',
      ok: false,
      blocker: false,
      info: `sin conexión en ${baseUrl}`,
      fix: 'levantá daemon con: pnpm dev:daemon'
    }
  }
}

async function main(): Promise<void> {
  const checks: Check[] = []

  checks.push({
    name: 'Host OS',
    ok: process.platform === 'darwin',
    blocker: true,
    info: `platform=${process.platform}`,
    fix: 'este target es macOS (darwin)'
  })

  const rustc = tryRun('rustc --version')
  checks.push({
    name: 'rustc',
    ok: rustc.ok,
    blocker: true,
    info: rustc.ok ? rustc.output : 'no encontrado',
    fix: 'instalá Rust: curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh'
  })

  const cargo = tryRun('cargo --version')
  checks.push({
    name: 'cargo',
    ok: cargo.ok,
    blocker: true,
    info: cargo.ok ? cargo.output : 'no encontrado',
    fix: 'si instalaste rustup, reiniciá shell o ejecutá: source "$HOME/.cargo/env"'
  })

  const rustup = tryRun('rustup --version')
  checks.push({
    name: 'rustup',
    ok: rustup.ok,
    blocker: false,
    info: rustup.ok ? rustup.output.split('\n')[0] ?? rustup.output : 'no encontrado',
    fix: 'recomendado para gestionar toolchains de Rust'
  })

  const xcodePath = tryRun('xcode-select -p')
  checks.push({
    name: 'xcode-select',
    ok: xcodePath.ok,
    blocker: true,
    info: xcodePath.ok ? xcodePath.output : 'no configurado',
    fix: 'instalá Command Line Tools: xcode-select --install'
  })

  const clang = tryRun('clang --version | head -n 1')
  checks.push({
    name: 'clang',
    ok: clang.ok,
    blocker: true,
    info: clang.ok ? clang.output : 'no encontrado',
    fix: 'instalá Xcode/Command Line Tools'
  })

  const tauriCli = tryRun('pnpm --filter @forge/gui-mac exec tauri --version')
  checks.push({
    name: 'tauri-cli',
    ok: tauriCli.ok,
    blocker: true,
    info: tauriCli.ok ? tauriCli.output : 'no disponible',
    fix: 'corré pnpm install en la raíz del monorepo'
  })

  const iconPath = resolve(process.cwd(), 'src-tauri/icons/icon.png')
  checks.push({
    name: 'Tauri icon asset',
    ok: existsSync(iconPath),
    blocker: true,
    info: existsSync(iconPath) ? iconPath : 'faltante',
    fix: 'creá apps/gui-mac/src-tauri/icons/icon.png (PNG RGBA válido)'
  })

  const frontendDist = resolve(process.cwd(), 'dist/index.html')
  checks.push({
    name: 'Frontend dist placeholder',
    ok: existsSync(frontendDist),
    blocker: false,
    info: existsSync(frontendDist) ? frontendDist : 'faltante',
    fix: 'corré pnpm --filter @forge/gui-mac ensure:dist'
  })

  checks.push(await checkDaemonHealth(process.env.FORGE_DAEMON_URL?.trim() || 'http://127.0.0.1:4545'))

  const blockers = checks.filter(item => !item.ok && item.blocker)
  const warnings = checks.filter(item => !item.ok && !item.blocker)

  console.log('\nForge GUI macOS doctor\n')

  for (const item of checks) {
    const icon = item.ok ? '✅' : item.blocker ? '❌' : '⚠️'
    console.log(`${icon} ${item.name}: ${item.info}`)
    if (!item.ok && item.fix) {
      console.log(`   ↳ fix: ${item.fix}`)
    }
  }

  console.log('\nResumen:')
  console.log(`- blockers: ${blockers.length}`)
  console.log(`- warnings: ${warnings.length}`)

  if (blockers.length > 0) {
    console.log('\nNo está listo para runtime nativo Tauri todavía.')
    process.exitCode = 1
    return
  }

  console.log('\nListo para correr GUI nativa con: pnpm dev:gui')
}

void main()
