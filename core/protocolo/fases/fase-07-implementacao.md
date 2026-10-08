# Fase 7 — Implementação e qualidade

Só depois do gate de aprovação.

**Antes de implementar:** estrutura do repositório, convenções de código, contratos de API, modelos de dados, plano de migrações, critérios de aceitação e estratégia de testes. Instale o harness no projeto quando o João pedir (`install.sh`).

**Durante:**
- Tipagem e validação adequadas, erro tratado explicitamente e separação de responsabilidades (vertical slice + DDD; ver `AGENT_RULES.md`).
- Segredo nunca vai para commit ou log. Considere autenticação, autorização e isolamento de dados (checklist OWASP em `AGENT_RULES.md` §0.1).
- Documente a decisão não óbvia (Diátaxis) e não crie dependência desnecessária.
- TDD: teste falhando antes. Spec-driven: o código sai de `spec.md` + `tasks.md`.

**Testes proporcionais ao risco e ao tipo de projeto:** unitário, integração, contrato, ponta a ponta, acessibilidade e segurança. Os portões seguem o Dial e a precedência R4: o `test-gate` deixa a prova viva no `HEAD`; o ponta a ponta confirma a linha persistida e a UI sem erro.
