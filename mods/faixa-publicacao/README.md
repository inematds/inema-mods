# faixa-publicacao — Faixa de publicação

Depois de um `git push` que **deu certo**, o mod mostra um aviso rápido:

```
Push feito em origin/main (github.com/inematds/portal). O deploy é automático
(Vercel/Pages) — não precisa fazer mais nada.
```

Lembra a regra "publicar = push": o deploy vem sozinho pelo webhook, não é para ficar
olhando o painel do Vercel.

Se você preencher **remotos permitidos** e o push foi para um remoto fora da lista, mostra
um segundo aviso, mais longo:

```
ATENÇÃO: github.com/fulano/x não está em "remotos permitidos" (/config).
Confira se o push era para esse destino.
```

## Como ele lê o push

- Acha `git push` em qualquer trecho do comando (`git add . && git commit ... && git push`),
  inclusive `git -C pasta push` e depois de `cd pasta &&`.
- Remoto e branch escritos no comando (`git push outro HEAD:feature`) são usados; se não
  estiverem, pergunta ao git o upstream da branch atual (`@{u}`); sem upstream, `origin`
  e a branch atual.
- URL do remoto: `git remote get-url <remoto>` (só leitura).
- Não avisa em push que falhou, `--dry-run` ou em segundo plano.

## Opções (`/config`)

| Opção | Padrão | O que faz |
|---|---|---|
| `remotos_permitidos` | vazio | Nomes de remoto ou trechos de URL (`origin`, `inematds/`, `NeiMaldaner/portal`). Vazio = não confere. |

## Ligar e desligar

`/plugin` → Installed → faixa-publicacao → Disable/Enable. Pânico: `claude plugin disable --all`.

## Limites (honestos)

- Só vê push feito pelo Claude via Bash. Push que você faz no seu terminal, ou dentro de
  um script (`./publica.sh`), não aparece.
- O aviso é depois do push: a lista de remotos **não impede** nada, só alerta. Para barrar
  antes, use o freio-de-mao com `contas_git`.
- "Deploy automático" é a regra do INEMA; o mod não confere se o Vercel/Pages publicou.
- Testado em Claude Code 2.1.289.
