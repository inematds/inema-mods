// Lógica pura da guarda de colisão (sem $), testada direto.

export const FOLGA_MS = 1_000

/** Converte um padrão com * em regex: ** = qualquer coisa, * = qualquer coisa sem "/". */
const globParaRegex = (padrao: string) => {
  const escapado = padrao.replace(/[.+^${}()|[\]\\?]/g, '\\$&')
  const corpo = escapado.replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*')
  return new RegExp(`(^|/)${corpo}$`)
}

/**
 * O caminho casa algum padrão de `ignorar`?
 * - com `*`: glob no fim do caminho (`*.lock` casa `a/b/yarn.lock`);
 * - sem `*`: trecho do caminho ancorado em "/" (`dist/` casa `/x/dist/a.js`, não `/x/redist/a.js`).
 */
export const ignorado = (caminho: string, padroes: readonly string[]) => {
  const c = '/' + caminho.replace(/\\/g, '/').replace(/^\/+/, '')
  return padroes.some(bruto => {
    const p = bruto.trim().replace(/\\/g, '/')
    if (p === '') return false
    if (p.includes('*')) return globParaRegex(p).test(c)
    return c.includes(p.startsWith('/') ? p : '/' + p)
  })
}

/** Mudou fora desta sessão? `base` = mtime do meu último toque, ou o início da sessão. */
export const mudouFora = (mtimeMs: number, base: number) => mtimeMs > base + FOLGA_MS

export const haQuanto = (agora: number, mtimeMs: number) => {
  const min = Math.floor(Math.max(0, agora - mtimeMs) / 60_000)
  if (min < 1) return 'há menos de 1 min'
  if (min < 120) return `há ${min} min`
  return `há ${Math.floor(min / 60)} h`
}

export const instrucaoAoModelo = (caminho: string, quando: string) =>
  `guarda-colisao: ${caminho} foi mudado fora desta sessão (${quando}) — por outra sessão, por um editor ou por outro programa. ` +
  'Não edite em cima da versão antiga: releia o arquivo com Read e refaça a alteração sobre o conteúdo atual. ' +
  'Se não tiver certeza de que pode mexer nele, pergunte ao usuário.'
