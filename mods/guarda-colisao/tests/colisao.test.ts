import { describe, expect, test } from 'claude-code/testing'

import { haQuanto, ignorado, mudouFora } from '../hooks/regras'
import { comando, mundoDe, SESSAO } from './mundo'

const INICIO = 10_000
const AGORA = 10 * 60_000 + 200_000

const edit = (file_path: string) => ({ tool: 'Edit' as const, file_path, old_string: 'a', new_string: 'b' })

describe('guarda-colisao', () => {
  test('registra /colisao ao iniciar', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['colisao'])
  })

  test('arquivo antigo (antes da sessão) não dispara', async ($, on) => {
    const mundo = mundoDe(on, { '/work/a.md': 'x' }, AGORA)
    mundo.inicio = INICIO // mtime 1_000 < início
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    const r = await $.tool.call(edit('/work/a.md'))
    expect(r.deny).toBeUndefined()
    expect(rodou).toBe(1)
    expect(mundo.perguntas).toEqual([])
  })

  test('arquivo novo (Write) não dispara', async ($, on) => {
    const mundo = mundoDe(on, {}, AGORA)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    const r = await $.tool.call({ tool: 'Write', file_path: '/work/novo.md', content: 'a' })
    expect(r.deny).toBeUndefined()
    expect(mundo.perguntas).toEqual([])
  })

  test('mudado fora: pergunta; Prosseguir edita e grava o toque (não pergunta de novo)', async ($, on) => {
    const mundo = mundoDe(on, { '/work/a.md': 'x' }, AGORA)
    mundo.inicio = INICIO
    mundo.arquivos.get('/work/a.md')!.mtime = 200_000
    mundo.respostas.push('Prosseguir')
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)

    const r1 = await $.tool.call(edit('/work/a.md'))
    expect(r1.deny).toBeUndefined()
    expect(mundo.perguntas).toEqual(['a.md foi mudado fora desta sessão há 10 min. O que fazer?'])
    expect(mundo.opcoes[0]).toEqual(['Pular e avisar o modelo', 'Prosseguir', 'Cancelar'])

    await $.tool.call(edit('/work/a.md'))
    expect(mundo.perguntas.length).toBe(1)
    expect(rodou).toBe(2)
  })

  test('mudado de novo por fora depois do meu toque: pergunta outra vez', async ($, on) => {
    const mundo = mundoDe(on, { '/work/a.md': 'x' }, AGORA)
    mundo.inicio = INICIO
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(edit('/work/a.md')) // toque com mtime 1_000
    mundo.arquivos.get('/work/a.md')!.mtime = 5_000 // outro programa mexeu
    mundo.respostas.push('Cancelar')
    const r = await $.tool.call(edit('/work/a.md'))
    expect(r.deny).toBeDefined()
    expect(r.deny).toContain('cancelado pelo usuário')
  })

  test('dentro da folga de 1 s não dispara', async ($, on) => {
    const mundo = mundoDe(on, { '/work/a.md': 'x' }, AGORA)
    mundo.inicio = 1_000
    mundo.arquivos.get('/work/a.md')!.mtime = 1_900
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(edit('/work/a.md'))
    expect(mundo.perguntas).toEqual([])
  })

  test('Pular: recusa com instrução para reler; Read libera a edição seguinte', async ($, on) => {
    const mundo = mundoDe(on, { '/work/a.md': 'x' }, AGORA)
    mundo.inicio = INICIO
    mundo.arquivos.get('/work/a.md')!.mtime = 200_000
    mundo.respostas.push('Pular e avisar o modelo')
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)

    const r = await $.tool.call(edit('/work/a.md'))
    expect(r.deny).toBeDefined()
    expect(r.deny).toContain('releia o arquivo com Read')

    await $.tool.call({ tool: 'Read', file_path: '/work/a.md' })
    const r2 = await $.tool.call(edit('/work/a.md'))
    expect(r2.deny).toBeUndefined()
    expect(r2.isError).toBeUndefined()
    expect(mundo.perguntas.length).toBe(1)
  })

  test('sem tela (ask rejeitado): padrão avisa o modelo', async ($, on) => {
    const mundo = mundoDe(on, { '/work/a.md': 'x' }, AGORA)
    mundo.inicio = INICIO
    mundo.arquivos.get('/work/a.md')!.mtime = 200_000
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    const r = await $.tool.call(edit('/work/a.md'))
    expect(r.deny).toBeDefined()
    expect(r.deny).toContain('foi mudado fora desta sessão')
    expect(rodou).toBe(0)
  })

  test('sem tela com sem_tela=permitir: deixa editar', { options: { sem_tela: 'permitir' } }, async ($, on) => {
    const mundo = mundoDe(on, { '/work/a.md': 'x' }, AGORA)
    mundo.inicio = INICIO
    mundo.arquivos.get('/work/a.md')!.mtime = 200_000
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    const r = await $.tool.call(edit('/work/a.md'))
    expect(r.deny).toBeUndefined()
    expect(rodou).toBe(1)
  })

  test('caminho ignorado não dispara', async ($, on) => {
    const mundo = mundoDe(on, { '/work/node_modules/x/i.js': 'x', '/work/yarn.lock': 'y' }, AGORA)
    mundo.inicio = INICIO
    for (const f of mundo.arquivos.values()) f.mtime = 200_000
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(edit('/work/node_modules/x/i.js'))
    await $.tool.call(edit('/work/yarn.lock'))
    expect(mundo.perguntas).toEqual([])
  })

  test('NotebookEdit também é vigiado', async ($, on) => {
    const mundo = mundoDe(on, { '/work/n.ipynb': '{}' }, AGORA)
    mundo.inicio = INICIO
    mundo.arquivos.get('/work/n.ipynb')!.mtime = 200_000
    mundo.respostas.push('Cancelar')
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    const r = await $.tool.call({ tool: 'NotebookEdit', notebook_path: '/work/n.ipynb', new_source: 'x' })
    expect(r.deny).toBeDefined()
  })

  test('/colisao conta as perguntas', async ($, on) => {
    const mundo = mundoDe(on, { '/work/a.md': 'x' }, AGORA)
    mundo.inicio = INICIO
    mundo.arquivos.get('/work/a.md')!.mtime = 200_000
    mundo.respostas.push('Cancelar')
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    expect((await $.command.run(comando('colisao'))).text).toContain('nenhuma pergunta')
    await $.tool.call(edit('/work/a.md'))
    await $.tool.call(edit('/work/a.md')) // sem resposta = sem tela
    const r = await $.command.run(comando('colisao'))
    expect(r.text).toContain('perguntei 2 vez(es)')
    expect(r.text).toContain('Cancelar 1')
    expect(r.text).toContain('sem tela 1')
  })

  test('regras puras', () => {
    expect(ignorado('/x/dist/a.js', ['dist/'])).toBe(true)
    expect(ignorado('/x/redist/a.js', ['dist/'])).toBe(false)
    expect(ignorado('/x/a/package.lock', ['*.lock'])).toBe(true)
    expect(ignorado('/x/a/lock.md', ['*.lock'])).toBe(false)
    expect(ignorado('/x/.git/HEAD', ['.git/'])).toBe(true)
    expect(ignorado('/x/a.md', [''])).toBe(false)
    expect(mudouFora(2_001, 1_000)).toBe(true)
    expect(mudouFora(2_000, 1_000)).toBe(false)
    expect(haQuanto(30_000, 0)).toBe('há menos de 1 min')
    expect(haQuanto(0, 50_000)).toBe('há menos de 1 min')
    expect(haQuanto(3 * 3_600_000, 0)).toBe('há 3 h')
  })
})
