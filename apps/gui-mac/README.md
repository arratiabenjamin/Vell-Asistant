# @forge/gui-mac

GUI secundaria para macOS usando Tauri.

## Rol en arquitectura

- **GUI**: presentación visual y navegación.
- **Daemon** (`apps/daemon`): orquestación de sesiones, approvals, tools y estado.
- **Engine** (`packages/engine`): núcleo agentic.

La GUI **no** implementa lógica de negocio de engine/daemon.

## Vistas MVP incluidas

1. Dashboard
2. Current Session
3. Approvals
4. Projects
5. Settings

## Requisitos

- Daemon corriendo (por defecto en `http://127.0.0.1:4545`)
- Node + pnpm
- Rust toolchain + dependencias de Tauri (solo para `tauri dev`)

## Desarrollo

Desde la raíz del monorepo:

```bash
pnpm install
pnpm dev:daemon
pnpm dev:gui:web
```

Para abrir la app nativa Tauri:

```bash
pnpm dev:gui
```

## Toolchain / doctor

```bash
# valida prerequisitos macOS + Rust + Tauri + daemon
pnpm doctor:gui

# instala rustup/rust estable (macOS)
pnpm setup:gui:rust

# valida prerequisitos + typecheck antes de levantar Tauri nativo
pnpm preflight:gui:native

# crea dist placeholder para compile de Tauri dev (si hiciera falta)
pnpm --filter @forge/gui-mac ensure:dist
```

Checklist completo: `docs/gui-macos-native-checklist.md`

Variable opcional:

```bash
VITE_FORGE_DAEMON_URL=http://127.0.0.1:4545
```

## Limitaciones actuales

- Es un shell visual austero (no editor avanzado).
- No incluye audio, voz, hotword ni remoto móvil.
- El streaming es básico (texto en vivo de la respuesta actual).
