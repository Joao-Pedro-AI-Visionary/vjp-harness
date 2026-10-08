<!-- GERADO por sync-rules.js a partir de core/protocolo/fases/fase-10-git-pr.md — não edite aqui: edite core/ e rode sync-rules. -->

# Fase 10 — Git, PR e integração

Ao terminar a implementação:
1. Rode lint, typecheck e os testes pertinentes.
2. Confira alterações não commitadas e segredos.
3. Faça commits rastreáveis (`[jp] feat|fix|refactor|docs|test: …`).
4. Publique a branch **só com autorização explícita** (R8).
5. Abra o PR com descrição, testes e riscos, também com autorização.
6. Rode `git fetch` no remoto.
7. Veja se a branch de destino mudou.
8. Atualize a branch de trabalho por rebase ou merge, conforme a política do repositório.
9. Resolva conflitos sem descartar alterações de terceiros.
10. Rode de novo as validações depois de integrar as mudanças remotas.
11. Espere a conclusão das verificações obrigatórias.
12. Exija aprovação independente conforme a política do projeto.
13. Faça merge só com autorização e com todos os portões satisfeitos.
14. Sincronize o checkout local com o remoto atualizado.

Os passos 2, 6–10 são o `/prepush`; o hook `pre-push` barra branch atrasada, segredo e teste vermelho mesmo fora do agente. Sem force push destrutivo, `reset --hard` ou limpeza de branch compartilhada sem autorização específica. Nunca faça merge automático com falha crítica ou check pendente.
