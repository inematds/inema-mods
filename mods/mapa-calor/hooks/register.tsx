// mapa-calor — "onde está o peso deste projeto?"
// /mapa abre um painel com uma linha por pasta de primeiro nível: barra proporcional
// e cor pela intensidade. /mapa bytes alterna entre contar arquivos e somar tamanho.
// Só lê a lista de arquivos (fs.list); não abre o conteúdo de nada.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LinhaMapa, Modo, Varredura } from '../types'

const PAINEL = 'mapa-calor'
const RAIZ_ROTULO = '(arquivos soltos na raiz)'
const modoAtom = atom({ plugin: 'mapa-calor', key: 'modo' } as const, 'arquivos')
const varreduraAtom = atom({ plugin: 'mapa-calor', key: 'varredura' } as const, null)
const cwdAtom = atom({ plugin: 'mapa-calor', key: 'cwd' } as const, '')

export const PADRAO_IGNORAR = '.git,node_modules,.next,dist,build,venv,.venv,__pycache__'

export const listaIgnorar = (texto: string) =>
  new Set(
    texto
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0),
  )

export const formatarBytes = (n: number) => {
  if (n < 1024) return `${n} B`
  const unidades = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < unidades.length - 1) {
    v /= 1024
    i++
  }
  return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace('.', ',')} ${unidades[i]}`
}

export const valorDe = (linha: LinhaMapa, modo: Modo) => (modo === 'bytes' ? linha.bytes : linha.arquivos)

export const ordenar = (linhas: readonly LinhaMapa[], modo: Modo) =>
  [...linhas].sort((a, b) => valorDe(b, modo) - valorDe(a, modo) || a.pasta.localeCompare(b.pasta))

/** Barra de `largura` células: cheias proporcionais ao valor (ao menos 1 se houver algo). */
export const barra = (valor: number, maximo: number, largura: number) => {
  const w = Math.max(1, largura)
  const cheias = maximo <= 0 || valor <= 0 ? 0 : Math.max(1, Math.round((valor / maximo) * w))
  return '█'.repeat(Math.min(w, cheias)) + '░'.repeat(Math.max(0, w - cheias))
}

/** Cor pela intensidade (fração do maior): vermelho, amarelo, verde, ciano. */
export const corDe = (fracao: number) => (fracao >= 0.66 ? 'red' : fracao >= 0.33 ? 'yellow' : fracao >= 0.1 ? 'green' : 'cyan')

const juntar = (pasta: string, nome: string) => (pasta.endsWith('/') ? `${pasta}${nome}` : `${pasta}/${nome}`)

/**
 * Percorre `raiz` em largura até `profundidade` níveis e soma, por pasta de primeiro
 * nível, nº de arquivos e bytes. Para em `limite` arquivos (cortado = true).
 * Links simbólicos (kind 'other') e nomes em `ignorar` ficam de fora.
 */
async function varrer(
  $: EngineInterface,
  raiz: string,
  ignorar: ReadonlySet<string>,
  profundidade: number,
  limite: number,
): Promise<Varredura> {
  const somas = new Map<string, LinhaMapa>()
  const somar = (pasta: string, bytes: number) => {
    const l = somas.get(pasta) ?? { pasta, arquivos: 0, bytes: 0 }
    l.arquivos += 1
    l.bytes += bytes
    somas.set(pasta, l)
  }
  let total = 0
  let cortado = false
  // fila: [caminho, nível (1 = filhos diretos da raiz), pasta de 1º nível]
  let fila: [string, number, string | null][] = [[raiz, 1, null]]
  while (fila.length > 0 && !cortado) {
    const proxima: [string, number, string | null][] = []
    for (const [pasta, nivel, topo] of fila) {
      const itens = await $.fs.list(pasta).catch(() => [])
      for (const item of itens) {
        if (ignorar.has(item.name)) continue
        if (item.kind === 'dir') {
          const dono = topo ?? item.name
          if (!somas.has(dono)) somas.set(dono, { pasta: dono, arquivos: 0, bytes: 0 })
          if (nivel < profundidade) proxima.push([juntar(pasta, item.name), nivel + 1, dono])
        } else if (item.kind === 'file') {
          if (total >= limite) {
            cortado = true
            break
          }
          total += 1
          somar(topo ?? RAIZ_ROTULO, item.size)
        }
      }
      if (cortado) break
    }
    fila = proxima
  }
  const linhas = [...somas.values()]
  return {
    raiz,
    linhas,
    totalArquivos: total,
    totalBytes: linhas.reduce((s, l) => s + l.bytes, 0),
    cortado,
    hora: await $.clock.now(),
  }
}

export const textoDoMapa = (v: Varredura, modo: Modo) => {
  const linhas = ordenar(v.linhas, modo)
  const cab = `Mapa de ${v.raiz}: ${v.totalArquivos} arquivo(s), ${formatarBytes(v.totalBytes)}` + (v.cortado ? ' (parei no limite de arquivos)' : '')
  if (linhas.length === 0) return `${cab}\nNenhuma pasta encontrada.`
  return [
    cab,
    ...linhas.slice(0, 15).map(l => `- ${l.pasta}: ${modo === 'bytes' ? formatarBytes(l.bytes) : `${l.arquivos} arquivo(s)`}`),
  ].join('\n')
}

const numeroDe = (v: unknown, padrao: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : padrao
}

export const register: Register = (on, options) => {
  const ignorar = listaIgnorar(String(options.ignorar ?? PADRAO_IGNORAR))
  const profundidade = numeroDe(options.profundidade, 3)
  const limite = numeroDe(options.limite, 5000)

  on('session.start', async ($, e, next) => {
    await update($, cwdAtom, () => e.cwd)
    await $.command.register({
      name: 'mapa',
      description: 'Mapa de calor das pastas do projeto (args: bytes | arquivos | reler)',
    })
    return next(e)
  })

  on('command.run', { command: 'mapa' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    let modo = await read($, modoAtom)
    if (arg === 'bytes' || arg === 'tamanho') modo = modo === 'bytes' ? 'arquivos' : 'bytes'
    if (arg === 'arquivos' || arg === 'contagem') modo = 'arquivos'
    await update($, modoAtom, () => modo)

    let v = await read($, varreduraAtom)
    if (v === null || arg === 'reler' || arg === '') {
      const raiz = (await read($, cwdAtom)) || (await $.session.cwd())
      v = await varrer($, raiz, ignorar, profundidade, limite)
      await update($, varreduraAtom, () => v)
    }
    await $.ui.open({ id: PAINEL, title: 'Mapa de calor' })
    return { text: textoDoMapa(v, modo) }
  })

  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const modo = await read($, modoAtom)
    const v = await read($, varreduraAtom)

    const alternar = async () => {
      await update($, modoAtom, m => (m === 'bytes' ? 'arquivos' : 'bytes'))
    }
    const reler = async () => {
      const raiz = (await read($, cwdAtom)) || (await $.session.cwd())
      const nova = await varrer($, raiz, ignorar, profundidade, limite)
      await update($, varreduraAtom, () => nova)
      $.ui.toast(`Mapa relido: ${nova.totalArquivos} arquivo(s).`)
    }

    if (v === null) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Ainda não li as pastas. Use /mapa.</Text>
        </Box>
      )
    }

    const linhas = ordenar(v.linhas, modo)
    const maximo = linhas.reduce((m, l) => Math.max(m, valorDe(l, modo)), 0)
    const largNome = Math.min(22, Math.max(6, ...linhas.map(l => l.pasta.length)))
    const largNum = 9
    const largBarra = Math.max(5, (e.props.bodyColumns ?? 60) - largNome - largNum - 4)
    const cabe = Math.max(3, e.props.scroll.bodyRows - 5)

    return (
      <Box flexDirection="column">
        <Text key="titulo" bold>
          {`Por ${modo === 'bytes' ? 'tamanho' : 'nº de arquivos'} · ${v.totalArquivos} arquivo(s), ${formatarBytes(v.totalBytes)}`}
        </Text>
        {v.cortado && <Text key="cortado" color="yellow">{`Parei em ${limite} arquivos: os números estão incompletos.`}</Text>}
        {linhas.length === 0 && <Text key="vazio" dimColor>Nenhuma pasta encontrada.</Text>}
        {linhas.slice(0, cabe).map((l, i) => {
          const valor = valorDe(l, modo)
          const nome = l.pasta.length > largNome ? `${l.pasta.slice(0, largNome - 1)}…` : l.pasta.padEnd(largNome)
          const num = (modo === 'bytes' ? formatarBytes(valor) : String(valor)).padStart(largNum)
          return (
            <Box key={`linha${i}`}>
              <Text>{`${nome} `}</Text>
              <Text color={corDe(maximo > 0 ? valor / maximo : 0)}>{barra(valor, maximo, largBarra)}</Text>
              <Text dimColor>{` ${num}`}</Text>
            </Box>
          )
        })}
        {linhas.length > cabe && <Text key="mais" dimColor>{`… e mais ${linhas.length - cabe} pasta(s)`}</Text>}
        <Box key="botoes">
          <Button key="alternar" hotkey="t" label={modo === 'bytes' ? 'ver por arquivos' : 'ver por tamanho'} onPress={alternar} />
          <Text> </Text>
          <Button key="reler" hotkey="r" label="ler de novo" onPress={reler} />
        </Box>
      </Box>
    )
  })
}
