<!-- GERADO por sync-rules.js a partir de core/protocolo/fases/fase-09-revisao.md — não edite aqui: edite core/ e rode sync-rules. -->

# Fase 9 — Revisão independente e adversarial

**QUEM REVISA NÃO É QUEM ESCREVE.** Todo trabalho relevante passa por revisão independente (`13`).

O revisor:
- usa contexto separado do executor (outro subagente ou sessão nova) e recebe **requisitos, critérios de aceitação, diff e evidências de teste**, sem a autoavaliação do executor;
- procura bugs, regressões, lógica de negócio, segurança e autorização, problemas arquiteturais, desempenho e consumo de recursos, migrações e compatibilidade de API, e funcionalidade incompleta ou simulada;
- classifica os achados por severidade (`blocker | should-fix | nit`, com `file:line`, teto de 10; skill `pr-review` sobre `git diff`, nunca em worktree);
- devolve as correções ao executor, e o novo diff passa por outra avaliação, no máximo em 2 rodadas (R3);
- **não aprova só porque os testes existentes passaram.** Teste verde é necessário, não suficiente.

**Revisão adversarial de arquitetura** (Dial 3, migração, auth, dinheiro, decisão difícil de reverter): o revisor recebe o problema, os requisitos e a arquitetura proposta, **sem** a justificativa persuasiva, e caça falhas, pressupostos não demonstrados e alternativas negligenciadas.
Exemplo: "[Provável] Microsserviços com Kubernetes adicionam complexidade operacional desnecessária para um MVP sem requisito demonstrado de escala independente. Alternativa: monólito modular com PostgreSQL e instrumentação. Risco evitado: custo de infra, observabilidade distribuída prematura, esforço de manutenção."
