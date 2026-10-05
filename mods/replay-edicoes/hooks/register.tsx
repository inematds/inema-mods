// replay-edicoes — "o que o Claude mudou, uma edição de cada vez?"
// /replay lê a conversa ($.session.messages), separa cada Edit/Write/MultiEdit/NotebookEdit
// que deu certo e abre um painel para andar passo a passo: [< anterior] [próximo >]
// (teclas h e l com o painel em foco) e [copiar diff]. Só lê a conversa; não abre arquivos.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMessage } from 'claude-code'

import type { Passo } from '../types'

const PAINEL = 'replay-edicoes'
const TETO_COPIA = 100_000
const TETO_LINHA = 400
const passosAtom = atom({ plugin: 'replay-edicoes', key: 'passos' } as const, [])
const indiceAtom = atom({ plugin: 'replay-edicoes', key: 'indice' } as const, 0)

/** Tira caracteres de controle (só tab e quebra de linha passam) e corta linha gigante. */
export const limparLinha = (s: string) => {
  const l = s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
  return l.length > TETO_LINHA ? `${l.slice(0, TETO_LINHA)}…` : l
}

const linhasDe = (texto: string) => (texto === '' ? [] : texto.replace(/\r\n?/g, '\n').split('\n').map(limparLinha))

type Bloco = { menos: string[]; mais: string[] }

/** Um bloco vira um hunk `@@ -1,a +1,b @@`. Os números são de posição relativa: o Edit não diz a linha real. */
const hunk = (b: Bloco) => {
  const ini = (n: number) => (n === 0 ? '0,0' : `1,${n}`)
  return [`@@ -${ini(b.menos.length)} +${ini(b.mais.length)} @@`, ...b.menos.map(l => `-${l}`), ...b.mais.map(l => `+${l}`)].join('\n')
}

/**
 * Monta o diff de vários blocos cabendo em `max` linhas de conteúdo. Cada bloco cortado
 * tem o cabeçalho recontado, para continuar sendo um hunk válido.
 */
export const montarDiff = (blocos: readonly Bloco[], max: number) => {
  const inteiro = blocos.map(hunk).join('\n')
  let resta = Math.max(2, max)
  let ocultas = 0
  const cortados: Bloco[] = []
  for (const b of blocos) {
    const total = b.menos.length + b.mais.length
    if (resta <= 0) {
      ocultas += total
      continue
    }
    if (total <= resta) {
      cortados.push(b)
      resta -= total
      continue
    }
    // metade para o que saiu, o resto para o que entrou
    const nMenos = Math.min(b.menos.length, Math.max(b.mais.length === 0 ? resta : 1, Math.floor(resta / 2)))
    const nMais = Math.min(b.mais.length, resta - nMenos)
    cortados.push({ menos: b.menos.slice(0, nMenos), mais: b.mais.slice(0, nMais) })
    ocultas += total - nMenos - nMais
    resta = 0
  }
  return {
    diff: cortados.map(hunk).join('\n').slice(0, 9_000),
    completo: inteiro.slice(0, TETO_COPIA),
    ocultas,
  }
}

const texto = (v: unknown) => (typeof v === 'string' ? v : '')

/** Os blocos (saiu/entrou) de uma chamada de ferramenta de edição, ou null se não for edição. */
export const blocosDe = (tool: string, input: Record<string, unknown>): { caminho: string; blocos: Bloco[] } | null => {
  if (tool === 'Edit') {
    return { caminho: texto(input.file_path), blocos: [{ menos: linhasDe(texto(input.old_string)), mais: linhasDe(texto(input.new_string)) }] }
  }
  if (tool === 'Write') {
    return { caminho: texto(input.file_path), blocos: [{ menos: [], mais: linhasDe(texto(input.content)) }] }
  }
  if (tool === 'MultiEdit') {
    const edits = Array.isArray(input.edits) ? (input.edits as Record<string, unknown>[]) : []
    return {
      caminho: texto(input.file_path),
      blocos: edits.map(ed => ({ menos: linhasDe(texto(ed.old_string)), mais: linhasDe(texto(ed.new_string)) })),
    }
  }
  if (tool === 'NotebookEdit') {
    const apagar = input.edit_mode === 'delete'
    return {
      caminho: texto(input.notebook_path),
      blocos: [{ menos: apagar ? ['(célula apagada)'] : [], mais: apagar ? [] : linhasDe(texto(input.new_source)) }],
    }
  }
  return null
}

export const passosDe = (mensagens: readonly SessionMessage[], max: number): Passo[] => {
  const passos: Passo[] = []
  mensagens.forEach((m, i) => {
    for (const uso of m.toolUses) {
      if (uso.isError === true) continue
      const b = blocosDe(uso.tool, uso.input)
      if (b === null) continue
      const d = montarDiff(b.blocos, max)
      passos.push({ ferramenta: uso.tool, caminho: b.caminho, mensagem: i, ...d })
    }
  })
  return passos
}

async function carregar($: EngineInterface, max: number) {
  const passos = passosDe(await $.session.messages(), max)
  await update($, passosAtom, () => passos)
  await update($, indiceAtom, i => Math.min(Math.max(0, i), Math.max(0, passos.length - 1)))
  return passos
}

const rotulo = (p: Passo) => (p.ferramenta === 'Write' ? 'arquivo novo (ou reescrito)' : p.ferramenta === 'NotebookEdit' ? 'notebook' : 'edição')

export const register: Register = (on, options) => {
  const n = Number(options.maxLinhas)
  const max = Number.isFinite(n) && n >= 4 ? Math.floor(n) : 40

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'replay',
      description: 'Replay das edições da sessão, passo a passo (args: primeiro | ultimo | número)',
    })
    return next(e)
  })

  on('command.run', { command: 'replay' }, async ($, e) => {
    const passos = await carregar($, max)
    if (passos.length === 0) return { text: 'Nenhuma edição de arquivo nesta conversa ainda.' }
    const arg = e.args.trim().toLowerCase()
    const num = Number(arg)
    if (arg === 'primeiro' || arg === '') await update($, indiceAtom, () => 0)
    if (arg === 'ultimo' || arg === 'último') await update($, indiceAtom, () => passos.length - 1)
    if (arg !== '' && Number.isInteger(num) && num >= 1) await update($, indiceAtom, () => Math.min(num, passos.length) - 1)
    await $.ui.open({ id: PAINEL, title: 'Replay de edições', focus: true })
    const i = await read($, indiceAtom)
    return { text: `Replay: ${passos.length} edição(ões). Mostrando o passo ${i + 1}. Teclas no painel: h anterior, l próximo, c copiar.` }
  })

  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const passos = await read($, passosAtom)
    const i = Math.min(await read($, indiceAtom), Math.max(0, passos.length - 1))

    const ir = (delta: number) => async () => {
      await update($, indiceAtom, x => Math.min(Math.max(0, x + delta), Math.max(0, passos.length - 1)))
    }
    const atualizar = async () => {
      const novos = await carregar($, max)
      $.ui.toast(`Replay atualizado: ${novos.length} edição(ões).`)
    }

    const p = passos[i]
    if (p === undefined) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Nenhuma edição de arquivo nesta conversa ainda.</Text>
          <Button key="atualizar" hotkey="u" label="atualizar" onPress={atualizar} />
        </Box>
      )
    }

    const copiar = async (surface: Parameters<EngineInterface['ui']['copy']>[0]['surface']) => {
      const r = await $.ui.copy({ text: p.completo, surface }).catch(() => undefined)
      $.ui.toast(r?.isCopied === true ? 'Diff copiado.' : 'Não consegui copiar o diff.')
    }

    return (
      <Box flexDirection="column">
        <Box key="cabecalho">
          <Text bold>{`Passo ${i + 1} de ${passos.length} · ${rotulo(p)}`}</Text>
        </Box>
        <Box key="caminho">
          <Text color="cyan" wrap="truncate-start">{p.caminho || '(sem caminho)'}</Text>
        </Box>
        <Code key="diff" source={p.diff} format="diff" {...(p.caminho ? { path: p.caminho } : {})} wrap="truncate-end" />
        {p.ocultas > 0 && (
          <Box key="aviso">
            <Text color="yellow">{`… mais ${p.ocultas} linha(s) não cabem aqui. O botão copiar leva o diff inteiro.`}</Text>
          </Box>
        )}
        <Text dimColor>Números de linha são relativos ao trecho, não ao arquivo.</Text>
        <Box key="botoes">
          <Button key="anterior" hotkey="h" label="< anterior" onPress={ir(-1)} />
          <Text> </Text>
          <Button key="proximo" hotkey="l" label="próximo >" onPress={ir(1)} />
          <Text> </Text>
          <Button key="copiar" hotkey="c" label="copiar diff" onPress={press => copiar(press.surface)} />
          <Text> </Text>
          <Button key="atualizar" hotkey="u" label="atualizar" dimColor onPress={atualizar} />
        </Box>
      </Box>
    )
  })
}
