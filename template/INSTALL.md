# V-JP Harness — Instalação determinística

Montagem reprodutível em qualquer máquina. Cada passo é pinado e verificável.

## 0. Pré-requisitos

| Requisito | Mínimo | Verificar |
|---|---|---|
| Node.js | ≥ 18 | `node --version` |
| git | qualquer | `git --version` (opcional, habilita worktrees) |

## 1. Núcleo determinístico (obrigatório)

Instalado automaticamente pelo `install.sh` na raiz do repo `vjp-harness`:

```bash
cd meu-projeto
bash /caminho/para/vjp-harness/install.sh --name meu-projeto
```

Isso, de forma determinística:
1. Copia o motor para `.harness/` (BSD + configs + registry).
1b. (v2.0.0) Renderiza as regras da fonte única `core/` com `tools/sync-rules.js`: `AGENTS.md` e `CLAUDE.md` (blocos gerenciados), `.harness/core/`, `.agents/rules/`, `.cursor/rules/`, skill `projeto-novo`, `.codex/hooks.json` (orçamento + SessionStart), `.codex/config.toml` (`features.worktrees`) e `.codex/vjp-cli.json`. Drift: `node .harness/tools/sync-rules.js --check`.
1c. Se `claude` estiver no PATH e a versão for >= 2.1.296, instala os plugins oficiais `claude-code-setup` e `receipts` (`claude plugin install …@claude-plugins-official --scope user -y`). Abaixo disso, ou sem rede, o install segue e só avisa.
2. Roda **`npm ci`** em `.harness/tools` (instala Repomix `0.2.14`, GSD Redux `1.1.0`, Postgres MCP `0.6.2`, Playwright MCP `0.0.75` a partir do `package-lock.json` — árvore idêntica byte-a-byte).
3. Faz o scaffold de `.gbrain/` (memória) e `.bsd/` (estado).
4. Roda o **doctor** (`verify.js`) e reporta o determinismo.

> `npm ci` (não `npm install`) é o que garante reprodutibilidade: ele exige o lockfile e falha se houver divergência.

## 2. Componentes opcionais (sob demanda)

Instale só o que o projeto usar. Cada um é pinado — ver [`REGISTRY.md`](./REGISTRY.md).

### Headroom (Compressor de Contexto) — `0.39.1`
Pacote PyPI (org `headroomlabs-ai`), substitui o RTK desde a v1.22.0:
```bash
uv tool install --python 3.13 "headroom-ai[proxy,code]==0.39.1"
export HEADROOM_BEACON=off
headroom wrap claude --port 8790 --code-memory none
```
Verifique: `headroom --version`. Ver [`tools/headroom.md`](./tools/headroom.md).

### GStack — `1.55.1.0` @ `c43c850cae77`
Plataforma operacional (skills + gbrain). Instale o plugin a partir de `garrytan/gstack` **no commit pinado**. Ver [`tools/gstack.md`](./tools/gstack.md).

### GBrain — via gstack
```bash
# dentro do Claude Code, com gstack instalado:
/setup-gbrain
```
Registra o MCP `gbrain`. Ver [`tools/gbrain.md`](./tools/gbrain.md).

### Superpowers — `v5.1.0`
Plugin a partir de `obra/superpowers` (tag `v5.1.0`). Ver [`tools/superpowers.md`](./tools/superpowers.md).

### MCPs (PostgreSQL / Playwright)
Já instalados em `.harness/tools` pelo `npm ci`. Para ativar, mescle [`config/mcp.json`](./config/mcp.json) no `~/.claude/settings.json` (ou `.mcp.json` do projeto) e ajuste a connection string. Ver [`tools/postgres-mcp.md`](./tools/postgres-mcp.md) e [`tools/playwright-mcp.md`](./tools/playwright-mcp.md).

## 3. Verificação final

```bash
node .harness/tools/bsd.js --doctor
```

- `[req]` em vermelho → montagem **não-determinística**, corrija antes de operar.
- `[opt]` ausente → ok, instale quando precisar.

Para CI:
```bash
node .harness/tools/verify.js --json   # exit 1 se algum obrigatório falhar
```
