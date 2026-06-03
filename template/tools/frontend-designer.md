# Frontend Designer

**Tier:** skill · **Versão pinada:** `1.55.1.0` (via gstack) · **Origem:** família de skills `design-*` do gstack (`garrytan/gstack`)

## Responsabilidade
UI, UX, responsividade, design system, acessibilidade. Implementado pelas skills do gstack: `design-consultation`, `design-html`, `design-review`, `design-shotgun`, `plan-design-review`.

## Quando usar
Dashboards · landing pages · formulários · apps administrativos · mobile. Alimenta o agente **Researcher** quando há impacto em `web/`, `frontend/` ou `mobile/` (ver `harness.yaml` → `mcp.playwright.trigger_directories`).

## Instalação
Incluído no gstack — sem instalação separada. Garanta o gstack pinado (ver [`gstack.md`](./gstack.md)).

## Verificação
```bash
test -d ~/.claude/skills/design-html && echo OK    # ou via --doctor (type: skill)
```

## Determinismo
Herda o pin do gstack (`c43c850cae77`).
