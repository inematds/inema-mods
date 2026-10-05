import type { SessionMessage } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { limparNome, resumoDe } from '../hooks/register'
import { comando, mundoDe, PANE_PROPS, SESSAO, VIEWPORT } from './mundo'

const LONGO = 'Pronto: criei o arquivo de rotas e ajustei os testes. '.repeat(10)

const CONVERSA: SessionMessage[] = [
  { role: 'user', text: 'faz as rotas', toolUses: [] },
  { role: 'assistant', text: LONGO, toolUses: [] },
  { role: 'assistant', text: '', toolUses: [] },
  { role: 'user', text: 'ok', toolUses: [] },
]

describe('marcador-sessao', () => {
  test('registra /marcar ao iniciar', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['marcar'])
  })

  test('/marcar <nome> guarda nome, hora, índice e resumo da última resposta, no store do projeto', async ($, on) => {
    const mundo = mundoDe(on, {}, { agora: 1_700_000_000_000 })
    mundo.mensagens = CONVERSA
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('marcar', '"antes do deploy"'))
    expect(r.text).toContain("Marcador 'antes do deploy' guardado (mensagem 4)")
    const salvo = mundo.store.get('marcadores:/work') as { nome: string; hora: number; indice: number; tldr: string }[]
    expect(salvo).toHaveLength(1)
    expect(salvo[0]?.nome).toBe('antes do deploy')
    expect(salvo[0]?.hora).toBe(1_700_000_000_000)
    expect(salvo[0]?.indice).toBe(4)
    expect(salvo[0]?.tldr.startsWith('Pronto: criei o arquivo de rotas')).toBe(true)
    expect(salvo[0]?.tldr.length).toBeLessThanOrEqual(201)
  })

  test('marcadores de outro projeto não aparecem', async ($, on) => {
    mundoDe(on, {}, { store: { 'marcadores:/outro': [{ nome: 'alheio', hora: 0, indice: 1, tldr: 'x' }] } })
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('marcar', 'abrir'))
    expect(r.text).toContain('Nenhum marcador neste projeto')
  })

  test('mesmo nome atualiza; apagar remove; nome que não existe avisa', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.mensagens = CONVERSA
    await $.session.start(SESSAO)
    await $.command.run(comando('marcar', 'ponto'))
    const r = await $.command.run(comando('marcar', 'Ponto'))
    expect(r.text).toContain('atualizado')
    expect((mundo.store.get('marcadores:/work') as unknown[]).length).toBe(1)
    expect((await $.command.run(comando('marcar', 'apagar sumido'))).text).toBe("Não achei o marcador 'sumido'.")
    expect((await $.command.run(comando('marcar', 'apagar ponto'))).text).toBe("Marcador 'ponto' apagado.")
    expect(mundo.store.get('marcadores:/work') as unknown[]).toEqual([])
  })

  test('marcadores sobrevivem a uma sessão nova (vêm do store)', async ($, on) => {
    mundoDe(on, {}, { store: { 'marcadores:/work': [{ nome: 'ontem', hora: 0, indice: 7, tldr: 'parei nos testes' }] } })
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('marcar'))
    expect(r.text).toContain('- ontem')
  })

  test('funções puras: nome limpo e resumo sem modelo', () => {
    expect(limparNome('  “meu   ponto”  ')).toBe('meu ponto')
    expect(resumoDe(CONVERSA, 20)).toBe('Pronto: criei o arqu…')
    expect(resumoDe([], 20)).toBe('(ainda sem resposta do Claude)')
  })

  test('painel lista e [colar no prompt] preenche o prompt, no terminal e no desktop', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.mensagens = CONVERSA
    await $.session.start(SESSAO)
    await $.command.run(comando('marcar', 'rotas'))
    await $.command.run(comando('marcar', 'abrir'))
    expect(mundo.abertos).toEqual(['marcador-sessao'])
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({
        plugin: 'marcador-sessao',
        surface,
        component: 'Pane',
        requestId: 'marcador-sessao',
        viewport: VIEWPORT,
        props: PANE_PROPS,
      })
      expect(await ui.find({ type: 'Text', text: 'rotas' })).toBeDefined()
      await ui.press({ key: 'colar0' })
      await ui.unmount()
    }
    expect(mundo.preenchidos).toHaveLength(2)
    expect(mundo.preenchidos[0]?.startsWith("Retomando o ponto 'rotas': Pronto: criei")).toBe(true)
  })
})
