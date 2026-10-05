#!/usr/bin/env bash
# Botão de pânico: desliga TODOS os mods/plugins de uma vez.
# Uso:  bash scripts/mods-off.sh            (desliga todos, escopo usuário)
#       bash scripts/mods-off.sh --inema    (desinstala só os mods deste kit)
set -u
if [ "${1:-}" = "--inema" ]; then
  for nome in $(ls "$(dirname "$0")/../mods"); do
    for escopo in user project local; do
      claude plugin uninstall "$nome@inema-mods" --scope "$escopo" >/dev/null 2>&1 && echo "removido: $nome ($escopo)"
    done
  done
  echo "Pronto. Abra uma sessão nova (ou rode /reload-plugins) para valer."
  exit 0
fi
claude plugin disable --all
echo "Todos os plugins foram desligados. Para religar um: claude plugin enable <nome>"
echo "Abra uma sessão nova (ou rode /reload-plugins) para valer."
