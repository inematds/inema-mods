import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, TurnStepToolUse } from 'claude-code'

import { ferramentasEmTexto, markdown, tipoDaFerramenta } from '../hooks/register'
import { comando, mundoDe, PAINEL, SESSAO } from './mundo'

const PLUGIN = 'linha-do-tempo'

const uso = (model: string, input: number, output: number) => ({
  model,
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: 1000,
  cache_creation_input_tokens: 50,
})

/** Por baixo do turn.step: o "modelo" responde com as ferramentas da fila. */
const respostas = (on: On, fila: TurnStepToolUse[][]) => {
  on('turn.step', async function* ($, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: fila.shift() ?? [],
      stopReason: 'end_turn' as const,
      usage: null,
    }
  })
}

const passo = async ($: Engine, turnId: string, index: number, extra: Record<string, unknown> = {}) => {
  const s = $.turn.step({ turnId, index, model: 'claude-opus-4-1', effort: 'high', messageCount: 3, ...extra })
  for await (const _ of s) void _
  return s.result
}

const usar = (...nomes: string[]): TurnStepToolUse[] => nomes.map(name => ({ name, input: {} }))

async function umTurno($: Engine, turnId: string, pedido: string, passos: number, aborted = false) {
  await $.turn.start({ text: pedido, turnId })
  for (let i = 0; i < passos; i++) await passo($, turnId, i)
  await $.turn.complete({
    answer: 'feito',
    durationMs: 12_300,
    isAborted: aborted,
    turnId,
    reason: aborted ? ('aborted' as const) : ('answer' as const),
    usage: uso('claude-opus-4-1', 1200, 800),
  })
}

describe('linha-do-tempo', () => {
  test('tipos de ferramenta: MCP agrupado', () => {
    expect(tipoDaFerramenta('mcp__magnific__images_generate')).toBe('MCP')
    expect(tipoDaFerramenta('Bash')).toBe('Bash')
    expect(ferramentasEmTexto({ Edit: 1, Bash: 3 })).toBe('Bash 3 · Edit 1')
    expect(markdown([])).toContain('nenhum turno')
  })

  test('registra o /timeline ao iniciar', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['timeline'])
  })

  test('turno a turno: modelo, esforço, ferramentas por tipo, tokens e duração', async ($, on) => {
    mundoDe(on)
    respostas(on, [usar('Bash', 'Bash', 'Read'), usar('Edit', 'mcp__x__y'), [], usar('Agent')])
    await $.session.start(SESSAO)
    await umTurno($, 't1', 'arruma o build e roda os testes', 3)
    await umTurno($, 't2', 'agora delega', 1, true)

    const md = (await $.command.run(comando('timeline', 'exportar'))).text ?? ''
    expect(md).toContain('## Linha do tempo (2 turnos)')
    expect(md).toContain('| 1 | arruma o build e roda os testes | opus-4-1 | alto | 3 | Bash 2 · Read 1 · Edit 1 · MCP 1 | 1200 | 800 | 1000 | 50 | 12,3 s |')
    expect(md).toContain('| 2 (interrompido) | agora delega | opus-4-1 | alto | 1 | Agent 1 |')
  })

  test('passo de subagente não entra no turno principal', async ($, on) => {
    mundoDe(on)
    respostas(on, [usar('Bash'), usar('Write', 'Write')])
    await $.session.start(SESSAO)
    await $.turn.start({ text: 'oi', turnId: 't1' })
    await passo($, 't1', 0)
    await passo($, 'sub', 0, { agentId: 'a1' })
    await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 'sub', reason: 'answer', agentId: 'a1' })
    await $.turn.complete({ answer: '', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer' })
    const md = (await $.command.run(comando('timeline', 'exportar'))).text ?? ''
    expect(md).toContain('(1 turnos)')
    expect(md).not.toContain('Write')
    expect(md).toContain('| - | - | - | - |') // turno sem usage
  })

  test('guarda no máximo 100 turnos', async ($, on) => {
    mundoDe(on)
    respostas(on, [])
    await $.session.start(SESSAO)
    for (let i = 0; i < 105; i++) {
      await $.turn.complete({ answer: '', durationMs: 10, isAborted: false, turnId: `t${i}`, reason: 'answer' })
    }
    const md = (await $.command.run(comando('timeline', 'exportar'))).text ?? ''
    expect(md).toContain('(100 turnos)')
    expect(md).toContain('| 105 |')
    expect(md).not.toContain('| 5 |')
  })

  test('/timeline abre o painel e /timeline limpar zera', async ($, on) => {
    const mundo = mundoDe(on)
    respostas(on, [usar('Bash')])
    await $.session.start(SESSAO)
    await umTurno($, 't1', 'oi', 1)
    const r = await $.command.run(comando('timeline'))
    expect(mundo.abertos).toEqual(['linha-do-tempo'])
    expect(r.text).toContain('1 turno(s)')
    expect((await $.command.run(comando('timeline', 'limpar'))).text).toBe('Linha do tempo zerada.')
    expect((await $.command.run(comando('timeline', 'exportar'))).text).toContain('nenhum turno')
  })

  test('painel desenha em terminal e desktop', async ($, on) => {
    mundoDe(on)
    respostas(on, [usar('Bash', 'Edit')])
    await $.session.start(SESSAO)
    await umTurno($, 't1', 'conserta o teste', 1)
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PAINEL('linha-do-tempo'), plugin: PLUGIN, surface })
      expect((await ui.find({ type: 'Text', text: /#1 opus-4-1/ }))?.text).toContain('esforço alto')
      expect(await ui.find({ type: 'Text', text: /Bash 1 · Edit 1/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /entrada 1,2 mil/ })).toBeDefined()
      await ui.unmount()
    }
    const ui = await $.ui.mount({ ...PAINEL('linha-do-tempo'), plugin: PLUGIN, surface: 'terminal' })
    await ui.press({ key: 'limpar' })
    expect(await ui.find({ type: 'Text', text: /Nenhum turno/ })).toBeDefined()
    await ui.unmount()
  })
})
