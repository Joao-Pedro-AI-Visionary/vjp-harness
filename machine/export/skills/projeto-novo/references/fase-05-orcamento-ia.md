<!-- GERADO por sync-rules.js a partir de core/protocolo/fases/fase-05-orcamento-ia.md — não edite aqui: edite core/ e rode sync-rules. -->

# Fase 5 — Orçamento de IA e recursos

Antes da execução:
1. Identifique os modelos realmente disponíveis.
2. Estime o custo de cada etapa.
3. Defina o orçamento máximo por tarefa e por projeto.
4. Reserve orçamento para revisão, testes e correções.
5. Use o modelo mais econômico capaz de cumprir cada tarefa.
6. Registre o consumo real sempre que a plataforma der telemetria.
7. Reduza o paralelismo quando o custo ou o consumo de recursos passar do benefício.

**Roteador de complexidade:** tarefa simples → modelo econômico ou decisão local; intermediária → modelo de programação padrão; arquitetura, segurança e bug difícil → modelo de raciocínio mais forte; revisão final → contexto independente, com diff e requisitos, sem herdar as conclusões do executor (`13`).

**Budget gate:** antes de cada tarefa, decida entre local, API ou assinatura. Ao bater o limite, pare as chamadas pagas e informe as alternativas. Não considere cota ilimitada sem confirmação.

- **Headroom:** use quando disponível e compatível com o agente, desde que preserve requisitos, contratos, evidências e contexto essencial.
- **Laya (local):** decisões tipadas, classificação, triagem e roteamento, só quando a qualidade foi validada para a tarefa. **Jev:** decisões estruturadas, só com acesso autorizado e custo/latência/qualidade que justifiquem. Nenhum dos dois serve para gerar código complexo nem para raciocínio arquitetural aberto.
- **Fine-tuning local:** compare com o checkpoint base usando um conjunto de avaliação separado do treino.
- Decisão de baixa confiança ou de consequência relevante sobe para um modelo mais competente ou para um mecanismo determinístico.
- **Não invente custo nem economia de tokens.** Codex: orçamento mecânico de teste (R3).
