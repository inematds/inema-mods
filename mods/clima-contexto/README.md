# clima-contexto

Uma faixa acima do prompt que mostra o "tempo" do contexto da conversa, para você saber a hora de compactar ou passar a sessão adiante (handoff) antes que fique pesada.

```
● chuva 72% usado ▄▆ último turno +64,0 mil 5h 20% · sem 80%! US$ 3,50 equivalente em API
cache ~50 min (estimado) [ compactar ] [ handoff ] [ esconder ]
```

## O que aparece

| Parte | O que é |
|---|---|
| `○ limpo` / `◐ nublado` / `● chuva` / `▲ tempestade` | Faixa do uso do contexto. Padrão: abaixo de 50%, 50–69%, 70–84%, 85% ou mais. Cores: amarelo, ciano, azul, magenta. |
| `72% usado` | Quanto da janela de contexto já está ocupado. |
| `▁▂▃▄▅▆▇█` | Minigráfico do contexto no fim de cada um dos últimos 12 turnos. |
| `último turno +64,0 mil` | Quanto o contexto cresceu no último turno, em tokens. |
| `5h 20% · sem 80%!` | Limites da assinatura (janela de 5 horas e semanal). `!` a partir de 80%. Só aparece em conta de assinatura. |
| `US$ ... equivalente em API` | Quanto a sessão custaria se fosse paga por API. Na assinatura você não paga isso: é só uma referência. |
| `cache ~N min (estimado)` | **Estimativa**: minutos que faltam até o cache de prompt provavelmente expirar, contando do fim do último turno. |

Na primeira vez que o uso passa de cada limiar aparece um aviso (toast). Se você compactar e o uso subir de novo, avisa de novo.

## Botões

- **[compactar]**: compacta a conversa (o mesmo que `/compact`).
- **[handoff]**: roda `/session-handoff` se esse comando existir; se não existir, escreve `/session-handoff` no prompt para você conferir e apertar Enter.
- **[esconder]**: some com a faixa até você digitar `/contexto`.

## Comandos

- `/contexto` — liga ou desliga a faixa (a escolha fica guardada para as próximas sessões).
- `/handoff-agora` — roda o handoff agora e deixa `/clear` escrito no prompt. **O `/clear` nunca é executado sozinho**: você aperta Enter quando o handoff terminar.

## Opções (`/config`)

| Opção | Padrão | Para que serve |
|---|---|---|
| Limiares do clima (%) | `50,70,85` | Onde começam nublado, chuva e tempestade. |
| Validade estimada do cache (minutos) | `60` | Base da estimativa do cache. |
| Handoff automático | desligado | Ao passar do limiar, roda o handoff **uma vez** e deixa `/clear` escrito no prompt. |
| Limiar do handoff automático (%) | `85` | Uso que dispara o handoff automático. |

## Limites (honestos)

- O **relógio do cache é estimado**: o Claude Code não informa quando o cache expira de verdade. A conta é "minutos desde o último turno" contra o valor configurado.
- O **custo é o equivalente em API** (`/cost`), não o que você paga na assinatura.
- Os limites 5h/semana só aparecem depois da primeira resposta e só em conta de assinatura.
- O handoff automático depende de existir o comando/skill `session-handoff`; sem ele, só escreve o comando no prompt.
- A faixa se atualiza sozinha a cada minuto (para o cache). Depois de recarregar o mod no meio da sessão, essa atualização volta só na próxima sessão; a faixa continua atualizando a cada turno.
- Outros mods que também desenham acima do prompt (ex.: `proximos-passos`) aparecem juntos, um embaixo do outro.
