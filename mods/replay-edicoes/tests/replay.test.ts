import type { SessionMessage } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { blocosDe, montarDiff, passosDe } from '../hooks/register'
import { comando, mundoDe, PANE_PROPS, SESSAO, VIEWPORT } from './mundo'

const uso = (tool: string, input: Record<string, unknown>, isError = false) => ({
  tool_use_id: `t${Math.random()}`,
  tool,
  input,
  text: 'ok',
  ...(isError && { isError: true as const }),
})

const CONVERSA: SessionMessage[] = [
  { role: 'user', text: 'cria e ajusta', toolUses: [] },
  {
    role: 'assistant',
    text: 'feito',
    toolUses: [
      uso('Write', { file_path: '/work/novo.ts', content: 'linha 1\nlinha 2' }),
      uso('Read', { file_path: '/work/novo.ts' }),
      uso('Edit', { file_path: '/work/novo.ts', old_string: 'linha 1', new_string: 'linha um' }),
      uso('Edit', { file_path: '/work/falhou.ts', old_string: 'a', new_string: 'b' }, true),
    ],
  },
  {
    role: 'assistant',
    text: '',
    toolUses: [
      uso('MultiEdit', {
        file_path: '/work/x.md',
        edits: [
          { old_string: 'a', new_string: 'b' },
          { old_string: 'c', new_string: 'd' },
        ],
      }),
    ],
  },
]

describe('replay-edicoes', () => {
  test('registra /replay ao iniciar', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['replay'])
  })

  test('cada edição que deu certo vira um passo, na ordem; Read e falhas ficam de fora', () => {
    const passos = passosDe(CONVERSA, 40)
    expect(passos.map(p => `${p.ferramenta} ${p.caminho}`)).toEqual(['Write /work/novo.ts', 'Edit /work/novo.ts', 'MultiEdit /work/x.md'])
    expect(passos[0]?.diff).toBe('@@ -0,0 +1,2 @@\n+linha 1\n+linha 2')
    expect(passos[1]?.diff).toBe('@@ -1,1 +1,1 @@\n-linha 1\n+linha um')
    expect(passos[2]?.diff).toBe('@@ -1,1 +1,1 @@\n-a\n+b\n@@ -1,1 +1,1 @@\n-c\n+d')
    expect(passos[2]?.mensagem).toBe(2)
  })

  test('diff grande é cortado e o cabeçalho continua batendo com as linhas', () => {
    const velho = Array.from({ length: 50 }, (_, i) => `v${i}`).join('\n')
    const novo = Array.from({ length: 50 }, (_, i) => `n${i}`).join('\n')
    const b = blocosDe('Edit', { file_path: '/f', old_string: velho, new_string: novo })
    const d = montarDiff(b?.blocos ?? [], 40)
    const linhas = d.diff.split('\n')
    expect(linhas[0]).toBe('@@ -1,20 +1,20 @@')
    expect(linhas.length).toBe(41)
    expect(d.ocultas).toBe(60)
    expect(d.completo.split('\n').length).toBe(101)
  })

  test('Write grande mostra só as primeiras linhas', () => {
    const conteudo = Array.from({ length: 100 }, (_, i) => `l${i}`).join('\n')
    const d = montarDiff(blocosDe('Write', { file_path: '/f', content: conteudo })?.blocos ?? [], 40)
    expect(d.diff.split('\n')[0]).toBe('@@ -0,0 +1,40 @@')
    expect(d.diff.split('\n')[1]).toBe('+l0')
    expect(d.ocultas).toBe(60)
  })

  test('caracteres de controle somem do diff', () => {
    const d = montarDiff(blocosDe('Edit', { file_path: '/f', old_string: 'a\r\nb', new_string: 'x\u0007y' })?.blocos ?? [], 40)
    expect(d.diff).toBe('@@ -1,2 +1,1 @@\n-a\n-b\n+xy')
  })

  test('/replay sem edições avisa e não abre painel', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('replay'))
    expect(r.text).toContain('Nenhuma edição')
    expect(mundo.abertos).toEqual([])
  })

  test('/replay abre o painel; /replay ultimo pula para o fim', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.mensagens = CONVERSA
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('replay'))
    expect(r.text).toContain('3 edição(ões). Mostrando o passo 1')
    expect(mundo.abertos).toEqual(['replay-edicoes'])
    const r2 = await $.command.run(comando('replay', 'ultimo'))
    expect(r2.text).toContain('passo 3')
  })

  test('painel anda com anterior/próximo e copia o diff, no terminal e no desktop', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.mensagens = CONVERSA
    await $.session.start(SESSAO)
    await $.command.run(comando('replay'))
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({
        plugin: 'replay-edicoes',
        surface,
        component: 'Pane',
        requestId: 'replay-edicoes',
        viewport: VIEWPORT,
        props: PANE_PROPS,
      })
      expect(await ui.find({ type: 'Text', text: /^Passo 1 de 3/ })).toBeDefined()
      expect((await ui.find({ type: 'Code' }))?.props.format).toBe('diff')
      await ui.press({ key: 'anterior' })
      expect(await ui.find({ type: 'Text', text: /^Passo 1 de 3/ })).toBeDefined()
      await ui.press({ key: 'proximo' })
      expect(await ui.find({ type: 'Text', text: /^Passo 2 de 3/ })).toBeDefined()
      await ui.press({ key: 'copiar' })
      expect(mundo.copiados.at(-1)).toBe('@@ -1,1 +1,1 @@\n-linha 1\n+linha um')
      await ui.press({ key: 'proximo' })
      await ui.press({ key: 'proximo' })
      expect(await ui.find({ type: 'Text', text: /^Passo 3 de 3/ })).toBeDefined()
      await ui.press({ key: 'anterior' })
      await ui.press({ key: 'anterior' })
      await ui.unmount()
    }
    expect(mundo.toasts.filter(t => t === 'Diff copiado.')).toHaveLength(2)
  })
})
