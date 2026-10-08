# Execução unificada — uma regra por tema (R1–R9)

**R1 Paralelismo.** O padrão é **1 executor + 1 revisor independente**. Paralelize só quando houver frentes de fato independentes com contrato definido antes, e nunca para tarefa pequena. O número de agentes é o menor entre: frentes independentes, teto de hardware e orçamento de tokens. **Teto de hardware padrão: 2 subagentes simultâneos** (3 se todos só lerem), porque a máquina de referência tem 8 GB e cada sessão ociosa custa 400–600 MB. O teto só sobe com medição da Fase 0. Um servidor de dev por vez. Recurso compartilhado (um browser CDP, um banco, um arquivo) obriga a ir sequencial. Fan-in só depois dos portões de cada frente.

**R2 Worktree.** O Maestro (`bsd.js`, headless) sempre isola o EXECUTOR em worktree; isso é mecânico e não muda. Na camada interativa, worktree serve só para **escrita concorrente** (≥2 frentes editando o mesmo repo), com uma branch por frente e arquivos de responsabilidade delimitados. Frente única usa branch local, sem worktree. Revisão roda sobre `git diff`, nunca em worktree nova. Worktree só é removida com os commits preservados e nada pendente.

**R3 Tentativas.** Teto absoluto de **2 tentativas de correção** por task ou portão: Maestro `maxRetries 2`, `test-gate`, rodadas de `pr-review` e `/prepush`. Com orçamento mecânico ligado (`VJP_CODEX=1` ou `VJP_TEST_BUDGET=1`), quem manda é o contador `.bsd/test-budget.json`: Codex 1/1, ou por nível 0:0/0 · 1:1/1 · 2:2/1 · 3:2/2. O stop-continue não zera o contador. Esgotou: entregue se a prova viva estiver verde; senão, reporte **[Falhou]** com os blockers. Nunca "repita até passar".

**R4 Portões de conclusão (precedência).** Os quatro portões, do mais forte ao mais fraco:
1. **Sinal mecânico**: suíte, `test-gate`/prova viva no `HEAD`, `pre-push`. Vermelho bloqueia sempre e nada o sobrepõe.
2. **Ponta a ponta**: `integration-verifier` (subagente) ou `fullstack-validate` (skill), que são o mesmo portão. Confere contrato, fluxo real na UI, linha persistida, caminhos ruins e performance. Obrigatório quando a mudança cruza front→API→DB.
3. **Revisão independente**: `pr-review` e, quando couber, a revisão adversarial. Pode barrar, mas não aprova por cima de vermelho.
4. **Entrega verificada**: checklist "antes de concluir" + formato de resposta. Sem evidência, não está concluído.

O Dial decide quais rodam (`40`). `gates.js` consolida a definição de pronto do pipeline: `spec-presente`, `adr-presente`, `saida-aberta` e `determinismo` bloqueiam; `prova-viva` avisa, e quem barra o push é o `pre-push`.

**R5 Browser.** Teste E2E que vale como sinal roda pelo runner (`playwright test`). O **Playwright MCP** é pinado e **local do projeto** (`.harness/tools`, `config/mcp.json`), nunca global. O **chrome-devtools MCP** (CDP) é a ferramenta global de inspeção visual (screenshot, console, network). Automação de sessão própria (gerar imagem no GPT/Gemini, por exemplo) só com autorização explícita. Nunca automatize login nem contorne OAuth, limite ou pagamento, e nunca grave token ou cookie em artefato.

**R6 Versões.** Proibido `@latest` em config, MCP e instalação: tudo é pinado e verificável (`registry.json`, `--doctor`). Pesquisar a versão mais nova (Fase 3) é permitido e recomendado; o que se escolhe entra **pinado**.

**R7 Arquivos de regra.** Todos são gerados de `core/` por `sync-rules.js`: `AGENTS.md` (Codex, AGY, Cursor), `~/.codex/AGENTS.md`, `CLAUDE.md` (`@imports`), `~/.claude/HARNESS.md`, `~/.gemini/GEMINI.md`, `.agents/rules/`, `.cursor/rules/` e skills. Ninguém espelha regra à mão; o `--check` acusa drift.

**R8 Git e remoto.** Push, branch remota, PR, merge, issue e comentário **só com autorização explícita**. Antes de qualquer push, rode o `/prepush` (fetch+rebase na base, segredos, suíte), valide de novo depois de integrar o remoto e não deixe nenhum check pendente. Sem force push, `reset --hard` ou limpeza de branch compartilhada sem autorização. Commits rastreáveis, com mensagem `[jp] feat|fix|refactor|docs|test: …`.

**R9 Limpeza.** Ao terminar, encerre só o que **esta** execução iniciou: processos Node/Python, containers temporários, portas, browsers automatizados (sem tocar em sessão pessoal), workers e modelos locais ociosos. **Nunca** apague banco, volume, `.env`, migração ou dado persistente para liberar memória. Registre o que foi encerrado e o que ficou ativo.
