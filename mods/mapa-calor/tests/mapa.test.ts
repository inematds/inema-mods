import { describe, expect, test } from 'claude-code/testing'

import { barra, corDe, formatarBytes, ordenar } from '../hooks/register'
import { comando, mundoDe, PANE_PROPS, SESSAO, VIEWPORT } from './mundo'

const PROJETO: Record<string, string> = {
  '/work/README.md': 'oi',
  '/work/src/a.ts': 'x'.repeat(100),
  '/work/src/b.ts': 'x'.repeat(100),
  '/work/src/lib/c.ts': 'x'.repeat(100),
  '/work/docs/guia.md': 'x'.repeat(5000),
  '/work/node_modules/pkg/index.js': 'x'.repeat(99999),
  '/work/.git/HEAD': 'ref',
  '/work/fundo/n1/n2/n3/longe.txt': 'x',
}

describe('mapa-calor', () => {
  test('registra /mapa ao iniciar', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['mapa'])
  })

  test('soma por pasta de 1º nível, ignora node_modules e .git, ordena por nº de arquivos', async ($, on) => {
    const mundo = mundoDe(on, PROJETO)
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('mapa'))
    expect(mundo.abertos).toEqual(['mapa-calor'])
    expect(r.text).toContain('Mapa de /work: 5 arquivo(s)')
    const linhas = (r.text ?? '').split('\n').slice(1)
    expect(linhas[0]).toBe('- src: 3 arquivo(s)')
    expect(r.text).toContain('- docs: 1 arquivo(s)')
    expect(r.text).toContain('(arquivos soltos na raiz): 1 arquivo(s)')
    expect(r.text).not.toContain('node_modules')
    expect(r.text).not.toContain('.git')
    expect(mundo.listados.some(p => p.includes('node_modules'))).toBe(false)
  })

  test('respeita a profundidade 3: arquivo no 5º nível não conta, mas a pasta aparece', async ($, on) => {
    const mundo = mundoDe(on, PROJETO)
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('mapa'))
    expect(r.text).toContain('- fundo: 0 arquivo(s)')
    expect(mundo.listados).toContain('/work/fundo/n1')
    expect(mundo.listados).not.toContain('/work/fundo/n1/n2')
  })

  test('/mapa bytes alterna para tamanho e de volta', async ($, on) => {
    mundoDe(on, PROJETO)
    await $.session.start(SESSAO)
    await $.command.run(comando('mapa'))
    const r = await $.command.run(comando('mapa', 'bytes'))
    expect((r.text ?? '').split('\n')[1]).toBe('- docs: 4,9 KB')
    const r2 = await $.command.run(comando('mapa', 'bytes'))
    expect((r2.text ?? '').split('\n')[1]).toBe('- src: 3 arquivo(s)')
  })

  test('para no limite de arquivos e avisa', { options: { limite: 2 } }, async ($, on) => {
    mundoDe(on, PROJETO)
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('mapa'))
    expect(r.text).toContain('2 arquivo(s)')
    expect(r.text).toContain('parei no limite')
  })

  test('funções puras: barra, cor, bytes, ordem', () => {
    expect(barra(5, 10, 10)).toBe('█████░░░░░')
    expect(barra(1, 1000, 4)).toBe('█░░░')
    expect(barra(0, 10, 3)).toBe('░░░')
    expect(corDe(1)).toBe('red')
    expect(corDe(0.4)).toBe('yellow')
    expect(corDe(0.01)).toBe('cyan')
    expect(formatarBytes(512)).toBe('512 B')
    expect(formatarBytes(1536)).toBe('1,5 KB')
    expect(formatarBytes(50 * 1024 * 1024)).toBe('50 MB')
    const l = [
      { pasta: 'a', arquivos: 1, bytes: 900 },
      { pasta: 'b', arquivos: 9, bytes: 10 },
    ]
    expect(ordenar(l, 'arquivos')[0]?.pasta).toBe('b')
    expect(ordenar(l, 'bytes')[0]?.pasta).toBe('a')
  })

  test('painel desenha no terminal e no desktop e o botão alterna o modo', async ($, on) => {
    mundoDe(on, PROJETO)
    await $.session.start(SESSAO)
    await $.command.run(comando('mapa'))
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({
        plugin: 'mapa-calor',
        surface,
        component: 'Pane',
        requestId: 'mapa-calor',
        viewport: VIEWPORT,
        props: PANE_PROPS,
      })
      expect(await ui.find({ type: 'Text', text: /^Por nº de arquivos/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /█/ })).toBeDefined()
      await ui.press({ key: 'alternar' })
      expect(await ui.find({ type: 'Text', text: /^Por tamanho/ })).toBeDefined()
      await ui.press({ key: 'alternar' })
      await ui.unmount()
    }
  })
})
