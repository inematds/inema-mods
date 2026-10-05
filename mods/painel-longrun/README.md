# painel-longrun

**"Como vai a execução longa?"** — sem abrir cinco arquivos.

Para quem deixa o Claude (ou o Codex) trabalhando horas numa tarefa com uma pasta de acompanhamento `longrun/<AAAA-MM-DD>-<nome>/`. O mod lê essa pasta e mostra tudo num painel que se atualiza sozinho.

O painel mostra:

- **Objetivo**: a primeira linha útil da seção `## Resultado` (ou `## Objetivo`) do `goal.md`.
- **Tempo rodando**: desde o `**Início:** AAAA-MM-DD HH:MM` do `goal.md`; se não houver, desde a data no nome da pasta.
- **Checklist com % e barra**: itens `- [x]` / `- [ ]` do `plan.md`. Se o `plan.md` não tiver caixas, usa as caixas do `goal.md` (critérios de pronto). Se não houver caixa nenhuma, lista os passos numerados do `plan.md` (sem %).
- **Últimas 3 linhas** do `progress.md` (linhas da tabela) e do `canal.md` (linhas que começam com `- `).

## Formato da pasta

```
<projeto>/longrun/2026-10-05-minha-tarefa/
  goal.md      objetivo, início, critérios de pronto
  plan.md      plano atual (itens "- [ ]" viram checklist)
  state.md     estado (não é lido pelo painel)
  progress.md  tabela de checkpoints (só acrescentar)
  canal.md     anotações "- data · tipo · texto" (só acrescentar)
```

Vale a pasta **mais recente** (pelo nome, que começa com a data) dentro de `longrun/` na pasta onde o Claude foi aberto. O mod **só lê**: nunca escreve nesses arquivos.

## Comandos

| Comando | O que faz |
|---|---|
| `/longrun` | Relê a pasta, abre o painel "Execução longa" e responde com um resumo de uma linha |
| `/longrun todas` | Lista as sessões do Claude Code com execução longa ativa (esta e as outras), com `feitos/total` e se ainda dão sinal |

No painel: **[atualizar agora]** (tecla `a` com o painel em foco).

## Opções (`/config`)

- **Pasta fixa**: vazio = execução mais recente em `longrun/` do projeto. Pode apontar para a pasta de uma execução (a que tem `goal.md`) ou para a pasta de outro projeto.
- **Atualizar a cada (segundos)**: padrão 30 (mínimo 5).
- **Como criar uma execução longa**: o texto que o painel mostra quando não acha nada. O padrão é o comando do kit execucao-longa do INEMA (`novo-longrun.sh <projeto> <slug>`); troque pelo comando do seu kit, ou por uma instrução sua.

## Limites (honestos)

- O painel relê os arquivos a cada 30 s em toda sessão onde o mod está ligado (é leitura leve: uma listagem e quatro arquivos). O relógio começa quando a sessão começa; depois de recarregar o mod (`/reload-plugins`) ele só volta a rodar numa sessão nova — use `/longrun` ou [atualizar agora] enquanto isso.
- `/longrun todas` depende de cada sessão gravar um registro no armazenamento do mod (um arquivo JSON do Claude Code). Funciona para sessões que rodam com o mod ligado; **se duas sessões abertas ao mesmo tempo enxergam na hora o que a outra gravou não foi verificado** — trate a lista como "provável". Registros parados há mais de um dia somem sozinhos; o da sessão some quando ela termina.
- A % só existe quando há caixas `- [ ]`/`- [x]`. Plano escrito só com passos numerados mostra os passos, sem %.
- O início é a hora local da máquina. Pasta sem data e `goal.md` sem `Início:` mostram "início desconhecido".
- Sem barra lateral fora do modo tela cheia: em terminal estreito o painel aparece acima do prompt.

Testado com Claude Code 2.1.289 (API de mods em acesso antecipado).
