---
name: arch-review
description: Revisão de arquitetura nível staff/principal — escalabilidade, filas, load balancing, observabilidade, resiliência e custo. Use quando o usuário pedir /arch-review, "revisar arquitetura", "isso escala?", ou antes de decisões estruturais (nova fila, novo serviço, mudança de infra).
---

# Arch Review — pensar como arquiteto, ligando os pontos

Objetivo: avaliar o sistema (ou a mudança proposta) contra carga real e falhas
reais — não contra o caso feliz. Sempre **mapear antes de propor**: leia a
estrutura, docker-compose/infra, módulos NestJS, schema Prisma e entrypoints
antes de opinar. Cada recomendação sai com **tradeoff e custo**, em ordem de
impacto — nada de lista genérica de best practices.

## 1. Mapa do sistema (sempre primeiro)

Produza um diagrama mermaid curto: clientes → LB/proxy → serviços → DB/filas/caches/integrações externas. Identifique o caminho crítico (request mais frequente) e o caminho mais caro (request mais pesado).

## 2. Dados e banco

- Schema: índices vs padrões de acesso reais (queries do código, não teoria).
- Crescimento: qual tabela cresce sem limite? Tem estratégia (particionamento, arquivamento, TTL)?
- Conexões: pool dimensionado? PgBouncer se muitas instâncias?
- Transações: alguma transação longa segurando lock? Isolamento adequado?
- Backup/restore testado é diferente de backup configurado.

## 3. Filas e trabalho assíncrono

- O que está síncrono e não deveria estar (email, PDF, webhook, integração externa)?
- Para cada fila (BullMQ/SQS/etc): idempotência do consumer, retry com backoff exponencial, DLQ, e o que acontece se a mesma mensagem chegar 2x.
- Outbox pattern quando precisa de "gravou no banco E publicou evento" atômico.

## 4. Escalabilidade e load balancing

- O serviço é stateless? (sessão em memória, upload em disco local e cron in-process quebram réplicas).
- O que acontece com 10x o tráfego de hoje? Qual componente cai primeiro?
- Cache: o que é caro e raramente muda? Estratégia de invalidação definida?
- Graceful shutdown: SIGTERM drena requests e jobs em andamento?

## 5. Resiliência

- Para cada dependência externa: timeout explícito, retry limitado, circuit breaker ou degradação. "Sem timeout" = incidente agendado.
- Modos de falha: DB caiu, fila caiu, integração caiu — o usuário vê o quê?

## 6. Observabilidade

- Logs estruturados (JSON) com request-id correlacionando front→back→job.
- Métricas dos 4 sinais: latência (p95/p99), tráfego, erros, saturação.
- Health checks: liveness vs readiness, cobrindo DB e fila.
- Alerta acionável: alguém é avisado ANTES do usuário reclamar?

## 7. Segurança operacional

- Secrets fora do código/configs versionadas; rate limit nos endpoints públicos; validação de input na borda; CORS restrito.

## Saída obrigatória

1. Diagrama do estado atual + 3 riscos mais graves ("se X acontecer, Y quebra porque Z").
2. Recomendações priorizadas em 3 faixas: **agora** (barato e crítico), **próximo ciclo**, **quando escalar** — cada uma com esforço estimado e tradeoff.
3. O que NÃO fazer ainda (complexidade prematura é dívida também).
