# GUI macOS QA checklist — Fase 7/8

Checklist manual corto para validar la GUI local antes de mergear cambios de UX/voz/multi-agente.

## 1) Provider y sesiones

- [ ] Abrir `Current Session`
- [ ] Confirmar que la sesión activa **no** esté en `mock`
- [ ] Si está en `mock`, aparece un warning visible
- [ ] Usar **Crear sesión real**
- [ ] Verificar que la nueva sesión use `openai-chatgpt` o el provider default no-mock

## 2) Conversación y scroll

- [ ] Enviar 3+ prompts seguidos
- [ ] Ver que el panel de conversación siga creciendo
- [ ] Confirmar auto-scroll al final
- [ ] Verificar que no se “pierdan” mensajes nuevos debajo del fold
- [ ] Confirmar que streaming queda visible mientras el assistant responde

## 3) Multi-agente supervisado por Vell

- [ ] Enviar un prompt largo o con señales de delegación
- [ ] Ver aparecer `Agent Activity`
- [ ] Confirmar al menos un subagente en estado visible
- [ ] Ver timeline/feed de eventos `agent.*`
- [ ] Confirmar que el resumen final de Vell consolida resultados

## 4) Voz local

- [ ] Mantener apretado **Push to talk**
- [ ] Ver estados: `listening → transcribing → sending`
- [ ] Soltar el botón y confirmar que el transcript se envía como prompt
- [ ] Si falta `SpeechRecognition`, ver fallback claro
- [ ] Si aparece `service-not-allowed` o `not-allowed`, ver hint de permisos macOS

## 5) TTS

- [ ] Con una respuesta visible, apretar **Leer respuesta**
- [ ] Confirmar que la app entra en `speaking`
- [ ] Confirmar que se puede cancelar con **Stop reading**
- [ ] Si no hay soporte, ver fallback claro por texto

## 6) Health básico

- [ ] `pnpm -s typecheck`
- [ ] `pnpm -s smoke:gui:mac-clean`
- [ ] `pnpm --filter @forge/gui-mac doctor:mac`

## 7) Criterio de cierre

No mergear si falla cualquiera de estos puntos:

- provider real no visible o confundible con mock
- voz sin hint útil ante permiso denegado
- conversación sin auto-scroll o con clipping
- multi-agente sin feed visible
- TTS sin fallback claro
