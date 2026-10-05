import { describe, expect, test } from 'claude-code/testing'

import { acharPassos, limpar } from '../hooks/register'
import { comando, FAIXA, mundoDe, prompt, SESSAO } from './mundo'

const PLUGIN = 'proximos-passos'

const COM_TITULO = `Pronto, o build passou e os testes também.

## Próximos passos

1. Publicar a versão **1.2.0**
2. Atualizar o \`README\`
3. Avisar no canal

Me diga qual seguir.`

const SEM_TITULO = `Corrigi o bug do relógio.

Posso agora:
- rodar a suíte inteira
- abrir o PR

Quer que eu siga?`

const fim = (answer: string) => ({ answer, durationMs: 10, isAborted: false, turnId: 't', reason: 'answer' as const })

describe('proximos-passos: leitura do texto', () => {
  test('lista sob título de próximos passos', () => {
    expect(acharPassos(COM_TITULO)).toEqual(['Publicar a versão 1.2.0', 'Atualizar o README', 'Avisar no canal'])
  })

  test('sem título: última lista do texto, com até 2 linhas depois', () => {
    expect(acharPassos(SEM_TITULO)).toEqual(['rodar a suíte inteira', 'abrir o PR'])
  })

  test('títulos em inglês e "opções"; subitens ignorados', () => {
    expect(acharPassos('Next steps:\n- a\n  - detalhe\n- b')).toEqual(['a', 'b'])
    expect(acharPassos('**Opções:**\n1) Plano A\n2) Plano B\n3) Plano C\n4) Plano D')).toHaveLength(4)
  })

  test('recusa: 1 item, 5+ itens, item longo, lista no meio do texto', () => {
    expect(acharPassos('Próximos passos:\n- só um')).toEqual([])
    expect(acharPassos('Próximos passos:\n- a\n- b\n- c\n- d\n- e')).toEqual([])
    expect(acharPassos(`Sugestões:\n- ${'x'.repeat(200)}\n- curto`)).toEqual([])
    expect(acharPassos('Fiz:\n- a\n- b\n\nUm\nDois\nTrês\nQuatro')).toEqual([])
    expect(acharPassos('Só texto, sem lista.')).toEqual([])
  })

  test('limpeza de marcação', () => {
    expect(limpar('**Rodar** `npm test`;')).toBe('Rodar npm test')
    expect(limpar('[ ] revisar')).toBe('revisar')
  })
})

describe('proximos-passos: sessão', () => {
  test('depois da resposta mostra até 3 botões; o botão escreve no prompt', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.mensagens = [
      { role: 'user', text: 'faz o build' },
      { role: 'assistant', text: COM_TITULO },
    ]
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['proximos'])
    await $.turn.complete(fim(''))

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface })
      expect(await ui.findAll({ type: 'Button' })).toHaveLength(4)
      expect((await ui.find({ key: 'passo1' }))?.props.label).toBe('Publicar a versão 1.2.0')
      await ui.unmount()
    }

    const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    await ui.press({ key: 'passo2' })
    expect(mundo.preenchidos).toEqual(['Atualizar o README'])
    expect(await ui.find({ key: 'passo1' })).toBeUndefined()
    await ui.unmount()
  })

  test('não chama o modelo nem roda comando: só lê e preenche', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.mensagens = [{ role: 'assistant', text: SEM_TITULO }]
    await $.session.start(SESSAO)
    await $.turn.complete(fim(''))
    expect(mundo.executados).toEqual([])
    expect(mundo.preenchidos).toEqual([])
  })

  test('[dispensar] esconde; /proximos reabre', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.mensagens = [{ role: 'assistant', text: SEM_TITULO }]
    await $.session.start(SESSAO)
    await $.turn.complete(fim(''))
    const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    await ui.press({ key: 'dispensar' })
    expect(await ui.find({ key: 'passo1' })).toBeUndefined()
    const r = await $.command.run(comando('proximos'))
    expect(r.text).toContain('1. rodar a suíte inteira')
    expect(await ui.find({ key: 'passo1' })).toBeDefined()
    await ui.unmount()
  })

  test('novo pedido esconde a faixa; resposta sem lista não mostra nada', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.mensagens = [{ role: 'assistant', text: SEM_TITULO }]
    await $.session.start(SESSAO)
    await $.turn.complete(fim(''))
    await $.prompt.submit(prompt('roda a suíte'))
    const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    expect(await ui.find({ key: 'passo1' })).toBeUndefined()
    await ui.unmount()

    mundo.mensagens = [{ role: 'assistant', text: 'Feito, tudo verde.' }]
    await $.turn.complete(fim('Feito, tudo verde.'))
    const ui2 = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    expect(await ui2.find({ type: 'Button' })).toBeUndefined()
    await ui2.unmount()
    expect((await $.command.run(comando('proximos'))).text).toContain('Não achei')
  })

  test('sem mensagens no histórico, usa o texto final do turno', async ($, on) => {
    mundoDe(on)
    await $.session.start(SESSAO)
    await $.turn.complete(fim(SEM_TITULO))
    const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    expect(await ui.find({ key: 'passo2' })).toBeDefined()
    await ui.unmount()
  })

  test('com "ligado" desligado, só aparece pelo /proximos', { options: { ligado: false } }, async ($, on) => {
    const mundo = mundoDe(on)
    mundo.mensagens = [{ role: 'assistant', text: COM_TITULO }]
    await $.session.start(SESSAO)
    await $.turn.complete(fim(''))
    const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    expect(await ui.find({ key: 'passo1' })).toBeUndefined()
    await $.command.run(comando('proximos'))
    expect(await ui.find({ key: 'passo1' })).toBeDefined()
    await ui.unmount()
  })
})
