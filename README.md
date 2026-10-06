# inema-mods — Kit INEMA de mods do Claude Code

**🇧🇷 [Português](README.md) · 🇺🇸 [English](README.en.md) · 🇪🇸 [Español](README.es.md)**

[![inema-mods — Kit INEMA de mods do Claude Code](guia/assets/banner.jpg)](https://inematds.github.io/inema-mods/guia/)

## 📖 Guia de uso

Guia completo (landing + passo a passo): **https://inematds.github.io/inema-mods/guia/**

**18 mods prontos, em português**, para o Claude Code: proteções contra estrago, um painel do contexto, recibo do que foi criado e outros. Cada mod é um acessório: você liga, usa e desliga quando quiser, sem mexer no motor.

> **Mod** é um pedaço de código que entra no meio do que o Claude Code faz: mostra coisas na tela (faixa, painel, aviso), pergunta antes de uma ação perigosa ou troca a ação por outra mais segura. Não gasta crédito: nenhum mod deste kit chama o modelo, a internet ou serviço pago.

Testado no **Claude Code 2.1.289** (terminal e app desktop). A API de mods ainda está em teste ("early access") e pode mudar entre versões. Veja [Quando o Claude Code atualizar](#quando-o-claude-code-atualizar).

## Instalar (2 comandos)

```bash
claude plugin marketplace add inematds/inema-mods
claude plugin install freio-de-mao@inema-mods
```

Troque `freio-de-mao` pelo mod que quiser (tabela abaixo). Depois abra uma sessão nova ou digite `/reload-plugins`.

- Só neste projeto: acrescente `--scope project`.
- Ver o que um mod faz antes de instalar: `claude plugin details freio-de-mao@inema-mods`, ou leia `mods/freio-de-mao/hooks/register.tsx`.
- Ajustar opções (limiares, listas): `/config` dentro do Claude Code.

## Os 18 mods

### Proteção

| Mod | O que faz | Comando |
|---|---|---|
| [freio-de-mao](mods/freio-de-mao) | Antes de `rm -rf`, `git reset --hard`, `push --force` e parecidos, mede o estrago **sem apagar** (quantos arquivos, tamanho) e pergunta: Cancelar / Lixeira / Backup e prosseguir / Prosseguir | `/freio` |
| [guarda-colisao](mods/guarda-colisao) | Antes de editar um arquivo que **outra sessão** mudou, pergunta se pode | `/colisao` |
| [vigia-api](mods/vigia-api) | Pergunta antes de usar serviço pago (geração de imagem/vídeo, APIs), com autorização por 1 hora | `/vigia` |
| [modo-gravacao](mods/modo-gravacao) | Para gravar vídeo/live: esconde na tela e-mails, chaves, valores, CPF, telefones | `/gravar on` |
| [faixa-publicacao](mods/faixa-publicacao) | Depois de `git push`, avisa onde foi publicado e que o deploy é automático | — |

### Contexto e sessão

| Mod | O que faz | Comando |
|---|---|---|
| [clima-contexto](mods/clima-contexto) | Faixa com o "tempo" do contexto (limpo, nublado, chuva, tempestade), limites de uso, botões [compactar] e [handoff] | `/contexto` |
| [linha-do-tempo](mods/linha-do-tempo) | Painel turno a turno: modelo, ferramentas, tokens, duração | `/timeline` |
| [roteador-subagente](mods/roteador-subagente) | Faz os subagentes rodarem num modelo menor (poupa a cota) | `/router on` |
| [painel-longrun](mods/painel-longrun) | Acompanha uma execução longa: objetivo, tempo, checklist com % | `/longrun` |

### Produtividade

| Mod | O que faz | Comando |
|---|---|---|
| [recibo-sessao](mods/recibo-sessao) | "O que o Claude criou?" — lista de arquivos criados/editados, com [abrir pasta] | `/recibo` |
| [proximos-passos](mods/proximos-passos) | Transforma a lista de próximos passos da resposta em botões | `/proximos` |
| [marcador-sessao](mods/marcador-sessao) | Marca um ponto da conversa com resumo, para retomar depois | `/marcar <nome>` |
| [replay-edicoes](mods/replay-edicoes) | Reproduz as edições da sessão passo a passo, com diff | `/replay` |
| [registrar-falha](mods/registrar-falha) | Depois de erros seguidos, oferece registrar a falha no FALHAS.md | `/falha` |

### Aprender e visual

| Mod | O que faz | Comando |
|---|---|---|
| [tradutor-acoes](mods/tradutor-acoes) | Explica em português simples cada ação ("Editando arquivo X"), sem esconder o comando real | `/tradutor` |
| [mapa-calor](mods/mapa-calor) | Mapa das pastas do projeto por quantidade/tamanho | `/mapa` |
| [tema-inema](mods/tema-inema) | Rodapé com marca, projeto e hora, para lives | `/tema on` |
| [bichinho](mods/bichinho) | Um bichinho que "come" os arquivos lidos (só por diversão) | `/bichinho on` |

Cada pasta tem um README com comandos, opções e **limites honestos** do mod.

## Botão de pânico

```bash
bash scripts/mods-off.sh            # desliga todos os plugins
bash scripts/mods-off.sh --inema    # remove só os mods deste kit
bash scripts/mods-doctor.sh         # diz quais mods a sua versão ainda aceita
```

## Crie o seu próprio mod

O melhor mod é o feito para o seu jeito de trabalhar. Prompts prontos para copiar e colar em [prompts/](prompts):

0. [Me entreviste e diga quais mods ligar](prompts/00-descubra-seu-mod.md): até 8 perguntas, nota para cada mod (deste kit e de outros) e o seu top 3 com o primeiro passo.
1. [Descubra os 5 mods que você precisa](prompts/01-auditoria-sugira-5-mods.md): o Claude lê suas últimas sessões e sugere.
2. [Crie a "previsão do contexto"](prompts/02-criar-mod-previsao-do-contexto.md).
3. [Crie o "freio de mão"](prompts/03-criar-mod-freio-de-mao.md).

Para criar: digite `/plugin-authoring` no Claude Code e descreva o mod em português.

## Segurança: leia antes de instalar mods de terceiros

Um mod roda com o seu usuário: pode ler arquivos, rodar comandos e acessar a internet. Instale só de fontes em que você confia e leia o `hooks/register.tsx`. Neste kit:

- nenhum mod chama o modelo, a internet ou serviço pago;
- os mods de proteção **reduzem o risco, não garantem**: a lista de comandos perigosos nunca é completa, e o modo gravação não esconde tudo (veja o README de cada um);
- quando você não está na tela (`claude -p`), os mods de proteção **negam** em vez de deixar passar.

## Para quem desenvolve

```bash
scripts/checar-mod.sh mods/<nome>    # claude plugin validate + tsc + claude plugin test
scripts/checar-mod.sh                # todos
python3 scripts/gerar-marketplace.py
```

Regras e pegadinhas da API, aprendidas na prática: [docs/COMO-FAZER-UM-MOD.md](docs/COMO-FAZER-UM-MOD.md).

### Quando o Claude Code atualizar

Rode `bash scripts/mods-doctor.sh`. Se um mod quebrar, desligue com `claude plugin disable <nome>@inema-mods` e veja se o kit tem versão nova (`claude plugin marketplace update inema-mods`).

---

Feito pelo [INEMA.CLUB](https://inema.club): conteúdo aberto e gratuito sobre IA.
