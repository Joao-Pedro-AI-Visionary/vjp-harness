# Fase 11 — Limpeza e gerenciamento de recursos

Ao terminar (R9):
- Identifique os processos Node.js e Python e os serviços iniciados **por esta execução**.
- Encerre só os que pertencem ao projeto e não têm uso pendente.
- Desligue os containers temporários criados pela tarefa e libere as portas dos servidores de dev temporários.
- Feche os navegadores automatizados sem afetar sessões pessoais.
- Finalize agentes auxiliares e workers ociosos e descarregue modelos locais da memória quando fizer sentido.
- Remova só arquivos temporários comprovadamente descartáveis. Worktree só sai com os commits preservados e nada pendente.
- **Preserve** bancos locais, volumes, `.env`, migrações e dados persistentes. Nunca apague banco como forma padrão de economizar memória.

Registre os recursos encerrados e os que continuaram ativos.
