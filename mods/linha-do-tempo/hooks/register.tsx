// linha-do-tempo — "gravador de voo" da sessão.
// Guarda, turno a turno da conversa principal: modelo e esforço (de turn.step),
// chamadas de ferramenta por tipo, tokens do turno (turn.complete.usage) e duração.
// /timeline abre o painel; /timeline exportar devolve Markdown; /timeline limpar zera.
import { atom, read, update } from 'claude-code'
import type { Register, TurnUsage } from 'claude-code'

import type { Parcial, Tokens, Turno } from '../types'

const PAINEL = 'linha-do-tempo'
const MAXIMO = 100
const turnos = atom({ plugin: 'linha-do-tempo', key: 'turnos' } as const, [])
const abertos = atom({ plugin: 'linha-do-tempo', key: 'abertos' } as const, {})
const contador = atom({ plugin: 'linha-do-tempo', key: 'contador' } as const, 0)

const ESFORCO: Record<string, string> = { low: 'baixo', medium: 'médio', high: 'alto', xhigh: 'muito alto', max: 'máximo' }

export const esforcoEmTexto = (e: unknown) =>
  e === undefined || e === null ? '-' : typeof e === 'number' ? `${e}` : (ESFORCO[String(e)] ?? String(e))

export const modeloCurto = (m: string) => m.replace(/^claude-/, '').replace(/-\d{8}$/, '')

/** Bash, Edit... ficam com o nome; toda ferramenta mcp__* vira "MCP". */
export const tipoDaFerramenta = (nome: string) => (nome.startsWith('mcp__') ? 'MCP' : nome)

export const tokensDe = (u: TurnUsage | undefined): Tokens | null =>
  u === undefined
    ? null
    : {
        entrada: u.input_tokens,
        saida: u.output_tokens,
        cacheLido: u.cache_read_input_tokens,
        cacheEscrito: u.cache_creation_input_tokens,
      }

export const numero = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')} mil`
  return String(n)
}

export const segundos = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`

export const ferramentasEmTexto = (f: Record<string, number>) => {
  const itens = Object.entries(f).sort((a, b) => b[1] - a[1])
  return itens.length === 0 ? 'nenhuma' : itens.map(([nome, q]) => `${nome} ${q}`).join(' · ')
}

export const tokensEmTexto = (t: Tokens | null) =>
  t === null
    ? 'sem dados'
    : `entrada ${numero(t.entrada)} · saída ${numero(t.saida)} · cache lido ${numero(t.cacheLido)} · cache escrito ${numero(t.cacheEscrito)}`

const celula = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ')

export const markdown = (lista: readonly Turno[]) => {
  if (lista.length === 0) return 'Linha do tempo: nenhum turno registrado ainda.'
  const total = lista.reduce(
    (acc, t) => ({
      entrada: acc.entrada + (t.tokens?.entrada ?? 0),
      saida: acc.saida + (t.tokens?.saida ?? 0),
      ms: acc.ms + t.duracaoMs,
    }),
    { entrada: 0, saida: 0, ms: 0 },
  )
  return [
    `## Linha do tempo (${lista.length} turnos)`,
    '',
    '| # | pedido | modelo | esforço | passos | ferramentas | entrada | saída | cache lido | cache escrito | duração |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...lista.map(
      t =>
        `| ${t.n}${t.interrompido ? ' (interrompido)' : ''} | ${celula(t.pedido)} | ${modeloCurto(t.modelo)} | ${t.esforco} | ${t.passos} | ${celula(ferramentasEmTexto(t.ferramentas))} | ${t.tokens?.entrada ?? '-'} | ${t.tokens?.saida ?? '-'} | ${t.tokens?.cacheLido ?? '-'} | ${t.tokens?.cacheEscrito ?? '-'} | ${segundos(t.duracaoMs)} |`,
    ),
    '',
    `Total: entrada ${numero(total.entrada)}, saída ${numero(total.saida)}, ${segundos(total.ms)} de turnos.`,
  ].join('\n')
}

const novoParcial = (pedido: string): Parcial => ({
  pedido: pedido.replace(/\s+/g, ' ').trim().slice(0, 60),
  modelo: '?',
  esforco: '-',
  passos: 0,
  ferramentas: {},
})

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'timeline',
      description: 'Linha do tempo da sessão, turno a turno (args: exportar | limpar)',
      argumentHint: 'exportar | limpar',
    })
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await update($, abertos, a => ({ ...a, [e.turnId]: novoParcial(e.text) }))
    return next(e)
  })

  // turn.step é um fluxo: o hook é um gerador assíncrono que repassa tudo e,
  // no fim, lê o resultado (modelo, esforço e ferramentas pedidas nesse passo).
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    if (e.agentId !== undefined) return r
    const modelo = r.usage?.model ?? e.model
    const esforco = esforcoEmTexto(e.effort)
    const usadas = r.toolUses.map(u => tipoDaFerramenta(u.name))
    await update($, abertos, a => {
      const p = a[e.turnId] ?? novoParcial('')
      const ferramentas = { ...p.ferramentas }
      for (const nome of usadas) ferramentas[nome] = (ferramentas[nome] ?? 0) + 1
      return { ...a, [e.turnId]: { ...p, modelo, esforco, passos: p.passos + 1, ferramentas } }
    })
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined) return r
    const p = (await read($, abertos))[e.turnId] ?? novoParcial('')
    const n = (await read($, contador)) + 1
    await update($, contador, () => n)
    const turno: Turno = {
      ...p,
      n,
      modelo: p.modelo === '?' && e.usage ? e.usage.model : p.modelo,
      tokens: tokensDe(e.usage),
      duracaoMs: e.durationMs,
      interrompido: e.isAborted,
    }
    await update($, turnos, lista => [...lista, turno].slice(-MAXIMO))
    await update($, abertos, a => {
      const resto = { ...a }
      delete resto[e.turnId]
      return resto
    })
    return r
  })

  on('command.run', { command: 'timeline' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const lista = await read($, turnos)
    if (arg === 'exportar') return { text: markdown(lista) }
    if (arg === 'limpar') {
      await update($, turnos, () => [])
      await update($, contador, () => 0)
      return { text: 'Linha do tempo zerada.' }
    }
    await $.ui.open({ id: PAINEL, title: 'Linha do tempo' })
    const ultimo = lista.at(-1)
    return {
      text:
        ultimo === undefined
          ? 'Linha do tempo aberta: nenhum turno registrado ainda.'
          : `Linha do tempo aberta: ${lista.length} turno(s); último em ${modeloCurto(ultimo.modelo)}, ${segundos(ultimo.duracaoMs)}. Use /timeline exportar para copiar em Markdown.`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const lista = await read($, turnos)
    const largura = e.props.bodyColumns
    const corta = (s: string) => (s.length > largura ? `${s.slice(0, Math.max(1, largura - 1))}…` : s)

    return (
      <Box flexDirection="column">
        <Box key="topo">
          <Text dimColor>{`${lista.length} turno(s) guardado(s), no máximo ${MAXIMO}. `}</Text>
          <Button key="limpar" label="limpar" plain onPress={async () => {
              await update($, turnos, () => [])
              await update($, contador, () => 0)
            }}
          />
        </Box>
        {lista.length === 0 && <Text dimColor>Nenhum turno ainda: mande um pedido e volte aqui.</Text>}
        {lista.map(t => (
          <Box key={`t${t.n}`} flexDirection="column" marginTop={1}>
            <Text bold color={t.interrompido ? 'red' : 'cyan'}>
              {corta(`#${t.n} ${modeloCurto(t.modelo)} · esforço ${t.esforco} · ${segundos(t.duracaoMs)} · ${t.passos} passo(s)${t.interrompido ? ' · interrompido' : ''}`)}
            </Text>
            {t.pedido !== '' && <Text dimColor>{corta(`  "${t.pedido}"`)}</Text>}
            <Text>{corta(`  ferramentas: ${ferramentasEmTexto(t.ferramentas)}`)}</Text>
            <Text dimColor>{corta(`  tokens: ${tokensEmTexto(t.tokens)}`)}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
