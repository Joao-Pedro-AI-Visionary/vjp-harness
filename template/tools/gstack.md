# GStack — Camada Operacional

**Tier:** platform · **Versão pinada:** `1.55.1.0` @ commit `c43c850cae77` · **Origem:** git `garrytan/gstack` (https://github.com/garrytan/gstack)

## Responsabilidade
Base operacional que padroniza e conecta os componentes do Harness: gerenciamento de agentes, workflows, memória (GBrain), ferramentas e convenções de projeto. Fornece o conjunto de skills (`/ship`, `/qa`, `/review`, `/design-*`, `/setup-gbrain`, etc.).

## Papel na arquitetura
Camada que envolve RTK, GBrain, GSD Redux e BSD numa arquitetura coesa e reutilizável.

## Instalação
Plugin/marketplace do Claude Code a partir de `garrytan/gstack`, **no commit pinado** para reprodutibilidade:
```
garrytan/gstack @ c43c850cae77  (v1.55.1.0)
```

## Verificação
```bash
test -d ~/.claude/skills/gstack && echo OK    # ou via --doctor (type: skill)
```

## Determinismo
Total se instalado pelo commit SHA pinado. Atualize o pin em `registry.json` ao subir de versão.
