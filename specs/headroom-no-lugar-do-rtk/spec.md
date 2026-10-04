# spec.md — Headroom no lugar do RTK (v1.22.0)

> Gate 1: nada vira código sem esta spec. Origem: pedido do JP em 2026-10-04 ("trocar o rtk pelo headroom no fluxo local e remoto").

## Problema

O papel **Compressor de Contexto** é ocupado pelo RTK (`rtk-ai/rtk` 0.42.4): um hook `PreToolUse` no Bash que reescreve `git status` → `rtk git status` e comprime só a **saída de comandos de shell**. Leitura de arquivo, resultado de MCP, busca e histórico da conversa passam crus.

O Headroom (`headroomlabs-ai/headroom`, PyPI `headroom-ai`, Apache-2.0) ocupa o mesmo papel numa camada acima: um **proxy local** entre o Claude Code e a API que comprime tudo o que o agente lê (tool outputs, logs, JSON, código, histórico), com os originais guardados localmente e recuperáveis (CCR). O próprio Headroom aposentou a integração com rtk (`wrap.py`: "CLI context tools (rtk, lean-ctx) have been removed").

## Decisões

1. **Pacote e pin.** `uv tool install --python 3.13 "headroom-ai[proxy,code]==0.39.1"`. Sem `[ml]`/`[all]`: o extra `ml` puxa o torch (vários GB); o Kompress roda em ONNX (`headroom doctor` → `kompress: ready (onnx)`), então não faz falta.
2. **Modo de uso: `wrap` por sessão, não proxy global.** O atalho `cch` roda `headroom wrap claude --port 8790 --code-memory none`. O `wrap` sobe o proxy, grava `ANTHROPIC_BASE_URL` só no `.claude/settings.local.json` do projeto (com hook `SessionStart` de autorreparo se o proxy morrer) e desfaz ao sair. O `~/.claude/settings.json` global **não** ganha `ANTHROPIC_BASE_URL`: um `claude` puro continua indo direto à API, e o caminho do modelo local (CCR) fica intacto.
3. **Porta 8790.** A 8787 (padrão do Headroom) já está ocupada por um serviço no WSL e, no Windows, o `wslrelay` a repassa: o `/health` responde, mas não é o Headroom (sintoma: `API Error: 405`). Porta fixa 8790 dos dois lados.
4. **`--code-memory none`.** O `wrap` registra o Serena como MCP por padrão. O harness já tem o `codebase-memory-mcp` pela porta `tools/cbm.js` e proíbe MCP global; Serena fica de fora.
5. **Telemetria desligada.** O beacon do Headroom é opt-out e vem **ligado** (`HEADROOM_BEACON`). O harness mexe em código de cliente: `HEADROOM_BEACON=off` no shell (bootstrap grava no `~/.bashrc`; no Windows, variável de usuário).
6. **Sem vendorização.** O RTK era clonado em `.harness/tools/rtk/` (`vendor: true`). O Headroom é pacote PyPI pinado por versão; não há clone no projeto. Sai o `.harness/tools/rtk/` do `.gitignore`; entra `.claude/settings.local.json` (o `wrap` escreve nele).
7. **Sem hook no settings.** Sai o `PreToolUse` `rtk hook claude` do `settings.template.json`. Nada entra no lugar: a compressão acontece no proxy.

## Custo conhecido

Com `ANTHROPIC_BASE_URL` apontando para o proxy, o Claude Code desliga o `/remote-control`. Quem precisar dele abre a sessão com `claude` puro.

## Fora de escopo

`headroom learn` (escreve em `CLAUDE.md`/`CLAUDE.local.md` — decisão separada), memória cross-agent (`--memory`), `HEADROOM_OUTPUT_SHAPER`, orçamento (`--budget`), wrap de Codex/Cursor. Histórico (specs e `upgrades/` antigos) não é reescrito.

## Critérios de aceite

1. `headroom --version` → `0.39.1`; `headroom telemetry` → `Upload beacon: OFF`.
2. Com o proxy na 8790, `claude -p "Responda apenas: ok"` responde `ok` e `headroom doctor --port 8790` mostra `proxy`, `version`, `kompress` e `savings` em pass (medido em 2026-10-04 no Windows: 2.890 tokens economizados numa chamada).
3. `cch -p "..."` funciona e, ao sair, não sobra `ANTHROPIC_BASE_URL` no `~/.claude/settings.json` nem processo escutando na 8790.
4. `registry.json` com o componente `headroom` (pip, 0.39.1) no lugar do `rtk`; `verify.js` reconhece; `npm test` em `template/tools` verde.
5. Nenhuma referência ativa a `rtk` fora de histórico (specs antigas, `upgrades/`, changelog) e da fixture genérica do `mirror.test.mjs`.
