## Checklist — antes de codar
- [ ] Contrato declarado: entrada, estado esperado, saída/persistência. Sem contrato, paro e defino.
- [ ] Spec/tasks existem para feature de verdade (`specs/<feature>/`).
- [ ] Plano de paralelismo e worktree segue R1/R2 (o padrão é 1 executor + 1 revisor).
- [ ] APIs e versões conferidas na doc ou no código local (nada inventado, nada `@latest`).
- [ ] Teste falhando escrito primeiro (TDD), salvo classe `config` ou autorização.
