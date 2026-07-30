# Gate local de push (`pre-push`)

> Substitui a **branch protection** do GitHub, que exige plano **Pro** em repositório privado (a API responde `403 Upgrade to GitHub Pro or make this repository public`). O gate roda na sua máquina, de graça, e bloqueia o push quando os testes falham.

Sem isso, os portões do `AGENT_RULES.md` (§0 Art. III "PR sem teste = bloqueado", §2 "gate por sinal concreto", §8.4 "teste executado") são **convenção, não mecanismo** — nada impede subir código quebrado.

## Instalar (uma vez por máquina, vale para todos os repos)

```bash
mkdir -p ~/.githooks
cp .harness/tools/hooks/pre-push ~/.githooks/pre-push
chmod +x ~/.githooks/pre-push
git config --global core.hooksPath ~/.githooks
```

Repos que usam **husky** não são afetados: o husky define `core.hooksPath` local, e config local vence a global.

## Como ele descobre o comando de teste

Nesta ordem:

1. `git config hooks.testcmd "<comando>"` — override por repo, vence tudo
2. `package.json` na raiz com script `test` → roda `npm test`
3. Nenhum dos dois → **não bloqueia**; só avisa que o repo está sem gate

O passo 1 existe porque nem todo repo tem os testes na raiz. No próprio `vjp-harness`:

```bash
git config hooks.testcmd "cd template/tools && npm test"
```

## Comportamento

| Situação | Resultado |
|---|---|
| Testes passam | push liberado |
| Testes falham | **push bloqueado**, com as últimas 30 linhas da saída |
| Repo sem teste configurado | liberado, com aviso |
| Deleção de branch / push sem commit novo | pulado (não faz sentido testar) |
| `git push --no-verify` | fura o gate — escape hatch de emergência |

## Detalhe de WSL (não remova)

No WSL o `PATH` do Windows vaza para o shell Linux e o `npm` acaba resolvendo para o `node.exe` do Windows, que não enxerga caminhos Linux e quebra com `MODULE_NOT_FOUND: C:\Windows\...`. Por isso o hook filtra as entradas `/mnt/c` do `PATH` e, se ainda assim não achar o `node`, carrega o `~/.nvm/nvm.sh`.

## Verificação

Testado com push real contra um remote bare local, nos quatro cenários da tabela acima — todos confirmados. O escape hatch (`--no-verify`) é intencional: um gate sem saída de emergência vira um gate que as pessoas desinstalam.
