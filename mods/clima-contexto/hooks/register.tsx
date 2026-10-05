// clima-contexto — "como está o tempo do meu contexto?"
// Faixa acima do prompt: símbolo + palavra (limpo / nublado / chuva / tempestade),
// % usado, minigráfico dos últimos 12 turnos, quanto o último turno somou,
// limites 5h e semanal, custo equivalente em API e uma ESTIMATIVA do cache.
// Botões [compactar] [handoff] [esconder]. Comandos /contexto e /handoff-agora.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limite, Retrato } from '../types'

const retrato = atom({ plugin: 'clima-contexto', key: 'retrato' } as const, null)
const historico = atom({ plugin: 'clima-contexto', key: 'historico' } as const, [])
const somaUltimo = atom({ plugin: 'clima-contexto', key: 'somaUltimo' } as const, null)
const tokensUltimo = atom({ plugin: 'clima-contexto', key: 'tokensUltimo' } as const, null)
const horaUltimo = atom({ plugin: 'clima-contexto', key: 'horaUltimo' } as const, null)
const avisados = atom({ plugin: 'clima-contexto', key: 'avisados' } as const, [])
const escondido = atom({ plugin: 'clima-contexto', key: 'escondido' } as const, false)
const ligado = atom({ plugin: 'clima-contexto', key: 'ligado' } as const, true)
const handoffFeito = atom({ plugin: 'clima-contexto', key: 'handoffFeito' } as const, false)

const TURNOS_NO_GRAFICO = 12
const BARRAS = '▁▂▃▄▅▆▇█'

export type Clima = { simbolo: string; palavra: string; cor: string }

/** "50,70,85" -> [50, 70, 85]; qualquer coisa estranha volta ao padrão. */
export const lerLimiares = (texto: unknown): [number, number, number] => {
  const nums = String(texto ?? '')
    .split(/[,;\s]+/)
    .map(Number)
    .filter(n => Number.isFinite(n) && n > 0 && n <= 100)
    .sort((a, b) => a - b)
  const [a, b, c] = nums
  return a !== undefined && b !== undefined && c !== undefined && nums.length === 3 ? [a, b, c] : [50, 70, 85]
}

export const climaDe = (percent: number, limiares: readonly [number, number, number]): Clima => {
  const [nublado, chuva, tempestade] = limiares
  if (percent >= tempestade) return { simbolo: '▲', palavra: 'tempestade', cor: 'magenta' }
  if (percent >= chuva) return { simbolo: '●', palavra: 'chuva', cor: 'blue' }
  if (percent >= nublado) return { simbolo: '◐', palavra: 'nublado', cor: 'cyan' }
  return { simbolo: '○', palavra: 'limpo', cor: 'yellow' }
}

/** Minigráfico: 0% = ▁, 100% = █. */
export const grafico = (valores: readonly number[]) =>
  valores
    .map(v => BARRAS[Math.min(BARRAS.length - 1, Math.max(0, Math.floor((v / 100) * BARRAS.length)))] ?? BARRAS[0])
    .join('')

export const tokensEmTexto = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')} mil`
  return String(Math.round(n))
}

const NOMES_LIMITE: Record<string, string> = { five_hour: '5h', seven_day: 'sem' }

export const limitesEmTexto = (limites: readonly Limite[]) =>
  limites
    .map(l => `${NOMES_LIMITE[l.kind] ?? l.kind} ${Math.round(l.percentUsed)}%${l.percentUsed >= 80 ? '!' : ''}`)
    .join(' · ')

/** Minutos de cache que sobram (estimativa): TTL menos o tempo desde o último turno. */
export const cacheEmTexto = (agora: number, hora: number | null, ttlMinutos: number) => {
  if (hora === null) return undefined
  const passados = Math.floor((agora - hora) / 60_000)
  const restam = ttlMinutos - passados
  return restam > 0 ? `cache ~${restam} min (estimado)` : 'cache provavelmente expirou (estimado)'
}

const retratoDe = (u: {
  context: { percent?: number; tokens?: number; window: number }
  rateLimits: readonly Limite[]
  cost?: { usd: number }
}): Retrato => ({
  percent: u.context.percent ?? 0,
  tokens: u.context.tokens ?? 0,
  janela: u.context.window,
  limites: u.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed })),
  ...(u.cost !== undefined && { usd: u.cost.usd }),
})

/** Roda o /session-handoff (ou escreve no prompt) e, se pedido, deixa /clear escrito. */
async function rodarHandoff($: EngineInterface, deixarClear: boolean) {
  const lista = await $.command.list().catch(() => [])
  const existe = lista.some(c => c.name === 'session-handoff')
  if (existe) {
    const ok = await $.command.run({ command: 'session-handoff' }).then(
      () => true,
      () => false,
    )
    if (ok && deixarClear) {
      await $.prompt.fill({ text: '/clear' })
      $.ui.toast('Handoff pedido. /clear ficou escrito no prompt: aperte Enter quando o handoff terminar.')
      return
    }
    if (ok) return
  }
  await $.prompt.fill({ text: '/session-handoff' })
  $.ui.toast('Escrevi /session-handoff no prompt: aperte Enter para rodar.')
}

async function compactar($: EngineInterface) {
  try {
    await $.session.compact({})
  } catch {
    // Fora de hora (turno rodando) ou sem o noun: tenta o comando, que espera a sessão ficar livre.
    await $.command.run({ command: 'compact' }).catch(() => $.ui.toast('Não consegui compactar agora. Tente /compact.'))
  }
}

/** Guarda o retrato, avisa limiares cruzados pela primeira vez e dispara o handoff automático. */
async function absorver(
  $: EngineInterface,
  novo: Retrato,
  limiares: readonly [number, number, number],
  auto: boolean,
  limiarHandoff: number,
) {
  await update($, retrato, () => novo)
  const p = novo.percent
  const ja = await read($, avisados)
  // Um limiar que ficou acima do uso (depois de compactar) pode avisar de novo.
  const mantidos = ja.filter(l => l <= p)
  const novos = limiares.filter(l => p >= l && !mantidos.includes(l))
  if (novos.length > 0 || mantidos.length !== ja.length) await update($, avisados, () => [...mantidos, ...novos])
  const maior = novos.at(-1)
  if (maior !== undefined) {
    const c = climaDe(p, limiares)
    $.ui.toast(`Contexto em ${Math.round(p)}%: ${c.simbolo} ${c.palavra}. Bom momento para compactar ou fazer handoff.`)
  }

  if (!auto) return
  if (p < limiarHandoff) {
    if (await read($, handoffFeito)) await update($, handoffFeito, () => false)
    return
  }
  if (await read($, handoffFeito)) return
  await update($, handoffFeito, () => true)
  // Fora do hook: $.command.run espera a sessão ficar livre.
  $.clock.after(0, () => void rodarHandoff($, true))
}

export const register: Register = (on, options) => {
  const limiares = lerLimiares(options.limiares)
  const ttl = Number(options.cache_minutos ?? 60) || 60
  const auto = options.auto_handoff === true
  const limiarHandoff = Number(options.limiar_handoff ?? 85) || 85

  on('session.start', async ($, e, next) => {
    // Cada comando por conta própria: se o nome já existir (skill do usuário), o outro continua.
    await $.command
      .register({ name: 'contexto', description: 'Liga/desliga a faixa do clima do contexto' })
      .catch(() => $.ui.toast('clima-contexto: /contexto já existe aqui; use o botão [esconder] da faixa'))
    await $.command
      .register({ name: 'handoff-agora', description: 'Roda o /session-handoff agora e deixa /clear escrito no prompt' })
      .catch(() => undefined)
    const salvo = await $.store.get('ligado').catch(() => undefined)
    if (salvo === false) await update($, ligado, () => false)
    // A estimativa do cache anda com o relógio: redesenha a faixa a cada minuto.
    $.clock.every(60_000, () => $.ui.invalidate('ui.render'))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await absorver($, retratoDe(e), limiares, auto, limiarHandoff)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined) return r
    const uso = await $.session.usage().catch(() => undefined)
    if (uso === undefined) return r
    const novo = retratoDe(uso)
    const antes = await read($, tokensUltimo)
    await update($, somaUltimo, () => (antes === null ? null : novo.tokens - antes))
    await update($, tokensUltimo, () => novo.tokens)
    const agora = await $.clock.now()
    await update($, horaUltimo, () => agora)
    await update($, historico, h => [...h, novo.percent].slice(-TURNOS_NO_GRAFICO))
    await absorver($, novo, limiares, auto, limiarHandoff)
    return r
  })

  on('command.run', { command: 'contexto' }, async $ => {
    const estaLigado = await read($, ligado)
    const estaEscondido = await read($, escondido)
    if (estaLigado && !estaEscondido) {
      await update($, ligado, () => false)
      await $.store.set('ligado', false)
      return { text: 'Faixa do clima desligada. /contexto liga de novo.' }
    }
    await update($, ligado, () => true)
    await update($, escondido, () => false)
    await $.store.set('ligado', true)
    const r = await read($, retrato)
    const resumo = r ? ` Agora: ${climaDe(r.percent, limiares).palavra}, ${Math.round(r.percent)}% usado.` : ''
    return { text: `Faixa do clima ligada.${resumo}` }
  })

  on('command.run', { command: 'handoff-agora' }, async $ => {
    $.clock.after(0, () => void rodarHandoff($, true))
    return { text: 'Rodando o handoff. Depois, /clear fica escrito no prompt (só roda se você apertar Enter).' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, retrato)
    if (e.props.hasSurvey || r === null || !(await read($, ligado)) || (await read($, escondido))) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const c = climaDe(r.percent, limiares)
    const hist = await read($, historico)
    const soma = await read($, somaUltimo)
    const cache = cacheEmTexto(await $.clock.now(), await read($, horaUltimo), ttl)
    const limites = limitesEmTexto(r.limites)
    const abaixo = await next(e)

    return (
      <Box flexDirection="column">
        <Box key="linha1" flexWrap="wrap">
          <Text key="clima" color={c.cor} bold>
            {`${c.simbolo} ${c.palavra} `}
          </Text>
          <Text key="pct">{`${Math.round(r.percent)}% usado `}</Text>
          {hist.length > 0 && <Text key="grafico" color={c.cor}>{`${grafico(hist)} `}</Text>}
          {soma !== null && <Text key="soma" dimColor>{`último turno ${soma >= 0 ? '+' : ''}${tokensEmTexto(soma)} `}</Text>}
          {limites !== '' && <Text key="limites">{`${limites} `}</Text>}
          {r.usd !== undefined && (
            <Text key="custo" dimColor>{`US$ ${r.usd.toFixed(2).replace('.', ',')} equivalente em API`}</Text>
          )}
        </Box>
        <Box key="linha2">
          {cache !== undefined && <Text key="cache" dimColor>{`${cache} `}</Text>}
          <Button key="compactar" label="compactar" onPress={() => compactar($)} />
          <Button key="handoff" label="handoff" onPress={() => rodarHandoff($, false)} />
          <Button key="esconder" label="esconder" onPress={() => update($, escondido, () => true)} />
        </Box>
        {abaixo}
      </Box>
    )
  })
}
