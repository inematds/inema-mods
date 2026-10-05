// tema-inema — identidade visual para lives e gravações: uma faixa curta acima do prompt
// "INEMA.CLUB · <projeto> · <hora>" na cor da marca e, opcionalmente, um destaque na
// mesma cor nas respostas do Claude (uma linha de marca no começo de cada resposta, ou
// uma moldura). Só muda o desenho na tela; o que o modelo lê não muda. /tema on|off.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const ligado = atom({ plugin: 'tema-inema', key: 'ligado' } as const, true)
const projeto = atom({ plugin: 'tema-inema', key: 'projeto' } as const, '')
const hora = atom({ plugin: 'tema-inema', key: 'hora' } as const, '')

const CHAVE_LIGADO = 'ligado'

export const CORES: Record<string, string> = {
  ambar: '#FFB000',
  amarelo: 'yellow',
  ciano: 'cyan',
  magenta: 'magenta',
  verde: 'green',
  azul: 'blue',
}

export const corDe = (nome: unknown) => CORES[String(nome ?? '')] ?? '#FFB000'

export const nomeDoProjeto = (cwd: string) => {
  const limpo = cwd.replace(/[\\/]+$/, '')
  if (limpo === '') return cwd === '' ? '?' : cwd
  const i = Math.max(limpo.lastIndexOf('/'), limpo.lastIndexOf('\\'))
  return i >= 0 ? limpo.slice(i + 1) : limpo
}

// HH:MM no fuso do ambiente em que o mod roda (o da máquina).
export const horaDe = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const textoDaFaixa = (marca: string, nomeProjeto: string, agora: string) =>
  [marca, nomeProjeto, agora].filter(p => p !== '').join(' · ')

async function atualizarHora($: EngineInterface) {
  const agora = horaDe(await $.clock.now())
  if ((await read($, hora)) !== agora) await update($, hora, () => agora)
}

async function carregar($: EngineInterface, cwd: string) {
  const salvo = await $.store.get(CHAVE_LIGADO).catch(() => undefined)
  await update($, ligado, () => salvo !== false)
  await update($, projeto, () => nomeDoProjeto(cwd))
  await atualizarHora($)
}

export const register: Register = (on, options) => {
  const marca = String(options.texto ?? 'INEMA.CLUB').trim() || 'INEMA.CLUB'
  const cor = corDe(options.cor)
  const destaque = String(options.destaque ?? 'linha')

  on('session.start', async ($, e, next) => {
    await carregar($, e.cwd)
    await $.command.register({ name: 'tema', description: 'Faixa e cores da marca para lives (args: on | off)' })
    // O relógio da faixa: confere a cada 20 s e só redesenha quando o minuto muda.
    $.clock.every(20_000, () => void atualizarHora($))
    return next(e)
  })

  on('command.run', { command: 'tema' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      const valor = arg === 'on'
      await update($, ligado, () => valor)
      await $.store.set(CHAVE_LIGADO, valor)
      return { text: valor ? 'Tema ligado.' : 'Tema desligado (use /tema on para ligar).' }
    }
    const estado = (await read($, ligado)) ? 'ligado' : 'desligado'
    return { text: `Tema ${estado}. Use /tema on ou /tema off. Texto e cor mudam em /config.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, ligado))) return next(e)
    const linha = textoDaFaixa(marca, await read($, projeto), await read($, hora))
    const { Box, Text } = $.ui.resolve(e)
    const abaixo = await next(e)
    return (
      <Box flexDirection="column">
        <Text color={cor} bold wrap="truncate-end">
          {linha}
        </Text>
        {abaixo}
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (destaque === 'nenhum' || !(await read($, ligado))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const original = await next(e)
    if (destaque === 'moldura') {
      return (
        <Box borderStyle="round" borderColor={cor} paddingX={1} flexDirection="column">
          {original}
        </Box>
      )
    }
    if (!e.props.isFirstOfReply) return original
    return (
      <Box flexDirection="column">
        <Text color={cor} bold>
          {`▌ ${marca}`}
        </Text>
        {original}
      </Box>
    )
  })
}
