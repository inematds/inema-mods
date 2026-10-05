// faixa-publicacao — depois de um "git push" que deu certo, mostra para onde foi
// e lembra que o deploy (Vercel/GitHub Pages) é automático. Se "remotos_permitidos"
// estiver preenchido e o remoto não estiver lá, mostra um alerta.
import type { EngineInterface, Register } from 'claude-code'

import { acharPush, permitido, urlCurta } from './regras'
import type { Push } from './regras'

async function git($: EngineInterface, cwd: string, args: string[]) {
  const r = await $.process.run(['git', ...args], { cwd, timeoutMs: 5_000 }).catch(() => undefined)
  return r && r.exitCode === 0 ? r.stdout.trim() : ''
}

async function avisar($: EngineInterface, push: Push, permitidos: readonly string[]) {
  let remoto = push.remoto
  let branch = push.branch
  if (remoto === undefined || branch === undefined) {
    // Sem remoto/branch no comando: o git usa o upstream da branch atual.
    const up = await git($, push.cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
    const barra = up.indexOf('/')
    if (remoto === undefined) remoto = barra > 0 ? up.slice(0, barra) : 'origin'
    if (branch === undefined) {
      branch = barra > 0 && up.slice(0, barra) === remoto ? up.slice(barra + 1) : await git($, push.cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
    }
  }
  const url = /[:/]/.test(remoto) ? remoto : await git($, push.cwd, ['remote', 'get-url', remoto])
  const onde = `${remoto}/${branch || '?'}${url && url !== remoto ? ` (${urlCurta(url)})` : ''}`
  $.ui.toast(`Push feito em ${onde}. O deploy é automático (Vercel/Pages) — não precisa fazer mais nada.`, { timeoutMs: 8_000 })
  if (!permitido(permitidos, remoto, url)) {
    $.ui.toast(
      `ATENÇÃO: ${urlCurta(url || remoto)} não está em "remotos permitidos" (/config). Confira se o push era para esse destino.`,
      { timeoutMs: 15_000 },
    )
  }
}

export const register: Register = (on, options) => {
  const permitidos = Array.isArray(options.remotos_permitidos) ? options.remotos_permitidos : []

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (e.run_in_background === true) return ran
    if (ran.deny !== undefined || ran.isError === true) return ran
    const push = acharPush(e.command, await $.session.cwd())
    if (push) await avisar($, push, permitidos).catch(() => undefined)
    return ran
  })
}
