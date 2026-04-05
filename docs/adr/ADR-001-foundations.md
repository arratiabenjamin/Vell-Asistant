# ADR-001: Fundaciones de arquitectura (Forge MVP)

## Estado
Aceptada.

## Decisiones

1) **TypeScript monorepo** para contratos tipados entre daemon/engine/tui.
2) **Separación daemon + engine + TUI** para embebibilidad y mantenibilidad.
3) **SQLite local-first** para sesiones, mensajes y approvals en MVP.
4) **Security-by-capabilities** para evitar shell libre y acceso arbitrario.
