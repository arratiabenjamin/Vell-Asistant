# Hardening local (MVP)

## 1) API token local

Si querés proteger el daemon en localhost:

```bash
export FORGE_DAEMON_TOKEN="token-largo-local"
pnpm dev:daemon
```

Todos los endpoints excepto `/health` van a requerir:

- `x-forge-token: <token>`
- o `Authorization: Bearer <token>`

## 2) Smoke test de daemon

Con daemon corriendo:

```bash
pnpm smoke:daemon
```

Valida:

- `/health`
- `/status`
- create session
- prompt mock
- select project
- tool `list_dir`

## 3) Daemon persistente (launchd en macOS)

Instalar:

```bash
pnpm daemon:install:launchd
```

Desinstalar:

```bash
pnpm daemon:uninstall:launchd
```

Logs:

- `tmp/forge-daemon.launchd.out.log`
- `tmp/forge-daemon.launchd.err.log`
