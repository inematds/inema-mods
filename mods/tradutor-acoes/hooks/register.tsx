// tradutor-acoes — para quem está começando: antes de cada ação do Claude (ler, editar,
// rodar comando, pesquisar...) aparece uma linha em português simples dizendo o que ele
// está fazendo. O desenho original continua logo abaixo, inteiro: o comando real nunca
// fica escondido. Só muda a tela; o que o modelo lê não muda. /tradutor on|off.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const ligado = atom({ plugin: 'tradutor-acoes', key: 'ligado' } as const, true)
const CHAVE_LIGADO = 'ligado'
const LIMITE = 60

const campo = (input: unknown, nome: string): string => {
  if (input === null || typeof input !== 'object') return ''
  const v = (input as Record<string, unknown>)[nome]
  return typeof v === 'string' ? v : ''
}

export const curto = (texto: string, limite = LIMITE) => {
  const linha = (texto.split('\n').find(l => l.trim() !== '') ?? '').trim().replace(/\s+/g, ' ')
  const mais = texto.trim().includes('\n') ? ' (...)' : ''
  return linha.length <= limite ? linha + mais : linha.slice(0, limite - 3) + '...'
}

export const nomeDoArquivo = (caminho: string) => {
  const limpo = caminho.replace(/[\\/]+$/, '')
  const i = Math.max(limpo.lastIndexOf('/'), limpo.lastIndexOf('\\'))
  return i >= 0 ? limpo.slice(i + 1) : limpo
}

const hostDe = (url: string) => {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim())
  return m?.[1] ?? curto(url, 40)
}

const comNome = (frase: string, valor: string) => (valor === '' ? frase : `${frase} ${valor}`)

// O mapa ferramenta -> frase em português simples. Recebe o nome da ferramenta e a
// entrada dela como o modelo mandou; nunca lança, mesmo com entrada estranha.
export const fraseDe = (tool: string, input: unknown): string => {
  const arquivo = nomeDoArquivo(campo(input, 'file_path') || campo(input, 'notebook_path') || campo(input, 'path'))
  switch (tool) {
    case 'Read':
      return comNome('Lendo arquivo', arquivo)
    case 'Edit':
    case 'MultiEdit':
      return comNome('Editando', arquivo || 'arquivo')
    case 'NotebookEdit':
      return comNome('Editando caderno', arquivo)
    case 'Write':
      return comNome('Criando', arquivo || 'arquivo')
    case 'Bash':
    case 'PowerShell': {
      const cmd = curto(campo(input, 'command'))
      return cmd === '' ? 'Rodando comando no terminal' : `Rodando comando: ${cmd}`
    }
    case 'Grep': {
      const termo = curto(campo(input, 'pattern'), 40)
      return termo === '' ? 'Procurando nos arquivos' : `Procurando '${termo}' nos arquivos`
    }
    case 'Glob': {
      const termo = curto(campo(input, 'pattern'), 40)
      return termo === '' ? 'Procurando arquivos' : `Procurando arquivos com nome '${termo}'`
    }
    case 'LS':
      return 'Olhando o que tem na pasta'
    case 'WebFetch': {
      const url = campo(input, 'url')
      return url === '' ? 'Abrindo página web' : `Abrindo página web: ${hostDe(url)}`
    }
    case 'WebSearch': {
      const q = curto(campo(input, 'query'), 50)
      return q === '' ? 'Pesquisando na internet' : `Pesquisando na internet: '${q}'`
    }
    case 'Agent':
    case 'Task': {
      const d = curto(campo(input, 'description'), 50)
      return d === '' ? 'Chamando ajudante (subagente)' : `Chamando ajudante (subagente): ${d}`
    }
    case 'TodoWrite':
    case 'TaskCreate':
    case 'TaskUpdate':
      return 'Atualizando a lista de tarefas'
    case 'Skill': {
      const s = campo(input, 'skill')
      return s === '' ? 'Usando uma habilidade (skill)' : `Usando a habilidade (skill) '${s}'`
    }
    case 'AskUserQuestion':
      return 'Fazendo uma pergunta para você'
    case 'ToolSearch':
      return 'Procurando ferramentas disponíveis'
    case 'Monitor':
      return 'Acompanhando um processo em segundo plano'
    case 'TaskStop':
      return 'Parando uma tarefa em segundo plano'
    case 'ExitPlanMode':
      return 'Mostrando o plano para você aprovar'
    case 'EnterWorktree':
      return 'Criando uma cópia de trabalho separada (worktree)'
    case 'ExitWorktree':
      return 'Saindo da cópia de trabalho separada'
  }
  if (tool.startsWith('mcp__')) {
    const [, servidor = '', ferramenta = ''] = tool.split('__')
    return `Usando ferramenta externa: ${servidor}${ferramenta === '' ? '' : ` / ${ferramenta}`}`
  }
  return `Usando a ferramenta ${tool}`
}

export const situacao = (p: { isErrored?: boolean; isInterrupted?: boolean }) =>
  p.isInterrupted === true ? ' (interrompido)' : p.isErrored === true ? ' (deu erro)' : ''

// Uma linha para um grupo dobrado ("Read 3 files, ran 2 shell commands").
export const resumoDoGrupo = (calls: ReadonlyArray<{ tool: string }>) => {
  const conta = new Map<string, number>()
  const tipo = (t: string) =>
    t === 'Read' ? 'leitura' : t === 'Grep' || t === 'Glob' || t === 'WebSearch' ? 'busca' : t === 'LS' ? 'pasta' : t === 'Bash' ? 'comando' : 'outra'
  for (const c of calls) conta.set(tipo(c.tool), (conta.get(tipo(c.tool)) ?? 0) + 1)
  const partes: string[] = []
  const n = (k: string) => conta.get(k) ?? 0
  if (n('leitura')) partes.push(n('leitura') === 1 ? 'lendo 1 arquivo' : `lendo ${n('leitura')} arquivos`)
  if (n('busca')) partes.push(n('busca') === 1 ? 'fazendo 1 busca' : `fazendo ${n('busca')} buscas`)
  if (n('pasta')) partes.push(n('pasta') === 1 ? 'olhando 1 pasta' : `olhando ${n('pasta')} pastas`)
  if (n('comando')) partes.push(n('comando') === 1 ? 'rodando 1 comando' : `rodando ${n('comando')} comandos`)
  if (n('outra')) partes.push(n('outra') === 1 ? '1 outra ação' : `${n('outra')} outras ações`)
  const texto = partes.join(', ')
  return texto === '' ? 'Olhando os arquivos' : texto.charAt(0).toUpperCase() + texto.slice(1)
}

async function carregar($: EngineInterface) {
  const salvo = await $.store.get(CHAVE_LIGADO).catch(() => undefined)
  await update($, ligado, () => salvo !== false)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await carregar($)
    await $.command.register({
      name: 'tradutor',
      description: 'Mostra em português o que o Claude está fazendo (args: on | off)',
    })
    return next(e)
  })

  on('command.run', { command: 'tradutor' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off') {
      const valor = arg === 'on'
      await update($, ligado, () => valor)
      await $.store.set(CHAVE_LIGADO, valor)
      return { text: valor ? 'Tradutor ligado.' : 'Tradutor desligado (use /tradutor on para ligar).' }
    }
    return { text: `Tradutor ${(await read($, ligado)) ? 'ligado' : 'desligado'}. Use /tradutor on ou /tradutor off.` }
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!(await read($, ligado))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const frase = fraseDe(e.props.tool, e.props.input) + situacao(e.props)
    const original = await next(e)
    return (
      <Box flexDirection="column">
        <Text color="cyan" wrap="truncate-end">
          {`> ${frase}`}
        </Text>
        {original}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    // Aberto (ctrl+o, --verbose), cada chamada vira um ToolUse e ganha a própria linha.
    if (e.props.isExpanded || !(await read($, ligado))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const original = await next(e)
    return (
      <Box flexDirection="column">
        <Text color="cyan" wrap="truncate-end">
          {`> ${resumoDoGrupo(e.props.calls)}`}
        </Text>
        {original}
      </Box>
    )
  })
}
