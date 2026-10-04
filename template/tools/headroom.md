# Headroom — Compressor de Contexto

**Tier:** core · **Versão pinada:** `0.39.1` · **Origem:** PyPI `headroom-ai[proxy,code]` (https://github.com/headroomlabs-ai/headroom, Apache-2.0) · **Destino:** runtime (`~/.local/bin/headroom` via `uv tool`) · **Substitui:** RTK (até v1.21.1)

## Responsabilidade
Proxy local entre o agente e a API do modelo. Comprime tudo o que o agente lê antes de sair da máquina — saída de ferramentas, logs, JSON, código e histórico — e guarda os originais localmente (CCR), recuperáveis sob demanda. Nenhum conteúdo é enviado a terceiros para ser comprimido.

O RTK comprimia só a saída de comandos de shell, via hook `PreToolUse` no Bash. O Headroom pega toda a janela, sem hook.

## Papel no pipeline
`Repomix → Headroom → GSD Redux`. Recebe o pacote bruto do Repomix (e todo o resto que o agente lê) e entrega contexto enxuto para o planejamento.

## Instalação
```bash
uv tool install --python 3.13 "headroom-ai[proxy,code]==0.39.1"
export HEADROOM_BEACON=off   # telemetria é opt-out e vem ligada
```
Sem `[ml]`/`[all]`: esses extras puxam o torch (vários GB). O Kompress roda em ONNX e o doctor mostra `kompress: ready (onnx)`.

## Uso
```bash
headroom wrap claude --port 8790 --code-memory none   # atalho: cch
headroom savings                                      # economia acumulada
headroom doctor --port 8790                           # com uma sessão aberta
```
- **Por sessão, não global.** O `wrap` sobe o proxy, grava `ANTHROPIC_BASE_URL` só no `.claude/settings.local.json` do projeto (com hook `SessionStart` de autorreparo) e desfaz ao sair. `claude` puro continua indo direto à API.
- **Porta 8790.** A 8787 (padrão) colide com um serviço do WSL, que o `wslrelay` repassa ao Windows: o `/health` responde, mas não é o Headroom (sintoma: `API Error: 405`).
- **`--code-memory none`.** Sem isso o `wrap` registra o Serena como MCP. O harness já tem o grafo de código pela porta `tools/cbm.js`.
- Com o proxy ativo o Claude Code desliga o `/remote-control`. Precisou dele: `claude` puro.

## Verificação
```bash
headroom --version      # deve conter: 0.39.1
headroom telemetry      # Upload beacon: OFF
```

## Determinismo
Pin por versão (`==0.39.1`) + verificação por comando. Origem externa (`headroomlabs-ai`) → atualize o pin em `registry.json` ao trocar de versão. Não é vendorizado: é pacote PyPI, espelhável por `tools/mirror.js`.
