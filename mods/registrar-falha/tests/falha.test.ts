import { describe, expect, test } from 'claude-code/testing'

import { comandoCurto, dataDe, deveMostrar, pedidoDeRegistro } from '../hooks/register'
import { comando, faixa, mundoDe, prompt, SESSAO, SUPERFICIES } from './mundo'

const PLUGIN = 'registrar-falha'
// Meio-dia UTC: a data é a mesma em qualquer fuso de -11h a +11h.
const MEIO_DIA = Date.UTC(2026, 9, 5, 12, 0, 0)

const erroBash = (falham: string[]) => ($: unknown, e: { tool: string; command?: string }) =>
  e.tool === 'Bash' && falham.includes(e.command ?? '')
    ? { isError: true as const, result: 'x', text: 'exit 1' }
    : { result: 'ok', text: 'ok' }

describe('registrar-falha: funções puras', () => {
  test('data AAAA-MM-DD', () => {
    expect(dataDe(MEIO_DIA)).toBe('2026-10-05')
    expect(dataDe(Date.UTC(2027, 0, 9, 12))).toBe('2027-01-09')
  })

  test('comando curto: primeira linha, espaços juntados, corte em 80', () => {
    expect(comandoCurto('  git   push  origin main ')).toBe('git push origin main')
    expect(comandoCurto('cd x\nnpm test')).toBe('cd x (...)')
    const longo = 'echo ' + 'a'.repeat(200)
    expect(comandoCurto(longo)).toHaveLength(80)
    expect(comandoCurto(longo).endsWith('...')).toBe(true)
  })

  test('pedido segue a linha-modelo do changelog', () => {
    expect(pedidoDeRegistro('2026-10-05', 'npm test')).toBe(
      'Registre no FALHAS.md uma linha: | 2026-10-05 | <o que quebrou> | <menor correção> | prompt | infra | — sobre: npm test',
    )
    expect(pedidoDeRegistro('2026-10-05', '')).toContain('— sobre: <descreva a falha>')
  })

  test('quando mostrar', () => {
    expect(deveMostrar(1, 2, false, false)).toBe(false)
    expect(deveMostrar(2, 2, false, false)).toBe(true)
    expect(deveMostrar(5, 2, false, true)).toBe(false)
    expect(deveMostrar(0, 2, true, true)).toBe(true)
  })
})

describe('registrar-falha: no turno', () => {
  test('registra /falha ao iniciar', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['falha'])
  })

  test('1 erro não mostra; 2 erros mostram; botão preenche o prompt com data e 1º comando', async ($, on) => {
    const mundo = mundoDe(on, {}, {}, { now: MEIO_DIA })
    on('tool.call', erroBash(['npm test', 'npm run build']) as never)
    await $.session.start(SESSAO)
    await $.prompt.submit(prompt('roda os testes'))
    await $.tool.call({ tool: 'Bash', command: 'ls' })
    await $.tool.call({ tool: 'Bash', command: 'npm test' })

    for (const surface of SUPERFICIES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa(surface) })
      expect(await ui.find({ key: 'registrar' })).toBeUndefined()
      await ui.unmount()
    }

    await $.tool.call({ tool: 'Bash', command: 'npm run build' })
    for (const surface of SUPERFICIES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa(surface) })
      expect(await ui.find({ type: 'Text', text: /2 comando\(s\) falharam/ })).toBeDefined()
      expect(await ui.find({ key: 'dispensar' })).toBeDefined()
      await ui.unmount()
    }

    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    await ui.press({ key: 'registrar' })
    expect(mundo.preenchidos).toEqual([
      'Registre no FALHAS.md uma linha: | 2026-10-05 | <o que quebrou> | <menor correção> | prompt | infra | — sobre: npm test',
    ])
    expect(await ui.find({ key: 'registrar' })).toBeUndefined()
    await ui.unmount()
  })

  test('[dispensar] some com a faixa até o próximo turno; turno novo zera a contagem', async ($, on) => {
    mundoDe(on)
    on('tool.call', erroBash(['a', 'b']) as never)
    await $.session.start(SESSAO)
    await $.prompt.submit(prompt('x'))
    await $.tool.call({ tool: 'Bash', command: 'a' })
    await $.tool.call({ tool: 'Bash', command: 'b' })
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    await ui.press({ key: 'dispensar' })
    expect(await ui.find({ key: 'registrar' })).toBeUndefined()
    await ui.unmount()

    await $.prompt.submit(prompt('y'))
    await $.tool.call({ tool: 'Bash', command: 'a' })
    const ui2 = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    expect(await ui2.find({ key: 'registrar' })).toBeUndefined()
    await ui2.unmount()
  })

  // Limite documentado no README: uma recusa de permissão (hook de settings, ou a pessoa
  // dizendo "não" no diálogo) chega ao tool.call do plugin como resultado com isError,
  // igual a um comando que falhou. Este teste fixa esse comportamento.
  test('recusa de permissão chega como erro e conta (limite conhecido)', async ($, on) => {
    mundoDe(on)
    on('classic.PreToolUse', () => ({ deny: 'não pode' }))
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.prompt.submit(prompt('x'))
    await $.tool.call({ tool: 'Bash', command: 'rm -rf /' })
    const r = await $.command.run(comando('falha'))
    expect(r.text).toContain('1 comando(s) com erro')
  })

  test('comando que deu certo não conta', async ($, on) => {
    mundoDe(on)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.prompt.submit(prompt('x'))
    await $.tool.call({ tool: 'Bash', command: 'ls' })
    await $.tool.call({ tool: 'Bash', command: 'pwd' })
    const r = await $.command.run(comando('falha'))
    expect(r.text).toContain('0 comando(s) com erro')
  })

  test('erros_minimos = 1 mostra no primeiro erro', { options: { erros_minimos: 1 } }, async ($, on) => {
    mundoDe(on)
    on('tool.call', erroBash(['a']) as never)
    await $.session.start(SESSAO)
    await $.prompt.submit(prompt('x'))
    await $.tool.call({ tool: 'Bash', command: 'a' })
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    expect(await ui.find({ key: 'registrar' })).toBeDefined()
    await ui.unmount()
  })

  test('/falha abre a faixa mesmo sem erro, com pedido de descrever', async ($, on) => {
    const mundo = mundoDe(on, {}, {}, { now: MEIO_DIA })
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('falha'))
    expect(r.text).toContain('<descreva a falha>')
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('desktop') })
    expect(await ui.find({ type: 'Text', text: /Registrar uma falha\?/ })).toBeDefined()
    await ui.press({ key: 'registrar' })
    expect(mundo.preenchidos[0]).toContain('| 2026-10-05 |')
    await ui.unmount()
  })
})
