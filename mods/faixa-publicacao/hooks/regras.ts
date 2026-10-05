// Acha o "git push" num comando e lê remoto/branch (sem $).
import { dividirTrechos, palavras, programa, resolver, semPrefixos } from './shell'

export type Push = {
  /** pasta onde o git roda (cd anterior e -C contam) */
  cwd: string
  /** remoto escrito no comando, ou undefined (= o do upstream / origin) */
  remoto?: string
  /** branch escrita no comando (destino do refspec), ou undefined */
  branch?: string
}

const FLAGS_COM_VALOR = new Set(['--repo', '--receive-pack', '--exec', '-o', '--push-option', '--signed'])

export function acharPush(comando: string, cwd: string): Push | undefined {
  let pasta = cwd
  let achado: Push | undefined
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
    if (args[i]?.valor !== 'push') continue
    const resto: string[] = []
    let seco = false
    for (let j = i + 1; j < args.length; j++) {
      const v = args[j]!.valor
      if (v === '--dry-run' || v === '-n') seco = true
      if (FLAGS_COM_VALOR.has(v)) j++
      else if (!v.startsWith('-')) resto.push(v)
    }
    if (seco) continue
    const [remoto, refspec] = resto
    let branch: string | undefined
    if (refspec !== undefined) {
      const destino = refspec.replace(/^\+/, '').split(':').pop() ?? ''
      branch = destino === '' || destino === 'HEAD' ? undefined : destino.replace(/^refs\/heads\//, '')
    }
    achado = { cwd: gitCwd, ...(remoto !== undefined && { remoto }), ...(branch !== undefined && { branch }) }
  }
  return achado
}

/** URL legível: git@github.com:dono/repo.git -> github.com/dono/repo */
export const urlCurta = (url: string) =>
  url
    .trim()
    .replace(/^[a-z+]+:\/\//, '')
    .replace(/^[^@/]+@/, '')
    .replace(/^([^/:]+):(?!\d)/, '$1/')
    .replace(/\.git$/, '')

export const permitido = (lista: readonly string[], remoto: string, url: string) => {
  const ativos = lista.map(s => s.trim()).filter(s => s !== '')
  if (ativos.length === 0) return true
  const alvo = [remoto, url, urlCurta(url)].map(s => s.toLowerCase())
  return ativos.some(p => alvo.some(a => a === p.toLowerCase() || a.includes(p.toLowerCase())))
}
