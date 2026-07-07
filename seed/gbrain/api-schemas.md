# GBrain Memory: API Schemas Registry

Registro centralizado de todos os schemas OpenAPI e AsyncAPI do ecossistema. Mantenha atualizado sempre que um schema for criado, modificado ou descontinuado.

---

## Schemas Ativos

| # | Serviço | Tipo | Arquivo | Versão | Status |
|---|---------|------|---------|--------|--------|
|   | *(nenhum schema registrado ainda)* |      |         |        |        |

> Ao criar um novo schema, adicione uma linha nesta tabela seguindo o template acima.

## Convenções de Nomenclatura

| Item | Convenção | Exemplo |
|------|-----------|---------|
| Arquivo OpenAPI | `openapi-{versao}.yaml` | `openapi-v1.yaml`, `openapi-v2.yaml` |
| Arquivo AsyncAPI | `asyncapi-{nome-do-servico}.yaml` | `asyncapi-notificacoes.yaml` |
| Operation ID | `{verbo}{Entidade}` (camelCase) | `listarUsuarios`, `criarPedido` |
| Path parameters | `{entidade}Id` (camelCase) | `{usuarioId}`, `{pedidoId}` |
| Query parameters | minúsculo, snake_case | `page`, `limit`, `sort`, `filter` |
| Schema names | PascalCase, singular | `Usuario`, `PedidoItem`, `PaginatedResponse` |
| Error codes | `CATEGORIA_MOTIVO` (SCREAMING_SNAKE) | `VALIDATION_REQUIRED_FIELD`, `NOT_FOUND` |
| Response envelope | `{ data, meta }` para listas, `{ error }` para erros | — |

## Endpoints Documentados (por serviço)

### *Serviço: (nome)*
*(preencher quando houver endpoints documentados)*

| Método | Path | Operation ID | Status |
|--------|------|-------------|--------|
|        |      |             |        |

## Endpoints Pendentes de Documentação

*(preencher conforme necessário)*

- [ ] *(lista de endpoints que ainda precisam de schema)*

## Referências a Decisões de Design de API

| Decisão | Referência |
|---------|-----------|
| API-First como workflow obrigatório | ADR-003 |
| OpenAPI 3.1 como formato padrão REST | ADR-003 |
| AsyncAPI 3.0 para eventos/mensageria | ADR-003 |
| *(adicione novas decisões abaixo)* | |

## Histórico de Mudanças

| Data | Descrição | Responsável |
|------|-----------|-------------|
|      | *(criação inicial do schema)* | |
