# tradutor-acoes

Para quem está começando: antes de cada ação do Claude aparece uma linha em português
simples dizendo o que ele está fazendo. **O desenho original continua logo abaixo** — o
comando real nunca fica escondido.

```
> Rodando comando: git push origin main
● Bash(git push origin main)
  ⎿  ...
```

## Como usar

| Comando | O que faz |
|---|---|
| `/tradutor on` | Liga (é o padrão). |
| `/tradutor off` | Desliga. Fica guardado mesmo depois de reiniciar. |
| `/tradutor` | Mostra se está ligado. |

## Frases

| Ferramenta | Frase |
|---|---|
| Read | Lendo arquivo X |
| Edit / MultiEdit | Editando X |
| NotebookEdit | Editando caderno X |
| Write | Criando X |
| Bash | Rodando comando: … (1ª linha, até 60 letras) |
| Grep | Procurando 'termo' nos arquivos |
| Glob | Procurando arquivos com nome '…' |
| WebFetch | Abrindo página web: site |
| WebSearch | Pesquisando na internet: '…' |
| Agent / Task | Chamando ajudante (subagente): descrição |
| TodoWrite | Atualizando a lista de tarefas |
| Skill | Usando a habilidade (skill) '…' |
| AskUserQuestion | Fazendo uma pergunta para você |
| `mcp__servidor__ferramenta` | Usando ferramenta externa: servidor / ferramenta |
| outra | Usando a ferramenta Nome |

Se a ação deu erro, a frase termina com "(deu erro)"; se foi interrompida, "(interrompido)".
Leituras e buscas que o Claude Code junta numa linha só ("Read 3 files") ganham um resumo:
"Lendo 3 arquivos, fazendo 1 busca".

## Limites

- Write sempre diz "Criando", mesmo quando o arquivo já existia (a linha não sabe).
- A frase usa só o nome do arquivo, não a pasta (a pasta aparece no desenho original).
- Não traduz o spinner ("Pensando…") nem os diálogos de permissão.
- Ocupa uma linha a mais por ação.
- Testado com o kit de testes do Claude Code 2.1.289 (terminal e desktop).
