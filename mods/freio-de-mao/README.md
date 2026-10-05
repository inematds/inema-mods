# freio-de-mao — Freio de mão

Antes de o Claude rodar um comando que **apaga ou descarta** coisas, o mod mede o
estrago **sem apagar nada** e pergunta o que fazer:

```
Freio de mão: este comando apaga ou descarta coisas.

> rm -rf build
  apaga de vez (rm não usa lixeira).
  Vai apagar: 120 arquivo(s), 8 pasta(s), 3,4 MB
    build/f0.js
    ... (no máximo 15 linhas)
    ... e mais 5

O que fazer?
  Prosseguir | Mandar para a lixeira | Fazer backup e prosseguir | Cancelar
```

- **Prosseguir** — roda o comando como está.
- **Mandar para a lixeira** (só para `rm`, sem `sudo`) — troca apenas o trecho do `rm`
  por `gio trash -f -- <alvos>`; se o `gio` não existir, move para
  `~/.local/share/Trash/files/<nome>.<data>` e grava o `.trashinfo` (aparece na lixeira
  do gerenciador de arquivos). O resto do comando (`&&`, `;`) fica igual.
- **Fazer backup e prosseguir** — copia antes com `cp -a --parents` para
  `~/.cache/inema-freio/<data>/` e mostra o caminho. **Se o backup falhar, o comando
  não roda.** Para `git reset/checkout/restore` copia os arquivos com mudanças; para
  `git clean`, os arquivos que ele apagaria.
- **Cancelar** — o comando não roda e o modelo recebe o que teria sido apagado.
- Texto digitado em "Outro" conta como **Cancelar**.

Só deixa passar sem perguntar quando a medição não depende da pasta e deu zero: alvo
com **caminho absoluto** que não existe (`rm -rf /tmp/nada`) ou nenhum processo encontrado.
Alvo relativo que "não existe" e comandos git **perguntam mesmo assim**, com o aviso de que
o shell pode estar em outra pasta (o Bash do Claude guarda o `cd` de comandos anteriores).
Se antes houver `cd $VAR`, `cd ~`, `cd -` ou `pushd`, não mede e avisa que não sabe a pasta.

## O que ele reconhece

`rm -r/-R/-rf/-fr/--recursive`, `rm` com glob (`rm *.log`), `find ... -delete` e
`find ... -exec rm`, `truncate`, `dd of=`, `mkfs*`/`wipefs`, `git reset --hard`,
`git checkout -- <caminhos>` / `git checkout .`, `git restore <caminhos>` (não o
`--staged` sozinho), `git clean -f...`, `git push --force/-f`, `git branch -D`,
`pkill -f`, `killall`, `fuser -k`, PowerShell `Remove-Item -Recurse`, `rd /s`.
Comandos compostos (`&&`, `||`, `;`, `|`, `&`) são lidos trecho a trecho; `cd pasta &&`
antes do comando muda a pasta da medição; `sudo`, `env`, `VAR=x` na frente são entendidos.

Como mede (só leitura): `find`/`du` sobre os alvos, `find` com `-delete` trocado por
`-print`, `git status --porcelain`, `git clean -n`, `git log <branch> --not --remotes`,
`pgrep -a`, `fuser -v`. Se o alvo tiver `$(...)`, crase, `;`, `|`, `&`, `<` ou `>`, **não
mede** (rodaria código antes da sua resposta) e pergunta mesmo assim. `rm -rf /`, `~`,
`$HOME`, `*` também não são medidos: aparecem como PERIGO.

## Conta do git (opcional)

Com `contas_git` preenchido (`inematds=inematds@gmail.com`, `NeiMaldaner=nei...@gmail.com`),
em `git commit`/`git push` confere `git config user.email` contra o dono do remoto no
GitHub (`git remote get-url`). Se não bater, pergunta (Prosseguir / Cancelar) e, ao
cancelar, diz ao modelo como corrigir (no repositório, sem `--global`). Dono fora da
lista = não confere.

## Comando

- `/freio` — o que foi parado nesta sessão e o que você escolheu.

## Opções (`/config`)

| Opção | Padrão | O que faz |
|---|---|---|
| `sem_tela` | `negar` | Sem ninguém para responder (`claude -p`, Esc): `negar` barra e explica ao modelo; `permitir` deixa rodar. |
| `contas_git` | vazio | Lista `dono=email` para conferir a conta antes de commit/push. |

## Ligar e desligar

`/plugin` → Installed → freio-de-mao → Disable/Enable. Pânico: `claude plugin disable --all`.

## Limites (honestos)

- **A lista de padrões nunca é completa.** Um script (`python limpa.py`, `npm run clean`,
  `make clean`), `mv` por cima de arquivo, `> arquivo`, `shred`, `kill -9 <pid>`,
  `git push origin +main`, `git push --force-with-lease` e qualquer coisa escrita de um
  jeito que o leitor simples não entende passam sem freio. É um cinto, não uma garantia.
- O leitor de comando é simples (aspas, `&&`, `;`, `|`, `$( )`); `eval`, aliases,
  here-docs e funções de shell não são entendidos.
- A pasta da medição é a da sessão (mais `cd` no mesmo comando). Se o shell do Bash
  ficou em outra pasta por um `cd` de um comando anterior, a medição pode olhar a pasta errada.
- `push --force`, `branch -D`, `dd`, `mkfs` e PowerShell não têm lixeira nem backup
  (só Prosseguir/Cancelar). Com `sudo`, também não.
- Lixeira por `mv` atravessando discos copia (lento) e não respeita limite de tamanho da
  lixeira. O caminho no `.trashinfo` não é codificado (espaço etc.) — o `gio` faz certo.
- `du -b` e `cp --parents` são do GNU (Linux). No Mac a medição de tamanho e o backup
  podem falhar (o backup falho barra o comando, por segurança).
- Medição grande (pasta enorme) tem limite de 15 s; passou disso, mostra "não consegui medir".
- Se o diálogo for respondido sozinho por ausência (AFK), não dá para distinguir de uma
  resposta sua — ver nota no relatório.
- Testado em Claude Code 2.1.289.
