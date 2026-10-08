## Checklist — antes de concluir
- [ ] **Estado**: o componente/função muda o estado certo ao receber o evento.
- [ ] **Impacto**: o evento altera de fato a regra de negócio ou o valor final (assert na saída, não no log).
- [ ] **Execução**: testes, build ou script foram **executados** no `HEAD` atual; prova viva fresca.
- [ ] Os portões do Dial passaram na ordem do R4; ponta a ponta quando cruza front→API→DB.
- [ ] O revisor independente (não o autor) viu requisitos + diff + evidência, quando o Dial ou o risco pede.
- [ ] Cada afirmação importante está marcada ([Validado]/[Não testado]/[Falhou]/[Não verificável]).
- [ ] Limpeza R9 feita.
- [ ] A resposta traz: **O que foi alterado** · **Grafo executado** (`[Estado] → [Regra] → [Verificador]`) · **Evidência real**. Sem evidência, digo que não está concluído.
