import { describe, expect, test } from 'claude-code/testing'

import { textoDoRecibo } from '../hooks/register'
import { comando, mundoDe, prompt, SESSAO } from './mundo'

describe('recibo-sessao', () => {
  test('registra o comando /recibo ao iniciar', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['recibo'])
  })

  test('arquivo novo conta como criado, existente como editado', async ($, on) => {
    mundoDe(on, { '/work/velho.md': 'x' })
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.prompt.submit(prompt('faz aí'))
    await $.tool.call({ tool: 'Write', file_path: '/work/novo.md', content: 'a' })
    await $.tool.call({ tool: 'Write', file_path: '/work/velho.md', content: 'b' })
    await $.tool.call({ tool: 'Edit', file_path: '/work/novo.md', old_string: 'a', new_string: 'c' })

    const r = await $.command.run(comando('recibo'))
    expect(r.text).toContain('1 criado(s), 1 editado(s)')
    expect(r.text).toContain('criado   /work/novo.md')
    expect(r.text).toContain('editado  /work/velho.md')
  })

  test('ferramenta que falhou não entra no recibo', async ($, on) => {
    mundoDe(on)
    on('tool.call', () => ({ isError: true as const, result: 'x', text: 'erro' }))
    await $.session.start(SESSAO)
    await $.tool.call({ tool: 'Write', file_path: '/work/falhou.md', content: 'a' })
    const r = await $.command.run(comando('recibo'))
    expect(r.text).toContain('nenhum arquivo')
  })

  test('/recibo limpar zera a lista', async ($, on) => {
    mundoDe(on)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call({ tool: 'Write', file_path: '/work/a.md', content: 'a' })
    expect((await $.command.run(comando('recibo', 'limpar'))).text).toBe('Recibo zerado.')
    expect((await $.command.run(comando('recibo'))).text).toContain('nenhum arquivo')
  })

  test('texto vazio é amigável', () => {
    expect(textoDoRecibo([], 'Nesta sessão')).toBe('Nesta sessão: nenhum arquivo criado ou alterado.')
  })
})
