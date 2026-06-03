# Superpowers

**Tier:** skill · **Versão pinada:** `v5.1.0` @ commit `f2cbfbefebbf` · **Origem:** git `obra/superpowers` (https://github.com/obra/superpowers) · **Destino:** `.harness/tools/superpowers/`

## Responsabilidade
Skill avançada para: TDD, debugging avançado, refatoração, revisão arquitetural, investigação de bugs, estratégias de implementação.

## Quando usar
Bugs complexos · refatorações grandes · arquitetura crítica · problemas difíceis de reproduzir. Alimenta o agente **Planner**.

## Instalação
Fonte clonada pinada (tag `v5.1.0`, commit `f2cbfbefebbf`) em `.harness/tools/superpowers/` pelo `install.sh` (`vendor.js`). Re-vendorize com `node .harness/tools/bsd.js --vendor --only superpowers`. Para ativar como plugin do Claude Code, aponte para o clone pinado.

## Verificação
```bash
test -d ~/.claude/skills/superpowers && echo OK    # ou via --doctor (type: skill)
```

## Determinismo
Total se instalado pela tag/commit pinado.
