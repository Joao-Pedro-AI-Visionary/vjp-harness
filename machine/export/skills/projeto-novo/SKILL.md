---
name: projeto-novo
description: "Protocolo V-JP para começar um projeto do zero: Fase 0 (ambiente) → perguntas → arquitetura → benchmark tecnológico global com gate de aprovação → escala → orçamento de IA → orquestração → implementação → assets/browser → revisão independente e adversarial → git/PR → limpeza → entrega verificada, com o FORMATO OBRIGATÓRIO. Use quando o usuário disser projeto novo, começar do zero, novo app, novo sistema ou novo MVP."
---
<!-- GERADO por sync-rules.js a partir de core/protocolo/00-projeto-novo.md — não edite aqui: edite core/ e rode sync-rules. -->

# Protocolo de projeto novo (V-JP Harness)

Transforma uma ideia em software funcional, testado, documentado, seguro e sustentável, equilibrando qualidade, velocidade, tokens/custo, CPU/RAM/GPU/disco, escala proporcional, manutenção, UX e segurança.
**Gerar código não é concluir uma tarefa.** A conclusão exige critério de aceitação verificável.

As regras globais (precedência, princípios, tom, verificação, anti-falso-consenso, R1–R9, Dial) já estão carregadas. Este protocolo só as aplica a um projeto que começa do zero. Leia cada fase em `references/` quando chegar nela, e não antes.

## Sequência
| # | Fase | Arquivo | Artefato |
|---|---|---|---|
| 0 | Descoberta do ambiente | `references/fase-00-ambiente.md` | tabela detectado/informado/desconhecido |
| 1 | Descoberta do projeto (perguntas) | `references/fase-01-descoberta.md` | `docs/projeto/PROJECT_BRIEF.md` |
| 2 | Arquitetura preliminar | `references/fase-02-arquitetura.md` | rascunho + ADRs |
| 3 | Benchmark tecnológico global + **gate de aprovação** | `references/fase-03-benchmark.md` | benchmark, matriz, radar, arquitetura final |
| 4 | Estratégia de escala | `references/fase-04-escala.md` | perfil de carga + gatilhos |
| 5 | Orçamento de IA e recursos | `references/fase-05-orcamento-ia.md` | teto por tarefa/projeto |
| 6 | Orquestração multiagente | `references/fase-06-orquestracao.md` | DAG de tasks em `specs/` |
| 7 | Implementação e qualidade | `references/fase-07-implementacao.md` | código + testes + docs |
| 8 | Assets, imagens e browser | `references/fase-08-assets-browser.md` | assets otimizados |
| 9 | Revisão independente e adversarial | `references/fase-09-revisao.md` | relatório de revisão |
| 10 | Git, PR e integração | `references/fase-10-git-pr.md` | commits/PR (com autorização) |
| 11 | Limpeza e recursos | `references/fase-11-limpeza.md` | lista do que foi encerrado |
| 12 | Entrega verificada | `references/fase-12-entrega.md` | relatório final |

As Fases 0–6 só produzem documentos (custo baixo). **Nada de implementação principal antes do gate de aprovação** (critérios na Fase 3). O gate é apresentado no formato abaixo e exige um "aprovado" explícito do João.

## Rigor por nível do Dial (Fase × nível)
A Fase 1 classifica o projeto. A classe do Dial vem do que a mudança toca (prod/migration/db/backend/frontend/config); o tipo do projeto só pode **subir** o nível, nunca descer abaixo do piso. Protótipo/PoC → 1, MVP → 2, produção/alta disponibilidade → 3. Sem dado nenhum, vale o padrão conservador (3).

| Fase | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| 0 Ambiente | curta | ✔ | ✔ | ✔ |
| 1 Descoberta | — | brief curto | brief | brief + critérios de aceitação por fluxo |
| 2 Arquitetura | — | 1 parágrafo | ADRs | ADRs |
| 3 Benchmark + gate | — | rápido (fontes) + "ok" do João | 3 candidatas/camada + matriz | + PoC medida se a decisão for difícil de reverter + revisão adversarial |
| 4 Escala | — | premissa | perfil + gatilhos | + NFR antes do código (`nfr-performance-planner`) |
| 5 Orçamento | teto | teto | teto por etapa | teto por etapa + reserva p/ revisão |
| 6 Orquestração | 1 executor | 1 executor | pipeline + contrato | + especialistas, R1 |
| 7 Implementação | portões | TDD + `test-gate` | + contrato + `pr-review` | + ponta a ponta |
| 8 Assets | se houver | se houver | se houver | se houver |
| 9 Revisão | — | autorrevisão crítica | revisor independente | + revisão adversarial |
| 10–12 | ✔ | ✔ | ✔ | ✔ |

## FORMATO OBRIGATÓRIO DE INICIALIZAÇÃO (apresentar no gate)
1. Resumo do projeto e finalidade.
2. Classificação: protótipo, PoC, MVP ou produção.
3. Plataforma recomendada e alternativas.
4. Stack frontend, backend e banco de dados.
5. Estratégia de autenticação, infraestrutura e escala.
6. Estimativa de complexidade e principais riscos.
7. Plano de agentes e divisão de responsabilidades.
8. Orçamento de IA e recursos locais.
9. Plano de testes e critérios de aceitação.
10. Próxima etapa de execução.

Depois da aprovação, execute de forma incremental, com portões de qualidade, economia de contexto, revisão independente e entrega verificável.

**REGRA FINAL:** simplicidade proporcional à necessidade, automação com controle, revisão independente, orçamento explícito e nenhuma conclusão sem evidência.
