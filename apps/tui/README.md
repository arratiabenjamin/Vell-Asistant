# @forge/tui

TUI principal (terminal-first) para operación diaria.

Navegación:

- `1..5`: cambia entre Home / Session / Projects / Approvals / Settings
- `Tab`: siguiente vista
- `Esc`: limpia input
- `Enter`: ejecuta input
- `Ctrl+C`: salir

Comandos slash:

- `/help`
- `/new [title]`
- `/use <sessionId|prefix>`
- `/resume-latest`
- `/project <absolute-path>`
- `/approve <approvalId|prefix>`
- `/reject <approvalId|prefix>`
- `/set <key> <json>`
- `/tool list_dir [path]`
- `/tool read_file <path> [maxBytes]`
- `/tool search_text <query> [path]`
- `/tool write_file <path> <content>`
- `/tool run <whitelisted command>`
- `/action <name> [jsonPayload]`

Flags útiles:

- `--new`
- `--session <id>`
- `--latest`
- `--resume-latest`
- `--approvals`
- `--approve <approval-id>`
- `--reject <approval-id>`
- `--projects`
- `--settings`
- `--set-setting <key> <json>`
- `--system-actions`
