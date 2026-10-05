import { describe, expect, test } from 'claude-code/testing'
import type { AgentSpawnInput, On } from 'claude-code'

import { destino, lerMapa } from '../hooks/register'
import { comando, FAIXA, mundoDe, SESSAO } from './mundo'

const PLUGIN = 'roteador-subagente'

const spawn = (subagentType: string, extra: Partial<AgentSpawnInput> = {}): AgentSpawnInput => ({
  tool_use_id: 'tu1',
  prompt: 'procura X',
  description: 'procura',
  subagentType,
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'claude-opus-4-1',
  background: false,
  fork: false,
  ...extra,
})

/** Por baixo do agent.spawn: guarda o modelo com que cada subagente "subiu". */
const engineDeAgentes = (on: On) => {
  const subiram: (string | undefined)[] = []
  let n = 0
  on('agent.spawn', ($, e) => {
    subiram.push(e.model)
    n += 1
    return { model: e.model ?? e.parentModel, agentId: `a${n}` }
  })
  return subiram
}

const fimDoSubagente = (agentId: string, model: string, out: number) => ({
  answer: 'ok',
  durationMs: 100,
  isAborted: false,
  turnId: `t-${agentId}`,
  reason: 'answer' as const,
  agentId,
  usage: { model, input_tokens: 1000, output_tokens: out, cache_read_input_tokens: 4000, cache_creation_input_tokens: 0 },
})

describe('roteador-subagente', () => {
  test('mapa do /config e destino por modo', () => {
    const mapa = lerMapa('Explore=haiku, general-purpose = sonnet, lixo, =x')
    expect(mapa).toEqual({ explore: 'haiku', 'general-purpose': 'sonnet' })
    expect(destino('off', mapa, 'Explore')).toBeUndefined()
    expect(destino('on', mapa, 'Explore')).toBe('haiku')
    expect(destino('on', mapa, 'Plan')).toBeUndefined()
    expect(destino('opus', mapa, 'Plan')).toBe('opus')
  })

  test('desligado (padrão): não mexe em nada', async ($, on) => {
    const mundo = mundoDe(on)
    const subiram = engineDeAgentes(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['router'])
    await $.agent.spawn(spawn('Explore'))
    expect(subiram).toEqual([undefined])
  })

  test('/router on segue o mapa; modelo explícito, fork e teammate ficam como estão', async ($, on) => {
    const mundo = mundoDe(on)
    const subiram = engineDeAgentes(on)
    await $.session.start(SESSAO)
    expect((await $.command.run(comando('router', 'on'))).text).toContain('explore=haiku')
    await $.agent.spawn(spawn('Explore'))
    await $.agent.spawn(spawn('general-purpose'))
    await $.agent.spawn(spawn('Plan'))
    await $.agent.spawn(spawn('Explore', { model: 'opus' }))
    await $.agent.spawn(spawn('fork', { fork: true }))
    await $.agent.spawn(spawn('Explore', { isTeammate: true }))
    expect(subiram).toEqual(['haiku', 'sonnet', undefined, 'opus', undefined, undefined])
    expect(mundo.status.at(-1)).toBe('router: mapa')
  })

  test('/router sonnet força todos (menos o explícito) e /router off desliga', async ($, on) => {
    const mundo = mundoDe(on)
    const subiram = engineDeAgentes(on)
    await $.session.start(SESSAO)
    await $.command.run(comando('router', 'sonnet'))
    expect(mundo.status.at(-1)).toBe('router: sonnet')
    await $.agent.spawn(spawn('Plan'))
    await $.agent.spawn(spawn('Explore', { model: 'haiku' }))
    await $.command.run(comando('router', 'off'))
    expect(mundo.status.at(-1)).toBeUndefined()
    await $.agent.spawn(spawn('Plan'))
    expect(subiram).toEqual(['sonnet', 'haiku', undefined])
  })

  test('modo salvo no store volta na sessão seguinte', async ($, on) => {
    const mundo = mundoDe(on, {}, { modo: 'haiku' })
    const subiram = engineDeAgentes(on)
    await $.session.start(SESSAO)
    expect(mundo.status.at(-1)).toBe('router: haiku')
    await $.agent.spawn(spawn('general-purpose'))
    expect(subiram).toEqual(['haiku'])
  })

  test('/router status soma os tokens só dos subagentes roteados, sem falar em dinheiro', async ($, on) => {
    mundoDe(on)
    engineDeAgentes(on)
    await $.session.start(SESSAO)
    expect((await $.command.run(comando('router', 'status'))).text).toContain('nenhum subagente foi roteado')
    await $.command.run(comando('router', 'on'))
    await $.agent.spawn(spawn('Explore')) // a1 -> haiku
    await $.agent.spawn(spawn('Plan')) // a2 -> não roteado
    await $.turn.complete(fimDoSubagente('a1', 'claude-haiku-4-5', 500))
    await $.turn.complete(fimDoSubagente('a2', 'claude-opus-4-1', 900))
    const t = (await $.command.run(comando('router', 'status'))).text ?? ''
    expect(t).toContain('1 subagente(s) roteado(s)')
    expect(t).toContain('Tokens rodados em modelo menor (haiku/sonnet): 5,5 mil')
    expect(t).toContain('haiku 5,5 mil (saída 500)')
    expect(t).not.toMatch(/US\$|R\$|dólar|reais/)
  })

  test('argumento estranho mostra o uso', async ($, on) => {
    mundoDe(on)
    await $.session.start(SESSAO)
    expect((await $.command.run(comando('router', 'gpt'))).text).toContain('Uso: /router')
  })

  test('faixa opcional desenha em terminal e desktop e desliga pelo botão', { options: { mostrar_faixa: true } }, async ($, on) => {
    const mundo = mundoDe(on)
    engineDeAgentes(on)
    await $.session.start(SESSAO)
    await $.command.run(comando('router', 'sonnet'))
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface })
      expect(await ui.find({ type: 'Text', text: /router: sonnet/ })).toBeDefined()
      await ui.unmount()
    }
    const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    await ui.press({ key: 'desligar' })
    expect(await ui.find({ type: 'Text', text: /router:/ })).toBeUndefined()
    expect(mundo.status.at(-1)).toBeUndefined()
    await ui.unmount()
  })

  test('sem a opção da faixa, nada é desenhado acima do prompt', async ($, on) => {
    mundoDe(on)
    await $.session.start(SESSAO)
    await $.command.run(comando('router', 'sonnet'))
    const ui = await $.ui.mount({ ...FAIXA, plugin: PLUGIN, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /router:/ })).toBeUndefined()
    await ui.unmount()
  })
})
