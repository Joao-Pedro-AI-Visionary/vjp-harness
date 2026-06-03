# RTK — Rust Token Killer

**Tier:** core · **Versão pinada:** `0.39.0` · **Origem:** git `rtk-ai/rtk` (https://github.com/rtk-ai/rtk) · **Destino:** `.harness/tools/rtk/`

## Responsabilidade
Proxy CLI otimizador de tokens (60–90% de economia em operações de dev): compressão de contexto, seleção inteligente de arquivos, cache de contexto, resumos incrementais.

## Papel no pipeline
`Repomix → RTK → GSD Redux`. Recebe o pacote bruto do Repomix e entrega contexto otimizado para o planejamento.

## Instalação
Fonte clonada pinada (tag `v0.39.0`, commit `2fbc7514f696`) em `.harness/tools/rtk/` pelo `install.sh` (`vendor.js`). O binário runnable fica em `~/.local/bin/rtk`. Re-vendorize com `node .harness/tools/bsd.js --vendor --only rtk`.

## Verificação
```bash
rtk --version    # deve conter: 0.39.0
```

## Determinismo
Pin por versão + verificação por comando. Origem externa (proprietária `rtk-ai`) → atualize o pin em `registry.json` ao trocar de versão.

> ⚠️ Colisão de nome: existe `reachingforthejack/rtk` (Rust Type Kit). Confirme com `rtk gain` (deve funcionar).
