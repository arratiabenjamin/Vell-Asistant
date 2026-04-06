# Forge Monorepo (MVP 1.0 - base)

Sistema nuevo, modular y terminal-first.

## Estructura

- `apps/daemon`: proceso persistente local + API HTTP
- `apps/tui`: shell inicial de TUI
- `apps/gui-mac`: GUI secundaria macOS (Tauri) conectada al daemon
- `packages/shared`: tipos/schemas compartidos
- `packages/control-plane`: contratos API
- `packages/engine`: runtime agentic desacoplado (base)
- `packages/storage`: SQLite + migraciones
- `packages/policy`: evaluación de permisos
- `packages/system-actions`: acciones locales seguras
- `packages/observability`: logger base

## Quickstart

```bash
cd "/Users/benja/Documents/Informatica/Clon Claude Code/openclaude/forge"
pnpm install
pnpm migrate
pnpm dev:daemon
```

Daemon con token opcional (recomendado):

```bash
export FORGE_DAEMON_TOKEN="cambiame-por-un-token-local"
pnpm dev:daemon
```

Health check:

```bash
curl http://127.0.0.1:4545/health
```

Sessions (Sprint 2):

```bash
curl http://127.0.0.1:4545/sessions
curl -X POST http://127.0.0.1:4545/sessions -H "content-type: application/json" -d '{"title":"Mi primera sesión"}'
curl -X POST http://127.0.0.1:4545/sessions -H "content-type: application/json" -d '{"title":"OpenAI session","provider":"openai"}'
```

Provider + streaming (Sprint 3):

```bash
# sesión local (mock provider)
curl -X POST http://127.0.0.1:4545/sessions -H "content-type: application/json" -d '{"title":"Mock stream","provider":"mock"}'

# stream SSE (usá -N para ver tokens)
curl -N -X POST http://127.0.0.1:4545/sessions/<session-id>/prompt/stream \
  -H "content-type: application/json" \
  -d '{"content":"explicame clean architecture en 3 puntos"}'
```

OpenAI-compatible provider:

```bash
export FORGE_OPENAI_API_KEY="sk-..."
export FORGE_OPENAI_BASE_URL="https://api.openai.com/v1"   # opcional
export FORGE_OPENAI_MODEL="gpt-4o-mini"                    # opcional
```

OpenAI auth modes (API key vs ChatGPT OAuth via Codex login):

```bash
# estado
curl http://127.0.0.1:4545/providers/openai/auth/status

# modo API key
curl -X POST http://127.0.0.1:4545/providers/openai/auth/api-key \
  -H "content-type: application/json" \
  -d '{"apiKey":"sk-..."}'

# verificar API key guardada
curl -X POST http://127.0.0.1:4545/providers/openai/auth/api-key/verify

# modo ChatGPT OAuth (requiere sesión activa en Codex CLI)
codex login --device-auth
curl -X POST http://127.0.0.1:4545/providers/openai/auth/chatgpt/activate
curl -X POST http://127.0.0.1:4545/providers/openai/auth/mode \
  -H "content-type: application/json" \
  -d '{"mode":"chatgpt_oauth"}'
```

TUI mínima (Sprint 2):

```bash
pnpm dev:tui
pnpm dev:tui -- --new
pnpm dev:tui -- --session <session-id>
```

GUI macOS mínima (Fase 2):

```bash
# web UI (sin runtime nativo)
pnpm dev:gui:web

# app nativa Tauri (requiere Rust + toolchain Tauri)
pnpm dev:gui
```

GUI actual (Fase 7 + Fase 8 base):

- polish visual/UX (layout, badges, estados vacíos/carga)
- vista `Agents` + panel de `Agent Activity` en sesión/dashboard
- Vell orquesta delegación supervisada (subagentes especializados)
- voz local MVP en `Current Session` (push-to-talk, STT, estados de voz)
- lectura opcional de la última respuesta vía speech synthesis del frontend
- timeline de eventos de delegación para ver cuándo Vell dividió y consolidó tareas

Doctor + setup Rust para GUI nativa:

```bash
pnpm doctor:gui
pnpm setup:gui:rust
pnpm preflight:gui:native
```

Checklist completo: `docs/gui-macos-native-checklist.md`
Smoke de limpieza para release nativo: `pnpm smoke:gui:mac-clean`

CI nativo GUI: `.github/workflows/gui-native-macos.yml`
CI core (daemon/tui/packages + smoke): `.github/workflows/core-ci.yml`
Release GUI nativa manual (unsigned o signed/notarized opcional): `.github/workflows/gui-native-release-macos.yml`

Para el flujo firmado/notarizado se usan secretos Apple y el workflow falla temprano si faltan.

Project context + read tools (Sprint 4):

```bash
# 1) Crear sesión
curl -X POST http://127.0.0.1:4545/sessions \
  -H "content-type: application/json" \
  -d '{"title":"Sprint4","provider":"mock"}'

# 2) Asociar proyecto a sesión
curl -X POST http://127.0.0.1:4545/sessions/<session-id>/project/select \
  -H "content-type: application/json" \
  -d '{"projectPath":"/ruta/absoluta/a/tu/proyecto"}'

# 3) Ver contexto detectado
curl http://127.0.0.1:4545/sessions/<session-id>/project/context

# 4) Tools de lectura (ALLOW)
curl -X POST http://127.0.0.1:4545/sessions/<session-id>/tools/list_dir \
  -H "content-type: application/json" \
  -d '{"path":"."}'

curl -X POST http://127.0.0.1:4545/sessions/<session-id>/tools/read_file \
  -H "content-type: application/json" \
  -d '{"path":"README.md","maxBytes":12000}'

curl -X POST http://127.0.0.1:4545/sessions/<session-id>/tools/search_text \
  -H "content-type: application/json" \
  -d '{"query":"TODO","path":".","maxResults":20}'
```

Approvals + write/command tools (Sprint 5):

```bash
# write_file crea approval (standard mode => CONFIRM)
curl -X POST http://127.0.0.1:4545/sessions/<session-id>/tools/write_file \
  -H "content-type: application/json" \
  -d '{"path":"tmp/sprint5.txt","content":"hola sprint 5"}'

# run_command_safe crea approval (whitelist cerrada)
curl -X POST http://127.0.0.1:4545/sessions/<session-id>/tools/run_command_safe \
  -H "content-type: application/json" \
  -d '{"command":"git status"}'

# listar approvals
curl http://127.0.0.1:4545/approvals

# aprobar/rechazar
curl -X POST http://127.0.0.1:4545/approvals/<approval-id>/approve
curl -X POST http://127.0.0.1:4545/approvals/<approval-id>/reject
```

Whitelist inicial de `run_command_safe`:

- `git status`
- `npm test`
- `pnpm test`
- `npm run lint`
- `pnpm lint`

TUI approvals:

```bash
pnpm dev:tui -- --approvals
pnpm dev:tui -- --approve <approval-id>
pnpm dev:tui -- --reject <approval-id>
```

Projects + settings + system actions (Sprint 6):

```bash
# proyectos recientes (se actualizan cuando usás /sessions/:id/project/select)
curl http://127.0.0.1:4545/projects

# settings públicas persistidas
curl http://127.0.0.1:4545/settings
curl -X PUT http://127.0.0.1:4545/settings/policy.mode \
  -H "content-type: application/json" \
  -d '{"value":"strict"}'
curl -X PUT http://127.0.0.1:4545/settings/default.provider \
  -H "content-type: application/json" \
  -d '{"value":"mock"}'

# catálogo de system actions
curl http://127.0.0.1:4545/system-actions

# ejecutar action ALLOW (abre URL)
curl -X POST http://127.0.0.1:4545/sessions/<session-id>/system-actions/open_url \
  -H "content-type: application/json" \
  -d '{"payload":{"url":"https://openai.com"}}'

# ejecutar action CONFIRM (open_vscode)
curl -X POST http://127.0.0.1:4545/sessions/<session-id>/system-actions/open_vscode \
  -H "content-type: application/json" \
  -d '{"payload":{"path":"."}}'
curl http://127.0.0.1:4545/approvals
curl -X POST http://127.0.0.1:4545/approvals/<approval-id>/approve
```

TUI Sprint 6:

```bash
pnpm dev:tui -- --projects
pnpm dev:tui -- --settings
pnpm dev:tui -- --set-setting policy.mode '"strict"'
pnpm dev:tui -- --system-actions
pnpm dev:tui -- --latest
pnpm dev:tui -- --resume-latest
```

TUI UX consolidation (fase local):

- Layout real: header + sidebar + main pane + input bar
- Vistas: Home, Session, Projects, Approvals, Settings
- Streaming visible en Session (`assistant-stream`)
- Actividad de tools/eventos visible
- Command bar con slash commands (`/help`)
- Estado visible de daemon / modo / sesión / provider-model / proyecto

Sprint 7 (resume estable + status claro + observabilidad):

```bash
# status enriquecido
curl http://127.0.0.1:4545/status

# latest session (restore rápido)
curl http://127.0.0.1:4545/sessions/latest
curl -X POST http://127.0.0.1:4545/sessions/latest/resume

# stream de eventos SSE (operaciones del daemon)
curl -N http://127.0.0.1:4545/events/stream
# replay desde id:
curl -N "http://127.0.0.1:4545/events/stream?since=10"

# snapshot de delegación multi-agente (Vell orchestrator)
curl http://127.0.0.1:4545/sessions/<session-id>/agents/activity
```

## Seguridad de API local (token)

Si definís `FORGE_DAEMON_TOKEN`, todos los endpoints (excepto `/health`) requieren:

- header `x-forge-token: <token>` **o**
- `Authorization: Bearer <token>`

Ejemplo:

```bash
curl http://127.0.0.1:4545/status -H "x-forge-token: $FORGE_DAEMON_TOKEN"
```

Para clientes:

- TUI: `FORGE_DAEMON_TOKEN=... pnpm dev:tui`
- GUI web/nativa: `VITE_FORGE_DAEMON_TOKEN=... pnpm dev:gui:web` / `pnpm dev:gui`

## Daemon persistente en macOS (launchd)

```bash
pnpm daemon:install:launchd
pnpm daemon:uninstall:launchd
```

Scripts:

- `apps/daemon/scripts/install-launchd-macos.sh`
- `apps/daemon/scripts/uninstall-launchd-macos.sh`

Guía rápida hardening: `docs/local-hardening.md`
