import { describe, expect, test } from 'claude-code/testing'

import { AVISO } from '../hooks/register'
import { comando, faixa, mundoDe, SESSAO, SUPERFICIES } from './mundo'

const PLUGIN = 'modo-gravacao'
const VP = { columns: 120, rows: 40, isFullscreen: true }

const msgUsuario = (surface: 'terminal' | 'desktop', text: string) => ({
  component: 'UserMessage' as const,
  surface,
  requestId: 'u1',
  viewport: VP,
  props: { text, origin: { kind: 'composer' as const }, isExpanded: false },
})

const msgAssistente = (surface: 'terminal' | 'desktop', text: string) => ({
  component: 'AssistantMessage' as const,
  surface,
  requestId: 'a1',
  viewport: VP,
  props: { text, isFirstOfReply: true },
})

const usoBash = (surface: 'terminal' | 'desktop', command: string, output?: unknown) => ({
  component: 'ToolUse' as const,
  surface,
  requestId: 't1',
  viewport: VP,
  props: {
    tool_use_id: 't1',
    tool: 'Bash',
    input: { command },
    isRunning: output === undefined,
    isErrored: false,
    isInterrupted: false,
    ...(output !== undefined && { output }),
  },
})

const resultadoBash = (surface: 'terminal' | 'desktop', stdout: string) => ({
  component: 'ToolResult' as const,
  surface,
  requestId: 't1',
  viewport: VP,
  props: { tool_use_id: 't1', tool: 'Bash', output: { stdout, stderr: '', interrupted: false }, isErrored: false },
})

const saidaComando = (surface: 'terminal' | 'desktop', text: string) => ({
  component: 'CommandOutput' as const,
  surface,
  requestId: 'c1',
  viewport: VP,
  props: { command: 'status', args: '', text, isErrored: false },
})

const grupo = (surface: 'terminal' | 'desktop', path: string) => ({
  component: 'ToolGroup' as const,
  surface,
  requestId: 'g1',
  viewport: VP,
  props: {
    calls: [{ tool_use_id: 'r1', tool: 'Read', input: { file_path: path }, isRunning: false, isErrored: false, isInterrupted: false }],
    isActive: false,
    isExpanded: false,
  },
})

const ultimo = (mundo: { desenhados: { component: string; props: unknown }[] }, component: string) =>
  [...mundo.desenhados].reverse().find(d => d.component === component)?.props as Record<string, unknown> | undefined

describe('modo-gravacao', () => {
  test('registra /gravar e começa desligado (nada muda, sem faixa)', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['gravar'])
    const ui = await $.ui.mount({ plugin: PLUGIN, ...msgUsuario('terminal', 'meu email nei@x.com') })
    expect(ultimo(mundo, 'UserMessage')?.text).toBe('meu email nei@x.com')
    await ui.unmount()
    const band = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    expect(await band.find({ type: 'Text', text: /GRAVANDO/ })).toBeUndefined()
    await band.unmount()
  })

  test('ligado: faixa vermelha nas duas superfícies', async ($, on) => {
    mundoDe(on)
    await $.session.start(SESSAO)
    await $.command.run(comando('gravar', 'on'))
    for (const surface of SUPERFICIES) {
      const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa(surface) })
      const t = await ui.find({ type: 'Text', text: /GRAVANDO/ })
      expect(t?.text).toBe(` ${AVISO} `)
      await ui.unmount()
    }
  })

  test('ligado: mensagens, ferramentas e saídas chegam mascaradas ao desenho', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    await $.command.run(comando('gravar', 'on'))
    for (const surface of SUPERFICIES) {
      const u = await $.ui.mount({ plugin: PLUGIN, ...msgUsuario(surface, 'manda pra nei@x.com') })
      expect(ultimo(mundo, 'UserMessage')?.text).toBe('manda pra [e-mail]')
      expect(ultimo(mundo, 'UserMessage')?.origin).toEqual({ kind: 'composer' })
      await u.unmount()

      const a = await $.ui.mount({ plugin: PLUGIN, ...msgAssistente(surface, 'Sua chave é sk-ant-api03-AAAAAAAAAAAAAAAAAAAA') })
      expect(ultimo(mundo, 'AssistantMessage')?.text).toBe('Sua chave é [token]')
      await a.unmount()

      const t = await $.ui.mount({ plugin: PLUGIN, ...usoBash(surface, 'ssh nei@192.168.0.7', { stdout: 'ok /home/nei', stderr: '' }) })
      const uso = ultimo(mundo, 'ToolUse')
      expect(uso?.input).toEqual({ command: 'ssh nei@[ip]' })
      expect(uso?.output).toEqual({ stdout: 'ok ~', stderr: '' })
      await t.unmount()

      const r = await $.ui.mount({ plugin: PLUGIN, ...resultadoBash(surface, 'TOKEN=abc\nIP 10.0.0.9') })
      expect(ultimo(mundo, 'ToolResult')?.output).toEqual({ stdout: 'TOKEN=[oculto]\nIP [ip]', stderr: '', interrupted: false })
      await r.unmount()

      const c = await $.ui.mount({ plugin: PLUGIN, ...saidaComando(surface, 'conta: nei@x.com') })
      expect(ultimo(mundo, 'CommandOutput')?.text).toBe('conta: [e-mail]')
      expect(ultimo(mundo, 'CommandOutput')?.command).toBe('status')
      await c.unmount()

      const g = await $.ui.mount({ plugin: PLUGIN, ...grupo(surface, '/home/nei/a.ts') })
      const calls = ultimo(mundo, 'ToolGroup')?.calls as { input: { file_path: string } }[]
      expect(calls[0]?.input.file_path).toBe('~/a.ts')
      await g.unmount()
    }
  })

  test('linha de ferramenta ainda rodando não ganha campo output', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    await $.command.run(comando('gravar', 'on'))
    const t = await $.ui.mount({ plugin: PLUGIN, ...usoBash('terminal', 'ls /home/nei') })
    const uso = ultimo(mundo, 'ToolUse')
    expect(uso && 'output' in uso).toBe(false)
    expect(uso?.input).toEqual({ command: 'ls ~' })
    await t.unmount()
  })

  test('mensagem aberta (ctrl+o) também é mascarada', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    await $.command.run(comando('gravar', 'on'))
    const base = msgUsuario('terminal', 'cpf 123.456.789-09')
    const ui = await $.ui.mount({ plugin: PLUGIN, ...base, props: { ...base.props, isExpanded: true } })
    expect(ultimo(mundo, 'UserMessage')?.text).toBe('cpf [cpf]')
    await ui.unmount()
  })

  test('extras do /config entram na máscara', { options: { extras: 'meu-servidor, /cliente-\\d+/i' } }, async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    await $.command.run(comando('gravar', 'on'))
    const ui = await $.ui.mount({ plugin: PLUGIN, ...msgAssistente('terminal', 'no meu-servidor, pasta CLIENTE-7') })
    expect(ultimo(mundo, 'AssistantMessage')?.text).toBe('no [oculto], pasta [oculto]')
    await ui.unmount()
  })

  test('ligado sobrevive a reinício; /gravar off volta ao normal', async ($, on) => {
    const mundo = mundoDe(on, {}, { ligado: true })
    await $.session.start(SESSAO)
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal') })
    expect(await ui.find({ type: 'Text', text: /GRAVANDO/ })).toBeDefined()
    await ui.unmount()
    expect((await $.command.run(comando('gravar', 'off'))).text).toBe('Modo gravação desligado.')
    const u = await $.ui.mount({ plugin: PLUGIN, ...msgUsuario('terminal', 'nei@x.com') })
    expect(ultimo(mundo, 'UserMessage')?.text).toBe('nei@x.com')
    await u.unmount()
  })

  test('cede a faixa a uma pesquisa (survey)', async ($, on) => {
    mundoDe(on, {}, { ligado: true })
    await $.session.start(SESSAO)
    const ui = await $.ui.mount({ plugin: PLUGIN, ...faixa('terminal', { hasSurvey: true }) })
    expect(await ui.find({ type: 'Text', text: /GRAVANDO/ })).toBeUndefined()
    await ui.unmount()
  })
})
