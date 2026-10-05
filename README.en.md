# inema-mods — INEMA kit of Claude Code mods

**🇧🇷 [Português](README.md) · 🇺🇸 [English](README.en.md) · 🇪🇸 [Español](README.es.md)**

[![inema-mods — INEMA kit of Claude Code mods](guia/assets/banner-en.jpg)](https://inematds.github.io/inema-mods/guia/en/)

## 📖 User guide

Full guide (landing + step by step): **https://inematds.github.io/inema-mods/guia/en/**

**18 ready-made mods, with Portuguese names and commands**, for Claude Code: protections against damage, a context panel, a receipt of what was created and more. Each mod is an accessory: you turn it on, use it and turn it off whenever you want, without touching the engine.

> A **mod** is a piece of code that steps into the middle of what Claude Code does: it shows things on screen (band, panel, warning), asks before a dangerous action, or swaps the action for a safer one. It spends no credits: no mod in this kit calls the model, the internet or a paid service.

Tested on **Claude Code 2.1.289** (terminal and desktop app). The mods API is still in testing ("early access") and may change between versions. See [When Claude Code updates](#when-claude-code-updates).

## Install (2 commands)

```bash
claude plugin marketplace add inematds/inema-mods
claude plugin install freio-de-mao@inema-mods
```

Replace `freio-de-mao` (handbrake) with the mod you want (table below). Then open a new session or type `/reload-plugins`.

- Only in this project: add `--scope project`.
- See what a mod does before installing: `claude plugin details freio-de-mao@inema-mods`, or read `mods/freio-de-mao/hooks/register.tsx`.
- Adjust options (thresholds, lists): `/config` inside Claude Code.

## The 18 mods

### Protection

| Mod | What it does | Command |
|---|---|---|
| [freio-de-mao](mods/freio-de-mao) (handbrake) | Before `rm -rf`, `git reset --hard`, `push --force` and similar, measures the damage **without deleting** (how many files, size) and asks: Cancel / Trash / Back up and proceed / Proceed | `/freio` |
| [guarda-colisao](mods/guarda-colisao) (collision guard) | Before editing a file that **another session** changed, asks if it is OK | `/colisao` |
| [vigia-api](mods/vigia-api) (API watchdog) | Asks before using a paid service (image/video generation, APIs), with approval lasting 1 hour | `/vigia` |
| [modo-gravacao](mods/modo-gravacao) (recording mode) | For recording a video/live stream: hides emails, keys, amounts, tax IDs and phone numbers on screen | `/gravar on` |
| [faixa-publicacao](mods/faixa-publicacao) (publish banner) | After `git push`, tells you where it was published and that the deploy is automatic | — |

### Context and session

| Mod | What it does | Command |
|---|---|---|
| [clima-contexto](mods/clima-contexto) (context weather) | A band with the context "weather" (clear, cloudy, rain, storm), usage limits, [compact] and [handoff] buttons | `/contexto` |
| [linha-do-tempo](mods/linha-do-tempo) (timeline) | Turn-by-turn panel: model, tools, tokens, duration | `/timeline` |
| [roteador-subagente](mods/roteador-subagente) (subagent router) | Makes subagents run on a smaller model (saves your quota) | `/router on` |
| [painel-longrun](mods/painel-longrun) (long-run panel) | Tracks a long execution: goal, time, checklist with % | `/longrun` |

### Productivity

| Mod | What it does | Command |
|---|---|---|
| [recibo-sessao](mods/recibo-sessao) (session receipt) | "What did Claude create?" — list of created/edited files, with [open folder] | `/recibo` |
| [proximos-passos](mods/proximos-passos) (next steps) | Turns the list of next steps in the answer into buttons | `/proximos` |
| [marcador-sessao](mods/marcador-sessao) (session bookmark) | Marks a point in the conversation with a summary, so you can resume later | `/marcar <name>` |
| [replay-edicoes](mods/replay-edicoes) (edit replay) | Replays the session's edits step by step, with a diff | `/replay` |
| [registrar-falha](mods/registrar-falha) (log failure) | After several errors in a row, offers to log the failure in FALHAS.md | `/falha` |

### Learn and visual

| Mod | What it does | Command |
|---|---|---|
| [tradutor-acoes](mods/tradutor-acoes) (action translator) | Explains each action in plain language ("Editing file X"), without hiding the real command | `/tradutor` |
| [mapa-calor](mods/mapa-calor) (heat map) | A map of the project folders by count/size | `/mapa` |
| [tema-inema](mods/tema-inema) (INEMA theme) | A footer with brand, project and time, for live streams | `/tema on` |
| [bichinho](mods/bichinho) (little pet) | A little pet that "eats" the files you read (just for fun) | `/bichinho on` |

Each folder has a README with the mod's commands, options and **honest limits**.

## Panic button

```bash
bash scripts/mods-off.sh            # turns off all plugins
bash scripts/mods-off.sh --inema    # removes only the mods from this kit
bash scripts/mods-doctor.sh         # tells you which mods your version still accepts
```

## Build your own mod

The best mod is the one made for the way you work. Ready-made prompts to copy and paste in [prompts/](prompts) (written in Portuguese):

1. [Discover the 5 mods you need](prompts/01-auditoria-sugira-5-mods.md): Claude reads your recent sessions and suggests them.
2. [Build the "context forecast"](prompts/02-criar-mod-previsao-do-contexto.md).
3. [Build the "handbrake"](prompts/03-criar-mod-freio-de-mao.md).

To build one: type `/plugin-authoring` in Claude Code and describe the mod in plain language.

## Security: read before installing third-party mods

A mod runs with your user account: it can read files, run commands and access the internet. Install only from sources you trust and read the `hooks/register.tsx`. In this kit:

- no mod calls the model, the internet or a paid service;
- the protection mods **reduce risk, they do not guarantee safety**: the list of dangerous commands is never complete, and recording mode does not hide everything (see each one's README);
- when you are not at the screen (`claude -p`), the protection mods **deny** instead of letting things through.

## For developers

```bash
scripts/checar-mod.sh mods/<name>    # claude plugin validate + tsc + claude plugin test
scripts/checar-mod.sh                # all of them
python3 scripts/gerar-marketplace.py
```

Rules and API gotchas, learned in practice: [docs/COMO-FAZER-UM-MOD.md](docs/COMO-FAZER-UM-MOD.md) (in Portuguese).

### When Claude Code updates

Run `bash scripts/mods-doctor.sh`. If a mod breaks, turn it off with `claude plugin disable <name>@inema-mods` and check whether the kit has a new version (`claude plugin marketplace update inema-mods`).

---

Made by [INEMA.CLUB](https://inema.club): open and free content about AI.
