# roteador-subagente

Escolhe o modelo de cada **subagente** (os "ajudantes" que o Claude dispara com a ferramenta Agent), para tarefas simples rodarem num modelo menor e pouparem a cota da assinatura.

## Comandos

- `/router on` — liga seguindo o mapa do `/config` (padrão: `Explore=haiku, general-purpose=sonnet`). Tipos que não estão no mapa ficam como estão.
- `/router sonnet` · `/router haiku` · `/router opus` — força todos os subagentes nesse modelo.
- `/router off` — desliga.
- `/router status` (ou só `/router`) — mostra o modo e quantos tokens rodaram nos subagentes roteados ("tokens rodados em modelo menor").

Quando ligado aparece `router: mapa` / `router: sonnet` na linha de status. O modo escolhido fica guardado para as próximas sessões.

## O que ele NUNCA troca

- Modelo pedido **explicitamente** na chamada do Agent (o parâmetro `model`).
- **Fork** (sempre herda o modelo da conversa) e **teammate** (agente de equipe).

## Opções (`/config`)

| Opção | Padrão | Para que serve |
|---|---|---|
| Mapa tipo=modelo | `Explore=haiku, general-purpose=sonnet` | Vale com `/router on`. Modelo pode ser `haiku`, `sonnet`, `opus` ou um id completo. Maiúsculas não importam no tipo. |
| Mostrar faixa acima do prompt | desligado | Além da linha de status, uma faixa curta com o modo e um botão `desligar`. |

## Limites (honestos)

- **Modelo próprio do agente**: um agente cujo arquivo de definição já diz `model:` (ex.: um agente seu) **não é visível** para o mod. Com `/router on` ele só é trocado se o tipo estiver no mapa; com `/router sonnet|haiku|opus` ele é trocado também. Se quiser preservar, tire o tipo do mapa e use `on`.
- Só o **modelo explícito na chamada** é reconhecido como "pedido"; ele é respeitado sempre.
- A soma de tokens é de **entrada + saída + cache** de cada subagente roteado, nesta sessão. É assinatura: o ganho é de **cota**, não de dinheiro, e por isso o mod não mostra valores em dólar.
- Não mexe no modelo da conversa principal, só nos subagentes.
