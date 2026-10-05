import { describe, expect, test } from 'claude-code/testing'

import { acharPago, casaComando, casaFerramenta } from '../hooks/regras'
import { comando, mundoDe, SESSAO } from './mundo'

const bash = (command: string) => ({ tool: 'Bash' as const, command })
const mcp = (tool: `mcp__${string}`) => ({ tool, prompt: 'gato' }) as never

describe('vigia-api', () => {
  test('registra /vigia', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['vigia'])
  })

  test('ferramenta grátis e comando comum não perguntam', async ($, on) => {
    const mundo = mundoDe(on)
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(mcp('mcp__magnific__account_balance'))
    await $.tool.call(bash('ls -la'))
    await $.tool.call({ tool: 'Read', file_path: '/work/a.md' })
    expect(mundo.perguntas).toEqual([])
    expect(rodou).toBe(3)
  })

  test('MCP pago: pergunta; "só esta vez" roda e volta a perguntar na próxima', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.respostas.push('Autorizar só esta vez', 'Negar')
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    const r1 = await $.tool.call(mcp('mcp__magnific__images_generate'))
    expect(r1.deny).toBeUndefined()
    expect(mundo.perguntas[0]).toBe('Isso usa serviço pago (mcp__magnific__images_generate). Autoriza agora?')
    expect(mundo.opcoes[0]).toEqual(['Negar', 'Autorizar só esta vez', 'Autorizar por 1 hora'])
    const r2 = await $.tool.call(mcp('mcp__magnific__images_generate'))
    expect(r2.deny).toContain('NÃO autorizou')
    expect(rodou).toBe(1)
  })

  test('"por 1 hora" vale para o padrão até expirar', async ($, on) => {
    const mundo = mundoDe(on, {}, 1_000_000)
    mundo.respostas.push('Autorizar por 1 hora')
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(mcp('mcp__klingai__text_to_video'))
    await $.tool.call(mcp('mcp__klingai__image_to_video')) // mesmo padrão mcp__klingai__*
    expect(mundo.perguntas.length).toBe(1)
    expect(rodou).toBe(2)

    const lista = await $.command.run(comando('vigia'))
    expect(lista.text).toContain('mcp__klingai__*')
    expect(lista.text).toContain('falta 60 min')

    await mundo.relogio.advance(60 * 60_000 + 1)
    const r = await $.tool.call(mcp('mcp__klingai__text_to_video')) // sem resposta = sem tela
    expect(r.deny).toBeDefined()
    expect(mundo.perguntas.length).toBe(2)
    expect((await $.command.run(comando('vigia'))).text).toContain('nenhuma autorização ativa')
  })

  test('Bash pago sem tela: nega pedindo autorização ao usuário', async ($, on) => {
    const mundo = mundoDe(on)
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    const r = await $.tool.call(bash('curl https://openrouter.ai/api/v1/chat -d @x.json'))
    expect(r.deny).toContain('peça autorização ao usuário')
    expect(r.deny).toContain('/vigia autorizar openrouter')
    expect(rodou).toBe(0)
    expect(mundo.perguntas[0]).toBe('Isso usa serviço pago (openrouter). Autoriza agora?')
  })

  test('/vigia autorizar e /vigia limpar', async ($, on) => {
    const mundo = mundoDe(on)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    expect((await $.command.run(comando('vigia', 'autorizar groq'))).text).toContain('autorizado por 1 hora')
    const r = await $.tool.call(bash('python3 transcreve.py --groq'))
    expect(r.deny).toBeUndefined()
    expect(mundo.perguntas).toEqual([])
    expect((await $.command.run(comando('vigia', 'limpar'))).text).toContain('1 autorização(ões) apagada(s)')
    expect((await $.command.run(comando('vigia', 'autorizar xyz'))).text).toContain('não está nas listas')
  })

  test('listas vazias no /config: nada é vigiado', { options: { ferramentas_pagas: [], comandos_pagos: [] } }, async ($, on) => {
    const mundo = mundoDe(on)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(mcp('mcp__klingai__text_to_video'))
    expect(mundo.perguntas).toEqual([])
  })

  test('regras puras', () => {
    expect(casaFerramenta('mcp__*heygen*', 'mcp__heygen-mcp__create_video')).toBe(true)
    expect(casaFerramenta('mcp__magnific__video_*', 'mcp__magnific__video_generate')).toBe(true)
    expect(casaFerramenta('mcp__magnific__images_generate', 'mcp__magnific__images_generate_svg')).toBe(false)
    expect(casaFerramenta('mcp__metricool__create*', 'mcp__metricool__getScheduledPosts')).toBe(false)
    expect(casaComando('codex exec .*image', 'codex exec -m x "gera image"')).toBe(true)
    expect(casaComando('codex exec .*image', 'codex exec -m x "traduz"')).toBe(false)
    expect(casaComando('kling ', 'kling text_to_video')).toBe(true)
    expect(casaComando('kling ', 'ls klingaimcp')).toBe(false)
    expect(casaComando('a(b', 'xa(by')).toBe(true) // regex inválida vira trecho literal
    expect(acharPago('Read', undefined, ['*'], ['.*'])).toBeUndefined()
    expect(acharPago('Bash', 'curl api.openai.com', [], ['api.openai.com'])).toEqual({ padrao: 'api.openai.com', nome: 'api.openai.com' })
  })
})
