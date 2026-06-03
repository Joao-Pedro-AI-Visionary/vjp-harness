# GBrain Memory: Architectural Decision Records (ADR)

Registre aqui as principais decisões de design e arquitetura, justificando motivações e consequências.

---

## ADR-001: Versionamento Local e Pinado de CLI no Harness
- **Status**: Aceito
- **Motivação**: Ferramentas globais ou `npx package@latest` em runtime geram comportamento imprevisível e quebram compatibilidade de pipelines.
- **Decisão**: Todas as dependências do harness (`repomix`, `@opengsd/get-shit-done-redux`) são instaladas localmente em `.harness/tools` com versões travadas no `package.json`.
- **Consequências**: Execução idêntica em qualquer ambiente; necessidade de atualizar o manifest manualmente para novos recursos.

<!-- Adicione novos ADRs abaixo: ADR-002, ADR-003... -->
