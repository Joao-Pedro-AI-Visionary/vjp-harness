# Headroom — Compressor de Contexto

**Uso**: proxy local que comprime tudo o que o agente lê (tool outputs, logs, JSON, código, histórico) antes de ir pro modelo. Originais ficam em cache local e voltam sob demanda (`headroom_retrieve`).

## Como abrir a sessão

```bash
cch                                  # = headroom wrap claude --port 8790 --code-memory none
cch -p "pergunta"                    # args repassados ao claude
claude                               # sem compressão (precisa dele para /remote-control)
```

## Meta-comandos

```bash
headroom savings                     # economia acumulada
headroom doctor --port 8790          # saúde do proxy (com sessão aberta)
headroom telemetry                   # deve mostrar: Upload beacon: OFF
```

## Regras

- Nada de hook no Bash: a compressão acontece no proxy, transparente.
- `HEADROOM_BEACON=off` sempre (telemetria vem ligada por padrão).
- Porta 8790 (a 8787 colide com serviço do WSL).
- Se precisar da saída crua de algo comprimido, o modelo chama `headroom_retrieve`; para auditoria, salve o output completo em arquivo.
