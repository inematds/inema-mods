#!/usr/bin/env bash
# Mod doctor: mostra o que está instalado e se cada mod deste kit ainda é aceito
# pela versão atual do Claude Code (a API de mods é "early access" e muda).
set -u
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
echo "Claude Code: $(claude --version 2>/dev/null)"
echo "Testado com: 2.1.289"
echo
echo "== Plugins instalados"
claude plugin list 2>/dev/null | sed 's/^/  /'
echo
echo "== Mods deste kit (validação contra a versão instalada)"
for mod in "$RAIZ"/mods/*/; do
  nome="$(basename "$mod")"
  if claude plugin validate "$mod" >/tmp/mods-doctor.$$ 2>&1; then
    echo "  ok      $nome"
  else
    echo "  QUEBRADO $nome"
    grep -E "❯|error|Error" /tmp/mods-doctor.$$ | head -3 | sed 's/^/           /'
  fi
done
rm -f /tmp/mods-doctor.$$
echo
echo "Se um mod quebrou depois de atualizar o Claude Code: desligue com"
echo "  claude plugin disable <nome>@inema-mods"
echo "e veja se há versão nova do kit (git pull + claude plugin update <nome>@inema-mods)."
