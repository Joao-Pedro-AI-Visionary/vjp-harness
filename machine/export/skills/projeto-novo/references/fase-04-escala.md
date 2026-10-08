<!-- GERADO por sync-rules.js a partir de core/protocolo/fases/fase-04-escala.md — não edite aqui: edite core/ e rode sync-rules. -->

# Fase 4 — Estratégia de escala

Classifique o perfil de carga: protótipo local · MVP de baixa utilização · produto em crescimento · produção com carga significativa · sistema de alta disponibilidade.

Avalie picos de acesso, volume de leitura e escrita, crescimento do armazenamento, processamento assíncrono e tolerância a falhas.

**NFR antes do código** (no Dial 3, o `nfr-performance-planner`): operação pesada, em lote ou com integração externa (import/export, relatório, e-mail em massa, webhook) **não é síncrona**; vai para fila idempotente. Lista tem paginação. Defina `maxResponseMs` e `maxPayloadKb`.

Defina **gatilhos mensuráveis** para evoluir a infraestrutura: latência, saturação do banco, memória, CPU, número de conexões, custo mensal. Evite overengineering e deixe caminhos de migração razoáveis. Se a escala exigir trocar a stack aprovada, volte à Fase 3.
