# @forge/gui-mac

GUI secundaria para macOS usando Tauri.

## Rol en arquitectura

- **GUI**: presentación visual y navegación.
- **Daemon** (`apps/daemon`): orquestación de sesiones, approvals, tools y estado.
- **Engine** (`packages/engine`): núcleo agentic.

La GUI **no** implementa lógica de negocio de engine/daemon.

## Vistas actuales

1. Dashboard
2. Current Session
3. Agents
4. Approvals
5. Projects
6. Settings

En `Current Session`, Vell muestra:

- streaming en vivo
- tools/events recientes
- panel de **Agent Activity** (delegación supervisada por Vell)
- **push-to-talk local** (cuando el runtime soporta Web Speech API)
- lectura opcional de la última respuesta con síntesis de voz del navegador
- timeline visual de eventos de delegación para seguir el trabajo de subagentes
- command bar con slash commands (`/new`, `/resume`, `/refresh`, `/agents`, `/help`)

Endpoint usado por GUI para delegación:

```bash
GET /sessions/:id/agents/activity
```

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

# smoke de limpieza para release nativo macOS
pnpm smoke:gui:mac-clean
```

Checklist completo: `docs/gui-macos-native-checklist.md`

Variable opcional:

```bash
VITE_FORGE_DAEMON_URL=http://127.0.0.1:4545
VITE_FORGE_DAEMON_TOKEN=tu-token-local
```

La pantalla **Settings** permite:

- cambiar `OpenAI auth mode` (`api_key` / `chatgpt_oauth`)
- guardar `OpenAI API key`
- verificar API key contra endpoint local `/providers/openai/auth/api-key/verify`

## Release macOS

La app nativa usa metadata explícita en `src-tauri/tauri.conf.json`, `src-tauri/tauri.macos.conf.json` y `src-tauri/Info.plist`.

Workflow manual:

- `.github/workflows/gui-native-release-macos.yml`

Modos:

- `profile=release|debug`
- `sign=false|true`
- `notarize=false|true`

Si activás `sign` o `notarize`, el workflow espera secretos Apple y falla con un mensaje claro si faltan:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_API_KEY`
- `APPLE_API_ISSUER`
- `APPLE_API_KEY_B64`

Antes de construir, el workflow corre `pnpm smoke:gui:mac-clean` para validar una Mac limpia.

## Voz local (MVP)

- input por micrófono con botón *mantener para hablar*
- estados UI: `listening`, `transcribing`, `sending`, `error`, `unsupported`
- el transcript se envía al mismo flujo de prompt del daemon (no hay lógica paralela)
- en macOS nativo, se declara `NSMicrophoneUsageDescription` en `src-tauri/Info.plist`

## Limitaciones actuales

- Es un shell visual austero (no editor avanzado).
- La capa de voz depende de soporte del WebView (`SpeechRecognition`/`webkitSpeechRecognition`).
- No incluye hotword, escucha continua ni remoto móvil.
- El streaming es básico (texto en vivo de la respuesta actual).
- La firma/notarización quedan para el workflow manual con secretos Apple.

## QA antes de merge

Usá `docs/gui-qa-checklist.md` para validar cambios de GUI, voz y multi-agente.

Checklist mínimo:

- la sesión actual no debe quedar confundida con `mock`
- si está en `mock`, la app debe mostrar warning visible y CTA para crear sesión real
- `Push to talk` debe mostrar estados claros y hints de permisos si falla
- la conversación debe seguir creciendo con auto-scroll
- `Agent Activity` y el feed de Vell deben seguir visibles

Comandos útiles:

```bash
pnpm -s typecheck
pnpm -s smoke:gui:mac-clean
pnpm --filter @forge/gui-mac doctor:mac
```
