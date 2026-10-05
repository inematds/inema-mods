// roteador-subagente — cada subagente no modelo certo.
// /router on      -> segue o mapa do /config (padrão Explore=haiku, general-purpose=sonnet)
// /router sonnet  -> força todos os subagentes no sonnet (idem haiku, opus)
// /router off     -> desliga; /router status -> como está e quantos tokens rodaram roteados.
// Nunca troca um modelo pedido explicitamente na chamada do Agent, nem fork/teammate.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Modo } from '../types'

const modo = atom({ plugin: 'roteador-subagente', key: 'modo' } as const, 'off')
const roteados = atom({ plugin: 'roteador-subagente', key: 'roteados' } as const, {})
const tokens = atom({ plugin: 'roteador-subagente', key: 'tokens' } as const, {})
const saida = atom({ plugin: 'roteador-subagente', key: 'saida' } as const, {})

const MODOS: readonly Modo[] = ['off', 'on', 'sonnet', 'haiku', 'opus']
const FORCADOS: readonly string[] = ['sonnet', 'haiku', 'opus']
const MENORES: readonly string[] = ['haiku', 'sonnet']

/** "Explore=haiku, general-purpose=sonnet" -> { explore: 'haiku', 'general-purpose': 'sonnet' } */
export const lerMapa = (texto: unknown): Record<string, string> => {
  const mapa: Record<string, string> = {}
  for (const par of String(texto ?? '').split(/[,;\n]+/)) {
    const i = par.indexOf('=')
    if (i <= 0) continue
    const tipo = par.slice(0, i).trim().toLowerCase()
    const modelo = par.slice(i + 1).trim()
    if (tipo !== '' && modelo !== '') mapa[tipo] = modelo
  }
  return mapa
}

/** Para onde vai este subagente; undefined = deixa como está. */
export const destino = (m: Modo, mapa: Readonly<Record<string, string>>, tipo: string): string | undefined => {
  if (m === 'off') return undefined
  if (FORCADOS.includes(m)) return m
  return mapa[tipo.toLowerCase()]
}

const mil = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi` : n >= 1_000 ? `${(n / 1_000).toFixed(1).replace('.', ',')} mil` : String(n)

export const linhaDeStatus = (m: Modo) => (m === 'off' ? undefined : `router: ${m === 'on' ? 'mapa' : m}`)

export const textoDoStatus = (
  m: Modo,
  mapa: Readonly<Record<string, string>>,
  quantos: number,
  porModelo: Readonly<Record<string, number>>,
  saidaPorModelo: Readonly<Record<string, number>>,
) => {
  const regra =
    m === 'off'
      ? 'desligado (os subagentes usam o modelo de sempre)'
      : m === 'on'
        ? `ligado, seguindo o mapa: ${Object.entries(mapa).map(([t, mo]) => `${t}=${mo}`).join(', ') || '(vazio)'}`
        : `forçando todos os subagentes no ${m}`
  const linhas = [`Roteador: ${regra}.`]
  const modelos = Object.entries(porModelo)
  if (quantos === 0 || modelos.length === 0) {
    linhas.push('Nesta sessão nenhum subagente foi roteado ainda.')
  } else {
    const menores = modelos.filter(([mo]) => MENORES.some(x => mo.includes(x))).reduce((s, [, n]) => s + n, 0)
    linhas.push(`Nesta sessão: ${quantos} subagente(s) roteado(s).`)
    linhas.push(`Tokens rodados em modelo menor (haiku/sonnet): ${mil(menores)}.`)
    linhas.push(
      `Por modelo: ${modelos.map(([mo, n]) => `${mo} ${mil(n)} (saída ${mil(saidaPorModelo[mo] ?? 0)})`).join(' · ')}.`,
    )
    linhas.push('Conta entrada + saída + cache de cada subagente roteado. É assinatura: o ganho é cota, não dinheiro.')
  }
  linhas.push('Modelo pedido explicitamente na chamada nunca é trocado.')
  return linhas.join('\n')
}

async function aplicarModo($: EngineInterface, novo: Modo) {
  await update($, modo, () => novo)
  await $.store.set('modo', novo).catch(() => undefined)
  $.ui.status(linhaDeStatus(novo))
}

export const register: Register = (on, options) => {
  const mapa = lerMapa(options.mapa)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'router',
      description: 'Roteador de subagente (args: on | off | sonnet | haiku | opus | status)',
      argumentHint: 'on | off | sonnet | haiku | opus | status',
    })
    const salvo = await $.store.get('modo').catch(() => undefined)
    if (typeof salvo === 'string' && (MODOS as readonly string[]).includes(salvo)) await aplicarModo($, salvo as Modo)
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    // Respeita o que foi pedido: modelo explícito, fork (sempre herda) e teammate.
    if (e.model !== undefined || e.fork || e.isTeammate === true) return next(e)
    const alvo = destino(await read($, modo), mapa, e.subagentType)
    if (alvo === undefined) return next(e)
    const r = await next({ ...e, model: alvo })
    const id = r.agentId
    if (id !== undefined) await update($, roteados, x => ({ ...x, [id]: alvo }))
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    const id = e.agentId
    if (id === undefined || e.usage === undefined) return r
    const alvo = (await read($, roteados))[id]
    if (alvo === undefined) return r
    const u = e.usage
    const total = u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
    await update($, tokens, x => ({ ...x, [alvo]: (x[alvo] ?? 0) + total }))
    await update($, saida, x => ({ ...x, [alvo]: (x[alvo] ?? 0) + u.output_tokens }))
    return r
  })

  on('command.run', { command: 'router' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if ((MODOS as readonly string[]).includes(arg)) {
      await aplicarModo($, arg as Modo)
      const m = arg as Modo
      return {
        text:
          m === 'off'
            ? 'Roteador desligado.'
            : m === 'on'
              ? `Roteador ligado, seguindo o mapa: ${Object.entries(mapa).map(([t, mo]) => `${t}=${mo}`).join(', ') || '(vazio: ajuste em /config)'}.`
              : `Roteador ligado: todos os subagentes no ${m} (menos os que pedirem modelo explicitamente).`,
      }
    }
    if (arg !== '' && arg !== 'status') return { text: 'Uso: /router on | off | sonnet | haiku | opus | status' }
    const quantos = Object.keys(await read($, roteados)).length
    return { text: textoDoStatus(await read($, modo), mapa, quantos, await read($, tokens), await read($, saida)) }
  })

  // Faixa opcional (/config "Mostrar faixa"): uma linha curta, por cima do que já houver na faixa.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (options.mostrar_faixa !== true || e.props.hasSurvey) return next(e)
    const m = await read($, modo)
    const linha = linhaDeStatus(m)
    if (linha === undefined) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const quantos = Object.keys(await read($, roteados)).length
    const abaixo = await next(e)
    return (
      <Box flexDirection="column">
        <Box key="router">
          <Text color="green">{`${linha} `}</Text>
          <Text dimColor>{`· ${quantos} subagente(s) roteado(s) `}</Text>
          <Button key="desligar" label="desligar" plain onPress={() => aplicarModo($, 'off')} />
        </Box>
        {abaixo}
      </Box>
    )
  })
}
