#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# prepush — gate mecânico (camadas 0 a 5). Roda em Git Bash (Windows) e WSL.
#
# Uso:  gate.sh [--base <branch>] [--no-rebase] [--hook] [--skip=a,b,c]
#               [--json <arquivo>] [--only=testes]
#
#   --base       branch de integração (padrão: git config prepush.base,
#                senão upstream, senão a primeira que existir em
#                homol/develop/main/master)
#   --no-rebase  bloqueia em vez de rebasear quando a branch está atrás
#   --hook       modo hook de git (sem rebase, sem cor, sem prompt)
#   --skip=      pula camadas: sync,segredos,estatico,testes,cobertura
#   --json       grava o resultado por camada em JSON
#
# Saída: relatório humano em stderr, uma linha final PREPUSH_RESULT=ok|bloqueado
# em stdout. Código: 0 ok · 1 bloqueado · 2 uso/ambiente.
# ---------------------------------------------------------------------------
set -uo pipefail

BASE=""; NO_REBASE=0; HOOK=0; SKIP=""; JSON=""; ONLY=""
for a in "$@"; do
  case "$a" in
    --base=*) BASE="${a#*=}" ;;
    --base) shift; BASE="${1:-}" ;;
    --no-rebase) NO_REBASE=1 ;;
    --hook) HOOK=1; NO_REBASE=1 ;;
    --skip=*) SKIP="${a#*=}" ;;
    --json=*) JSON="${a#*=}" ;;
    --json) shift; JSON="${1:-}" ;;
    --only=*) ONLY="${a#*=}" ;;
  esac
done

if [ "$HOOK" -eq 1 ] || [ ! -t 2 ]; then RED=""; GRN=""; YLW=""; DIM=""; BLD=""; RST="";
else RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; DIM=$'\033[2m'; BLD=$'\033[1m'; RST=$'\033[0m'; fi
say()  { printf '%s\n' "$*" >&2; }
ok()   { say "${GRN}✔ $*${RST}"; }
warn() { say "${YLW}⚠ $*${RST}"; }
fail() { say "${RED}✖ $*${RST}"; }
skip() { case ",$SKIP," in *",$1,"*) return 0;; esac; return 1; }

# Estado por camada, sem array associativo: o bash do macOS e 3.2, onde
# `declare -A` nao existe e o indice vira expressao aritmetica -- com `set -u`
# a primeira marcacao morre em "sync: unbound variable". Um par de variaveis
# por camada roda igual em bash 3.2, 5.x, Git Bash e WSL.
ST_sync=""; ST_segredos=""; ST_estatico=""; ST_testes=""; ST_cobertura=""
NOTA_sync=""; NOTA_segredos=""; NOTA_estatico=""; NOTA_testes=""; NOTA_cobertura=""
BLOQUEADO=0
marca() { eval "ST_$1=\$2; NOTA_$1=\${3:-}"; [ "$2" = "bloqueado" ] && BLOQUEADO=1; return 0; }
st()   { eval "printf '%s' \"\${ST_$1:-}\""; }
nota() { eval "printf '%s' \"\${NOTA_$1:-}\""; }

# Binários instalados pelo winget ficam fora do PATH do Git Bash até reabrir o shell.
if [ -n "${LOCALAPPDATA:-}" ] && command -v cygpath >/dev/null 2>&1; then
  WG="$(cygpath -u "$LOCALAPPDATA")/Microsoft/WinGet"
  export PATH="$PATH:$WG/Links"
  for d in "$WG"/Packages/Gitleaks.Gitleaks_*; do [ -d "$d" ] && export PATH="$PATH:$d"; done
fi
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { fail "não é um repositório git"; exit 2; }
cd "$ROOT" || exit 2
LOGDIR="${TMPDIR:-/tmp}/prepush-$(basename "$ROOT")"; mkdir -p "$LOGDIR"

# ── Camada 0 · contexto ─────────────────────────────────────────────────────
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
[ "$BRANCH" = "HEAD" ] && { fail "HEAD solto (detached); faça checkout de uma branch"; exit 2; }
REMOTE=$(git config --get "branch.$BRANCH.remote" || echo origin)
git remote get-url "$REMOTE" >/dev/null 2>&1 || { fail "remoto '$REMOTE' não existe"; exit 2; }

if ! skip sync; then
  say "${DIM}▶ fetch $REMOTE --prune${RST}"
  git fetch "$REMOTE" --prune --quiet 2>"$LOGDIR/fetch.log" || { fail "fetch falhou: $(tail -1 "$LOGDIR/fetch.log")"; exit 2; }
fi

if [ -z "$BASE" ]; then BASE=$(git config --get prepush.base || true); fi
if [ -z "$BASE" ]; then
  for c in homol develop main master; do
    git show-ref --verify --quiet "refs/remotes/$REMOTE/$c" && { BASE="$c"; break; }
  done
fi
UPSTREAM=""
# `rev-parse --abbrev-ref @{u}` ecoa "@{u}" literal quando não há upstream — validar antes.
if git rev-parse --verify -q '@{u}' >/dev/null 2>&1; then UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null); fi
# Sem base remota (repo novo, primeira publicação): não há do que estar atrás.
# As camadas de segredo/testes rodam sobre TODA a história que vai subir.
SEM_BASE=0; EMPTY_TREE=$(git hash-object -t tree /dev/null)
if [ -z "$BASE" ] || ! git show-ref --verify --quiet "refs/remotes/$REMOTE/$BASE"; then
  if [ -n "$UPSTREAM" ]; then BASE="${UPSTREAM#"$REMOTE"/}"; else SEM_BASE=1; BASE="${BASE:-$BRANCH}"; fi
fi
# Remoto sem refspec de fetch (`git fetch` só atualiza FETCH_HEAD e origin/<base>
# fica velho para sempre — visto no vjp-harness em 04/09/2026): busca a base e a
# própria branch por refspec explícito, para a checagem de "atrás" ser real.
if ! skip sync && [ "$SEM_BASE" -eq 0 ]; then
  if [ -z "$(git config --get-all "remote.$REMOTE.fetch" 2>/dev/null)" ]; then
    warn "remoto '$REMOTE' sem remote.$REMOTE.fetch — corrija: git config remote.$REMOTE.fetch '+refs/heads/*:refs/remotes/$REMOTE/*'"
  fi
  git fetch --quiet "$REMOTE" "+refs/heads/$BASE:refs/remotes/$REMOTE/$BASE" 2>>"$LOGDIR/fetch.log" || true
  git fetch --quiet "$REMOTE" "+refs/heads/$BRANCH:refs/remotes/$REMOTE/$BRANCH" 2>>"$LOGDIR/fetch.log" || true
fi
# A própria branch base subindo (ex.: push em main): o que importa é o upstream.
if [ "$BRANCH" = "$BASE" ] && [ -n "$UPSTREAM" ]; then BASE="${UPSTREAM#"$REMOTE"/}"; fi
if [ "$SEM_BASE" -eq 1 ]; then RANGE="HEAD"; elif [ -n "$UPSTREAM" ]; then RANGE="$UPSTREAM..HEAD"; else RANGE="$REMOTE/$BASE..HEAD"; fi
N_OUT=$(git rev-list --count "$RANGE" 2>/dev/null || echo 0)

say ""
say "${BLD}prepush · $(basename "$ROOT")${RST}"
say "${DIM}  branch : $BRANCH${UPSTREAM:+ (upstream $UPSTREAM)}"
say "  base   : $([ "$SEM_BASE" -eq 1 ] && echo "(nenhuma no remoto — primeira publicação)" || echo "$REMOTE/$BASE")"
say "  a subir: $N_OUT commit(s) em $RANGE${RST}"
git log --oneline "$RANGE" 2>/dev/null | head -15 | sed 's/^/    /' >&2
say ""

# ── Camada 1 · sincronizar (pull antes do push) ─────────────────────────────
if skip sync; then marca sync pulado; elif [ "$SEM_BASE" -eq 1 ]; then
  ok "primeira publicação: nada no remoto para sincronizar"; marca sync ok "sem base remota"
else
  # Árvore suja só impede o REBASE. O que sobe é o que está commitado; arquivo
  # modificado e não commitado não viaja no push — no hook é aviso, não bloqueio.
  SUJA=0; [ -n "$(git status --porcelain --untracked-files=no)" ] && SUJA=1
  [ "$SUJA" -eq 1 ] && { warn "árvore suja (não sobe no push, mas impede rebase):"; git status --short --untracked-files=no | head -6 | sed 's/^/    /' >&2; }
  {
    ATRAS=0
    git merge-base --is-ancestor "$REMOTE/$BASE" HEAD || ATRAS=1
    if [ -n "$UPSTREAM" ] && [ "$(git rev-list --count "HEAD..$UPSTREAM")" -gt 0 ]; then ATRAS=1; fi
    if [ "$ATRAS" -eq 0 ]; then
      ok "sincronizada: contém $REMOTE/$BASE$([ -n "$UPSTREAM" ] && [ "$UPSTREAM" != "$REMOTE/$BASE" ] && echo " e $UPSTREAM")"
      marca sync ok
    elif [ "$SUJA" -eq 1 ]; then
      fail "branch ATRÁS de $REMOTE/$BASE$([ -n "$UPSTREAM" ] && [ "$UPSTREAM" != "$REMOTE/$BASE" ] && echo " e $UPSTREAM") e árvore suja: commit ou stash, depois rode /prepush"
      marca sync bloqueado "atras da base + arvore suja"
    elif [ "$NO_REBASE" -eq 1 ]; then
      fail "branch ATRÁS de $REMOTE/$BASE$([ -n "$UPSTREAM" ] && [ "$UPSTREAM" != "$REMOTE/$BASE" ] && echo " e $UPSTREAM"): faça pull/rebase antes (rode /prepush)"
      marca sync bloqueado "atras da base"
    else
      say "${DIM}▶ rebase em $REMOTE/$BASE${RST}"
      ALVO="$REMOTE/$BASE"
      if [ -n "$UPSTREAM" ] && [ "$(git rev-list --count "HEAD..$UPSTREAM")" -gt 0 ]; then ALVO="$UPSTREAM"; fi
      if git rebase --quiet "$ALVO" >"$LOGDIR/rebase.log" 2>&1; then
        if [ "$ALVO" != "$REMOTE/$BASE" ] && ! git merge-base --is-ancestor "$REMOTE/$BASE" HEAD; then
          git rebase --quiet "$REMOTE/$BASE" >>"$LOGDIR/rebase.log" 2>&1 || { git rebase --abort; fail "conflito ao rebasear em $REMOTE/$BASE (abortado)"; marca sync bloqueado "conflito"; }
        fi
        [ "$ST_sync" != "bloqueado" ] && { ok "rebase feito em $ALVO"; marca sync ok "rebase em $ALVO"; }
      else
        git rebase --abort 2>/dev/null
        fail "conflito no rebase em $ALVO (abortado). Resolva à mão: git rebase $ALVO"
        grep -E "^CONFLICT" "$LOGDIR/rebase.log" | head -5 | sed 's/^/    /' >&2
        marca sync bloqueado "conflito"
      fi
    fi
  }
fi
N_OUT=$(git rev-list --count "$RANGE" 2>/dev/null || echo 0)
if [ "$SEM_BASE" -eq 1 ]; then DIFF_RANGE="$EMPTY_TREE..HEAD"; LOG_OPTS="HEAD"; else DIFF_RANGE="$REMOTE/$BASE...HEAD"; LOG_OPTS="$DIFF_RANGE"; fi

# ── Camada 2 · segredos e dados pessoais ────────────────────────────────────
if skip segredos; then marca segredos pulado; else
  ACHADOS=0
  if command -v gitleaks >/dev/null 2>&1; then
    if gitleaks git --no-banner --redact --exit-code 1 --log-opts="$LOG_OPTS" . >"$LOGDIR/gitleaks.log" 2>&1 \
       || gitleaks detect --no-banner --redact --exit-code 1 --log-opts="$LOG_OPTS" >"$LOGDIR/gitleaks.log" 2>&1; then
      ok "gitleaks: nenhum segredo nos commits a subir"
    else
      if grep -qiE "leaks found|Finding:" "$LOGDIR/gitleaks.log"; then
        fail "gitleaks encontrou segredo(s):"; grep -E "Finding:|File:|Line:|RuleID:" "$LOGDIR/gitleaks.log" | head -12 | sed 's/^/    /' >&2
        ACHADOS=1
      else
        warn "gitleaks falhou ao rodar ($(tail -1 "$LOGDIR/gitleaks.log")); usando varredura interna"
      fi
    fi
  else
    warn "gitleaks não instalado (winget install Gitleaks.Gitleaks / brew install gitleaks); usando varredura interna"
  fi
  # Varredura interna: só linhas ADICIONADAS nos commits a subir.
  ADD=$(git diff "$DIFF_RANGE" --unified=0 --no-color -- . ':(exclude)*.lock' ':(exclude)package-lock.json' ':(exclude)yarn.lock' ':(exclude)pnpm-lock.yaml' 2>/dev/null \
        | grep -E '^\+[^+]' | grep -vE '^\+\+\+' || true)
  PADROES='AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|gho_[A-Za-z0-9]{36}|GOCSPX-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[0-9A-Za-z-]{10,}|sk-[A-Za-z0-9_-]{20,}|sk_live_[0-9a-zA-Z]{20,}|rk_live_[0-9a-zA-Z]{20,}|eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|(postgres|postgresql|mysql|mongodb(\+srv)?|redis|amqp)://[^:/@\s]+:[^@\s]{4,}@|(password|passwd|senha|secret|api[_-]?key|client[_-]?secret|token)["'"'"']?\s*[:=]\s*["'"'"'][^"'"'"'$<{ ]{8,}["'"'"']'
  HITS=$(printf '%s\n' "$ADD" | grep -nE "$PADROES" | grep -viE 'example|placeholder|dummy|xxxx|changeme|<[a-z_]+>|\$\{|process\.env|\.test\.|\.spec\.|mock' | head -10 || true)
  if [ -n "$HITS" ]; then
    fail "possíveis segredos em linhas adicionadas (padrões internos):"; printf '%s\n' "$HITS" | cut -c1-160 | sed 's/^/    /' >&2; ACHADOS=1
  fi
  ENVS=$(git diff --name-only --diff-filter=A "$DIFF_RANGE" 2>/dev/null | grep -E '(^|/)\.env(\.[a-z]+)?$' | grep -vE '\.env\.(example|sample|template)$' || true)
  if [ -n "$ENVS" ]; then fail "arquivo .env entrando no repositório: $ENVS"; ACHADOS=1; fi
  # Caminho de máquina pessoal (LGPD / regra do harness): nomeia uma pessoa.
  CAMINHOS=$(printf '%s\n' "$ADD" | grep -nE '(/home/|/Users/|[A-Za-z]:\\\\?Users\\\\?)[A-Za-z0-9._-]+' \
             | grep -viE '/home/(ubuntu|app|node|runner|root|ec2-user|deploy|ci|docker)\b|Users\\?(runneradmin|Public|Default|Administrator)\b|(/home/|/Users/|Users\\?)(fulano|ciclano|beltrano|usuario|username|user|nome|seu-usuario|voce|you|me|x+)\b|<[a-z_]+>|\$\{?[A-Z_]+|%[A-Z_]+%' | head -5 || true)
  if [ -n "$CAMINHOS" ]; then
    fail "caminho de máquina pessoal em linha adicionada (parametrize ou use placeholder):"; printf '%s\n' "$CAMINHOS" | cut -c1-160 | sed 's/^/    /' >&2; ACHADOS=1
  fi
  if [ "$ACHADOS" -eq 0 ]; then ok "segredos/dados pessoais: limpo"; marca segredos ok; else marca segredos bloqueado "segredo ou dado pessoal"; fi
fi

# ── Camada 3 · estático (typecheck, lint, audit) ────────────────────────────
tem_script() { [ -f package.json ] && node -e 'process.exit(require("./package.json").scripts?.["'"$1"'"]?0:1)' 2>/dev/null; }
if skip estatico; then marca estatico pulado; else
  EST_OK=1; EST_NOTA=""
  for s in typecheck type-check lint; do
    if tem_script "$s"; then
      say "${DIM}▶ npm run $s${RST}"
      if npm run -s "$s" >"$LOGDIR/$s.log" 2>&1; then ok "$s"; else fail "$s falhou (log: $LOGDIR/$s.log)"; tail -15 "$LOGDIR/$s.log" | sed 's/^/    /' >&2; EST_OK=0; EST_NOTA="$EST_NOTA $s"; fi
    fi
  done
  if [ -f package.json ] && [ "$(git config --get prepush.audit || echo warn)" != "off" ]; then
    if npm audit --audit-level=high --omit=dev >"$LOGDIR/audit.log" 2>&1; then ok "npm audit (high+): limpo"
    else
      if [ "$(git config --get prepush.audit)" = "block" ]; then fail "npm audit com vulnerabilidade high+ (prepush.audit=block)"; EST_OK=0; EST_NOTA="$EST_NOTA audit";
      else warn "npm audit: vulnerabilidade high+ em dependência de produção (aviso; prepush.audit=block para travar)"; fi
      grep -E "^[0-9]+ .*vulnerabilit" "$LOGDIR/audit.log" | head -2 | sed 's/^/    /' >&2
    fi
  fi
  if command -v ruff >/dev/null 2>&1 && ls pyproject.toml setup.cfg >/dev/null 2>&1; then
    if ruff check . >"$LOGDIR/ruff.log" 2>&1; then ok "ruff"; else fail "ruff falhou"; EST_OK=0; EST_NOTA="$EST_NOTA ruff"; fi
  fi
  if [ "$EST_OK" -eq 1 ]; then marca estatico ok; else marca estatico bloqueado "$EST_NOTA"; fi
fi

# ── Camada 4 · testes (o mesmo comando que o hook usa) ──────────────────────
if skip testes; then marca testes pulado; else
  TEST_CMD=$(git config --get prepush.testcmd || git config --get hooks.testcmd || true)
  if [ -z "$TEST_CMD" ]; then
    if tem_script test; then TEST_CMD="npm test";
    elif [ -f pytest.ini ] || [ -f conftest.py ] || grep -qs "\[tool.pytest" pyproject.toml; then TEST_CMD="pytest -q";
    elif [ -f go.mod ]; then TEST_CMD="go test ./..."; fi
  fi
  if [ -z "$TEST_CMD" ]; then
    warn "nenhum comando de teste (git config prepush.testcmd \"...\")"; marca testes pulado "sem comando"
  else
    say "${DIM}▶ $TEST_CMD${RST}"
    if bash -c "$TEST_CMD" >"$LOGDIR/testes.log" 2>&1; then
      ok "testes: $( { grep -E '^Tests:|passed|passing|ok ' "$LOGDIR/testes.log" | tail -1; } | tr -s ' ' | cut -c1-100)"
      marca testes ok
    else
      fail "testes falharam (log: $LOGDIR/testes.log)"
      grep -E '^(FAIL|ERROR)|●.*›|^Tests:|^Test Suites:|FAILED|Error:' "$LOGDIR/testes.log" | head -20 | sed 's/^/    /' >&2
      marca testes bloqueado "ver $LOGDIR/testes.log"
    fi
  fi
fi

# ── Camada 5 · cobertura da mudança (informativa) ───────────────────────────
if skip cobertura; then marca cobertura pulado; else
  SEM_TESTE=""
  for f in $(git diff --name-only "$DIFF_RANGE" 2>/dev/null | grep -E '\.(ts|tsx|js|jsx|py|go)$' | grep -vE '(\.test\.|\.spec\.|_test\.|/tests?/|/__tests__/|\.d\.ts$|\.config\.|/migrations?/|/prisma/)'); do
    b=$(basename "$f"); stem="${b%.*}"; d=$(dirname "$f")
    if ! git ls-files "$d" | grep -qE "(^|/)${stem}[._-]?(test|spec|unit\.test|integration\.test)\.[a-z]+$|(^|/)test_${stem}\.py$" \
       && ! git grep -qlE "from ['\"]\./${stem}['\"]|from ['\"]\.\./[^'\"]*${stem}['\"]|${stem}" -- "$d/*.test.*" "$d/*.spec.*" "$d/__tests__/*" "$d/tests/*" 2>/dev/null; then
      SEM_TESTE="$SEM_TESTE $f"
    fi
  done
  if [ -z "$SEM_TESTE" ]; then ok "cobertura da mudança: todo arquivo alterado tem teste vizinho"; marca cobertura ok
  else warn "arquivos alterados SEM teste vizinho (a skill decide se gera):"; for f in $SEM_TESTE; do say "    $f"; done; marca cobertura aviso "$SEM_TESTE"; fi
fi

# ── Resumo ──────────────────────────────────────────────────────────────────
say ""; say "${BLD}resumo${RST}"
for k in sync segredos estatico testes cobertura; do
  s_=$(st "$k"); [ -n "$s_" ] || s_='?'
  printf '  %-10s %-10s %s\n' "$k" "$s_" "$(nota "$k")" >&2
done
say "${DIM}  logs: $LOGDIR${RST}"
if [ -n "$JSON" ]; then
  {
    printf '{"repo":"%s","branch":"%s","base":"%s/%s","commits":%s,"camadas":{' "$(basename "$ROOT")" "$BRANCH" "$REMOTE" "$BASE" "$N_OUT"
    first=1; for k in sync segredos estatico testes cobertura; do
      [ $first -eq 0 ] && printf ','; first=0
      printf '"%s":{"status":"%s","nota":"%s"}' "$k" "$(st "$k")" "$(nota "$k" | tr -d '"\n' | cut -c1-300)"
    done
    printf '},"resultado":"%s","logs":"%s"}\n' "$([ $BLOQUEADO -eq 0 ] && echo ok || echo bloqueado)" "$LOGDIR"
  } >"$JSON"
fi
if [ "$BLOQUEADO" -eq 0 ]; then say "${GRN}${BLD}gate mecânico verde${RST}"; echo "PREPUSH_RESULT=ok"; exit 0
else say "${RED}${BLD}gate mecânico BLOQUEADO${RST}"; echo "PREPUSH_RESULT=bloqueado"; exit 1; fi
