# prepush — camadas, ferramentas e o que o mercado oferece (levantamento de 2026-09-04)

## Por que esta skill existe

Em 2026-09-02 e 2026-09-04 o mesmo padrão custou rodadas inteiras no CoverPay: clone atrás da `homol`, diagnóstico feito em cima de código velho, e um consent do Google gravado sem escopo porque nada validava. Branch protection do GitHub não existe em repo privado sem plano Pro, então o portão tem de ser **local e em camadas**: cada camada pega uma classe de defeito que a anterior não pega.

O pedido do JP: uma skill que faça "o que o TestSprite faz e o que o CodeRabbit faz, mais camadas, e sempre pull antes de push". O desenho abaixo cobre isso com o que roda **nesta máquina, sem mandar código para nuvem por padrão**, e deixa os serviços pagos como camadas opcionais.

## As camadas e o que cada uma pega

| # | Camada | Ferramenta | Pega | Custo |
|---|---|---|---|---|
| 1 | sincronizar | `git fetch` + `rebase` | trabalho em cima de base velha, conflito descoberto na PR | 0 |
| 2 | segredos | **gitleaks** (instalado 04/09 via winget) + regex interna | chave AWS/Google/GitHub/Stripe/Slack, URL com senha, `.env`, chave privada, caminho `C:\Users\fulano` (LGPD) | 0 |
| 3 | estático | typecheck, lint, `npm audit`, ruff | erro de tipo, regra de lint, dependência vulnerável | 0 |
| 4 | testes | suíte completa do repo | regressão coberta | tempo |
| 5 | cobertura da mudança | script | arquivo alterado sem teste | 0 |
| 6 | testes da mudança | Claude escreve e roda | comportamento novo sem prova (TestSprite local) | tokens |
| 7 | revisão adversarial | `/code-review high` + CodeRabbit/Greptile CLI se houver | lógica, borda, segurança, contrato (CodeRabbit local) | plano / grátis |
| 8 | subir | `git push`, `gh pr`, CI watch | — | 0 |

## O que o mercado tem (set/2026) e onde cada um entra

### Revisão por IA (o "CodeRabbit")

| Ferramenta | Como roda | Custo | Veredito para o JP |
|---|---|---|---|
| **Claude Code `/code-review`** | local, subagente, lê `CLAUDE.md`; níveis `low`…`max` | dentro do plano | **Revisor 1, obrigatório.** Já está aqui, zero setup. |
| **Claude Code `/code-review ultra`** | nuvem, frota de agentes + verificação que tenta derrubar cada achado; <1% de falso positivo reportado | US$ 5–20 por rodada | Para PR grande ou área sensível (auth, dinheiro, dados). Só com sim do usuário. |
| **CodeRabbit CLI** (`cr`) | terminal, `cr review --base homol --agent` (JSON para agente); plugin `/coderabbit:review` | grátis 3 revisões/hora; US$ 0,25/arquivo além; Pro US$ 24/dev/mês | **Revisor 2 opcional.** Segunda opinião de outro fornecedor. Instalar: `irm https://cli.coderabbit.ai/install.ps1 \| iex` e `cr auth login`. |
| **Greptile CLI** | `greptile review --branch homol --agent`; indexa o repo inteiro; em teste independente pegou ~82% dos bugs plantados vs ~44% do CodeRabbit, com mais ruído | pago (sem tier grátis claro) | Alternativa ao CodeRabbit como revisor 2 se um dia valer o custo. |
| **Cursor Bugbot** | só GitHub, ~90 s, US$ 1–1,50 por revisão | uso | Não entra: exige PR no GitHub, sem CLI. |
| **Qodo Command** | agentes configuráveis no terminal, `qodo --ui` | plano | Mais plataforma que gate; não entra agora. |
| **Copilot Code Review** | reviewer nativo do GitHub | incluso no Copilot | Só se a org pagar Copilot. |

Conclusão: dois revisores de fornecedores diferentes pegam mais que um revisor caro. Revisor 1 é o `/code-review` (já pago). Revisor 2, quando instalado, é o CodeRabbit CLI no tier grátis.

### Testes gerados (o "TestSprite")

| Ferramenta | Como roda | Custo | Veredito |
|---|---|---|---|
| **TestSprite MCP** | MCP no IDE; lê PRD + explora o app vivo; gera e **executa na nuvem** E2E (Playwright) e API (Python); auto-heal; benchmark próprio: 42% → 93% de pass em uma iteração | créditos; código e app vão para a nuvem | Camada 6 opcional quando há ambiente vivo e PRD. Não é padrão: manda o app para fora. |
| **Claude gera testes do diff** (camada 6 desta skill) | local; regra de qualidade do `no-mistakes` (nada de grep no fonte) | tokens | **Padrão.** Prova comportamento novo sem sair da máquina. |
| **Shiplight AI** | testes E2E em YAML no repo, roda local sem conta | grátis/OSS | Candidato se o V2 ganhar suíte E2E versionada. |
| Playwright MCP + skill `playwright-generate-test` | gera spec executando os passos no browser | 0 | Usar para smoke E2E do V2 quando houver URL de homolog. |

### Segredos

Padrão que o mercado converge em 2026: **gitleaks no hook** (regex, <1 s), TruffleHog em CI com verificação de credencial viva, Semgrep para padrão AST (segredo montado por concatenação). Aqui: gitleaks instalado no Windows (`winget install Gitleaks.Gitleaks`); WSL ainda sem (`brew install gitleaks` ou binário da release). A varredura interna cobre quando o gitleaks falta.

### Pipeline de push completo

| Ferramenta | O que é | Veredito |
|---|---|---|
| **no-mistakes** (já instalado no WSL, v1.48 → 1.57 disponível) | proxy git local: `git push no-mistakes` → worktree descartável → intent, rebase, review, test, document, lint, push, PR, CI; agente configurável | É o mais próximo de "prepush pronto". Limites: vive no WSL, revisão é um agente só, sem varredura de segredos nem cobertura da mudança. **O `/prepush` cobre essas lacunas e roda em Windows e WSL.** Os dois convivem: `/prepush` como gate, `no-mistakes` quando quiser o PR automático com CI babysitting. |
| pre-push hook do harness V-JP (v1.18) | roda `npm test`, bloqueia | Substituído por `scripts/pre-push-hook.sh`: mesma ideia + branch atrás + segredos. |

## Instalação nesta máquina (estado em 2026-09-04)

- Skill: `~/.claude/skills/prepush/` (Windows). Copiar para `\\wsl$\Ubuntu-24.04\home\jpdev\.claude\skills\prepush` para usar no WSL.
- gitleaks: instalado (Windows). O gate adiciona `%LOCALAPPDATA%\Microsoft\WinGet\Links` ao PATH sozinho.
- Hook global (`/prepush --instalar-hook`): `~/.githooks/pre-push` + `git config --global core.hooksPath ~/.githooks`.
- Opcionais: CodeRabbit CLI (`cr`), Greptile CLI, TestSprite MCP, `gh` (já tem).

## Config por repositório (git config)

| Chave | Efeito |
|---|---|
| `prepush.base` | branch de integração (senão detecta homol/develop/main/master) |
| `prepush.testcmd` | comando de teste (senão `hooks.testcmd`, senão `npm test`/`pytest`/`go test`) |
| `prepush.audit` | `warn` (padrão) / `block` / `off` |
| `prepush.hook.testes` | `off` para o hook não rodar a suíte (o `/prepush` roda sempre) |
| `prepush.e2eurl` | URL viva para smoke E2E na camada 6 |
| `prepush.ci` | `watch` para `gh pr checks --watch` depois da PR |

## Fontes

- CodeRabbit CLI: https://www.coderabbit.ai/blog/coderabbit-cli-free-ai-code-reviews-in-your-cli · https://docs.coderabbit.ai/cli/overview · preços https://toolradar.com/tools/coderabbit/pricing
- TestSprite: https://docs.testsprite.com/ · alternativas https://www.shiplight.ai/blog/best-testsprite-alternatives
- Comparativos de revisão por IA: https://www.greptile.com/content-library/best-ai-code-review-tools · https://codeant.ai/blogs/best-ai-code-review-tools · https://deepsource.com/resources/ai-code-review-tools
- Greptile CLI: https://www.greptile.com/docs/code-review/greptile-cli
- Qodo Command: https://github.com/qodo-ai/command
- Claude Code Code Review / ultrareview: https://code.claude.com/docs/en/code-review · https://code.claude.com/docs/en/ultrareview
- Segredos: https://iancloud.ai/blog/secrets-scanning-pre-commit-era-gitleaks-trufflehog-semgrep-2026 · https://www.decryptiondigest.com/blog/prevent-developers-pushing-secrets-git-pre-commit-gitleaks-guide
- no-mistakes: https://github.com/kunchenguid/no-mistakes · https://kunchenguid.github.io/no-mistakes/concepts/gate-model/
