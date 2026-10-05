# recibo-sessao

**"O que o Claude criou ou mudou nesta sessão?"** — sem precisar perguntar a ele.

O mod anota cada arquivo que o Claude cria ou edita (ferramentas Write, Edit e NotebookEdit) e mostra a lista quando você pede.

## Comandos

| Comando | O que faz |
|---|---|
| `/recibo` | Abre o painel "Recibo da sessão" e mostra a lista completa (criados `+`, editados `~`) |
| `/recibo ultimo` | Só o que mudou no último pedido |
| `/recibo limpar` | Zera a lista |

No painel, cada linha tem **[abrir pasta]**, que abre a pasta do arquivo no gerenciador de arquivos.

## Opções (`/config`)

- **Programa que abre pastas**: `xdg-open` (Linux, padrão), `open` (Mac) ou `explorer` (Windows).

## Limites

- Vê só o que passa pelas ferramentas de arquivo do Claude. Arquivo gerado por um comando no terminal (ex.: `ffmpeg -o video.mp4`) não entra.
- A lista vale para a sessão atual; numa sessão nova começa vazia.
