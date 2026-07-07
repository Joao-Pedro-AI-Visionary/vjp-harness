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

## 3. Vertical Slice + DDD (Padrão Arquitetural Default)

> **Registrado no ADR-002**. Este padrão substitui a organização por camada técnica. Cada feature de negócio é um "slice vertical" independente.

### 3.1 Princípios

1. **Organização por Feature, não por Camada**: O código é agrupado por funcionalidade de negócio (`modules/billing/`, `modules/identity/`), não por tipo técnico (`controllers/`, `services/`, `repositories/`).
2. **Cada Feature é um Slice Vertical**: Um slice atravessa todas as camadas (Controller → DTO → Use Case → Repository), mas **não depende de outros slices**.
3. **DDD para Regras de Negócio**: Entidades ricas com comportamento, Value Objects imutáveis, Aggregates como raiz de consistência, Domain Events para efeitos colaterais.

### 3.2 Conceitos DDD no Contexto do Slice

| Conceito | Onde fica no slice | Responsabilidade |
|---|---|---|
| **Entity** | `domain/entities/` | Objeto com identidade única (`id`), mutável, contém regras de negócio |
| **Value Object** | `domain/value-objects/` | Objeto imutável, sem identidade, comparado por valor (`Money`, `Email`, `CPF`) |
| **Aggregate** | `domain/aggregates/` | Cluster de entidades com uma raiz (Aggregate Root) que garante consistência |
| **Domain Event** | `domain/domain-events/` | Ocorrência relevante no domínio, disparada pelo Aggregate Root |
| **Domain Service** | `domain/domain-services/` | Lógica de negócio que não pertence naturalmente a uma entidade ou value object |
| **Repository** | `domain/repositories/` (interface) + `infrastructure/repositories/` (implementação) | Persistência e recuperação de Aggregates |
| **Use Case** | `application/use-cases/` | Orquestrador: recebe DTO, coordena entidades/domain services, persiste via Repository |
| **Controller** | `infrastructure/controllers/` | Fino: só roteia HTTP, valida com DTO, chama Use Case |
| **DTO** | `application/dto/` | Schema de validação de entrada (`class-validator`) |
| **Mapper** | `infrastructure/mappers/` | Converte entre entidade de domínio e modelo de persistência |

### 3.3 Estrutura de Diretórios

```
src/
  shared/                          # Código compartilhado entre slices
    kernel/                        # DDD building blocks
    infrastructure/                # Database, cache, messaging
    utils/

  modules/
    <feature-name>/                # Slice vertical
      application/                 # Casos de uso
        use-cases/
        dto/
        interfaces/
      domain/                      # Regras de negócio puras
        entities/
        value-objects/
        aggregates/
        domain-events/
        domain-services/
        specifications/
        repositories/              # Interfaces ONLY
        types/
      infrastructure/              # Implementações concretas
        controllers/
        repositories/
        mappers/
        subscribers/
      tests/                       # Testes de integração do slice
```

### 3.4 Regras de Isolamento entre Slices

- Um slice **NÃO pode importar** classes de domínio de outro slice diretamente.
- A comunicação entre slices deve ser feita via **Facades** (em `application/interfaces/`) ou **Domain Events** (via message broker).
- DTOs podem ser compartilhados entre slices apenas se estiverem em `shared/`.
- Cada slice gerencia suas próprias migrations (tabelas prefixadas pelo nome do módulo, se necessário).

### 3.5 Como os Agentes Aplicam

- **PLANNER**: avalia riscos por slice. Uma mudança no slice `billing` não impacta `identity`.
- **RESEARCHER**: mapeia quais slices serão criados/modificados. Identifica bounded contexts.
- **EXECUTOR**: gera código seguindo a estrutura de slice vertical. Domínio puro, sem dependências de infra.
- **REVIEWER**: valida o isolamento — nenhum slice deve importar domínio de outro slice.

> Ajuste esta stack para a realidade do seu projeto antes de operar os agentes.
