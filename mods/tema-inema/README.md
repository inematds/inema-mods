# tema-inema

Identidade visual para lives e gravações:

- uma faixa curta acima do prompt, na cor da marca: `INEMA.CLUB · portal · 14:05`
  (marca · nome da pasta do projeto · hora, atualizada sozinha);
- um destaque na mesma cor nas respostas do Claude.

Só muda o desenho na tela; o que o modelo lê não muda.

## Como usar

| Comando | O que faz |
|---|---|
| `/tema on` | Liga (é o padrão). |
| `/tema off` | Desliga faixa e destaque. Fica guardado depois de reiniciar. |
| `/tema` | Mostra se está ligado. |

## Opções (`/config`)

| Opção | Padrão | O que é |
|---|---|---|
| texto | `INEMA.CLUB` | O começo da faixa. |
| cor | `ambar` | `ambar`, `amarelo`, `ciano`, `magenta`, `verde`, `azul`. |
| destaque | `linha` | `linha`: uma linha `▌ INEMA.CLUB` no começo de cada resposta. `moldura`: borda colorida em volta de cada bloco da resposta (ocupa 2 linhas a mais por bloco). `nenhum`: só a faixa. |

## Limites

- O Claude Code não deixa mudar a cor de **um lado só** da borda nem a cor do texto da
  resposta sem redesenhá-la; por isso o destaque é uma linha extra ou uma moldura inteira.
- A hora segue o fuso da máquina e é conferida a cada 20 segundos (pode atrasar até 20 s).
- `ambar` é uma cor exata (`#FFB000`); em terminal com poucas cores ela vira a mais próxima.
- A faixa acima do prompt é dividida com outros mods (gravação, bichinho, registrar-falha):
  cada um põe a sua linha e mostra os outros abaixo.
- Testado com o kit de testes do Claude Code 2.1.289 (terminal e desktop).
