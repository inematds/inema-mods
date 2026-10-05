// modo-gravacao — para gravar vídeo ou fazer live sem mostrar dado sensível.
// /gravar on: as mensagens do transcript (sua, do Claude, chamadas e resultados de
// ferramentas, saída de comandos) passam a ser DESENHADAS com e-mails, tokens, IPs,
// telefones, CPF/CNPJ, valores em dinheiro, a pasta /home/<usuario> e linhas CHAVE=valor
// mascarados. Só o desenho muda: o que o modelo lê e o que fica salvo na conversa não
// mudam. Uma faixa vermelha acima do prompt avisa que está gravando. /gravar off volta.
// REDUZ o risco, não garante (ver README).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput } from 'claude-code'

import { mascarar, mascararTudo, regrasExtras, TEXTO_DE_FALHA } from './mascara'

const ligado = atom({ plugin: 'modo-gravacao', key: 'ligado' } as const, false)
const CHAVE_LIGADO = 'ligado'

export const AVISO = 'GRAVANDO — dados sensíveis mascarados na tela'

async function carregar($: EngineInterface) {
  const salvo = await $.store.get(CHAVE_LIGADO).catch(() => undefined)
  await update($, ligado, () => salvo === true)
}

// Se algo der errado ao mascarar, desenha um marcador no lugar — nunca o original.
function oculto($: EngineInterface, e: RenderInput) {
  const { Text } = $.ui.resolve(e)
  return <Text dimColor>{TEXTO_DE_FALHA}</Text>
}

export const register: Register = (on, options) => {
  const extras = regrasExtras(String(options.extras ?? ''))
  const m = (t: string) => mascarar(t, extras)
  const mt = (v: unknown) => mascararTudo(v, extras)

  on('session.start', async ($, e, next) => {
    await carregar($)
    await $.command.register({
      name: 'gravar',
      description: 'Modo gravação: mascara dados sensíveis na tela (args: on | off)',
    })
    return next(e)
  })

  on('command.run', { command: 'gravar' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      const valor = arg === 'on'
      await update($, ligado, () => valor)
      await $.store.set(CHAVE_LIGADO, valor)
      return {
        text: valor
          ? 'Modo gravação LIGADO. O que já está na tela é redesenhado mascarado; revise o vídeo antes de publicar.'
          : 'Modo gravação desligado.',
      }
    }
    const estado = (await read($, ligado)) ? 'LIGADO' : 'desligado'
    return { text: `Modo gravação ${estado}. Use /gravar on ou /gravar off.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, ligado))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const abaixo = await next(e)
    return (
      <Box flexDirection="column">
        <Text backgroundColor="red" color="white" bold wrap="truncate-end">
          {` ${AVISO} `}
        </Text>
        {abaixo}
      </Box>
    )
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    try {
      return await next({ ...e, props: { ...e.props, text: m(e.props.text) } })
    } catch {
      return oculto($, e)
    }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    try {
      return await next({ ...e, props: { ...e.props, text: m(e.props.text) } })
    } catch {
      return oculto($, e)
    }
  })

  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    try {
      return await next({ ...e, props: { ...e.props, text: m(e.props.text) } })
    } catch {
      return oculto($, e)
    }
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    try {
      const props = { ...e.props, input: mt(e.props.input) }
      // Só reescreve `output` se ele já estava lá: acrescentar `output: undefined`
      // quebra o desenho da linha.
      if ('output' in e.props) props.output = mt(e.props.output)
      return await next({ ...e, props })
    } catch {
      return oculto($, e)
    }
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    try {
      return await next({ ...e, props: { ...e.props, output: mt(e.props.output) } })
    } catch {
      return oculto($, e)
    }
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    try {
      const calls = e.props.calls.map(c => ({ ...c, input: mt(c.input) }))
      return await next({ ...e, props: { ...e.props, calls } })
    } catch {
      return oculto($, e)
    }
  })
}
