---
name: fullstack-validate
description: Gate de validação fullstack — roda após QUALQUER implementação que toque front, back ou DB. Valida estática, backend, banco, visual e integração de ponta a ponta com evidências reais. Use quando o usuário pedir /fullstack-validate, "validar", "valida tudo", ou ao finalizar uma feature antes de declarar pronto.
---

# Fullstack Validate — Gate de Entrega

Nada é "pronto" sem passar por este gate. Cada fase produz **evidência real**
(saída de comando, screenshot, registro no banco) — nunca declare ✅ por inferência.
Stack default do JP: NestJS + Prisma + PostgreSQL no back; React/Next no front.
Adapte os comandos ao projeto (leia package.json antes).

## Fase 1 — Estática (rápida, sempre)

```bash
npm run lint && npx tsc --noEmit && npm run build
```
- Front e back, se monorepo. Zero erros, zero warnings novos.

## Fase 2 — Backend

1. **Testes**: `npm test` (unit) + e2e se existir. Se a feature não tem teste, escreva ao menos 1 caso feliz + 1 caso de erro.
2. **Contratos**: DTOs com validação real (class-validator/zod) — testar payload inválido e conferir que retorna 400 estruturado, não 500.
3. **Prisma/migrations**: `npx prisma migrate status` (sem drift) e `npx prisma validate`.
4. **Queries quentes**: para cada query nova em rota de listagem/busca, rodar `EXPLAIN ANALYZE` (via psql ou MCP postgres). Procurar Seq Scan em tabela grande e N+1 (vários SELECTs no log do Prisma para um único request).
5. **Auth/permissão**: chamar a rota nova SEM token e com token de role errada — ambas devem falhar corretamente.

## Fase 3 — Frontend (visual, com browser de verdade)

Suba o app e use o MCP `chrome-devtools` (ou Playwright):

1. **Console limpo**: zero erros e zero warnings de React no console.
2. **Network**: nenhuma chamada 4xx/5xx inesperada; sem requests duplicados.
3. **Screenshots**: capturar desktop (1440px) e mobile (390px) das telas alteradas.
4. **Checklist visual** (avaliar nos screenshots, apontar o que falhar):
   - Hierarquia: o elemento mais importante é o mais proeminente?
   - Espaçamento em escala consistente (4/8px), alinhamento em grid.
   - Contraste AA (texto ≥ 4.5:1), tipografia máx. 2 famílias.
   - Estados completos: hover, focus visível, loading, empty state, erro.
   - Responsivo: nada estourando ou sobrepondo em 390px.
5. Para mudança visual significativa, invocar também a skill `design-review`.

## Fase 4 — Integração ponta a ponta

1. Executar o fluxo principal da feature pelo browser (não só curl): ação do usuário → request → resposta → UI atualizada.
2. **Conferir no banco**: SELECT no registro criado/alterado — status 200 não prova persistência correta (timezone, FK, default, soft-delete).
3. Executar 1 fluxo de erro (input inválido, recurso inexistente) e conferir que a UI mostra mensagem amigável, não tela branca.

## Fase 5 — Proativa: ligar os pontos

Olhar além do diff e apontar (sem implementar sem pedir):
- Endpoint novo sem paginação/rate-limit que pode crescer?
- Operação lenta/externa que deveria ir para fila em vez de request síncrono?
- Falta log estruturado/métrica no caminho novo? Health check cobre a dependência nova?
- Índice faltando para o padrão de acesso novo?
- Algo que esta mudança quebra em outro módulo (buscar usos com grep)?

## Saída obrigatória

Tabela final com cada item: ✅/❌/⚠️ + evidência (1 linha). Se algo ❌, corrigir e
revalidar ANTES de reportar — o relatório final só sai com tudo verde ou com
pendências explicitamente justificadas. Achados da Fase 5 vão em "Recomendações"
com tradeoff de cada uma.
