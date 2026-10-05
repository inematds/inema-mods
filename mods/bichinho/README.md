# bichinho

Um bichinho de texto acima do prompt que "come" os arquivos que o Claude lê, edita ou cria.
A cada mordida ele troca de cara e soma a conta:

```
(o.o) com fome... arquivos comidos: 0
(O.O) nhac! arquivos comidos: 1  (último: index.html)
(^.^) nhac! arquivos comidos: 2  (último: app.ts)
```

É uma demonstração divertida do que um mod consegue fazer (vídeo 2 da série).

## Como usar

| Comando | O que faz |
|---|---|
| `/bichinho off` | Esconde (fica guardado depois de reiniciar). |
| `/bichinho on` | Mostra de novo. |
| `/bichinho` | Mostra a conta atual. |

## Limites

- Conta Read, Edit e Write que deram certo. Ação com erro não conta. O mesmo arquivo lido
  duas vezes conta duas vezes.
- A conta é da sessão: começa de zero quando o Claude Code abre.
- Leituras feitas por comandos do terminal (`cat`, `grep`) e por subagentes não contam.
- Ocupa uma linha da faixa acima do prompt, dividida com outros mods.
- Testado com o kit de testes do Claude Code 2.1.289 (terminal e desktop).
