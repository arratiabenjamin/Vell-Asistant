# GUI macOS nativa (Tauri) — Checklist completo

Objetivo: validar que `apps/gui-mac` corre como app nativa en macOS, conectada al daemon existente.

## 0) Prerrequisitos base

- [ ] macOS (`uname -s` = `Darwin`)
- [ ] Xcode Command Line Tools instaladas
- [ ] Node + pnpm instalados
- [ ] Dependencias del monorepo instaladas (`pnpm install`)

## 1) Toolchain Rust (bloqueante)

- [ ] `rustc --version`
- [ ] `cargo --version`
- [ ] `rustup --version` (recomendado)

Instalación guiada:

```bash
pnpm setup:gui:rust
```

## 2) Doctor rápido del entorno

```bash
pnpm doctor:gui
```

Esperado:
- `blockers: 0`
- Mensaje final: `Listo para correr GUI nativa con: pnpm dev:gui`

## 3) Runtime web + daemon (sanity)

Terminal 1:

```bash
pnpm dev:daemon
```

Terminal 2:

```bash
pnpm dev:gui:web
```

Checks:
- [ ] Dashboard muestra daemon online
- [ ] Current Session envía prompt y recibe streaming
- [ ] Approvals lista/aprueba/rechaza
- [ ] Projects abre proyecto en sesión actual o nueva
- [ ] Settings actualiza `policy.mode` y `default.provider`

Si el puerto 1420 está ocupado:

```bash
lsof -nP -iTCP:1420 -sTCP:LISTEN
kill <PID>
```

## 4) Runtime nativo Tauri

Con daemon corriendo:

```bash
pnpm dev:gui
```

Checks:
- [ ] abre ventana nativa
- [ ] consume daemon real (no mock interno)
- [ ] no hay crash al enviar prompt
- [ ] cambios de sesión/proyecto se reflejan en UI

Nota: el toolchain ahora prepara `dist/index.html` placeholder automáticamente para que Tauri compile en modo dev aunque todavía no hayas corrido build web.

## 5) Build nativo (siguiente nivel)

```bash
pnpm --filter @forge/gui-mac build:web
pnpm --filter @forge/gui-mac exec tauri build
```

Checks:
- [ ] build completa sin errores
- [ ] bundle generado en `src-tauri/target` (local)

## 6) Pendientes para distribución productiva

- [ ] firma de app (Apple Developer)
- [ ] notarización
- [x] metadatos de bundle macOS versionados en `apps/gui-mac/src-tauri/tauri.conf.json` + `apps/gui-mac/src-tauri/tauri.macos.conf.json`
- [x] smoke final para Mac limpia: `pnpm smoke:gui:mac-clean`
- [ ] secretos Apple cargados en GitHub Actions para `gui-native-release-macos`

## 7) CI nativo (GitHub Actions)

Workflow: `.github/workflows/gui-native-macos.yml`

- Job `preflight-native` (push/PR):
  - install deps
  - rust toolchain
  - `pnpm doctor:gui`
  - `pnpm preflight:gui:native`
  - `cargo check` en `src-tauri`
- Job `debug-build-dry-run` (manual `workflow_dispatch`):
  - build web
  - `tauri build --debug --no-bundle --ci`

## 8) Release artifact nativo (unsigned)

Workflow manual: `.github/workflows/gui-native-release-macos.yml`

- construye bundle nativo macOS en perfil `release` o `debug`
- sube artifacts de `target/*/bundle/**`
- soporta `sign=false|true` y `notarize=false|true`
- si activás `sign` o `notarize`, falla temprano si faltan secretos Apple

Secretos esperados por el workflow:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_API_KEY`
- `APPLE_API_ISSUER`
- `APPLE_API_KEY_B64`
