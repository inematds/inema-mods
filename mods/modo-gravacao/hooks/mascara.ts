// Mascaramento de dados sensíveis em texto, para o modo gravação.
// Função pura, sem dependência do engine: fácil de testar caso a caso.
// REDUZ o risco, não garante: padrão que a regex não conhece passa.

export type Regra = { nome: string; re: RegExp; troca: string | ((...m: string[]) => string) }

const ipValido = (ip: string) => ip.split('.').every(p => Number(p) <= 255)

// A ordem importa: blocos e linhas de .env primeiro (pegam o valor inteiro), depois
// tokens com prefixo conhecido, depois dados pessoais, dinheiro, IP e por fim a pasta
// do usuário.
export const REGRAS: Regra[] = [
  {
    nome: 'chave-privada',
    re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g,
    troca: '[chave privada oculta]',
  },
  {
    // Linha de .env: CHAVE=valor (com ou sem export, aspas ou espaços em volta do =).
    nome: 'env',
    re: /^(\s*(?:export\s+)?[A-Z][A-Z0-9_]*[A-Z0-9]\s*=\s*)(\S.*)$/gm,
    troca: (_m: string, chave: string) => `${chave}[oculto]`,
  },
  {
    // No meio da linha, só quando o nome tem cara de segredo: API_KEY=..., DB_PASSWORD="...".
    nome: 'env-inline',
    re: /\b([A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PASS|PWD|CREDENTIALS?)\s*=\s*)(["']?)[^\s"'`]+\2/gi,
    troca: (_m: string, chave: string, aspas: string) => `${chave}${aspas}[oculto]${aspas}`,
  },
  {
    // JSON/YAML com aspas: "api_key": "valor", "password": "valor"
    nome: 'json-segredo',
    re: /("[A-Za-z0-9_-]*(?:key|token|secret|password|passwd)"\s*:\s*)"[^"]+"/gi,
    troca: (_m: string, chave: string) => `${chave}"[oculto]"`,
  },
  {
    // Senha dentro de URL: https://usuario:senha@host
    nome: 'url-senha',
    re: /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]+@/gi,
    troca: (_m: string, inicio: string) => `${inicio}[oculto]@`,
  },
  { nome: 'bearer', re: /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}/g, troca: (_m: string, b: string) => `${b}[token]` },
  { nome: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]+){0,2}/g, troca: '[token]' },
  { nome: 'sk', re: /\bsk-[A-Za-z0-9_-]{16,}/g, troca: '[token]' },
  { nome: 'github', re: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, troca: '[token]' },
  { nome: 'aws', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, troca: '[token]' },
  { nome: 'slack', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g, troca: '[token]' },
  { nome: 'google', re: /\bAIza[0-9A-Za-z_-]{35}/g, troca: '[token]' },
  { nome: 'outros-tokens', re: /\b(?:gsk_|hf_|glpat-|npm_|xai-)[A-Za-z0-9_-]{20,}/g, troca: '[token]' },
  { nome: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, troca: '[e-mail]' },
  { nome: 'cnpj', re: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, troca: '[cnpj]' },
  { nome: 'cpf', re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, troca: '[cpf]' },
  {
    // Telefone BR: +55, (DDD), ou celular com hífen (98765-4321, 11 98765-4321).
    nome: 'telefone',
    re: /(?:\+55[\s-]?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b|\(\d{2}\)\s?9?\d{4}[\s-]?\d{4}\b|\b\d{2}\s9\d{4}-\d{4}\b|\b9\d{4}-\d{4}\b)/g,
    troca: '[telefone]',
  },
  // CPF, CNPJ ou celular com DDD sem pontuação: 11 ou 14 dígitos seguidos.
  // (13 dígitos é carimbo de tempo em milissegundos e fica.)
  { nome: 'digitos', re: /(?<![\d.])(?:\d{14}|\d{11})(?![\d.])/g, troca: '[número oculto]' },
  { nome: 'reais', re: /R\$\s?-?\d[\d.]*(?:,\d+)?/g, troca: 'R$ ***' },
  { nome: 'dolares', re: /US\$\s?-?\d[\d.,]*/g, troca: 'US$ ***' },
  // $12, $1.50, $1,234 — mas não $1 (parâmetro de shell) nem $HOME.
  { nome: 'dolar', re: /(?<![A-Za-z0-9$])\$(?:\d{2,}(?:[.,]\d+)*|\d(?:[.,]\d+)+)\b/g, troca: '$***' },
  {
    nome: 'ip',
    re: /(?<![\d.])(\d{1,3}(?:\.\d{1,3}){3})(?!\d|\.\d)/g,
    troca: (m: string, ip: string) => (ipValido(ip) && !/^(?:127\.|0\.0\.0\.0$)/.test(ip) ? '[ip]' : m),
  },
  { nome: 'home', re: /\/home\/[^/\s:'"`]+/g, troca: '~' },
  { nome: 'home-mac', re: /\/Users\/[^/\s:'"`]+/g, troca: '~' },
  { nome: 'home-windows', re: /\b[A-Za-z]:\\Users\\[^\\\s:'"`]+/g, troca: '~' },
]

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "extras" do /config: lista separada por vírgula. Termo entre barras (/regex/flags) é
// expressão regular; o resto é texto literal (sem diferença de maiúsculas). Regex
// inválida vira texto literal — nunca derruba o mascaramento.
export const regrasExtras = (extras: string): Regra[] =>
  extras
    .split(',')
    .map(t => t.trim())
    .filter(t => t !== '')
    .map((termo, i) => {
      const m = /^\/(.+)\/([a-z]*)$/.exec(termo)
      if (m) {
        try {
          const flags = (m[2] ?? '').includes('g') ? (m[2] ?? '') : `${m[2] ?? ''}g`
          return { nome: `extra${i}`, re: new RegExp(m[1] ?? '', flags), troca: '[oculto]' }
        } catch {
          // cai para literal
        }
      }
      return { nome: `extra${i}`, re: new RegExp(escapar(termo), 'gi'), troca: '[oculto]' }
    })

export const TEXTO_DE_FALHA = '[oculto pelo modo gravação]'

export const mascarar = (texto: string, extras: readonly Regra[] = []): string => {
  if (typeof texto !== 'string' || texto === '') return texto
  let saida = texto
  for (const regra of [...REGRAS, ...extras]) {
    try {
      regra.re.lastIndex = 0
      saida = saida.replace(regra.re, regra.troca as (...m: string[]) => string)
    } catch {
      // Uma regra que falhou não pode deixar o texto passar cru: esconde tudo.
      return TEXTO_DE_FALHA
    }
  }
  return saida
}

// Aplica `mascarar` em toda string de um valor (entrada/saída de ferramenta),
// mantendo a mesma forma: mesmas chaves, mesmos tipos, undefined continua undefined.
export const mascararTudo = (valor: unknown, extras: readonly Regra[] = [], fundo = 0): unknown => {
  if (typeof valor === 'string') return mascarar(valor, extras)
  if (fundo > 40 || valor === null || typeof valor !== 'object') return valor
  if (Array.isArray(valor)) return valor.map(v => mascararTudo(v, extras, fundo + 1))
  const saida: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) saida[k] = mascararTudo(v, extras, fundo + 1)
  return saida
}
