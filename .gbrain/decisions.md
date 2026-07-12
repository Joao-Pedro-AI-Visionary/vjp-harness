# 🧠 Decisions — Decisões Arquiteturais (GBrain · V-JP)

> O coração do método V-JP: toda escolha estrutural gravada com **alternativa descartada + porquê**.
> Entradas abaixo podem ser geradas por `tools/gbrain-decision.js` (append idempotente).

## 2026-06-28 — Achado 1 — Rejeitar agentmemory (rohitg00) como componente; resolver a captura de decisão com helper NATIVO no GBrain
- **Decisão:** Achado 1 — Rejeitar agentmemory (rohitg00) como componente; resolver a captura de decisão com helper NATIVO no GBrain
- **Alternativa descartada:** Vendorizar agentmemory como core, ou adotá-lo como MCP opcional da camada interativa
- **Porquê:** Instável (hotfix quase diário, v0.9.26 quebrada), token-burn reaberto (issue #143), benchmark 95,2% auto-reportado, MCP de 53 tools é não-determinístico (fere a tese do harness) e nem alcança o BSD headless. O helper nativo (gbrain-decision.js) resolve a dor real, é determinístico, zero dep e alimenta o GBrain que o BSD lê.
## 2026-06-28 — Achado 2 — Adotar codebase-memory-mcp v0.8.1 como MCP interativo, complementando Repomix+RTK
- **Decisão:** Achado 2 — Adotar codebase-memory-mcp v0.8.1 como MCP interativo, complementando Repomix+RTK
- **Alternativa descartada:** Substituir Repomix+RTK por ele, ou rejeitar para manter enxuto
- **Porquê:** Cobre TS e C# com resolução semântica real; faz query cirúrgica de impacto (diff→símbolos, dead code, call graph). Propósito diferente de Repomix+RTK (visão do todo), então complementa. MIT, pinável via npm ci. Substituir seria perda; o BSD headless não fala MCP, então fica na camada interativa.
## 2026-06-28 — Achado 3 — Manter o scheduling do BSD (já determinístico); importar do Bernstein só o gate por sinal concreto
- **Decisão:** Achado 3 — Manter o scheduling do BSD (já determinístico); importar do Bernstein só o gate por sinal concreto
- **Alternativa descartada:** Refatorar BSD para FSM com transition table + audit chain HMAC ao estilo Bernstein
- **Porquê:** O scheduling do BSD já é 100% determinístico (ordem hardcoded em bsd.js; LLM só gera conteúdo, nunca ordena). DAG/topo-sort/paralelismo do Bernstein não se aplica a pipeline linear de 1 feature. Importado o padrão barato: merge exige 'testes verdes E aprovado' (sinal concreto > juízo do LLM). FSM/audit assinado = nota de futuro.
## 2026-06-28 — Manutenção — Substituir server-postgres (vulnerável) por Postgres MCP Pro crystaldba v0.3.0 + gate Prisma
- **Decisão:** Manutenção — Substituir server-postgres (vulnerável) por Postgres MCP Pro crystaldba v0.3.0 + gate Prisma
- **Alternativa descartada:** Validar migration só via prisma migrate diff/validate (sem MCP), ou usar Supabase MCP (item 97 do briefing)
- **Porquê:** server-postgres tem SQL injection e foi arquivado. crystaldba é Postgres puro (Prisma/EC2), seguro (modo restricted), com EXPLAIN cost model + índice hipotético HypoPG (útil ao índice parcial pendente). Supabase NÃO é a stack principal (item 97 é erro de digitação, confirmado pelo usuário). Mantém prisma diff/validate como gate barato. Ressalva: crystaldba desacelerou (release v0.3.0 mai/2025) — candidato a fork.
## 2026-06-28 — Manutenção v1.7.1 — Bumpar pin do RTK 0.42.3 → 0.42.4
- **Decisão:** Manutenção v1.7.1 — Bumpar pin do RTK 0.42.3 → 0.42.4
- **Alternativa descartada:** Manter 0.42.3 e fazer downgrade do binário global da máquina para casar o pin
- **Porquê:** O binário global já roda 0.42.4 (release legítima, tag v0.42.4 @ 8a7dd7e5570d). Alinhar o pin ao que de fato roda elimina o drift do doctor sem downgrade. Determinismo preservado: tag+commit pinados.
## 2026-06-28 — Validação v1.7.2 — Postgres MCP Pro (crystaldba) confirmado AO VIVO (EXPLAIN + HypoPG via Docker)
- **Decisão:** Validação v1.7.2 — Postgres MCP Pro (crystaldba) confirmado AO VIVO (EXPLAIN + HypoPG via Docker)
- **Alternativa descartada:** Fechar o item só com a documentação, sem teste contra banco real
- **Porquê:** Briefing exigia confirmar o EXPLAIN antes de fechar. Sem uvx na máquina, usei Docker+Colima contra Postgres 16 efêmero (100k linhas) e dirigi o MCP por cliente stdio: explain_query baseline=Seq Scan 2281; com hypothetical_indexes=Index Scan 241; analyze_query_indexes=2281→8.1 (283x). Regra 7 provada de ponta a ponta; pendência fechada.
## 2026-06-28 — Bugfix v1.7.3 — verify do Postgres MCP Pro usava flag --version inexistente
- **Decisão:** Bugfix v1.7.3 — verify do Postgres MCP Pro usava flag --version inexistente
- **Alternativa descartada:** Manter --version e aceitar o ✗ permanente no doctor como 'precisa de uvx'
- **Porquê:** Validação /goal (cenário ruim) revelou que postgres-mcp não tem --version → verify sempre falhava mesmo com uvx. Troquei p/ 'uvx postgres-mcp==0.3.0 --help' (exit 0, contém 'access-mode'); o pin ==0.3.0 garante a versão. Agora o doctor fica 11/11 com uv instalado.
## 2026-06-28 — v1.8.0 Sug.4 — Auto-testes do harness com node:test (built-in)
- **Decisão:** v1.8.0 Sug.4 — Auto-testes do harness com node:test (built-in)
- **Alternativa descartada:** Continuar sem testes próprios, ou usar framework externo (jest/vitest)
- **Porquê:** Era hipocrisia cobrar testes dos outros e não ter. node:test é built-in (zero dep, combina com o enxuto/determinismo). Cobre mergeGate, evaluateRegistry, gbrain-decision, applyFiles, buildContext. 23 testes verdes.
## 2026-06-28 — v1.8.0 Sug.5 — Teste de regressão do merge gate (claim central do BSD)
- **Decisão:** v1.8.0 Sug.5 — Teste de regressão do merge gate (claim central do BSD)
- **Alternativa descartada:** Deixar a afirmação 'teste verde manda, LLM não sobrepõe' só na documentação
- **Porquê:** Extraí o gate p/ função pura mergeGate(testPassed,reviewApproved) e testei o caminho LLM-aprova+teste-falha→NÃO-merge. Afirmação central agora é fato testado, não fé.
## 2026-06-28 — v1.8.0 Sug.6 — CI GitHub Actions (doctor.yml), AJUSTADA p/ não-strict
- **Decisão:** v1.8.0 Sug.6 — CI GitHub Actions (doctor.yml), AJUSTADA p/ não-strict
- **Alternativa descartada:** Rodar 'doctor --strict' na CI como sugerido
- **Porquê:** --strict falharia SEMPRE no runner (opcionais rtk/uvx/skills/vendor ausentes). CI correta: npm ci → npm test (node:test) → verify.js não-strict (só obrigatórios). 'saída p/ CI' deixa de ser boilerplate morto.
## 2026-06-28 — v1.8.0 Sug.7 — REJEITADA: migrar .gbrain PGLite → node:sqlite
- **Decisão:** v1.8.0 Sug.7 — REJEITADA: migrar .gbrain PGLite → node:sqlite
- **Alternativa descartada:** Trocar a memória para node:sqlite nativo
- **Porquê:** Equívoco: PGLite NÃO é dependência do harness — está dentro do gbrain engine vendorizado (pinado, opcional) e só carrega no /setup-gbrain. O que o BSD lê é .gbrain/*.md (texto, versionável/diffável); SQLite pioraria isso. Trocar = forkar componente de terceiro pinado. node:sqlite fica como nota de futuro se um dia construir store próprio.
## 2026-06-28 — v1.8.0 Sug.12 — Exemplo real no README (honesto, sem métrica inventada)
- **Decisão:** v1.8.0 Sug.12 — Exemplo real no README (honesto, sem métrica inventada)
- **Alternativa descartada:** Inventar números do tipo 'feature X em N min com Y% menos refatoração'
- **Porquê:** Não tenho medição; fabricar seria desonesto. Uso o próprio self-upgrade v1.7.x como caso real verificável no git (worktree→spec→prova viva→decisões; crystaldba validado ao vivo; instalado em 6 projetos).
## 2026-06-28 — v1.9.0 — Nomes por papel (estratégia B): superfície descritiva, procedência entre parênteses
- **Decisão:** v1.9.0 — Nomes por papel (estratégia B): superfície descritiva, procedência entre parênteses
- **Alternativa descartada:** A) só apresentação; C) white-label total escondendo nomes externos; ou renomear CLI/arquivos (bsd.js→orquestrador.js)
- **Porquê:** Nomes como GBrain/GStack/BSD/RTK não comunicam função a quem chega de fora. Estratégia B: superfície 100% por papel (Orquestrador, Compressor de Contexto, Memória Persistente...), com o projeto de origem como PROCEDÊNCIA entre parênteses — atribuição honesta (licença MIT/Apache) + determinismo auditável. Renomear o que é meu (GStack→Núcleo, BSD→Orquestrador display). CLI/IDs/arquivos ESTÁVEIS (zero quebra). White-label total rejeitado: esconder dep externa fere licença e a própria tese de transparência.
## 2026-06-28 — v1.9.1 — Orquestrador renomeado para 'Maestro' (escolha do usuário)
- **Decisão:** v1.9.1 — Orquestrador renomeado para 'Maestro' (escolha do usuário)
- **Alternativa descartada:** Manter 'Orquestrador' puro, ou outra marca (Forja/Bússola)
- **Porquê:** Usuário escolheu 'Maestro' — boa metáfora (rege a orquestra dos 4 agentes) e dá identidade. Nome do registry mantém 'Maestro — Orquestrador (BSD)' p/ leitura de fora; BSD/bsd.js inalterados.
## 2026-06-28 — v1.10.0 — Especialistas Front/Back/DB + Contrato-primeiro + Verificação E2E + NFR (Nível 3)
- **Decisão:** v1.10.0 — Especialistas Front/Back/DB + Contrato-primeiro + Verificação E2E + NFR (Nível 3)
- **Alternativa descartada:** Manter 1 executor genérico; ou só verificador E2E (Nível 1); ou só especialistas builders sem contrato/verificação
- **Porquê:** Dor recorrente: back 'pronto' mas front quebra/não persiste/pesado/sem fila. Causa: nenhuma verificação do fluxo real front→API→DB nem decisão de NFR. Solução Nível 3: contrato-primeiro (fonte da verdade Back↔Front), executores especialistas por camada (backend/db/frontend) cientes do contrato+NFR, subagentes interativos (.claude/agents/) que usam Playwright+Postgres MCP p/ verificar fluxo e PERSISTÊNCIA reais, e Planejador de NFR que decide fila/async no início. Headless ganha passos NFR+Contrato; helpers puros (nfrSummary/contractGaps) testados. CLI/IDs estáveis.
## 2026-06-28 — v1.10.1 — CI manual + checagem local (npm run check) + CLAUDE.md aponta p/ AGENT_RULES
- **Decisão:** v1.10.1 — CI manual + checagem local (npm run check) + CLAUDE.md aponta p/ AGENT_RULES
- **Alternativa descartada:** Manter CI auto em push (falhava startup em repo privado sem minutos); ou copiar AGENT_RULES inteiro no CLAUDE.md
- **Porquê:** CI dava startup_failure em todo push: repo PRIVADO sem minutos de Actions (YAML válido). Tornei o workflow manual (workflow_dispatch) e adicionei 'npm run check' (node:test + verify) p/ gate local grátis. CLAUDE.md NÃO duplica regras: install injeta bloco gerenciado (marcadores idempotentes) apontando p/ .harness/AGENT_RULES.md — fonte única, sem drift. Bloco global curto em ~/.claude/CLAUDE.md (separado, fora do repo).
## 2026-07-03 — v1.10.2 — Hono + Drizzle + Zod como stack alternativa (alinhamento com Manifesto Dev Solo)
- **Decisão:** v1.10.2 — Hono + Drizzle + Zod como stack alternativa (alinhamento com Manifesto Dev Solo)
- **Alternativa descartada:** (A) Substituir NestJS+Prisma globalmente; (B) Manter só NestJS+Prisma, ignorar Manifesto
- **Porquê:** Stack Tier 0 sugerida no Manifesto (Bun+Hono+Drizzle) tem cold start 10x menor (0.5ms vs 50ms), 10x mais req/s no mesmo CPU, custo Cloudflare Workers $0.50/M req vs Vercel+Railway $5+/mês. Drizzle é mais type-safe que Prisma (compile-time SQL). Hono/Drizzle/Zod são MIT ativos, sem dependência de framework opinionado. Adoção como OPCIONAL (não substituição) preserva os 6 projetos instalados em NestJS+Prisma e dá hedge: libs de domínio (auth, payments) podem ser Drizzle+TS puro, compartilháveis entre stacks. Constitution Article I (Library-First) e VII (YAGNI/Simplicity) continuam válidos. Validação: 2 features piloto em 60 dias; se OK, homologar como Tier 1.
## 2026-07-03 — v1.10.2 (security) — npm audit: 4 vulnerabilidades HIGH → 0 via repomix 0.2.14→1.16.0 + overrides hono ^4.12.25 + ws ^8.21.0
- **Decisão:** v1.10.2 (security) — npm audit: 4 vulnerabilidades HIGH → 0 via repomix 0.2.14→1.16.0 + overrides hono ^4.12.25 + ws ^8.21.0
- **Alternativa descartada:** (A) Manter deps antigas com 4 HIGH; (B) Dropar GSD Redux agora pra eliminar transitivas hono/ws (refactor arquitetural); (C) Trocar repomix por outro empacotador
- **Porquê:** npm audit reportou 4 HIGH no lockfile da v1.10.1: (1) repomix 0.2.14 (RCE via --remote-branch + secret scanning bypass), (2) hono 4.12.23 (5 CVEs combinadas — path traversal, CORS reflection, body-limit bypass, etc), (3) ws 8.20.1 (DoS memory exhaustion). hono e ws são transitivas do @opengsd/get-shit-done-redux (descontinuado, status quo). Repomix é dep direta sob meu controle. Estratégia escolhida: (1) bump repomix 0.2.14→1.16.0 (binário idêntico ./bin/repomix.cjs, sem impacto nas chamadas do harness que só usa CLI com --config); (2) npm overrides para forçar hono ^4.12.25 e ws ^8.21.0 (este último SEM fix upstream declarado pelo audit, mas 8.21.0 lançado 2026-05-22 mitiga a range vulnerável 8.0.0-8.20.1). Resultado: 0 vulnerabilidades, 37/37 testes verdes, doctor 10/12 OK (mesmo baseline). GSD Redux descontinuado vira nota de futuro (v1.11.0 ou v2.0.0: avaliar drop e reescrever pipeline com planejador próprio).
## 2026-07-07 — v1.10.3 — bsd.js passa a ler spec.md/tasks.md de verdade (fecha o gap do Princípio #2)
- **Decisão:** `--execute <feature>` agora procura `.planning/phases/<feature>/` ou `specs/<feature>/`;
  se achar `tasks.md`, executa task por task (Planner→NFR→Contrato→Researcher→Executor/testes/Reviewer
  por task), injeta `spec.md` como contexto nos agentes, e marca `[x]` em `tasks.md` no disco conforme
  cada task é aprovada. Sem esses arquivos, cai no modo autônomo de sempre — 100% retrocompatível.
- **Alternativa descartada:** Tornar spec.md/tasks.md obrigatórios (bloquear o modo autônomo) — rejeitada
  por quebrar todo projeto já usando `--execute` sem specs escritas hoje (regressão inaceitável numa
  ferramenta vendorizada em 6+ projetos).
- **Porquê:** Achado ao usar o harness no monoRepo (roadmap CoverPay+Partners): `--execute` nunca leu
  arquivo nenhum — o LLM inventava o plano do zero a cada chamada, contradizendo o Princípio #2 do
  próprio AGENT_RULES.md ("código só a partir de spec.md/tasks.md") e o mermaid que o próprio
  `updateStateMarkdown` já gerava ("Task lida do tasks.md", nunca verdadeiro). Efeito colateral bom:
  `--continue` agora resume de verdade pelas tasks ainda não marcadas `[x]`, em vez de reprocessar tudo
  do zero. Ver `specs/bsd-spec-driven-fix/spec.md` e `tests/spec-tasks.test.mjs` (TDD: RED confirmado
  antes da implementação).
- **Bug lateral achado e corrigido no caminho:** o guard `isMain` (só roda `main()` quando o arquivo é
  executado diretamente, não importado por teste) usava `path.resolve` puro — não resolve symlinks.
  Em diretórios com symlink no caminho (ex.: `/var/folders/...` no macOS, symlink pra
  `/private/var/folders/...`), invocar `bsd.js` por caminho ABSOLUTO fazia a comparação falhar
  silenciosamente: `main()` nunca rodava, script saía com exit 0 e zero output, sem erro nenhum.
  Corrigido comparando `fs.realpathSync` dos dois lados, com fallback pro comportamento antigo se
  `realpathSync` falhar.
## 2026-07-12 — Fase 2 Task 2 — Wire do Dial de Coreografia no bsd.js (computa nível upfront, honra estágios, registra nível real)
- **Decisão:** `bsd.js` passa a computar o nível do Dial (`selectLevel`) uma vez no início de `executeFeature`
  (classe derivada dos caminhos citados em `specMd` via `classifyTaskClass`, `recommended: null` — Fase 3
  injeta a confiança medida), a **honrar** esse nível pulando os 4 estágios upfront (planner/nfr/contract/
  researcher) via stub `DRY.*` quando `!stageOn(<estágio>)`, e a **registrar o nível real** (`taskLevel`) no
  `RUN_RECORD` em vez do `level: 0` fixo herdado da Fase 1. `dial.js`/`dial.json` (Task 1, commit
  `6f861c6`) são consumidos em try/catch: sem config carregável, cai em nível 3 (conservador), preservando
  100% do comportamento pré-Dial.
- **Alternativa descartada:** (A) Deixar o `bsd.js` sem alteração até a Fase 3 injetar `recommended` de
  verdade (adiar o wiring); (B) Honrar o nível recalculando por estágio individualmente em vez de uma vez
  upfront por feature.
- **Porquê:** Ver `specs/metodo-duravel-portoes-dial/plan-fase2.md` Task 2 — o objetivo da Fase 2 é o
  `bsd.js` já **usar** o Dial (não só ele existir isolado em `dial.js`), com nível-default 3 garantindo
  zero mudança de comportamento observável até a Fase 3 baixar o nível via confiança medida. (A) foi
  rejeitada porque deixaria `dial.js` morto/não-integrado, violando o próprio plano da fase. (B) foi
  rejeitada porque o nível é uma propriedade da FEATURE/task (classe upfront), não de cada estágio
  isoladamente — recalcular por estágio adicionaria complexidade sem ganho (mesma classe, mesmo piso,
  mesmo `recommended` nulo em toda a feature nesta fase).

## 2026-07-12 — Fase 3 — Aferidor Analisador (recommendLevel) + wire no bsd.js
- **Decisão:** novo módulo puro `aferidor-analise.js` (`readRecords` + `recommendLevel`) que lê `.bsd/history.jsonl`, janela por `task_class × model_id`, e recomenda um nível pro Dial: demove (baseline+1) se `first_try_pass < demoteThreshold`; promove (baseline-1) se evidência forte (`≥ promoteThreshold`) e zero intervenção humana; cold start / model_id novo → `conservativeDefault`. Baseline = `level` do último RUN_RECORD da classe (derivado do histórico, sem arquivo de estado separado). Usa `shadow_first_try_pass` quando há `≥ minShadow` amostras (forward-compat p/ Fase 4), senão o sucesso no nível atual. Thresholds em `dial.json`. `bsd.js` troca `recommended: null` (Fase 2) pela recomendação medida.
- **Alternativa descartada:** (A) manter um arquivo de estado com o "nível atual" por classe (em vez de derivar do último `level` do histórico); (B) exigir a sombra da Fase 4 antes de qualquer promoção (adiar promoção pra Fase 4).
- **Porquê:** ver `specs/metodo-duravel-portoes-dial/plan-fase3.md` + spec §3.4. (A) foi rejeitada porque o histórico já é a fonte da verdade append-only (o `level` está gravado em cada RUN_RECORD) — um segundo arquivo de estado duplicaria e poderia divergir (viola Art. VIII anti-abstração/estado redundante). (B) foi rejeitada porque deixaria a Fase 3 sem entregar promoção nenhuma; a promoção por sucesso-no-nível-atual é a versão otimista, e a Fase 4 a endurece com a sombra sem trocar a interface (o `recommendLevel` já consome `shadow_first_try_pass` quando existir). O piso do Dial (`max(piso, recomendado)`) continua protegendo — a recomendação nunca fura a segurança.

## 2026-07-12 — Fase 4 — Probe Sombra + Conjunto-Canário (sombra.js) + wire opt-in no bsd.js
- **Decisão:** novo módulo `sombra.js` (`shadowLevelFor`, `aggregateShadow`, `runCanaryProbe`, `dialConsistencyRunner`, `loadCanary`) + `config/canary.json` (fixtures dourados versionados). O `bsd.js` roda o probe sombra **opt-in** (`VJP_SHADOW=1`, default OFF) e popula `shadow_level`/`shadow_first_try_pass` no RUN_RECORD, que o analisador (Fase 3) já consome. Runner **plugável**: embutido = `dialConsistencyRunner` (self-check determinístico do Dial, sem LLM).
- **Alternativa descartada:** (A) rodar a pipeline LLM ao vivo no nível-sombra por padrão (probe de qualidade real); (B) não wire no bsd.js e entregar só o CLI.
- **Porquê:** ver `plan-fase4.md` + spec §3.4. (A) foi rejeitada como default porque exige conectividade + custo de tokens e não é determinística/testável sem o modelo ao vivo — fica como gancho de PRODUÇÃO (injetar um runner LLM), com o mecanismo e os campos já prontos e o default OFF garantindo zero mudança de comportamento. (B) foi rejeitada porque deixaria os campos de sombra nunca populados (mecanismo morto); o wire opt-in integra ponta-a-ponta e é testável. **Limite honesto:** o runner embutido mede a saúde/consistência do Dial (self-check), não a qualidade do modelo — documentado em `sombra.md`.

## 2026-07-12 — Fase 5 — Portas (adaptadores c/ fallback) + Mirror de Upstreams (Riscos A e B)
- **Decisão:** (1) `ports.js` resolve um PAPEL (`memory`, `packer`) para a ferramenta pinada se presente, senão para um FALLBACK nativo V-JP em formato aberto (`fallbacks/memory-fallback.js` JSONL; `fallbacks/packer-fallback.js` texto único). (2) `mirror.js` guarda cópia própria (tarball) de cada upstream externo, verificável por SHA-256, com auditoria offline determinística (`ok|corrupted|missing|unverified`, `unverified ≠ ok`) e `--fetch` opt-in (rede). Espelho em `.mirror/` (gitignored, reproduzível pelo manifesto).
- **Alternativa descartada:** (A) criar porta para TODAS as ferramentas (RTK, GSD, Superpowers, MCPs...) — wrapper por completude; (B) confiar só no vendoring atual (clone do upstream no commit pinado) sem espelho próprio; (C) commitar os tarballs do espelho no repo.
- **Porquê:** ver `plan-fase5.md` + spec §3.5/§3.6. (A) foi rejeitada por violar Art. VIII/VII: porta sem fallback próprio real é wrapper especulativo ("pra caso troque") — só criamos porta onde existem 2+ implementações CONCRETAS, o que reconcilia o adaptador com o anti-abstraction gate. (B) foi rejeitada porque o vendoring depende do upstream CONTINUAR existindo: repo apagado/tag movida/pacote despublicado mata a montagem — exatamente o Risco B; o mirror é a cópia que sobrevive ao sumiço. (C) foi rejeitada porque tarballs binários incham o repo e o manifesto+SHA já tornam o espelho reproduzível e auditável. **Limite honesto:** `--fetch` toca a rede e não é coberto por testes; tudo o que é determinístico (manifesto, hash, verificação, resolução de portas, fallbacks) é testado.

## 2026-07-12 — Mirror: espelhar npm/pip (fecha buraco do Risco B) + excluir external-stack
- **Decisão:** `mirror.js --fetch` passa a espelhar TODOS os tipos de upstream (git, **npm**, **pip**), não só git. `fetchCmdFor` (pura) monta o comando por tipo: `git clone` / `npm pack` / `python3 -m pip download`; tipo desconhecido → `null` (não inventa comando). `mirrorableEntries` exclui `bundled` (já é nosso) e `external-stack` (hono-drizzle: é escolha de stack, não artefato baixável). Falha de um item é reportada e o resto continua (não aborta o espelho todo).
- **Alternativa descartada:** (A) deixar só git espelhado (estado entregue na Fase 5); (B) usar o binário `pip` direto.
- **Porquê:** (A) deixava a metade MAIS FRÁGIL desprotegida — pacote npm/pip pode ser despublicado a qualquer momento (é o Risco B mais provável na prática, mais até que repo git apagado); com só-git, 5 dos 10 upstreams ficavam sem cópia. (B) foi rejeitada porque em muitas máquinas (macOS incluso, esta inclusive) o binário `pip` não está no PATH embora o módulo exista — `python3 -m pip` é a forma robusta (descoberto ao vivo: `pip` falhou, `python3 -m pip` funcionou). Espelho agora 10/10, auditado por SHA-256 (adulteração e apagamento detectados).

## 2026-07-12 — Sombra de Verdade: runner LLM (mede o modelo), amostrado 1-em-N
- **Decisão:** `sombra-llm.js` — a IA resolve tarefas douradas (`canary-llm.json`) e um JUIZ DETERMINÍSTICO (código puro, não IA) compara com o gabarito; resultado vira `shadow_first_try_pass` p/ o Aferidor promover. Modo **automático amostrado** (escolha do usuário): mede a cada `shadowSampleEvery` (default 5) execuções; nas demais roda o self-check barato do Dial. Amostragem determinística (`runCount % N`), sem `Math.random`. Sem LLM/rede → `null` (≠ pass).
- **Alternativa descartada:** (A) tarefas douradas de GERAÇÃO DE CÓDIGO, executando a saída da IA p/ ver se passa nos testes (o jeito mais fiel de medir capacidade); (B) juiz LLM (IA avaliando IA); (C) rodar a cada feature (sem amostragem); (D) só sob demanda (CLI manual).
- **Porquê:** (A) foi rejeitada por **violar a própria Constituição, Art. LLM05 ("NUNCA eval() em LLM output")** — executar código gerado pela IA é exatamente o que o artigo proíbe; a saída estruturada mede instrução-seguida + raciocínio no domínio do harness sem executar nada. (B) rejeitada porque juiz-IA é não-determinístico e não-auditável — o juiz tem que ser código que eu possa ler e testar. (C) rejeitada por custo (queima token em toda feature; Art. LLM10 pede consumo limitado). (D) foi a minha recomendação inicial, mas o usuário escolheu explicitamente a opção amostrada — mede sozinho sem depender de lembrar, diluindo o custo.
