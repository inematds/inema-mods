import { describe, expect, test } from 'claude-code/testing'

import { cacheEmTexto, climaDe, grafico, lerLimiares, limitesEmTexto } from '../hooks/register'
import { comando, FAIXA, mundoDe, SESSAO, usoCom } from './mundo'

const PLUGIN = 'clima-contexto'
const L: [number, number, number] = [50, 70, 85]

const fimDeTurno = (answer = 'ok') => ({
  answer,
  durationMs: 1_000,
  isAborted: false,
  turnId: 't',
  reason: 'answer' as const,
})

describe('clima-contexto: contas', () => {
  test('faixas do clima nos limiares padrão', () => {
    expect(climaDe(10, L).palavra).toBe('limpo')
    expect(climaDe(49, L).simbolo).toBe('○')
    expect(climaDe(50, L).palavra).toBe('nublado')
    expect(climaDe(69, L).simbolo).toBe('◐')
    expect(climaDe(70, L).palavra).toBe('chuva')
    expect(climaDe(84, L).simbolo).toBe('●')
    expect(climaDe(85, L).palavra).toBe('tempestade')
    expect(climaDe(99, L).cor).toBe('magenta')
  })

  test('limiares do /config: válidos, desordenados ou lixo', () => {
    expect(lerLimiares('40, 60, 80')).toEqual([40, 60, 80])
    expect(lerLimiares('80,40,60')).toEqual([40, 60, 80])
    expect(lerLimiares('abc')).toEqual([50, 70, 85])
    expect(lerLimiares(undefined)).toEqual([50, 70, 85])
  })

  test('minigráfico, limites e cache estimado', () => {
    expect(grafico([0, 50, 100])).toBe('▁▅█')
    expect(limitesEmTexto([
      { kind: 'five_hour', percentUsed: 20 },
      { kind: 'seven_day', percentUsed: 81.5 },
    ])).toBe('5h 20% · sem 82%!')
    expect(cacheEmTexto(10 * 60_000, 0, 60)).toBe('cache ~50 min (estimado)')
    expect(cacheEmTexto(61 * 60_000, 0, 60)).toBe('cache provavelmente expirou (estimado)')
    expect(cacheEmTexto(0, null, 60)).toBeUndefined()
  })
})

describe('clima-contexto: sessão', () => {
  test('registra /contexto e /handoff-agora', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['contexto', 'handoff-agora'])
  })

  test('avisa (toast) só na primeira vez que cruza cada limiar', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    for (const p of [30, 55, 60, 72, 90, 91]) {
      mundo.uso = usoCom(p)
      await $.turn.complete(fimDeTurno())
    }
    expect(mundo.toasts).toHaveLength(3)
    expect(mundo.toasts[0]).toContain('nublado')
    expect(mundo.toasts[1]).toContain('chuva')
    expect(mundo.toasts[2]).toContain('tempestade')
    // Depois de compactar (uso cai) e subir de novo, avisa outra vez.
    mundo.uso = usoCom(20)
    await $.turn.complete(fimDeTurno())
    mundo.uso = usoCom(52)
    await $.turn.complete(fimDeTurno())
    expect(mundo.toasts).toHaveLength(4)
  })

  test('faixa mostra clima, %, gráfico, soma do turno, limites, custo e cache', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    mundo.uso = usoCom(40)
    await $.turn.complete(fimDeTurno())
    mundo.uso = usoCom(72, {
      rateLimits: [
        { kind: 'five_hour', percentUsed: 20 },
        { kind: 'seven_day', percentUsed: 80 },
      ],
      cost: { usd: 3.5 },
    })
    await $.turn.complete(fimDeTurno())
    await mundo.relogio.advance(10 * 60_000)

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface })
      expect((await ui.find({ type: 'Text', text: /chuva/ }))?.text).toContain('● chuva')
      expect((await ui.find({ type: 'Text', text: /usado/ }))?.text).toContain('72% usado')
      expect((await ui.find({ type: 'Text', text: /▄▆/ }))).toBeDefined()
      expect((await ui.find({ type: 'Text', text: /último turno/ }))?.text).toContain('+64,0 mil')
      expect((await ui.find({ type: 'Text', text: /5h/ }))?.text).toContain('5h 20% · sem 80%!')
      expect((await ui.find({ type: 'Text', text: /US\$/ }))?.text).toContain('US$ 3,50 equivalente em API')
      expect((await ui.find({ type: 'Text', text: /cache/ }))?.text).toContain('cache ~50 min (estimado)')
      expect(await ui.find({ type: 'Button', key: 'compactar' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('botões: compactar chama o compact, handoff roda o comando, esconder some com a faixa', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.disponiveis = ['session-handoff']
    await $.session.start(SESSAO)
    mundo.uso = usoCom(60)
    await $.turn.complete(fimDeTurno())

    const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    await ui.press({ key: 'compactar' })
    expect(mundo.compactacoes).toBe(1)
    await ui.press({ key: 'handoff' })
    expect(mundo.executados).toContain('session-handoff')
    expect(mundo.preenchidos).not.toContain('/clear')
    await ui.press({ key: 'esconder' })
    expect(await ui.find({ type: 'Text', text: /usado/ })).toBeUndefined()
    await ui.unmount()

    // /contexto traz a faixa de volta.
    expect((await $.command.run(comando('contexto'))).text).toContain('ligada')
  })

  test('handoff sem o comando instalado: escreve /session-handoff no prompt', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    mundo.uso = usoCom(60)
    await $.turn.complete(fimDeTurno())
    const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    await ui.press({ key: 'handoff' })
    expect(mundo.preenchidos).toEqual(['/session-handoff'])
    expect(mundo.executados).toEqual([])
    await ui.unmount()
  })

  test('/contexto desliga e liga a faixa', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    mundo.uso = usoCom(30)
    await $.turn.complete(fimDeTurno())
    expect((await $.command.run(comando('contexto'))).text).toContain('desligada')
    const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /usado/ })).toBeUndefined()
    await ui.unmount()
    expect((await $.command.run(comando('contexto'))).text).toContain('30% usado')
  })

  test('/handoff-agora roda o handoff e deixa /clear escrito, sem executar /clear', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.disponiveis = ['session-handoff']
    await $.session.start(SESSAO)
    await $.command.run(comando('handoff-agora'))
    await mundo.relogio.settle()
    expect(mundo.executados).toEqual(['session-handoff'])
    expect(mundo.preenchidos).toEqual(['/clear'])
  })

  test('handoff automático desligado (padrão): nada roda mesmo em tempestade', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.disponiveis = ['session-handoff']
    await $.session.start(SESSAO)
    mundo.uso = usoCom(95)
    await $.turn.complete(fimDeTurno())
    await mundo.relogio.settle()
    expect(mundo.executados).toEqual([])
  })

  test('handoff automático ligado: roda uma vez só ao cruzar o limiar', { options: { auto_handoff: true, limiar_handoff: 80 } }, async ($, on) => {
    const mundo = mundoDe(on)
    mundo.disponiveis = ['session-handoff']
    await $.session.start(SESSAO)
    for (const p of [70, 81, 84, 90]) {
      mundo.uso = usoCom(p)
      await $.turn.complete(fimDeTurno())
      await mundo.relogio.settle()
    }
    expect(mundo.executados).toEqual(['session-handoff'])
    expect(mundo.preenchidos).toEqual(['/clear'])
    expect(mundo.executados).not.toContain('clear')
  })

  test('turno de subagente não mexe no gráfico', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    mundo.uso = usoCom(60)
    await $.turn.complete({ ...fimDeTurno(), agentId: 'a1' })
    const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /usado/ })).toBeUndefined()
    await ui.unmount()
  })
})
