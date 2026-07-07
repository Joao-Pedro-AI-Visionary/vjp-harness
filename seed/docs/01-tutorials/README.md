# Tutorials (learning-oriented)

> **Propósito:** Aprendizado passo-a-passo. O leitor nunca viu o assunto antes.
> **Público:** Iniciantes, novos integrantes do time, curiosos.
> **Tom:** Paciente, explicativo, minimalista.

## Template de Tutorial

```markdown
---
title: "[Nome do Tutorial]"
type: tutorial
quadrant: learning-oriented
prerequisites: [Pré-requisito 1, Pré-requisito 2]
estimated_time: "X minutos"
---

# [Nome do Tutorial]

## O que você vai aprender
[Descrição de 1-2 frases do que o leitor será capaz de fazer ao final.]

## Pré-requisitos

- [ ] [Pré-requisito 1] — [detalhe, ex.: "Node.js ≥ 18 instalado"]
- [ ] [Pré-requisito 2] — [detalhe, ex.: "Acesso ao repositório X"]
- [ ] [Conhecimento básico de Y] — [referência externa opcional]

## Passo 1: [Título do passo]

[Ação clara e direta. Apenas o necessário para este passo.]

```bash
# Comando que o leitor deve executar
comando --exemplo
```

**Resultado esperado:** [O que o leitor deve ver/obter após executar.]

## Passo 2: [Título do passo]

[Ação seguinte, construindo sobre o passo anterior.]

```typescript
// Código para criar/alterar
const exemplo = novoExemplo();
```

**Resultado esperado:** [O que deve acontecer.]

## [...]

## Próximos passos

- [Link para How-to relacionado]
- [Link para Explanation aprofundada]
- [Link para Reference sobre o tema]

## Troubleshooting

| Problema | Causa provável | Solução |
|---|---|---|
| [Erro comum 1] | [Causa] | [Solução] |
| [Erro comum 2] | [Causa] | [Solução] |
```

## Regras

1. **Zero pressuposição:** Não assuma conhecimento além dos pré-requisitos listados.
2. **Passos numerados:** Cada passo tem UM comando ou ação.
3. **Resultado esperado:** Cada passo termina com o que o leitor deve ver.
4. **Reproduzível:** O tutorial deve funcionar do início ao fim sem atalhos.
5. **Um conceito por vez:** Introduza novos conceitos gradualmente.
