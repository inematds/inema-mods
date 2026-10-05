# proximos-passos

Quando a resposta do Claude termina com uma listinha de opções ("Próximos passos: 1. publicar 2. testar..."), o mod mostra **até 3 botões** acima do prompt. Apertar um botão **escreve** aquele pedido no prompt: você revisa e aperta Enter.

```
próximos passos: [ Publicar a versão 1.2.0 ] [ Atualizar o README ] [ Avisar no canal ] dispensar
```

Os botões também respondem às teclas `1`, `2` e `3` quando a faixa está com o foco (ctrl+x tab ou um clique).

## Como ele acha a lista

Lê só o texto da última resposta. **Não chama o modelo** (não gasta cota) nem roda nada.

1. Procura uma lista (numerada ou com marcadores `-`, `*`, `•`) logo abaixo de um título que fale de **próximo(s)**, **next**, **opções** ou **sugest...**.
2. Se não houver título, pega a **última lista do texto**, desde que depois dela venham no máximo 2 linhas (como "Quer que eu siga?").
3. Só mostra se achar **de 2 a 4 itens curtos** (até 160 caracteres cada). Subitens são ignorados; marcação como `**negrito**` e `` `código` `` é tirada.

## Comandos e opções

- `/proximos` — lê de novo a última resposta e reabre a faixa.
- **[dispensar]** — esconde a faixa. Ela também some quando você manda um novo pedido.
- `/config` → **Mostrar sozinho depois de cada resposta** (padrão: ligado). Desligado, a faixa só aparece com `/proximos`.

## Limites (honestos)

- É leitura de texto, não entendimento: uma lista de resultados sob um título como "Next, I ran..." pode virar botão por engano; listas com 5 ou mais itens são ignoradas de propósito.
- Com 4 itens, só os 3 primeiros viram botão (`/proximos` lista quais).
- Rótulos longos são cortados no botão, mas o texto completo é o que vai para o prompt.
- Outros mods que também desenham acima do prompt (ex.: `clima-contexto`) aparecem juntos, um embaixo do outro.
