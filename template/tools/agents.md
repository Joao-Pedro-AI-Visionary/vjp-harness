# Agentes & Camada LLM

**Arquivos:** `tools/agents.js` (os 4 agentes) · `tools/llm.js` (adapters provider-agnostic) · `config/agents.json` (config).

## Backend LLM (provider-agnostic)
`tools/llm.js` traz adapters sem dependências externas (fetch nativo):

| Provider | Endpoint | Uso típico |
|---|---|---|
| `openai` | `{baseUrl}/chat/completions` | CLIProxyAPI (:8317), OpenAI, Together, qualquer compatível |
| `anthropic` | `{baseUrl}/v1/messages` | Claude API direta |
| `ollama` | `{baseUrl}/api/chat` | modelos locais |

## Configuração — `config/agents.json`
```json
{
  "llm": {
    "provider": "openai",
    "baseUrl": "http://localhost:8317/v1",
    "model": "REPLACE_WITH_PINNED_MODEL",
    "apiKeyEnv": "VJP_LLM_API_KEY",
    "temperature": 0,
    "maxTokens": 4096,
    "timeoutMs": 180000
  },
  "agents": { "planner": {"model": null}, "researcher": {"model": null}, "executor": {"model": null}, "reviewer": {"model": null} },
  "pipeline": { "maxRetries": 2, "testCommand": "npm test", "autoMerge": true }
}
```

- **Pine `llm.model`** — modelo fixo = determinismo. Override por agente em `agents.<id>.model`.
- **API key vem da env** nomeada em `apiKeyEnv` (ex: `export VJP_LLM_API_KEY=...`). Nunca commite a key.
- `temperature: 0` para reprodutibilidade.

## Verificar conectividade
```bash
node .harness/tools/bsd.js --check-llm    # valida provider+model+key com um ping
```

## Fluxo dos agentes
```
PLANNER ─ risco/estratégia ─▶ RESEARCHER ─ arquivos impactados ─▶
  ┌─ EXECUTOR escreve files+tests na worktree, commita
  │  testes (pipeline.testCommand)
  └─ REVIEWER aprova? ── não ──▶ retry com feedback (até maxRetries)
                         └─ sim ─▶ git merge --no-ff na principal
```

Cada agente recebe `AGENT_RULES.md` + `.gbrain/*.md` como contexto. O EXECUTOR **não recebe shell** — só devolve conteúdo de arquivos, aplicados com proteção contra path traversal.

## Segurança
- Escritas restritas à git worktree isolada; merge só após testes verdes.
- `--dry-run` exercita toda a mecânica (worktree→commit→test→merge) sem chamar o LLM.
- `autoMerge: false` mantém as mudanças na branch `bsd-feature-<x>` para revisão manual.
