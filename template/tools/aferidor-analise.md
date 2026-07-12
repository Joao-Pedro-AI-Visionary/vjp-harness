# Aferidor de Confiança — Analisador (V-JP)

Responde "o modelo melhorou?" **medindo**, não perguntando. Lê `.bsd/history.jsonl`, janela
de `windowSize` por `task_class × model_id`, e recomenda um nível pro Dial:
- **Demove (aperta)** se `first_try_pass < demoteThreshold` (regressão).
- **Promove (afrouxa)** se evidência forte (`≥ promoteThreshold`) e **zero** intervenção humana.
- **Cold start / model_id novo** → conservador (sem evidência, não afrouxa).
- Usa a **sombra** (Fase 4, `shadow_first_try_pass`) quando há `≥ minShadow` amostras; senão, o sucesso no nível atual.

O Dial aplica o **piso** por cima (`max(piso, recomendado)`) — a recomendação nunca fura a segurança.
Config em `.harness/config/dial.json`. Uso: `node .harness/tools/aferidor-analise.js --class <c> [--model <id>] [--json]`.
Ver spec §3.4.
