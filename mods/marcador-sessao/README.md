# marcador-sessao

**"Onde eu estava mesmo?"** — um marcador de página para a conversa com o Claude.

`/marcar <nome>` guarda um ponto da conversa: o nome, a hora, quantas mensagens a conversa tinha e um resumo curto. O resumo é o começo da última resposta do Claude (as primeiras ~200 letras): **nenhum modelo é chamado**, não gasta nada.

Os marcadores ficam guardados **por projeto** (pela pasta onde o Claude foi aberto) e continuam lá em sessões novas.

## Comandos

| Comando | O que faz |
|---|---|
| `/marcar <nome>` | Guarda este ponto. Mesmo nome de novo = atualiza. Aspas são opcionais: `/marcar "antes do deploy"` |
| `/marcar` | Mostra a ajuda e a lista de marcadores deste projeto |
| `/marcar abrir` | Abre o painel "Marcadores" |
| `/marcar apagar <nome>` | Remove um marcador |

No painel, cada marcador tem **[colar no prompt]** (teclas `1` a `9` com o painel em foco): escreve no prompt *"Retomando o ponto '<nome>': <resumo>"*. Você confere, completa e envia. Atenção: ele **substitui** o que estiver digitado no prompt.

## Opções (`/config`)

- **Tamanho do resumo**: padrão 200 letras.

## Limites (honestos)

- **Não dá para "voltar" a conversa até o ponto marcado.** O Claude Code não oferece ao mod um jeito de rolar a tela até uma mensagem. O marcador guarda o resumo e a posição (número da mensagem) para você retomar o assunto colando o resumo.
- O resumo é só o começo da última resposta: se ela começou com algo genérico ("Pronto."), o resumo fica genérico. Dê um nome que explique.
- `abrir` e `apagar` são palavras reservadas: não dá para criar um marcador chamado só "abrir".
- Guarda até 50 marcadores por projeto (os mais antigos saem).

Testado com Claude Code 2.1.289 (API de mods em acesso antecipado).
