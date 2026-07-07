# Explanation (understanding-oriented)

> **Propósito:** Contexto, justificativas e discussões. O "porquê" das coisas.
> **Público:** Qualquer pessoa que queira compreender fundamentos, decisões e trade-offs.
> **Tom:** Expositivo, contextual, aberto a discussão.

## Template de Explanation

```markdown
---
title: "[Título da Explanation]"
type: explanation
quadrant: understanding-oriented
author: "[Nome ou time]"
date: "YYYY-MM-DD"
status: draft | reviewed | accepted
---

# [Título da Explanation]

## Motivação

[Por que este tópico existe? Qual problema motivou esta decisão, arquitetura ou design?]

## Contexto

[Histórico relevante: o que existia antes, quais alternativas foram consideradas, quais restrições estavam em vigor.]

## Decisão / Design

[Descrição clara da decisão ou design adotado. Diagramas são bem-vindos (Mermaid, ASCII art).]

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Componente │───▶│  Serviço    │───▶│  Repositório│
│     A       │    │     B       │    │     C       │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Alternativas Consideradas

### Alternativa 1: [Nome]

**Prós:**
- [Vantagem 1]
- [Vantagem 2]

**Contras:**
- [Desvantagem 1]
- [Desvantagem 2]

**Motivo da rejeição:** [Explicação objetiva.]

### Alternativa 2: [Nome] (✅ ESCOLHIDA)

**Prós:**
- [Vantagem 1]
- [Vantagem 2]

**Contras:**
- [Desvantagem 1] (mitigada por [ação])

**Motivo da escolha:** [Explicação objetiva.]

## Consequências

### Positivas
- [Impacto positivo esperado]

### Negativas / Trade-offs
- [Impacto negativo ou dívida técnica assumida]

## Pontos de Atenção

- [Cuidado 1]
- [Cuidado 2]

## Referências

- [Link para ADR correspondente em `.gbrain/decisions.md`]
- [Link para documentação técnica relacionada]
- [Link para RFC ou issue relevante]

## Discussão Aberta

> Este espaço é para perguntas em aberto, pontos não resolvidos ou convites para revisão.
```

## Regras

1. **Sem instruções:** Explanation não ensina a fazer — isso é papel do Tutorial ou How-to.
2. **Sem detalhes técnicos minuciosos:** Isso é papel da Reference.
3. **Contexto é rei:** Mostre o "antes" e o "depois", as alternativas e os trade-offs.
4. **Diagramas:** Use Mermaid ou ASCII art para ilustrar fluxos e arquiteturas.
5. **Atualizável:** Explanation deve ser revisitada quando a decisão ou design mudar.
