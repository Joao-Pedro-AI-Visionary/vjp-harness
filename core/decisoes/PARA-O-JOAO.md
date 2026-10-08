# Decisões para o João confirmar (v2.0.0)

Cada item já tem um **padrão aplicado** para nada ficar travado. Se você discordar, a mudança é pequena e o lugar está indicado.

| # | Pergunta | Padrão aplicado agora | Onde mudar |
|---|---|---|---|
| 1 | No pedido original você queria que, ao fim dos agentes, o harness **abrisse o PR, fizesse fetch/pull e o merge sozinho**. Quer autorizar isso de forma permanente (por exemplo, só em branch própria com CI verde)? | **Não.** Push, PR e merge só com autorização explícita na sessão, sempre depois do `/prepush` (R8) | `core/30-execucao.md` R8 + `protocolo/fases/fase-10-git-pr.md` |
| 2 | Teto de agentes simultâneos: mantém **2 (3 se só leitura)** com aumento só por medição da Fase 0, ou prefere uma fórmula (ex.: `floor((RAM livre − 2 GB) / 0,6 GB)`)? | 2 / 3, sobe só com medição | `core/30-execucao.md` R1 |
| 3 | Mapeamento tipo de projeto → Dial: protótipo/PoC → 1, MVP → 2, produção → 3 (só sobe). Concorda? | Aplicado | `core/protocolo/00-projeto-novo.md` |
| 4 | `integration-verifier` (subagente) e `fullstack-validate` (skill) tratados como **o mesmo portão** (ponta a ponta). Concorda, ou quer os dois em sequência? | Mesmo portão | `core/30-execucao.md` R4 |
| 5 | `chrome-devtools-mcp` fixado em **1.10.1** (o mais novo no npm em 2026-10-08). Ok? | 1.10.1 | `machine/export/settings.template.json`, `machine/MACHINE.md` §2.5 |
| 6 | Hook de orçamento do Codex **só no projeto** (sem hook global, porque os dois rodariam juntos e gastariam o orçamento duas vezes). Ok? | Só projeto | `template/tools/sync-rules.js` (planProject/planGlobal) |
| 7 | `~/AGENTS.md` (legado v1; o Codex não lê esse caminho): manter atualizado quando já for nosso, ou apagar na migração? | Mantido e atualizado (nada é apagado) | `sync-rules.js` planGlobal; `docs/MIGRACAO-v2.md` |
| 8 | Em projeto com harness, o bundle aparece **duas vezes** (global + `AGENTS.md` do projeto, ~6–7 mil tokens no total). Prefere um bloco **enxuto** no projeto quando o global existir? (Risco: projeto aberto em máquina sem o global fica sem regras.) | Bundle completo nos dois | `sync-rules.js` planProject |
| 9 | O bundle tem ~23,3 KB do limite de 24 KB do Antigravity. Regra nova sempre-ativa vai exigir enxugar outra ou mover para skill. Prefere já reservar folga (ex.: teto de 22 KB)? | Teto 24.000 bytes | `core/manifest.json` → `limits.bundleMaxBytes` |
| 10 | Cursor não tem arquivo global de regras (User Rules só pela interface). Quer colar o bundle nas User Rules à mão, ou basta o `AGENTS.md` por projeto? | Só por projeto | — |
| 11 | **Laya** e **Jev** não aparecem em nenhum lugar do harness nem da máquina inventariada. Ficaram como item a detectar na Fase 0 (detectado / informado / desconhecido) e como uso condicional na Fase 5 ("só com qualidade validada / acesso autorizado"). Onde eles rodam / como detectar? | Detecção opcional | `core/protocolo/fases/fase-00-ambiente.md`, `fase-05-orcamento-ia.md` |
| 12 | Gerar imagens no GPT/Gemini pela sua sessão (Playwright/CDP): permitido só com autorização explícita na sessão e **sem** automatizar login. Ok? | Assim | `core/30-execucao.md` R5, `fase-08-assets-browser.md` |
| 13 | O `.bundle` contém o commit-base (árvore original do `main`), que ainda tem o e-mail e o nome de empresa no histórico. Os commits v2 removem isso. Se quiser histórico sem rastro, é preciso reescrever o histórico do remoto — fica a seu critério | Não reescrito | — |
| 14 | `npm run check` dentro de um **projeto instalado** já falhava na v1 (testes que leem `machine/hooks/` e `VERSION`, que só existem no repo do harness). A v2 mantém esse comportamento — ver o relatório. Quer que esses testes passem a se pular fora do repo? | Não corrigido (pré-existente) | `template/tools/tests/*.test.mjs` |
| 15 | `template/tools/package.json` continua com `version: 1.10.2` (mudar mexeria no `package-lock.json`). Quer alinhar com 2.0.0? | Mantido | `template/tools/package.json` + lock |
