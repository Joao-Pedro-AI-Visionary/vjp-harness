# spec.md — Mapa de Código ligado aos portões (v1.21.0)

> Gate 1: nada vira código sem esta spec. Origem: pergunta do JP em 2026-09-04 ("como o codebase-memory-mcp se adequa no meu harness?") e a restrição que ele impôs em seguida: **ter o melhor sem sacrificar contexto com chamadas demais**.

## Problema

O `codebase-memory-mcp` está pinado desde a v1.7.0 (0.8.1) e documentado como "reforço do Pesquisador", mas **nenhum portão o chama**: `pr-review` abre vizinhos do diff por adivinhação (§2.3), `test-gate` identifica símbolos mudados lendo arquivos (§5.1) e a camada 5 do `prepush` só sabe dizer "arquivo sem teste vizinho". Na camada interativa ele nunca foi registrado como MCP (nem global, nem por projeto). Upstream está em 0.10.8 com modo `cli` (um tool por processo, sem servidor).

## Decisões

1. **Porta, não MCP.** Uma porta `tools/cbm.js` chama o binário em modo `cli`. Zero tool no contexto do modelo; só o texto da resposta entra. O MCP fica opcional e em escopo **local** do projeto (`claude mcp add -s local`), nunca global.
2. **Orçamento fixo.** `impact` com profundidade 2 e 3 linhas por símbolo (~300 tokens medidos no Partner-Web-Backend, 5.252 nós). Até 3 chamadas por review/gate. Sem `semantic_query`. Os limites vivem em `LIMITS` e mudá-los é ADR.
3. **Três pontos de encaixe, e só três.** `pr-review` §2 (antes de abrir vizinho), `test-gate` §5 passo 1 (quais símbolos e quais specs já os cobrem), `prepush` camada 5 (raio de impacto no relatório do gate, informativo). Fora do GSD, fora do BSD headless.
4. **Nunca bloqueia.** Binário ausente → código 3, uma linha, o fluxo segue. Erro do grafo → código 2, idem. O grafo é pista, não sinal concreto (§2: merge exige teste verde).
5. **Bump do pin** 0.8.1 → 0.10.8 (lockfile regenerado). UI (porta 9749) e watcher desligados por config persistida. `install.sh` ignora `.codebase-memory/` e registra o MCP local se o CLI `claude` existir.
6. **"Sem chamadores" não é prova** em NestJS (injeção de dependência pode não resolver). Escrito na doc e nos skills.

## Fora de escopo

`manage_adr` (o `.gbrain/decisions.md` continua fonte única), `ingest_traces`, cross-repo, UI 3D, daemon persistente, `semantic_query`, BSD headless como cliente.

## Critérios de aceite

1. `node .harness/tools/cbm.js impact` num repo indexado imprime `changed_files`, `seed_symbols`, `impacted` e `impacted_modules` em menos de 2 KB.
2. Sem binário: `cbm.js` sai com 3 e uma linha; `gate.sh` camada 5 continua `ok|aviso` como antes.
3. `tests/cbm.test.mjs` verde (partes puras: caminho, projeto, args, parse da saída, base).
4. `registry.json` 1.21.0 com `codebase-memory-mcp@0.10.8` e componente `cbm`; `REGISTRY.md`, `harness.yaml`, `VERSION`, cabeçalho do `AGENT_RULES.md` em 1.21.0.
5. Skills `pr-review`, `test-gate`, `prepush` (+ `gate.sh`) citam a porta com o orçamento; instalados em `~/.claude/skills` no Windows e no WSL.
