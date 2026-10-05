# vigia-api — Vigia de API paga

Antes de o Claude usar uma ferramenta ou comando que **gasta dinheiro ou créditos**, o
mod pergunta:

```
Isso usa serviço pago (mcp__klingai__text_to_video). Autoriza agora?
  Autorizar só esta vez | Autorizar por 1 hora | Negar
```

- **Autorizar só esta vez** — roda esta chamada; a próxima pergunta de novo.
- **Autorizar por 1 hora** — libera aquele **padrão** (ex.: `mcp__klingai__*`) por 1 hora,
  bom para lotes. Fica guardado no armazenamento do mod e **vale para todas as sessões
  abertas** nesse período.
- **Negar** (ou texto em "Outro") — não roda; o modelo é instruído a não tentar por outro
  caminho e a perguntar a você.
- **Sem tela** (`claude -p`, Esc) — nega e manda o modelo pedir autorização em texto.
  Você libera com `/vigia autorizar <padrão>`.

## Comandos

- `/vigia` — autorizações ativas e quanto falta.
- `/vigia limpar` — apaga todas (volta a perguntar sempre).
- `/vigia autorizar <padrão>` — libera um padrão por 1 hora sem esperar a pergunta
  (útil em `claude -p`). O padrão tem que estar nas listas, escrito igual.

## Opções (`/config`)

| Opção | Padrão | Como casa |
|---|---|---|
| `ferramentas_pagas` | `mcp__magnific__images_generate`, `mcp__magnific__video_*`, `mcp__magnific__audio_*`, `mcp__klingai__*`, `mcp__metricool__create*`, `mcp__*heygen*` | Nome inteiro da ferramenta MCP; `*` = qualquer trecho. |
| `comandos_pagos` | `openrouter`, `api.openai.com`, `groq`, `heygen`, `elevenlabs`, `kling ` (com espaço), `replicate`, `fal.ai`, `codex exec .*image` | Expressão regular procurada no comando Bash, sem diferenciar maiúsculas (se for inválida, vira trecho literal). |

Lista vazia = nada vigiado naquela categoria.

## Ligar e desligar

`/plugin` → Installed → vigia-api → Disable/Enable. Pânico: `claude plugin disable --all`.

## Limites (honestos)

- **Reduz o risco, não é à prova.** API chamada dentro de um script (`python gera.py`,
  `npm run gen:data`, `node traduz.mjs`) não é vista, a menos que o próprio comando
  contenha um dos padrões. Ferramenta MCP nova ou renomeada também passa até você pôr
  na lista.
- Falso positivo: `groq` casa `cat notas-groq.md`; `heygen` casa `ls heygen-cli/`.
  Ajuste a lista se incomodar.
- `WebFetch` e `$.http` de outros plugins não são vigiados.
- A autorização de 1 hora é por padrão, não por chamada: liberar `mcp__klingai__*`
  libera todas as ferramentas do Kling nesse tempo.
- O mod não sabe o custo real; não consulta saldo (não chama API).
- Testado em Claude Code 2.1.289.
