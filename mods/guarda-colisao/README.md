# guarda-colisao — Guarda de colisão

Antes de o Claude editar um arquivo (`Edit`, `Write`, `NotebookEdit`), o mod confere se
esse arquivo foi **mudado fora desta sessão** — por outra sessão do Claude, por você no
editor ou por outro programa. Se foi, ele pergunta:

```
a.md foi mudado fora desta sessão há 10 min. O que fazer?
  Prosseguir | Pular e avisar o modelo | Cancelar
```

- **Prosseguir** — edita assim mesmo.
- **Pular e avisar o modelo** — a edição não acontece e o modelo recebe a instrução de
  reler o arquivo (`Read`) e refazer a alteração sobre a versão atual.
- **Cancelar** — a edição não acontece ("cancelado pelo usuário").
- Texto digitado em "Outro" conta como **Pular**.

## Como ele decide

- Guarda, por arquivo (caminho real, com links seguidos), o horário de modificação logo
  depois do **último toque desta sessão** (edição ou leitura com `Read`).
- Se a sessão nunca tocou no arquivo, compara com o **início da sessão**.
- Só pergunta se o arquivo está mais novo que isso **+ 1 segundo de folga**.
- Arquivo que ainda não existe (Write de arquivo novo) nunca pergunta.
- Ler o arquivo com `Read` conta como toque: depois de reler, o modelo edita sem nova pergunta.

## Comando

- `/colisao` — quantas vezes perguntou nesta sessão e o que você respondeu. Muitos
  "Prosseguir" = falso positivo: ponha o caminho em **ignorar**.

## Opções (`/config`)

| Opção | Padrão | O que faz |
|---|---|---|
| `sem_tela` | `avisar` | Sem ninguém para responder (`claude -p`, Esc, diálogo fechado): `avisar` recusa a edição e manda o modelo reler; `permitir` deixa editar. |
| `ignorar` | `node_modules/`, `.git/`, `dist/`, `build/`, `.next/`, `*.lock` | Trechos de caminho que não são vigiados. Sem `*` = trecho do caminho (ancorado em `/`); com `*` = padrão no fim do caminho (`*.lock`). |

## Ligar e desligar

`/plugin` → Installed → guarda-colisao → Disable (ou Enable). Botão de pânico para todos:
`claude plugin disable --all`.

## Limites (honestos)

- Mudança feita **pela própria sessão via Bash** (`sed -i`, `npm run format`, gerador de
  código) também conta como "fora": o mod só vê Edit/Write/NotebookEdit/Read. Resultado:
  pergunta a mais (falso positivo), nunca a menos.
- A comparação é por horário de modificação. Programa que muda o arquivo e restaura o
  horário antigo passa despercebido.
- A memória de "meu toque" é desta sessão. Duas sessões abertas se vigiam uma à outra,
  que é o objetivo — mas `/clear` recomeça a contagem pelo novo início.
- Não trava o arquivo: entre a pergunta e a edição, outro programa ainda pode mexer.
- Testado em Claude Code 2.1.289.
