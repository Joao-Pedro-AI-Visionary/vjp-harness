# GBrain Memory: Architectural Decision Records (ADR)

Registre aqui as principais decisões de design e arquitetura, justificando motivações e consequências.

---

## ADR-001: Versionamento Local e Pinado de CLI no Harness
- **Status**: Aceito
- **Motivação**: Ferramentas globais ou `npx package@latest` em runtime geram comportamento imprevisível e quebram compatibilidade de pipelines.
- **Decisão**: Todas as dependências do harness (`repomix`, `@opengsd/get-shit-done-redux`) são instaladas localmente em `.harness/tools` com versões travadas no `package.json`.
- **Consequências**: Execução idêntica em qualquer ambiente; necessidade de atualizar o manifest manualmente para novos recursos.

## ADR-002: Vertical Slice + DDD as Default Architecture
- **Status**: Aceito
- **Motivação**: Alinhamento com Spec-Driven, isolamento de features, facilidade para agentes de IA (cada slice é independente e autocontido), redução de acoplamento entre times/agentes trabalhando em paralelo.
- **Decisão**: Adotar Vertical Slice como padrão arquitetural default, com DDD para regras de negócio complexas. A organização do código passa a ser por feature module (`src/modules/<feature-name>/`) em vez de por camada técnica (`controllers/`, `services/`, `repositories/`). Cada slice vertical atravessa Controller → DTO → Use Case → Repository, mas mantendo o domínio puro (sem dependências de infraestrutura).
- **Consequências**:
  - Positivas: Cada feature é independente; mais fácil para agentes navegarem e gerarem código; paralelismo real entre slices; isolamento reduz risco de regressão.
  - Negativas: Mais arquivos no total; require disciplina para não vazar dependências entre slices; necessidade de shared kernel para código reutilizável.
- **Referências**: `template/tools/vertical-slice-ddd.md`, `seed/gbrain/architecture.md` (seção 3), `template/tools/generate-slice.sh`

---

## ADR-003: API-First com OpenAPI 3.1
- **Status**: Aceito
- **Motivação**: Inconsistência entre serviços, falta de documentação viva, dificuldade de geração automática de clientes e ausência de contrato formal entre frontend e backend.
- **Decisão**: Toda API REST deve ter spec OpenAPI 3.1 aprovada antes da implementação. Mensageria/eventos seguem AsyncAPI 3.0. O schema é a fonte da verdade da interface.
- **Consequências**:
  - O fluxo do RESEARCHER é alterado: deve gerar/atualizar o schema OpenAPI/AsyncAPI como primeiro artefato no mapeamento de impacto
  - O EXECUTOR implementa servidor e testes seguindo o schema (não o contrário)
  - O REVIEWER valida conformidade com o schema
  - Ferramentas recomendadas: Redocly CLI (lint/diff), @hey-api/openapi-ts (geração client TS), openapi-generator (server/client multi-language)
  - Schemas versionados (`openapi-v1.yaml`, `openapi-v2.yaml`); breaking changes exigem bump major
  - Ver ADR-001 para precedente de versionamento pinado no harness

---

## ADR-004: Documentação Diátaxis
- **Status:** Aceito
- **Motivação:** Documentação consistente, orientada ao usuário, cobertura dos 4 quadrantes (Tutorials, How-to Guides, Reference, Explanation). Sem um framework unificado, a documentação do ecossistema VJP Harness tende a ser inconsistente — mesclando conceitos introdutórios com referência técnica, ou omitindo documentação de features.
- **Decisão:** Adotar o framework **Diátaxis** (divirgat.io) para toda documentação gerada no ecossistema. Todo artefato de documentação deve pertencer a um dos 4 quadrantes:
  - **Tutorials** (`docs/01-tutorials/`) — aprendizado passo-a-passo para iniciantes
  - **How-to Guides** (`docs/02-how-to/`) — soluções para problemas específicos
  - **Reference** (`docs/03-reference/`) — descrição técnica precisa e exaustiva
  - **Explanation** (`docs/04-explanation/`) — contexto, decisões e entendimento profundo
- **Consequências:**
  - O agente **REVIEWER** deve validar documentação como parte do gate de merge, usando a checklist Diátaxis (`template/tools/diataxis-docs.md`)
  - O agente **EXECUTOR** deve gerar/atualizar documentação da feature no quadrante apropriado junto com código e testes
  - Nenhuma feature é considerada completa sem documentação no quadrante apropriado
  - O pipeline de CI deve incluir verificação de presença/consistência de documentação
  - Os templates de cada quadrante estão em `seed/docs/` e devem ser usados como ponto de partida
