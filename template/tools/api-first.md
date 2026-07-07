# API-First (OpenAPI / AsyncAPI)

**Tier:** skill · **Versão pinada:** `1.0.0` · **Origem:** spec vendorizada — design de APIs antes da implementação · **Destino:** `.harness/tools/api-first.md`

## Responsabilidade
Design de APIs orientado a contrato: especificação completa (OpenAPI 3.1 para REST, AsyncAPI 3.0 para eventos/mensageria) antes de qualquer linha de código de implementação. O schema é a fonte da verdade e o artefato de consenso entre serviços.

## Fluxo API-First
```
Spec (GBrain/Requisito) → OpenAPI/AsyncAPI Schema → Generate Server/Client → Implement → Test
```
O VJP Harness executa este pipeline com:
1. **GSD** produz `spec.md` e `tasks.md` com requisitos de API
2. **RESEARCHER** gera/atualiza o schema OpenAPI ou AsyncAPI no mapeamento de impacto
3. **EXECUTOR** implementa servidor e testes seguindo o schema
4. **REVIEWER** valida conformidade com o schema via MCPs

## Quando usar
| Cenário | Schema |
|---|---|
| REST endpoints (CRUD, queries, commands) | OpenAPI 3.1 |
| WebSocket / Server-Sent Events | OpenAPI 3.1 (webhooks, callbacks) |
| Event-driven / Mensageria (Kafka, RabbitMQ, SQS, Redis Pub/Sub) | AsyncAPI 3.0 |
| GraphQL | Schema SDL + OpenAPI wrapper |

Toda API REST exposta por qualquer serviço do ecossistema DEVE ter um schema OpenAPI 3.1 aprovado antes da implementação (ver ADR-003).

## Ferramentas sugeridas

| Ferramenta | Uso | Origem |
|---|---|---|
| **Redocly CLI** | Lint, bundle, diff de OpenAPI/AsyncAPI | `npm` / `redocly-cli` |
| **@hey-api/openapi-ts** | Geração de client TypeScript tipado a partir do schema | `npm` / `@hey-api/openapi-ts` |
| **openapi-generator** | Geração de server/client em múltiplas linguagens (Java, Python, Go, TS) | `npm` / `@openapitools/openapi-generator-cli` |
| **AsyncAPI Generator** | Geração de código, documentação e bindings de mensageria | `npm` / `@asyncapi/generator` |
| **Spectral** | Regras customizadas de lint de OpenAPI | `npm` / `@stoplight/spectral-cli` |

## Template de OpenAPI schema mínimo

```yaml
openapi: "3.1.0"
info:
  title: Nome do Serviço
  version: "1.0.0"
  description: Descrição sucinta do serviço
servers:
  - url: https://api.exemplo.com/v1
    description: Produção
paths:
  /recursos:
    get:
      operationId: listarRecursos
      summary: Listar recursos com paginação e filtros
      parameters:
        - $ref: "#/components/parameters/page"
        - $ref: "#/components/parameters/limit"
        - $ref: "#/components/parameters/filter"
      responses:
        "200":
          description: Lista paginada de recursos
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PaginatedResponse"
        default:
          $ref: "#/components/responses/ErrorResponse"
components:
  schemas:
    Recurso:
      type: object
      required: [id, nome]
      properties:
        id: { type: string, format: uuid }
        nome: { type: string }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }
    PaginatedResponse:
      type: object
      required: [data, meta]
      properties:
        data: { type: array, items: { $ref: "#/components/schemas/Recurso" } }
        meta:
          type: object
          required: [page, limit, total]
          properties:
            page: { type: integer, minimum: 1 }
            limit: { type: integer, minimum: 1, maximum: 100 }
            total: { type: integer, minimum: 0 }
    ErrorDetail:
      type: object
      required: [code, message]
      properties:
        code: { type: string }
        message: { type: string }
        details: { type: object }
    StandardError:
      type: object
      required: [error]
      properties:
        error: { $ref: "#/components/schemas/ErrorDetail" }
  parameters:
    page:
      name: page
      in: query
      schema: { type: integer, default: 1, minimum: 1 }
      description: Número da página
    limit:
      name: limit
      in: query
      schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
      description: Itens por página
    filter:
      name: filter
      in: query
      schema: { type: string }
      description: Filtro no formato campo:valor (ex.: status:ativo)
  responses:
    ErrorResponse:
      description: Erro padrão
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/StandardError"
```

> Para o template completo (incluindo nomenclatura RESTful, paginação, erros, sorting), veja [`../config/openapi-template.yaml`](../config/openapi-template.yaml).

## Template de AsyncAPI schema mínimo

```yaml
asyncapi: "3.0.0"
info:
  title: Serviço de Notificações
  version: "1.0.0"
  description: Eventos e mensagens do sistema de notificações
defaultContentType: application/json
servers:
  production:
    host: kafka.exemplo.com:9092
    protocol: kafka
channels:
  notificacao.criada:
    address: notificacao.criada
    messages:
      notificacaoCriada:
        $ref: "#/components/messages/NotificacaoCriada"
operations:
  receberNotificacao:
    action: receive
    channel:
      $ref: "#/channels/notificacao.criada"
    messages:
      - $ref: "#/channels/notificacao.criada/messages/notificacaoCriada"
components:
  messages:
    NotificacaoCriada:
      summary: Uma nova notificação foi criada
      payload:
        type: object
        required: [id, tipo, destinatario, mensagem]
        properties:
          id: { type: string, format: uuid }
          tipo: { type: string, enum: [email, push, sms] }
          destinatario: { type: string, format: email }
          mensagem: { type: string }
          criadaEm: { type: string, format: date-time }
```

## Boas práticas

1. **Versionamento de schemas**: Cada versão de API vive em seu próprio arquivo (`openapi-v1.yaml`, `openapi-v2.yaml`). URLs versionadas (`/v1/`, `/v2/`). O versionamento SEMÂNTICO do schema segue o da API.

2. **Backward compatibility**: Use `redocly lint` com regras de breaking change antes de modificar um schema publicado. Mudanças backward-compatible:
   - Adicionar campo opcional em response
   - Adicionar novo endpoint
   - Estender enum (se o consumidor tolerar valores desconhecidos)

3. **Breaking changes** exigem bump de versão major:
   - Remover campo obrigatório
   - Renomear endpoint ou campo
   - Alterar tipo de campo
   - Remover enum value
   - Alterar status code de resposta

4. **Documentação viva**: O schema OpenAPI deve ser a ÚNICA fonte de documentação. Nunca documente a API em README separado — gere docs a partir do schema com Redocly (`redocly build-docs`).

5. **Validação em CI**: Todo PR que toque em `openapi-*.yaml` ou `asyncapi-*.yaml` deve executar:
   ```bash
   redocly lint openapi-v1.yaml
   redocly lint --format asyncapi asyncapi-notificacoes.yaml
   ```

6. **Schemas no GBrain**: Registre todos os schemas ativos em `.gbrain/api-schemas.md` para consulta pelos agentes.

## Verificação
```bash
test -f .harness/tools/api-first.md && echo OK
```

## Determinismo
Skill/Spec vendorizada em `.harness/tools/api-first.md`. O template OpenAPI completo vive em `.harness/config/openapi-template.yaml`. Ambos evoluem por PR com revisão.
