import { describe, expect, test } from 'claude-code/testing'

import { linhaDoBichinho, quadroDe } from '../hooks/register'
import { comando, faixa, mundoDe, SESSAO, SUPERFICIES } from './mundo'

const PLUGIN = 'bichinho'

describe('bichinho', () => {
  test('registra /bichinho ao iniciar', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['bichinho'])
  })

  test('quadros giram a cada mordida', () => {
    expect(quadroDe(0)).toBe('(o.o)')
    expect(quadroDe(1)).toBe('(O.O)')
    expect(quadroDe(2)).toBe('(^.^)')
    expect(quadroDe(3)).toBe('(o.o)')
    expect(linhaDoBichinho(0, '')).toBe('(o.o) com fome... arquivos comidos: 0')
    expect(linhaDoBichinho(2, 'a.ts')).toBe('(^.^) nhac! arquivos comidos: 2  (último: a.ts)')
  })

  test('come Read, Edit e Write que deram certo; ignora o que falhou e outras ferramentas', async ($, on) => {
    mundoDe(on)
    on('tool.call', ($, e) =>
      e.tool === 'Edit' && e.file_path.endsWith('falha.ts')
        ? { isError: true as const, result: 'x', text: 'erro' }
        : { result: 'ok', text: 'ok' },
    )
    await $.session.start(SESSAO)
    await $.tool.call({ tool: 'Read', file_path: '/work/a.ts' })
    await $.tool.call({ tool: 'Edit', file_path: '/work/b.ts', old_string: 'a', new_string: 'b' })
    await $.tool.call({ tool: 'Write', file_path: '/work/c.md', content: 'x' })
    await $.tool.call({ tool: 'Edit', file_path: '/work/falha.ts', old_string: 'a', new_string: 'b' })
    await $.tool.call({ tool: 'Bash', command: 'ls' })
    const r = await $.command.run(comando('bichinho'))
    expect(r.text).toContain('arquivos comidos: 3')
    expect(r.text).toContain('(último: c.md)')
  })

  test('desenha acima do prompt nas duas superfícies, e some com /bichinho off', async ($, on) => {
    mundoDe(on)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call({ tool: 'Read', file_path: '/work/a.ts' })
    for (const surface of SUPERFICIES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa(surface) })
      expect((await ui.find({ type: 'Text', text: /\(O\.O\) nhac! arquivos comidos: 1/ }))).toBeDefined()
      await ui.unmount()
    }
    await $.command.run(comando('bichinho', 'off'))
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    expect(await ui.find({ type: 'Text', text: /arquivos comidos/ })).toBeUndefined()
    await ui.unmount()
  })

  test('off sobrevive a reinício (guardado no store)', async ($, on) => {
    mundoDe(on, {}, { ligado: false })
    await $.session.start(SESSAO)
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    expect(await ui.find({ type: 'Text', text: /arquivos comidos/ })).toBeUndefined()
    await ui.unmount()
    expect((await $.command.run(comando('bichinho', 'on'))).text).toBe('Bichinho acordado.')
    const ui2 = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    expect(await ui2.find({ type: 'Text', text: /arquivos comidos: 0/ })).toBeDefined()
    await ui2.unmount()
  })

  test('cede a faixa a uma pesquisa (survey)', async ($, on) => {
    mundoDe(on)
    await $.session.start(SESSAO)
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal', { hasSurvey: true }) })
    expect(await ui.find({ type: 'Text', text: /arquivos comidos/ })).toBeUndefined()
    await ui.unmount()
  })
})
