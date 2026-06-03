# Agentes & Camada LLM

**Arquivos:** `tools/agents.js` (os 4 agentes) · `tools/llm.js` (adapters provider-agnostic) · `config/agents.json` (config).

## Backend LLM (provider-agnostic)
`tools/llm.js` traz adapters sem dependências externas (fetch nativo):

| Provider | Endpoint | Uso típico |
|---|---|---|
| `openai` | `{baseUrl}/chat/completions` | CLIProxyAPI (:8317), OpenAI, Together, qualquer compatível |
| `anthropic` | `{baseUrl}/v1/messages` | Claude API direta |
| `ollama` | `{baseUrl}/api/chat` | modelos locais |

## Presets — use qualquer provider
O harness é portável: qualquer provider OpenAI-compatible funciona pelo adapter `openai`. Já vêm prontos em `config/agents.json`:

| Preset | provider | baseUrl |
|---|---|---|
| `cliproxy` | openai | `http://localhost:8317/v1` (suas subs via CLIProxyAPI) |
| `openai` | openai | `https://api.openai.com/v1` |
| `deepseek` | openai | `https://api.deepseek.com/v1` |
| `kimi` | openai | `https://api.moonshot.cn/v1` |
| `glm` | openai | `https://open.bigmodel.cn/api/paas/v4` |
| `minimax` | openai | `https://api.minimaxi.com/v1` |
| `openrouter` | openai | `https://openrouter.ai/api/v1` |
| `groq` | openai | `https://api.groq.com/openai/v1` |
| `together` | openai | `https://api.together.xyz/v1` |
| `anthropic` | anthropic | `https://api.anthropic.com` |
| `ollama` | ollama | `http://localhost:11434` |

## Trocar de provider — duas formas

**A) Por ENV (sem editar arquivo — ideal pra "rodar em qualquer lugar"):**
```bash
export VJP_LLM_PRESET=deepseek
export VJP_LLM_MODEL=deepseek-chat
export VJP_LLM_API_KEY=sk-...
node .harness/tools/bsd.js --check-llm
```
Outro dia, outro provider — só trocar as envs:
```bash
export VJP_LLM_PRESET=kimi      VJP_LLM_MODEL=kimi-k2-0905-preview
export VJP_LLM_PRESET=openrouter VJP_LLM_MODEL=z-ai/glm-4.6
export VJP_LLM_PRESET=ollama    VJP_LLM_MODEL=qwen3:8b   # local, sem key
```

**B) No `config/agents.json`** (fixa por projeto):
```json
"llm": { "preset": "deepseek", "model": "deepseek-chat", "apiKeyEnv": "VJP_LLM_API_KEY" }
```

Precedência: **ENV > preset > bloco `llm`**. Override de modelo por agente em `agents.<id>.model`.

- **Modelo é livre** — fixar é OPCIONAL e só serve pra reproduzir um projeto. Não há provider "default obrigatório".
- **API key sempre por ENV** (nome em `apiKeyEnv`). Nunca commitada.
- `temperature: 0` por padrão (reprodutibilidade).

## Verificar conectividade
```bash
node .harness/tools/bsd.js --check-llm    # valida provider+baseUrl+model+key com um ping
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
