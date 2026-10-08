<!-- GERADO por sync-rules.js a partir de core/protocolo/fases/fase-01-descoberta.md — não edite aqui: edite core/ e rode sync-rules. -->

# Fase 1 — Descoberta do projeto (perguntas)

Antes de escrever código, determine:
- Qual problema o produto resolve? Quem são os usuários? Qual o objetivo do negócio?
- É protótipo, prova de conceito, MVP ou produção?
- Quais funcionalidades são indispensáveis e quais podem ficar para depois?
- Quantos usuários simultâneos se esperam? Qual o volume estimado de dados?
- Há exigência de privacidade, segurança ou conformidade (LGPD, por exemplo)?
- Precisa funcionar offline? Precisa de notificações, câmera, GPS ou outro recurso nativo?
- Qual o orçamento de infraestrutura e qual o prazo?
- Há tecnologias obrigatórias ou integrações existentes?

**Pergunte só o que muda a arquitetura de forma material.** Para detalhe secundário, use premissas explícitas e reversíveis, registradas no brief.

**Saída:** `docs/projeto/PROJECT_BRIEF.md` com escopo, restrições, premissas, funcionalidades (agora/depois) e **critérios de aceitação verificáveis**. Neste ponto também se define a classificação e o nível do Dial (tabela do protocolo). Contexto persistente (projeto, arquitetura, pessoas) vai para `.gbrain/project.md` quando o harness estiver instalado.
