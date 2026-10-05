// freio-de-mao — antes de um comando Bash que apaga ou descarta, mede o estrago
// SEM apagar (quantos arquivos, pastas, tamanho, mudanças não commitadas) e pergunta:
// Prosseguir / Mandar para a lixeira / Fazer backup e prosseguir / Cancelar.
// Também confere a conta do git (user.email x dono do remoto) se "contas_git" estiver preenchido.
// /freio mostra o que foi parado nesta sessão.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Parada } from '../types'
import {
  acharCommitOuPush,
  analisar,
  aspas,
  avisoZero,
  caminhosDoStatus,
  donoDaUrl,
  lerContas,
  lerMedidaLinhas,
  lerMedidaSh,
  marcaDeData,
  nadaAPerder,
  podeBackup,
  podeLixeira,
  reescreverParaLixeira,
  resumoMedida,
  scriptBackup,
} from './regras'
import type { Medida, Perigo } from './regras'

const paradas = atom({ plugin: 'freio-de-mao', key: 'paradas' } as const, [])

const PROSSEGUIR = 'Prosseguir'
const LIXEIRA = 'Mandar para a lixeira'
const BACKUP = 'Fazer backup e prosseguir'
const CANCELAR = 'Cancelar'
const MAX_LISTA = 15

type Config = { semTela: 'negar' | 'permitir'; contas: Map<string, string> }

const curto = (s: string, n = 100) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

async function medir($: EngineInterface, p: Perigo): Promise<Medida | undefined> {
  const m = p.medicao
  if (!m) return undefined
  if ('sh' in m) {
    const r = await $.process.run(['sh', '-c', m.sh], { cwd: p.cwd, timeoutMs: 15_000 }).catch(() => undefined)
    return r ? lerMedidaSh(r.stdout) : undefined
  }
  const r = await $.process.run(m.argv, { cwd: p.cwd, timeoutMs: 10_000 }).catch(() => undefined)
  if (!r) return undefined
  if (m.argv[0] === 'git' && r.exitCode !== 0) return undefined // não é repositório, branch não existe...
  return lerMedidaLinhas(p.tipo, m.listaDoErro ? r.stderr : r.stdout)
}

/** Monta o texto da pergunta: comando, efeito, resumo e no máximo 15 linhas de lista. */
function textoDoPerigo(itens: readonly { p: Perigo; m: Medida | undefined }[]) {
  const linhas: string[] = ['Freio de mão: este comando apaga ou descarta coisas.']
  let orcamento = MAX_LISTA
  for (const { p, m } of itens) {
    linhas.push('', `> ${curto(p.texto)}`, `  ${p.efeito}${p.sudo ? ' (com sudo)' : ''}.`)
    if (!m) {
      linhas.push(`  ${p.semMedida ?? 'Não consegui medir o estrago antes (confira você).'}`)
      continue
    }
    linhas.push(`  ${resumoMedida(p, m)}`)
    if (m.n === 0) linhas.push(`  ${avisoZero(p)}`)
    const mostrar = m.lista.slice(0, Math.max(0, orcamento))
    orcamento -= mostrar.length
    linhas.push(...mostrar.map(l => `    ${curto(l, 90)}`))
    const total = Math.max(m.n, m.lista.length)
    if (total > mostrar.length) linhas.push(`    ... e mais ${total - mostrar.length}`)
  }
  linhas.push('', 'O que fazer?')
  return linhas.join('\n')
}

const resumoCurto = (itens: readonly { p: Perigo; m: Medida | undefined }[]) =>
  itens.map(({ p, m }) => `${curto(p.texto, 60)} -> ${m ? resumoMedida(p, m) : (p.semMedida ?? p.efeito)}`).join('; ')

async function registrar($: EngineInterface, comando: string, decisao: string, resumo: string) {
  const hora = await $.clock.now()
  await update($, paradas, l => [...l, { hora, comando: curto(comando, 120), decisao, resumo }].slice(-100))
}

/** Lista do que copiar no backup, por perigo; undefined = não dá para fazer backup. */
function planoDeBackup(p: Perigo, m: Medida | undefined): { brutos: string[]; raizGit: boolean } | undefined {
  if (!podeBackup(p)) return undefined
  if (p.tipo === 'rm' || p.tipo === 'find' || p.tipo === 'truncate') return { brutos: p.alvos, raizGit: false }
  if (!m) return undefined
  if (p.tipo === 'git-clean') return { brutos: m.lista.map(aspas), raizGit: false }
  return { brutos: caminhosDoStatus(m.lista).map(aspas), raizGit: true }
}

async function fazerBackup($: EngineInterface, planos: readonly { p: Perigo; brutos: string[]; raizGit: boolean }[], marca: string) {
  let pasta = ''
  for (const { p, brutos, raizGit } of planos) {
    const r = await $.process.run(['sh', '-c', scriptBackup(brutos, marca, raizGit)], { cwd: p.cwd, timeoutMs: 120_000 }).catch((err: unknown) => ({
      exitCode: 1,
      stdout: '',
      stderr: String(err),
    }))
    if (r.exitCode !== 0) return { erro: curto(r.stderr.trim() || `código ${r.exitCode}`, 160) }
    pasta = r.stdout.trim().split('\n').pop() ?? pasta
  }
  return { pasta }
}

async function git($: EngineInterface, cwd: string, args: string[]) {
  const r = await $.process.run(['git', ...args], { cwd, timeoutMs: 5_000 }).catch(() => undefined)
  return r && r.exitCode === 0 ? r.stdout.trim() : ''
}

/** git commit/push: o user.email bate com a conta do dono do remoto? */
async function conferirConta($: EngineInterface, comando: string, cwd: string, cfg: Config): Promise<{ deny: string } | undefined> {
  if (cfg.contas.size === 0) return undefined
  const alvo = acharCommitOuPush(comando, cwd)
  if (!alvo) return undefined
  let url = alvo.remoto && /[:/]/.test(alvo.remoto) ? alvo.remoto : await git($, alvo.cwd, ['remote', 'get-url', alvo.remoto ?? 'origin'])
  if (!url && alvo.remoto === undefined) {
    const primeiro = (await git($, alvo.cwd, ['remote'])).split('\n')[0]
    if (primeiro) url = await git($, alvo.cwd, ['remote', 'get-url', primeiro])
  }
  const dono = donoDaUrl(url)
  const esperado = dono ? cfg.contas.get(dono.toLowerCase()) : undefined
  if (!dono || !esperado) return undefined
  const email = (await git($, alvo.cwd, ['config', 'user.email'])).toLowerCase()
  if (email === esperado) return undefined

  const negar = {
    deny:
      `freio-de-mao: o git vai fazer ${alvo.sub} como "${email || '(sem e-mail)'}", mas o remoto é da conta ${dono} (e-mail esperado ${esperado}). ` +
      `Corrija neste repositório (sem --global): git config user.email ${esperado} — e confira o user.name. Depois tente de novo.`,
  }
  const resposta = await $.ui
    .ask(`Conta do git diferente: ${alvo.sub} como "${email || '(sem e-mail)'}", mas o remoto é de ${dono} (esperado ${esperado}). Prosseguir assim mesmo?`, {
      header: 'Conta git',
      options: [CANCELAR, PROSSEGUIR],
    })
    .catch(() => undefined)
  if (resposta === undefined) {
    await registrar($, comando, 'sem tela (conta git)', `${email} x ${dono}`)
    return cfg.semTela === 'permitir' ? undefined : negar
  }
  await registrar($, comando, `${resposta} (conta git)`, `${email} x ${dono}`)
  return resposta === PROSSEGUIR ? undefined : negar
}

export const textoFreio = (lista: readonly Parada[], agora: number) => {
  if (lista.length === 0) return 'Freio de mão: nada parado nesta sessão.'
  return [
    `Freio de mão: ${lista.length} parada(s) nesta sessão.`,
    ...lista.slice(-15).map(p => {
      const min = Math.max(0, Math.floor((agora - p.hora) / 60_000))
      return `  - há ${min} min · ${p.decisao} · ${p.comando}\n      ${curto(p.resumo, 140)}`
    }),
  ].join('\n')
}

export const register: Register = (on, options) => {
  const cfg: Config = {
    semTela: options.sem_tela === 'permitir' ? 'permitir' : 'negar',
    contas: lerContas(Array.isArray(options.contas_git) ? options.contas_git : []),
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'freio', description: 'Freio de mão: o que foi parado nesta sessão' })
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const cwd = await $.session.cwd()

    const conta = await conferirConta($, e.command, cwd, cfg)
    if (conta) return conta

    const perigos = analisar(e.command, cwd)
    if (perigos.length === 0) return next(e)

    const medidos: { p: Perigo; m: Medida | undefined }[] = []
    for (const p of perigos) medidos.push({ p, m: await medir($, p) })
    const relevantes = medidos.filter(({ p, m }) => !(m && nadaAPerder(p, m)))
    if (relevantes.length === 0) return next(e) // nada a perder (alvo não existe, árvore limpa...)

    const lixeira = relevantes.every(({ p }) => podeLixeira(p))
    const planos = relevantes.map(({ p, m }) => {
      const plano = planoDeBackup(p, m)
      return plano ? { p, ...plano } : undefined
    })
    const backup = planos.every(x => x !== undefined)
    const opcoes = [CANCELAR, ...(lixeira ? [LIXEIRA] : []), ...(backup ? [BACKUP] : []), PROSSEGUIR]
    const resumo = resumoCurto(relevantes)

    const resposta = await $.ui.ask(textoDoPerigo(relevantes), { header: 'Freio', options: opcoes }).catch(() => undefined)

    if (resposta === undefined) {
      await registrar($, e.command, 'sem tela', resumo)
      if (cfg.semTela === 'permitir') return next(e)
      return {
        deny:
          `freio-de-mao: comando destrutivo barrado (não há ninguém na tela para confirmar). Ele faria: ${resumo}. ` +
          'Não tente apagar por outro caminho: explique ao usuário o que quer apagar e por quê, e deixe ele decidir.',
      }
    }
    await registrar($, e.command, resposta, resumo)

    if (resposta === PROSSEGUIR) return next(e)

    const marca = marcaDeData(await $.clock.now())
    if (resposta === LIXEIRA && lixeira) {
      const gio = await $.process.run(['sh', '-c', 'command -v gio'], { timeoutMs: 5_000 }).catch(() => undefined)
      const temGio = gio !== undefined && gio.exitCode === 0
      const rms = perigos.filter(p => p.tipo === 'rm' && podeLixeira(p))
      const novo = reescreverParaLixeira(e.command, rms.map(p => p.trecho), new Map(rms.map(p => [p.trecho, p.alvos])), temGio, marca)
      $.ui.toast(`Mandando para a lixeira (${temGio ? 'gio trash' : '~/.local/share/Trash'}) em vez de apagar.`, { timeoutMs: 8_000 })
      return next({ ...e, command: novo })
    }

    if (resposta === BACKUP && backup) {
      const r = await fazerBackup($, planos.filter(x => x !== undefined), marca)
      if ('erro' in r) {
        $.ui.toast(`Backup falhou — o comando NÃO rodou. (${r.erro})`, { timeoutMs: 10_000 })
        return { deny: `freio-de-mao: o backup antes do comando falhou (${r.erro}), então o comando não rodou. Avise o usuário.` }
      }
      $.ui.toast(`Backup feito em ${r.pasta}`, { timeoutMs: 10_000 })
      return next(e)
    }

    // Cancelar ou texto livre: não roda.
    return {
      deny: `freio-de-mao: o usuário cancelou. O comando faria: ${resumo}. Não tente apagar por outro caminho; pergunte ao usuário como seguir.`,
    }
  })

  on('command.run', { command: 'freio' }, async $ => ({ text: textoFreio(await read($, paradas), await $.clock.now()) }))
}
