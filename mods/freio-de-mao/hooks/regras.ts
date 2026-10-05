// Freio de mão — lógica pura (sem $): acha comandos destrutivos num comando Bash,
// monta os comandos SEGUROS que medem o estrago, lê a saída deles e reescreve o
// trecho do rm para "mandar para a lixeira". Testada direto.
import { dividirTrechos, juntarTrechos, palavras, programa, resolver, semPrefixos } from './shell'
import type { Palavra } from './shell'

export type Tipo =
  | 'rm'
  | 'find'
  | 'truncate'
  | 'git-reset'
  | 'git-checkout'
  | 'git-restore'
  | 'git-clean'
  | 'git-push-force'
  | 'git-branch-D'
  | 'matar'
  | 'disco'
  | 'powershell'

/** Como medir sem apagar. `sh` roda por `sh -c` (só se o gate de segurança deixar); `argv` roda direto. */
export type Medicao = { sh: string } | { argv: string[]; listaDoErro?: true } | undefined

export type Perigo = {
  tipo: Tipo
  /** índice do trecho (para reescrever só ele) */
  trecho: number
  /** o trecho como foi escrito, sem espaços nas pontas */
  texto: string
  /** pasta onde o trecho roda (session.cwd + cd anteriores + git -C) */
  cwd: string
  sudo: boolean
  /** alvos como foram escritos (aspas preservadas) — para lixeira e backup */
  alvos: string[]
  medicao: Medicao
  /** por que não dá para medir (quando medicao é undefined) */
  semMedida?: string
  /** frase do que acontece */
  efeito: string
  /** um cd/-C antes usou variável, ~ ou -: não sabemos em que pasta roda */
  pastaIncerta?: true
}

const PERIGOSOS_SH = /[`;|&<>]|\$\(/

/** Gate de segurança: só montamos `sh -c` com alvos crus se não houver substituição de comando nem redirecionamento. */
export const seguroParaShell = (brutos: readonly string[]) => brutos.every(b => !PERIGOSOS_SH.test(b))

/** Aspas simples de shell. */
export const aspas = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

const RAIZ_PERIGOSA = /^(\/|~\/?|\$HOME\/?|\$\{HOME\}\/?|\/home\/?|\/\*|~\/\*|\.\/?\*?|\*)$/

/** Script que mede alvos de rm/truncate: N alvos, F arquivos, D pastas, B bytes, L lista curta. */
export const scriptMedirAlvos = (brutos: readonly string[], recursivo: boolean) =>
  [
    `set -- ${brutos.join(' ')}`,
    'for a in "$@"; do shift; if [ -e "$a" ] || [ -L "$a" ]; then set -- "$@" "$a"; fi; done',
    'echo "N $#"',
    '[ $# -eq 0 ] && exit 0',
    `P="${recursivo ? '' : '-maxdepth 0'}"`,
    'echo "F $(find -- "$@" $P -type f 2>/dev/null | wc -l)"',
    'echo "D $(find -- "$@" $P -type d 2>/dev/null | wc -l)"',
    'echo "B $(du -sbc -- "$@" 2>/dev/null | tail -n 1 | cut -f1)"',
    'for a in "$@"; do if [ -d "$a" ] && [ ! -L "$a" ]; then echo "L $a/"; else echo "L $a"; fi; done | head -n 15',
  ].join('\n')

/** Script que roda o find SEM -delete (troca por -print) e conta o que ele acharia. */
export const scriptMedirFind = (brutos: readonly string[]) =>
  [
    `find ${brutos.join(' ')} 2>/dev/null | { n=0; while IFS= read -r l; do n=$((n+1)); [ $n -le 15 ] && echo "L $l"; done; echo "N $n"; echo "F $n"; }`,
  ].join('\n')

const flagsDe = (args: readonly Palavra[]) => {
  const flags: string[] = []
  const resto: Palavra[] = []
  let fim = false
  for (const a of args) {
    if (!fim && a.valor === '--') fim = true
    else if (!fim && a.valor.startsWith('-') && a.valor !== '-') flags.push(a.valor)
    else resto.push(a)
  }
  return { flags, resto }
}

const temLetra = (flags: readonly string[], letra: RegExp, longa: string[]) =>
  flags.some(f => (f.startsWith('--') ? longa.includes(f) : letra.test(f.slice(1))))

const temGlob = (p: Palavra) => /[*?[]/.test(p.valor) && !/^['"]/.test(p.bruto)

/** Lê os trechos do comando e devolve o que é perigoso (vazio = deixa passar). */
export function analisar(comando: string, cwdSessao: string): Perigo[] {
  const perigos: Perigo[] = []
  let pasta = cwdSessao
  let incerta = false
  dividirTrechos(comando).forEach((t, indice) => {
    const texto = t.texto.trim()
    const { args, sudo } = semPrefixos(palavras(t.texto))
    const prog = programa(args[0])
    const progMin = prog.toLowerCase()
    const base = { trecho: indice, texto, cwd: pasta, sudo, ...(incerta && { pastaIncerta: true as const }) }

    if (prog === 'cd' || prog === 'pushd' || prog === 'popd') {
      const destino = args[1]?.valor
      if (prog === 'cd' && destino !== undefined && !/^[-~]|[`$*?]/.test(destino)) pasta = resolver(pasta, destino)
      else incerta = true // cd sem destino (= HOME), cd -, cd ~, cd $X, pushd/popd
      return
    }

    if (prog === 'rm' || prog === 'rmdir') {
      const { flags, resto } = flagsDe(args.slice(1))
      const recursivo = temLetra(flags, /[rR]/, ['--recursive'])
      if (prog === 'rm' && !recursivo && !resto.some(temGlob)) return
      if (prog === 'rmdir') return // rmdir só apaga pasta vazia
      const brutos = resto.map(p => p.bruto)
      const raiz = resto.find(p => RAIZ_PERIGOSA.test(p.valor))
      perigos.push({
        ...base,
        tipo: 'rm',
        alvos: brutos,
        medicao: raiz || !seguroParaShell(brutos) ? undefined : { sh: scriptMedirAlvos(brutos, recursivo) },
        ...(raiz && { semMedida: `PERIGO: apaga "${raiz.valor}" inteiro` }),
        efeito: 'apaga de vez (rm não usa lixeira)',
      })
      return
    }

    if (prog === 'find') {
      const vals = args.map(a => a.valor)
      const exec = vals.findIndex(v => v === '-exec' || v === '-execdir' || v === '-ok' || v === '-okdir')
      const execRm = exec >= 0 && ['rm', 'shred', 'unlink'].includes(programa(args[exec + 1]))
      if (!vals.includes('-delete') && !execRm) return
      const inicio = args.slice(1).findIndex(a => /^[-(!]/.test(a.valor))
      const caminhos = (inicio < 0 ? args.slice(1) : args.slice(1, inicio + 1)).map(a => a.bruto)
      const brutos = args.slice(1).map(a => (a.valor === '-delete' ? '-print' : a.bruto))
      perigos.push({
        ...base,
        tipo: 'find',
        alvos: caminhos.length > 0 ? caminhos : ['.'],
        medicao: execRm || !seguroParaShell(brutos) ? undefined : { sh: scriptMedirFind(brutos) },
        efeito: 'apaga cada arquivo que o find achar',
      })
      return
    }

    if (prog === 'truncate') {
      const resto: Palavra[] = []
      for (let i = 1; i < args.length; i++) {
        const v = args[i]!.valor
        if (v === '-s' || v === '-r' || v === '--size' || v === '--reference') i++
        else if (!v.startsWith('-')) resto.push(args[i]!)
      }
      const brutos = resto.map(p => p.bruto)
      perigos.push({
        ...base,
        tipo: 'truncate',
        alvos: brutos,
        medicao: seguroParaShell(brutos) ? { sh: scriptMedirAlvos(brutos, false) } : undefined,
        efeito: 'corta/zera o conteúdo dos arquivos',
      })
      return
    }

    if (prog === 'dd') {
      const of = args.find(a => a.valor.startsWith('of='))
      if (!of) return
      perigos.push({ ...base, tipo: 'disco', alvos: [], medicao: undefined, semMedida: `escreve por cima de ${of.valor.slice(3)}`, efeito: 'sobrescreve o destino byte a byte' })
      return
    }

    if (prog === 'mkfs' || prog.startsWith('mkfs.') || prog === 'wipefs') {
      perigos.push({ ...base, tipo: 'disco', alvos: [], medicao: undefined, semMedida: 'formata o disco/partição', efeito: 'apaga TUDO o que está no disco ou partição' })
      return
    }

    if (prog === 'pkill') {
      const { flags, resto } = flagsDe(args.slice(1))
      if (!temLetra(flags, /f/, ['--full'])) return
      const manter = args.slice(1).filter(a => !/^-(\d+|[A-Z]+|SIG[A-Z]+)$/.test(a.valor) && a.valor !== '--signal').map(a => a.valor)
      perigos.push({ ...base, tipo: 'matar', alvos: [], medicao: { argv: ['pgrep', '-a', ...manter] }, efeito: `encerra todo processo cuja linha de comando contém "${resto.map(r => r.valor).join(' ')}"` })
      return
    }
    if (prog === 'killall') {
      const { resto } = flagsDe(args.slice(1))
      const nomes = resto.map(r => r.valor).filter(v => !/^\d+$/.test(v))
      perigos.push({ ...base, tipo: 'matar', alvos: [], medicao: nomes.length ? { argv: ['pgrep', '-a', '-x', nomes.join('|')] } : undefined, efeito: `encerra todos os processos chamados ${nomes.join(', ')}` })
      return
    }
    if (prog === 'fuser') {
      const { flags, resto } = flagsDe(args.slice(1))
      if (!temLetra(flags, /k/, ['--kill'])) return
      perigos.push({ ...base, tipo: 'matar', alvos: [], medicao: { argv: ['fuser', '-v', ...resto.map(r => r.valor)], listaDoErro: true }, efeito: 'encerra quem estiver usando essa porta/arquivo' })
      return
    }

    if (progMin === 'remove-item' || progMin === 'ri' || progMin === 'del' || progMin === 'erase') {
      if (!args.some(a => /^-r(ecurse)?$/i.test(a.valor))) return
      perigos.push({ ...base, tipo: 'powershell', alvos: [], medicao: undefined, semMedida: 'não sei medir comando do Windows', efeito: 'apaga a pasta e tudo dentro' })
      return
    }
    if (progMin === 'rd' || progMin === 'rmdir.exe') {
      if (!args.some(a => /^\/s$/i.test(a.valor))) return
      perigos.push({ ...base, tipo: 'powershell', alvos: [], medicao: undefined, semMedida: 'não sei medir comando do Windows', efeito: 'apaga a pasta e tudo dentro' })
      return
    }

    if (prog === 'git') {
      let i = 1
      let gitCwd = pasta
      let gitIncerta = incerta
      const globais: string[] = []
      while (i < args.length && args[i]!.valor.startsWith('-')) {
        const v = args[i]!.valor
        if ((v === '-C' || v === '-c') && args[i + 1]) {
          if (v === '-C') {
            const d = args[i + 1]!.valor
            if (/^[-~]|[`$*?]/.test(d)) gitIncerta = true
            else gitCwd = resolver(gitCwd, d)
          }
          else globais.push(v, args[i + 1]!.valor)
          i += 2
        } else i++
      }
      const sub = args[i]?.valor
      const { flags, resto } = flagsDe(args.slice(i + 1))
      const caminhos = resto.map(r => r.valor)
      const g = { ...base, cwd: gitCwd, alvos: [] as string[], ...(gitIncerta && { pastaIncerta: true as const }) }
      const status = (extra: string[]): Medicao => ({ argv: ['git', ...globais, 'status', '--porcelain', ...extra] })

      if (sub === 'reset' && flags.includes('--hard')) {
        perigos.push({ ...g, tipo: 'git-reset', medicao: status([]), efeito: 'descarta TODAS as mudanças não commitadas (arquivos rastreados)' })
      } else if (sub === 'checkout' && (args.slice(i + 1).some(a => a.valor === '--') || caminhos.includes('.'))) {
        const ps = args.slice(i + 1).some(a => a.valor === '--') ? caminhos : ['.']
        perigos.push({ ...g, tipo: 'git-checkout', medicao: status(['--', ...ps]), efeito: 'descarta as mudanças não commitadas desses arquivos' })
      } else if (sub === 'restore' && caminhos.length > 0 && (!temLetra(flags, /S/, ['--staged']) || temLetra(flags, /W/, ['--worktree']))) {
        perigos.push({ ...g, tipo: 'git-restore', medicao: status(['--', ...caminhos]), efeito: 'descarta as mudanças não commitadas desses arquivos' })
      } else if (sub === 'clean' && temLetra(flags, /f/, ['--force'])) {
        const seco = flags
          .filter(f => f !== '--force' && f !== '-i' && f !== '--interactive')
          .map(f => (f.startsWith('--') ? f : '-' + f.slice(1).replace(/[fi]/g, '')))
          .filter(f => f !== '-')
        perigos.push({ ...g, tipo: 'git-clean', medicao: { argv: ['git', ...globais, 'clean', '-n', ...seco, ...(caminhos.length ? ['--', ...caminhos] : [])] }, efeito: 'apaga arquivos não rastreados (que o git nunca guardou)' })
      } else if (sub === 'push' && (flags.includes('--force') || temLetra(flags, /f/, []))) {
        perigos.push({ ...g, tipo: 'git-push-force', medicao: undefined, semMedida: 'não dá para medir sem consultar o remoto', efeito: 'reescreve o histórico no remoto: commits que só existem lá podem sumir' })
      } else if (sub === 'branch' && (flags.includes('-D') || (temLetra(flags, /d/, ['--delete']) && temLetra(flags, /f/, ['--force'])))) {
        const nome = caminhos[0] ?? ''
        perigos.push({ ...g, tipo: 'git-branch-D', medicao: nome ? { argv: ['git', ...globais, 'log', '--oneline', nome, '--not', '--remotes'] } : undefined, efeito: `apaga a branch ${nome} mesmo com commits que não estão em lugar nenhum` })
      }
    }
  })
  // Pasta incerta: medir na pasta errada daria "nada a perder" falso. Não mede, pergunta.
  return perigos.map(p =>
    p.pastaIncerta && p.tipo !== 'matar' && p.medicao !== undefined
      ? { ...p, medicao: undefined, semMedida: 'Não sei em que pasta isso roda (cd com variável, ~ ou - antes): não medi, confira você.' }
      : p,
  )
}

export type Medida = { n: number; arquivos?: number; pastas?: number; bytes?: number; lista: string[] }

/** Lê a saída de um script de medição ("N 3", "F 10", "L item"...). */
export function lerMedidaSh(saida: string): Medida {
  const m: Medida = { n: 0, lista: [] }
  for (const linha of saida.split('\n')) {
    const [k, ...r] = linha.split(' ')
    const v = r.join(' ')
    if (k === 'N') m.n = Number(v) || 0
    else if (k === 'F') m.arquivos = Number(v) || 0
    else if (k === 'D') m.pastas = Number(v) || 0
    else if (k === 'B') m.bytes = Number(v) || 0
    else if (k === 'L' && v !== '') m.lista.push(v)
  }
  return m
}

/** Lê a saída de um comando git/pgrep/fuser: uma linha por item. */
export function lerMedidaLinhas(tipo: Tipo, saida: string): Medida {
  let linhas = saida.split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '')
  if (tipo === 'git-reset') linhas = linhas.filter(l => !l.startsWith('??')) // reset --hard não mexe em não rastreados
  if (tipo === 'git-checkout' || tipo === 'git-restore') linhas = linhas.filter(l => !l.startsWith('??'))
  if (tipo === 'matar') linhas = linhas.filter(l => !/^\s*USER\s+PID/.test(l))
  if (tipo === 'git-clean') linhas = linhas.map(l => l.replace(/^Would remove /, ''))
  return { n: linhas.length, lista: linhas }
}

/** Caminhos (relativos à raiz do repo) que o git vai descartar — para o backup. */
export const caminhosDoStatus = (lista: readonly string[]) =>
  lista.map(l => {
    const c = l.slice(3)
    const seta = c.indexOf(' -> ')
    return (seta >= 0 ? c.slice(seta + 4) : c).replace(/^"(.*)"$/, '$1')
  })

export const tamanho = (bytes: number) => {
  const un = ['bytes', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < un.length - 1) {
    v /= 1024
    i++
  }
  return i === 0 ? `${v} bytes` : `${v.toFixed(1).replace('.', ',')} ${un[i]}`
}

/** Uma linha de resumo do estrago medido. */
export function resumoMedida(p: Perigo, m: Medida): string {
  if (p.tipo === 'rm' || p.tipo === 'truncate') {
    const partes = [`${m.arquivos ?? 0} arquivo(s)`]
    if (p.tipo === 'rm') partes.push(`${m.pastas ?? 0} pasta(s)`)
    if (m.bytes !== undefined) partes.push(tamanho(m.bytes))
    return `${p.tipo === 'rm' ? 'Vai apagar' : 'Vai cortar'}: ${partes.join(', ')}`
  }
  if (p.tipo === 'find') return `Vai apagar: ${m.n} item(ns) que o find acha`
  if (p.tipo === 'matar') return `Vai encerrar: ${m.n} processo(s)`
  if (p.tipo === 'git-branch-D') return `Commits que só existem nessa branch: ${m.n}`
  if (p.tipo === 'git-clean') return `Vai apagar: ${m.n} arquivo(s)/pasta(s) não rastreado(s)`
  return `Mudanças não commitadas que se perdem: ${m.n} arquivo(s)`
}

/** Nada a perder? Então nem pergunta (menos falso positivo). */
const absoluto = (bruto: string) => bruto.replace(/^['"]/, '').startsWith('/')

/**
 * Nada a perder? Então nem pergunta (menos falso positivo). Só quando a medição não
 * depende da pasta: alvos absolutos (rm/find/truncate) ou processos (matar). O shell do
 * Bash guarda o cd de comandos anteriores, então alvo relativo medido como "não existe"
 * pode existir na pasta onde o shell está — nesse caso pergunta. Git sempre pergunta.
 */
export const nadaAPerder = (p: Perigo, m: Medida) =>
  m.n === 0 &&
  (p.tipo === 'matar' || ((p.tipo === 'rm' || p.tipo === 'find' || p.tipo === 'truncate') && p.alvos.length > 0 && p.alvos.every(absoluto)))

/** Aviso quando a medição deu zero mas mesmo assim vamos perguntar. */
export const avisoZero = (p: Perigo) =>
  p.tipo.startsWith('git-')
    ? `Nada a perder em ${p.cwd} — confira se o shell está mesmo nesse repositório.`
    : `Não achei os alvos em ${p.cwd}; se o shell estiver em outra pasta, pode apagar coisas lá.`

export const podeLixeira = (p: Perigo) => p.tipo === 'rm' && !p.sudo && p.alvos.length > 0 && seguroParaShell(p.alvos)
export const podeBackup = (p: Perigo) =>
  !p.sudo &&
  (((p.tipo === 'rm' || p.tipo === 'find' || p.tipo === 'truncate') && p.alvos.length > 0 && seguroParaShell(p.alvos)) ||
    p.tipo === 'git-reset' ||
    p.tipo === 'git-checkout' ||
    p.tipo === 'git-restore' ||
    p.tipo === 'git-clean')

/** Marca de data para nomes: 20261005-143000. */
export const marcaDeData = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)

/** O trecho do rm vira "mandar para a lixeira" (gio trash, ou mv para a lixeira do Linux com .trashinfo). */
export function trechoLixeira(alvos: readonly string[], temGio: boolean, marca: string) {
  const lista = alvos.join(' ')
  if (temGio) return `gio trash -f -- ${lista}`
  return (
    `{ L="\${XDG_DATA_HOME:-$HOME/.local/share}/Trash"; mkdir -p "$L/files" "$L/info" && ` +
    `for f in ${lista}; do [ -e "$f" ] || [ -L "$f" ] || continue; ` +
    `p="$(realpath -s -- "$f")"; b="$(basename -- "$f").${marca}"; ` +
    `mv -- "$f" "$L/files/$b" && printf '[Trash Info]\\nPath=%s\\nDeletionDate=%s\\n' "$p" "$(date +%Y-%m-%dT%H:%M:%S)" > "$L/info/$b.trashinfo"; done; }`
  )
}

/** Reescreve o comando inteiro trocando só os trechos de rm indicados. */
export function reescreverParaLixeira(comando: string, indices: readonly number[], alvosPorIndice: ReadonlyMap<number, readonly string[]>, temGio: boolean, marca: string) {
  const trechos = dividirTrechos(comando)
  const novos = trechos.map((t, i) => {
    if (!indices.includes(i)) return t
    const alvos = alvosPorIndice.get(i) ?? []
    const antes = /^\s*/.exec(t.texto)?.[0] ?? ''
    const depois = /\s*$/.exec(t.texto)?.[0] ?? ''
    return { ...t, texto: `${antes}${trechoLixeira(alvos, temGio, marca)}${depois}` }
  })
  return juntarTrechos(novos)
}

/** Script de backup: copia os alvos (com a estrutura de pastas) para ~/.cache/inema-freio/<marca>/ e imprime a pasta. */
export const scriptBackup = (brutos: readonly string[], marca: string, raizGit: boolean) =>
  [
    raizGit ? 'cd "$(git rev-parse --show-toplevel)" || exit 3' : '',
    `D="\${XDG_CACHE_HOME:-$HOME/.cache}/inema-freio/${marca}"`,
    'mkdir -p "$D" || exit 2',
    `set -- ${brutos.join(' ')}`,
    'for a in "$@"; do shift; if [ -e "$a" ] || [ -L "$a" ]; then set -- "$@" "$a"; fi; done',
    '[ $# -gt 0 ] && { cp -a --parents -- "$@" "$D"/ || exit 1; }',
    'echo "$D"',
  ]
    .filter(Boolean)
    .join('\n')

/** Dono do repositório numa URL do GitHub: git@github.com:dono/x.git -> dono. */
export const donoDaUrl = (url: string) => /github\.com[:/]+([^/]+)\//i.exec(url)?.[1]

/** "dono=email" -> Map(dono minúsculo -> email minúsculo). */
export const lerContas = (lista: readonly string[]) => {
  const m = new Map<string, string>()
  for (const item of lista) {
    const i = item.indexOf('=')
    if (i > 0) m.set(item.slice(0, i).trim().toLowerCase(), item.slice(i + 1).trim().toLowerCase())
  }
  return m
}

/** Acha "git commit" / "git push" (para conferir a conta). */
export function acharCommitOuPush(comando: string, cwdSessao: string): { sub: 'commit' | 'push'; cwd: string; remoto?: string } | undefined {
  let pasta = cwdSessao
  let achado: { sub: 'commit' | 'push'; cwd: string; remoto?: string } | undefined
  for (const t of dividirTrechos(comando)) {
    const { args } = semPrefixos(palavras(t.texto))
    const prog = programa(args[0])
    if (prog === 'cd' && args[1] && !/[`$*?]/.test(args[1].valor)) {
      pasta = resolver(pasta, args[1].valor)
      continue
    }
    if (prog !== 'git') continue
    let i = 1
    let gitCwd = pasta
    while (i < args.length && args[i]!.valor.startsWith('-')) {
      if (args[i]!.valor === '-C' && args[i + 1]) {
        gitCwd = resolver(gitCwd, args[i + 1]!.valor)
        i += 2
      } else if (args[i]!.valor === '-c') i += 2
      else i++
    }
    const sub = args[i]?.valor
    if (sub === 'commit') achado ??= { sub, cwd: gitCwd }
    else if (sub === 'push') {
      const remoto = args.slice(i + 1).find(a => !a.valor.startsWith('-'))?.valor
      achado ??= { sub, cwd: gitCwd, ...(remoto !== undefined && { remoto }) }
    }
  }
  return achado
}
