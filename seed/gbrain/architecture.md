# GBrain Memory: Technical Architecture & Boundary Rules

Diretrizes arquiteturais estritas da aplicação. Mantenha o código modular, testável e escalável.

---

## 1. Stack Backend Homologada
- **Framework Principal**: NestJS
- **Banco de Dados**: PostgreSQL
- **ORM**: Prisma ou queries tipadas
- **Camadas Desacopladas**:
  - `Controllers`: Entrada de dados, roteamento HTTP e validação via DTOs.
  - `DTOs`: Esquemas de validação de dados (`class-validator`).
  - `Services / Use Cases`: Regras de negócio puras, desacopladas de frameworks.
  - `Repositories / Adapters`: Implementação de persistência e interfaces externas.

## 2. Regras de Isolamento de Testes
- **Testes Unitários**: Testar funções isoladamente com mocks completos das dependências.
- **Testes de Integração**:
  - **PROIBIDO** o uso de bancos de dados voláteis ou mockados manualmente.
  - É obrigatório o uso de **Testcontainers** para instanciar containers Docker efêmeros do PostgreSQL durante o ciclo do teste.
  - Chamadas HTTP externas devem ser interceptadas deterministicamente pelo **Nock**.

> Ajuste esta stack para a realidade do seu projeto antes de operar os agentes.
