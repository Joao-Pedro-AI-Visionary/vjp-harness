# GBrain Memory: Operational Commands & CLI Recipes

Receitas de comandos CLI validadas para operar no projeto de forma segura e repetível.

---

## 1. Comandos de Orquestração do Harness (BSD)
- **Executar uma feature**:
  ```bash
  node .harness/tools/bsd.js --execute <nome-da-feature>
  ```
- **Retomar pipeline interrompido**:
  ```bash
  node .harness/tools/bsd.js --continue
  ```
- **Dashboard de progresso e histórico**:
  ```bash
  node .harness/tools/bsd.js --status
  ```
- **Limpeza de emergência (worktrees + histórico)**:
  ```bash
  node .harness/tools/bsd.js --reset
  ```

## 2. Empacotamento de Contexto (Repomix)
```bash
node .harness/tools/node_modules/repomix/bin/repomix.cjs --config .harness/config/repomix.config.json
```

<!-- Adicione receitas específicas do seu projeto abaixo. -->
