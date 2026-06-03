# Frontend Designer

**Tier:** skill · **Versão pinada:** `main` · **Origem:** git `anthropics/skills` (`frontend-design`, https://github.com/anthropics/skills) · **Destino:** `.harness/tools/frontend-designer.md`

## Responsabilidade
UI, UX, responsividade, design system, acessibilidade. Spec/skill `frontend-design` do repositório `anthropics/skills`.

## Quando usar
Dashboards · landing pages · formulários · apps administrativos · mobile. Alimenta o agente **Researcher** quando há impacto em `web/`, `frontend/` ou `mobile/` (ver `harness.yaml` → `mcp.playwright.trigger_directories`).

## Instalação
Skill/Spec de `anthropics/skills` (caminho `frontend-design`). A spec é vendorizada como este próprio doc em `.harness/tools/frontend-designer.md`.

## Verificação
```bash
test -f .harness/tools/frontend-designer.md && echo OK    # via --doctor (type: file)
```

## Determinismo
Pinado ao ref do `anthropics/skills`. Atualize ao sincronizar a spec.
