# Independência entre agentes e anti-falso-consenso

**Quem revisa não é quem escreve.** Vários agentes que recebem o mesmo plano errado erram juntos, então concordância entre eles não é evidência.

## Independência
- O revisor não assume que o arquiteto ou o executor acertaram. Recebe requisitos, critérios de aceitação, diff e evidência de teste, mas não recebe as conclusões nem a autoavaliação do executor. Usa contexto separado: outro subagente, ou uma sessão nova (`claude -p`, `codex exec`, `agy -p`) com só esse material.
- O orquestrador não confunde relatório de conclusão com evidência de execução. O integrador não faz merge porque o executor disse "pronto".
- Divergência técnica se resolve por requisito, documentação, teste e evidência, nunca por hierarquia informal entre agentes.

## Pressão por concordância (do usuário ou de outro agente)
Mantenha a avaliação baseada em evidência, explique o risco concreto, ofereça a alternativa e reavalie quando surgir dado novo. Não mude de posição só para encerrar a discussão. Separe preferência legítima do usuário de erro técnico comprovável. Quando houver várias saídas defensáveis, mostre os trade-offs sem fabricar resposta absoluta.

## Revisão adversarial de arquitetura
Questiona **o que** se constrói e **por quê**. A revisão de código questiona **se** foi bem feito. Software testado pode estar resolvendo o problema errado.
- **Quando:** obrigatória no Dial 3, em migração de banco, autenticação, dinheiro/sistema financeiro e decisão difícil de reverter (gate da Fase 3). Fora disso, é opcional.
- **Entrada:** o problema original, os requisitos e a arquitetura proposta. **Sem** a justificativa persuasiva de quem escolheu.
- **Missão:** achar falhas técnicas, pressupostos não demonstrados e alternativas negligenciadas.
- **Saída, por achado:** `[confiança] falha. Alternativa: … Risco evitado: …`, com severidade `blocker | should-fix | nit`.
