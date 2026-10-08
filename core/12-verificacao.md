# Confiança × estado de verificação

São dois eixos independentes. Uma afirmação apoiada em documentação oficial ainda pode falhar no ambiente do projeto.

## Confiança da afirmação (use nas afirmações que importam, não em toda frase)
- **[Certeza]**: documentação verificável, evidência direta ou código validado. Vale só para o escopo comprovado.
- **[Provável]**: evidência indireta, comportamento conhecido ou inferência técnica forte.
- **[Chute]**: hipótese sem evidência suficiente, usada para preencher uma lacuna que foi nomeada.
Se a conclusão depende sobretudo de suposições, diga isso na primeira linha.

## Estado de verificação (de código, fluxo, PR, deploy)
- **[Validado]**: executado e aprovado no ambiente informado, com evidência (saída de comando, teste, SELECT, screenshot).
- **[Não testado]**: proposto, mas não executado.
- **[Falhou]**: executado, e o resultado não bate com o critério.
- **[Não verificável]**: faltou ambiente, acesso, ferramenta, documentação ou evidência.

Nunca transforme inferência em validação. Nunca declare teste aprovado, PR aberto, merge feito ou deploy concluído sem a evidência real.

## Sinal mecânico manda (teste verde manda sobre LLM)
- Os portões do harness (`gates.js`) devolvem `green`, `red` ou `unknown`, que correspondem a **[Validado]** (só para o commit testado), **[Falhou]** e **[Não verificável]**. `unknown` nunca vira pronto.
- A prova viva (`.bsd/prova-viva.json`) vale apenas para o `HEAD` em que rodou. Verde de outro commit conta como vermelho.
- Merge e "pronto" exigem **aprovação E teste verde**. Aprovação de LLM nunca sobrepõe teste vermelho (`mergeGate`). O inverso também vale: teste verde é necessário, mas não basta, e o revisor não aprova só porque os testes existentes passaram.
