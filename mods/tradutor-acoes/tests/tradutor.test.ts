import { describe, expect, test } from 'claude-code/testing'

import { curto, fraseDe, nomeDoArquivo, resumoDoGrupo, situacao } from '../hooks/register'
import { comando, mundoDe, SESSAO, SUPERFICIES } from './mundo'

const PLUGIN = 'tradutor-acoes'

const linhaDeFerramenta = (surface: 'terminal' | 'desktop', tool: string, input: unknown, extra: { isErrored?: boolean } = {}) => ({
  component: 'ToolUse' as const,
  surface,
  requestId: 'toolu_1',
  viewport: { columns: 120, rows: 40, isFullscreen: true },
  props: {
    tool_use_id: 'toolu_1',
    tool,
    input,
    isRunning: false,
    isErrored: extra.isErrored ?? false,
    isInterrupted: false,
  },
})

const grupo = (surface: 'terminal' | 'desktop', tools: string[], isExpanded = false) => ({
  component: 'ToolGroup' as const,
  surface,
  requestId: 'grupo-1',
  viewport: { columns: 120, rows: 40, isFullscreen: true },
  props: {
    calls: tools.map((tool, i) => ({ tool_use_id: `t${i}`, tool, input: {}, isRunning: false, isErrored: false, isInterrupted: false })),
    isActive: false,
    isExpanded,
  },
})

describe('tradutor-acoes: mapa ferramenta -> frase', () => {
  test('arquivos', () => {
    expect(fraseDe('Read', { file_path: '/home/nei/projetos/site/index.html' })).toBe('Lendo arquivo index.html')
    expect(fraseDe('Edit', { file_path: '/w/app.ts', old_string: 'a', new_string: 'b' })).toBe('Editando app.ts')
    expect(fraseDe('Write', { file_path: '/w/novo.md', content: '' })).toBe('Criando novo.md')
    expect(fraseDe('NotebookEdit', { notebook_path: '/w/a.ipynb' })).toBe('Editando caderno a.ipynb')
  })

  test('comandos e buscas', () => {
    expect(fraseDe('Bash', { command: 'git push' })).toBe('Rodando comando: git push')
    expect(fraseDe('Bash', { command: 'cd x\nnpm test' })).toBe('Rodando comando: cd x (...)')
    expect(fraseDe('Grep', { pattern: 'TODO' })).toBe("Procurando 'TODO' nos arquivos")
    expect(fraseDe('Glob', { pattern: '**/*.ts' })).toBe("Procurando arquivos com nome '**/*.ts'")
    expect(fraseDe('WebFetch', { url: 'https://inema.club/cursos?x=1', prompt: 'p' })).toBe('Abrindo página web: inema.club')
    expect(fraseDe('WebSearch', { query: 'claude code mods' })).toBe("Pesquisando na internet: 'claude code mods'")
  })

  test('ajudantes e outros', () => {
    expect(fraseDe('Agent', { description: 'Achar o bug', prompt: '...' })).toBe('Chamando ajudante (subagente): Achar o bug')
    expect(fraseDe('Task', {})).toBe('Chamando ajudante (subagente)')
    expect(fraseDe('TodoWrite', { todos: [] })).toBe('Atualizando a lista de tarefas')
    expect(fraseDe('Skill', { skill: 'pdf' })).toBe("Usando a habilidade (skill) 'pdf'")
    expect(fraseDe('mcp__github__create_issue', {})).toBe('Usando ferramenta externa: github / create_issue')
    expect(fraseDe('FerramentaNova', {})).toBe('Usando a ferramenta FerramentaNova')
  })

  test('entrada estranha nunca quebra', () => {
    expect(fraseDe('Read', null)).toBe('Lendo arquivo')
    expect(fraseDe('Read', 'texto')).toBe('Lendo arquivo')
    expect(fraseDe('Bash', { command: 42 })).toBe('Rodando comando no terminal')
    expect(fraseDe('Edit', undefined)).toBe('Editando arquivo')
  })

  test('auxiliares', () => {
    expect(curto('a'.repeat(100))).toHaveLength(60)
    expect(nomeDoArquivo('C:\\Users\\nei\\a.txt')).toBe('a.txt')
    expect(situacao({ isErrored: true })).toBe(' (deu erro)')
    expect(situacao({ isInterrupted: true, isErrored: true })).toBe(' (interrompido)')
    expect(resumoDoGrupo([{ tool: 'Read' }, { tool: 'Read' }, { tool: 'Grep' }])).toBe('Lendo 2 arquivos, fazendo 1 busca')
    expect(resumoDoGrupo([])).toBe('Olhando os arquivos')
  })
})

describe('tradutor-acoes: na tela', () => {
  test('registra /tradutor ao iniciar', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['tradutor'])
  })

  test('linha em PT acima e o desenho original intacto abaixo, nas duas superfícies', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    for (const surface of SUPERFICIES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, ...linhaDeFerramenta(surface, 'Bash', { command: 'git push origin main' }) })
      expect((await ui.find({ type: 'Text', text: /Rodando comando/ }))?.text).toBe('> Rodando comando: git push origin main')
      const desenho = await ui.drawn()
      expect(desenho.type).toBe('Box')
      // Dois filhos: a frase e o que o engine desenhou.
      expect('children' in desenho ? desenho.children?.length : 0).toBe(2)
      await ui.unmount()
    }
    // O engine recebeu as props originais, sem mudança: o comando real aparece.
    const usos = mundo.desenhados.filter(d => d.component === 'ToolUse')
    expect(usos.length).toBeGreaterThan(0)
    expect(usos.every(d => (d.props as { input: { command: string } }).input.command === 'git push origin main')).toBe(true)
  })

  test('erro aparece na frase', async ($, on) => {
    mundoDe(on)
    await $.session.start(SESSAO)
    const ui = await $.ui.mount({ plugin: PLUGIN, ...linhaDeFerramenta('terminal', 'Read', { file_path: '/w/x.ts' }, { isErrored: true }) })
    expect(await ui.find({ type: 'Text', text: '> Lendo arquivo x.ts (deu erro)' })).toBeDefined()
    await ui.unmount()
  })

  test('grupo dobrado ganha resumo; aberto não (cada linha já se traduz)', async ($, on) => {
    mundoDe(on)
    await $.session.start(SESSAO)
    for (const surface of SUPERFICIES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, ...grupo(surface, ['Read', 'Read', 'Read', 'Grep']) })
      expect(await ui.find({ type: 'Text', text: '> Lendo 3 arquivos, fazendo 1 busca' })).toBeDefined()
      await ui.unmount()
    }
    const ui = await $.ui.mount({ plugin: PLUGIN, ...grupo('terminal', ['Read'], true) })
    expect(await ui.find({ type: 'Text', text: /^> / })).toBeUndefined()
    await ui.unmount()
  })

  test('/tradutor off desliga e fica guardado; padrão é ligado', async ($, on) => {
    mundoDe(on)
    await $.session.start(SESSAO)
    expect((await $.command.run(comando('tradutor'))).text).toContain('Tradutor ligado')
    expect((await $.command.run(comando('tradutor', 'off'))).text).toContain('desligado')
    const ui = await $.ui.mount({ plugin: PLUGIN, ...linhaDeFerramenta('terminal', 'Read', { file_path: '/w/x.ts' }) })
    expect(await ui.find({ type: 'Text', text: /Lendo/ })).toBeUndefined()
    await ui.unmount()
  })

  test('desligado no store continua desligado depois de reiniciar', async ($, on) => {
    mundoDe(on, {}, { ligado: false })
    await $.session.start(SESSAO)
    const ui = await $.ui.mount({ plugin: PLUGIN, ...linhaDeFerramenta('desktop', 'Read', { file_path: '/w/x.ts' }) })
    expect(await ui.find({ type: 'Text', text: /Lendo/ })).toBeUndefined()
    await ui.unmount()
  })
})
