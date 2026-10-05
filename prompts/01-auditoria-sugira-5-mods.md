# Prompt: "descubra os 5 mods que EU preciso"

Cole numa sessão nova do Claude Code (ela vai ler seus históricos; não precisa de nada instalado):

```
Analise como eu uso o Claude Code. Leia minhas últimas 30 sessões em ~/.claude/projects
(arquivos .jsonl; leia em partes, não carregue tudo de uma vez). Se existirem, leia também
meus arquivos FALHAS.md, LIMITES.md e CLAUDE.md.

Quero saber:
1. O que eu peço repetidamente (tarefas, frases, comandos).
2. O que dá errado com frequência (erros, retrabalho, coisas que eu tive que corrigir).
3. O que eu fico perguntando ou conferindo à mão (contexto, custo, arquivos criados, status).

Depois sugira 5 mods do Claude Code que resolveriam isso, do mais útil ao menos útil.
Para cada um: nome curto em português, o que ele mostra ou faz, em que momento age
(antes / no lugar / depois de uma ação, ou só mostra algo na tela) e que problema meu ele resolve,
citando a evidência que você achou nas sessões.

Não crie nada ainda. Eu escolho um e depois peço para construir.
```

Depois de escolher: `/plugin-authoring` e peça, por exemplo, "constrói o mod número 2 com o nome X".
