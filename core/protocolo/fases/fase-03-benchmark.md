# Fase 3 — Benchmark tecnológico global + gate de aprovação

**Missão:** depois da arquitetura preliminar e antes de aprovar a stack, investigar em escala mundial quais tecnologias, frameworks, ferramentas e arquiteturas entregam o melhor resultado para **este** projeto. Não se limite ao que o agente já conhece nem ao que é popular. Profundidade proporcional ao Dial e à reversibilidade da decisão.

1. **Pesquisa global**, em fontes atuais: GitHub/open source, documentação oficial e changelogs, benchmarks independentes e reproduzíveis, artigos de engenharia, publicações acadêmicas, CNCF, Stack Overflow Developer Survey, Thoughtworks Technology Radar, ecossistemas emergentes (front, back, banco, infra, IA) e casos de produção comparáveis. Pesquise em inglês e em outros idiomas quando valer a pena. Para cada evidência, registre **fonte, versão, data, limitação e confiabilidade**. Não afirme superioridade sem evidência.
2. **Comparação:** por camada, de preferência três candidatas (a preliminar, uma consolidada e uma emergente promissora). Critérios: desempenho/latência, CPU/RAM/disco, escala e concorrência, segurança e histórico de CVEs, maturidade e manutenção, DX, integração com agentes de IA, ecossistema, custo de hospedagem e operação, compatibilidade e migração, complexidade e adequação ao produto. Mais nova não significa melhor.
3. **Benchmark prático**, quando há duas ou mais alternativas competitivas numa decisão relevante: cenário representativo → métricas e limites → PoC mínima → condições comparáveis → p50/p95/p99, throughput, memória, CPU e custo → repetir e registrar as condições → comparar com os requisitos reais → descartar as inferiores. Benchmark sintético nunca é a única evidência. Se a PoC custar mais que o risco da decisão, justifique a dispensa.
4. **Matriz de decisão:** nota 0–10 por critério ponderado. Os pesos são definidos **por projeto**, nunca fixados globalmente, e somam 100% (exemplo: adequação 30, performance/escala 20, custo 20, manutenção 15, segurança 10, maturidade 5). A matriz mostra a stack proposta, as alternativas, os resultados medidos ou documentados, prós e contras, o custo estimado, os riscos e a justificativa. Marque o que é **medição**, **estimativa** ou **hipótese**. Nenhuma tecnologia ganha ponto por ser nova.
5. **Technology watch:** classifique o que é promissor, mas ainda não entra, como ADOPT, TRIAL, ASSESS ou HOLD.
6. **Gate de aprovação.** A implementação principal (Fase 7) não começa antes de:
   - investigação proporcional ao risco concluída;
   - alternativas relevantes comparadas;
   - evidências e fontes registradas;
   - compatibilidade e custos validados;
   - decisão arquitetural final documentada;
   - FORMATO OBRIGATÓRIO apresentado e **"aprovado" explícito do João**.
   Projeto simples aceita pesquisa rápida. Decisão difícil de reverter exige investigação profunda + revisão adversarial (`13`).

**Artefatos** (em `docs/projeto/`): `GLOBAL_TECH_BENCHMARK.md`, `TECH_DECISION_MATRIX.md`, `TECHNOLOGY_RADAR.md`, `ARCHITECTURE_FINAL.md` + ADRs em `.gbrain/decisions.md`. Até o nível 1 do Dial, os quatro podem ser seções de um único `ARCHITECTURE_FINAL.md`. Versões escolhidas entram **pinadas** (R6).

**Regra central:** buscar a tecnologia mais **adequada**, não a mais nova, a mais rápida em teste isolado ou a mais popular. Rode o benchmark de novo quando surgir necessidade de escala, quando uma dependência crítica entrar em fim de suporte ou quando aparecer vantagem comprovada. Arquitetura não fica congelada, mas também não migra por modismo.
