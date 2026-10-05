import { describe, expect, test } from 'claude-code/testing'

import { corDe, horaDe, nomeDoProjeto, textoDaFaixa } from '../hooks/register'
import { comando, faixa, mundoDe, SESSAO, SUPERFICIES } from './mundo'

const PLUGIN = 'tema-inema'
// 12:00 UTC. A hora mostrada depende do fuso da máquina, então os testes de tela
// comparam com horaDe(), que usa o mesmo fuso.
const MEIO_DIA = Date.UTC(2026, 9, 5, 12, 0, 0)

const resposta = (surface: 'terminal' | 'desktop', isFirstOfReply: boolean) => ({
  component: 'AssistantMessage' as const,
  surface,
  requestId: 'msg-1',
  viewport: { columns: 120, rows: 40, isFullscreen: true },
  props: { text: 'Pronto, terminei.', isFirstOfReply },
})

describe('tema-inema: funções puras', () => {
  test('nome do projeto é a última pasta do cwd', () => {
    expect(nomeDoProjeto('/home/nei/projetos/portal')).toBe('portal')
    expect(nomeDoProjeto('/home/nei/projetos/portal/')).toBe('portal')
    expect(nomeDoProjeto('C:\\Users\\nei\\site')).toBe('site')
    expect(nomeDoProjeto('/')).toBe('/')
  })

  test('cores: nomes em PT viram cores; desconhecida vira âmbar', () => {
    expect(corDe('ciano')).toBe('cyan')
    expect(corDe('ambar')).toBe('#FFB000')
    expect(corDe('roxo')).toBe('#FFB000')
    expect(corDe(undefined)).toBe('#FFB000')
  })

  test('hora HH:MM e texto da faixa', () => {
    expect(horaDe(MEIO_DIA)).toMatch(/^\d\d:\d\d$/)
    expect(textoDaFaixa('INEMA.CLUB', 'portal', '14:05')).toBe('INEMA.CLUB · portal · 14:05')
    expect(textoDaFaixa('INEMA.CLUB', '', '14:05')).toBe('INEMA.CLUB · 14:05')
  })
})

describe('tema-inema: na tela', () => {
  test('faixa com marca, projeto e hora nas duas superfícies', async ($, on) => {
    mundoDe(on, {}, {}, { now: MEIO_DIA })
    await $.session.start({ ...SESSAO, cwd: '/home/nei/projetos/portal' })
    const esperado = `INEMA.CLUB · portal · ${horaDe(MEIO_DIA)}`
    for (const surface of SUPERFICIES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa(surface) })
      expect((await ui.find({ type: 'Text', text: esperado }))?.text).toBe(esperado)
      await ui.unmount()
    }
  })

  test('o relógio da faixa anda sozinho', async ($, on) => {
    const mundo = mundoDe(on, {}, {}, { now: MEIO_DIA })
    await $.session.start(SESSAO)
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    expect(await ui.find({ type: 'Text', text: new RegExp(`· ${horaDe(MEIO_DIA)}$`) })).toBeDefined()
    await mundo.relogio.advance(7 * 60_000)
    const depois = horaDe(MEIO_DIA + 7 * 60_000)
    expect(depois).not.toBe(horaDe(MEIO_DIA))
    expect(await ui.find({ type: 'Text', text: new RegExp(`· ${depois}$`) })).toBeDefined()
    await ui.unmount()
  })

  test('texto e cor vêm do /config', { options: { texto: 'MINHA LIVE', cor: 'ciano' } }, async ($, on) => {
    mundoDe(on, {}, {}, { now: MEIO_DIA })
    await $.session.start(SESSAO)
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    const achado = await ui.find({ type: 'Text', text: /^MINHA LIVE · work · / })
    expect(achado).toBeDefined()
    const desenho = await ui.drawn()
    expect(desenho.type).toBe('Box')
    expect(('children' in desenho ? desenho.children?.[0] : undefined) as unknown).toMatchObject({ type: 'Text', props: { color: 'cyan', bold: true } })
    await ui.unmount()
  })

  test('linha da marca só no primeiro bloco da resposta, com o desenho original mantido', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    for (const surface of SUPERFICIES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, ...resposta(surface, true) })
      expect(await ui.find({ type: 'Text', text: '▌ INEMA.CLUB' })).toBeDefined()
      await ui.unmount()
      const ui2 = await $.ui.mount({ plugin: PLUGIN, ...resposta(surface, false) })
      expect(await ui2.find({ type: 'Text', text: '▌ INEMA.CLUB' })).toBeUndefined()
      await ui2.unmount()
    }
    // O engine (o mundo, aqui) desenhou a resposta original sem mudar o texto.
    const respostas = mundo.desenhados.filter(d => d.component === 'AssistantMessage')
    expect(respostas.length).toBeGreaterThan(0)
    expect(respostas.every(d => (d.props as { text: string }).text === 'Pronto, terminei.')).toBe(true)
  })

  test('moldura envolve cada bloco', { options: { destaque: 'moldura' } }, async ($, on) => {
    mundoDe(on)
    await $.session.start(SESSAO)
    for (const surface of SUPERFICIES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, ...resposta(surface, false) })
      expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { borderStyle: 'round', borderColor: '#FFB000' } })
      await ui.unmount()
    }
  })

  test('/tema off some com faixa e destaque, e fica guardado', async ($, on) => {
    mundoDe(on)
    await $.session.start(SESSAO)
    expect((await $.command.run(comando('tema', 'off'))).text).toContain('desligado')
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    expect(await ui.find({ type: 'Text', text: /INEMA\.CLUB/ })).toBeUndefined()
    await ui.unmount()
    const ui2 = await $.ui.mount({ plugin: PLUGIN, ...resposta('terminal', true) })
    expect(await ui2.find({ type: 'Text', text: /INEMA\.CLUB/ })).toBeUndefined()
    await ui2.unmount()
  })

  test('desligado no store continua desligado depois de reiniciar', async ($, on) => {
    mundoDe(on, {}, { ligado: false })
    await $.session.start(SESSAO)
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    expect(await ui.find({ type: 'Text', text: /INEMA\.CLUB/ })).toBeUndefined()
    await ui.unmount()
  })
})
