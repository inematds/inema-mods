#!/usr/bin/env bash
# Confere um mod (ou todos): claude plugin validate + tsc + claude plugin test.
# Uso: scripts/checar-mod.sh mods/recibo-sessao      |  scripts/checar-mod.sh   (todos)
# Os tipos vêm do próprio Claude Code instalado (a skill plugin-authoring os escreve);
# defina CLAUDE_CODE_TYPES=<caminho do claude-code.d.ts> se o script não achar.
set -u
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

TIPOS="${CLAUDE_CODE_TYPES:-}"
if [ -z "$TIPOS" ]; then
  TIPOS="$(ls -t /tmp/claude-*/bundled-skills/*/*/plugin-authoring/types/claude-code.d.ts 2>/dev/null | head -1)"
fi
if [ -z "$TIPOS" ] || [ ! -f "$TIPOS" ]; then
  echo "Tipos não encontrados. Rode /plugin-authoring numa sessão do Claude Code (ele escreve os tipos) ou defina CLAUDE_CODE_TYPES." >&2
  exit 2
fi

TSC="${TSC:-}"
if [ -z "$TSC" ]; then
  if command -v tsc >/dev/null; then TSC=tsc; else TSC="npx -y -p typescript@5 tsc"; fi
fi

if [ $# -gt 0 ]; then MODS=("$@"); else MODS=(mods/*/); fi
FALHOU=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for mod in "${MODS[@]}"; do
  mod="${mod%/}"
  nome="$(basename "$mod")"
  echo "== $nome"
  if ! claude plugin validate "$mod" >"$TMP/$nome.validate" 2>&1; then
    echo "  validate: FALHOU"; sed 's/^/    /' "$TMP/$nome.validate" | tail -20; FALHOU=1
  else
    echo "  validate: ok"
  fi
  abs="$RAIZ/$mod"
  cat >"$TMP/$nome.tsconfig.json" <<JSON
{
  "compilerOptions": {
    "target": "es2023", "lib": ["es2023"], "types": [],
    "module": "esnext", "moduleResolution": "bundler",
    "strict": true, "noUncheckedIndexedAccess": true,
    "noEmit": true, "skipLibCheck": true,
    "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"
  },
  "files": ["$TIPOS"],
  "include": ["$abs/hooks", "$abs/types", "$abs/tests"]
}
JSON
  if ! $TSC -p "$TMP/$nome.tsconfig.json" >"$TMP/$nome.tsc" 2>&1; then
    echo "  tsc: FALHOU"; sed 's/^/    /' "$TMP/$nome.tsc" | head -30; FALHOU=1
  else
    echo "  tsc: ok"
  fi
  if ls "$mod"/tests/*.test.ts* >/dev/null 2>&1; then
    if ! claude plugin test "$mod" >"$TMP/$nome.test" 2>&1; then
      echo "  test: FALHOU"; sed 's/^/    /' "$TMP/$nome.test" | tail -30; FALHOU=1
    else
      echo "  test: ok ($(grep -c -i -E 'pass|✓' "$TMP/$nome.test") linhas de aprovação)"
    fi
  else
    echo "  test: SEM TESTES"; FALHOU=1
  fi
done
exit $FALHOU
