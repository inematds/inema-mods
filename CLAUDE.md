# CLAUDE.md — inema-mods

Kit INEMA de mods do Claude Code (plugins de function hooks). Repo: `inematds/inema-mods`. Autor dos commits: `inematds <inematds@gmail.com>`.

- Cada mod em `mods/<nome>/` (manifesto, `hooks/register.tsx`, `types/`, `tests/`, README PT). Regras e pegadinhas: [docs/COMO-FAZER-UM-MOD.md](docs/COMO-FAZER-UM-MOD.md).
- Antes de commitar um mod: `TSC=~/projetos/polyskill/node_modules/.bin/tsc scripts/checar-mod.sh mods/<nome>` com validate/tsc/test `ok`. Depois `python3 scripts/gerar-marketplace.py`.
- Mod nunca chama o modelo, rede ou API paga. Mensagens em PT simples, sem emoji.
- API de mods é early access: ao atualizar o Claude Code, rodar `scripts/checar-mod.sh` (todos) e anotar a versão testada no README.
- Falhas: uma linha em [FALHAS.md](FALHAS.md).

## Self-learning

When I correct you, or you catch yourself making a mistake: before continuing, add the lesson as a one-line rule under ## Lessons, so it never happens again.

## Lessons

- `$` só pode ser passado a função declarada no topo do módulo; helper dentro de `register` que recebe `$` faz o módulo não carregar. (05/10/2026)
