# Como fazer um mod neste repo (regras aprendidas na prática — Claude Code 2.1.289)

Modelo pronto e aprovado: `mods/recibo-sessao/` — copie a estrutura dele.

## Estrutura (obrigatória)

```
mods/<nome>/
  .claude-plugin/plugin.json   {name, version "0.1.0", description PT, author INEMA, types?, userConfig?}
  hooks/hooks.json             { "modules": ["./register.tsx"] }
  hooks/register.tsx           export const register: Register = (on, options) => { ... }
  types/index.d.ts             só se usar $.state (atom): interface PluginState { '<nome>': {...} }
  tests/mundo.ts               cópia de mods/recibo-sessao/tests/mundo.ts (ajuste se precisar de mais mocks)
  tests/<nome>.test.ts         testes do comportamento pedido
  README.md                    PT: o que faz, como ligar/desligar, comandos, opções (/config), limites
```

## Verificação (tem que passar antes de dizer "pronto")

```
TSC=~/projetos/polyskill/node_modules/.bin/tsc scripts/checar-mod.sh mods/<nome>
```
Roda `claude plugin validate` + `tsc` contra os tipos do engine + `claude plugin test`. As 3 linhas têm que dar `ok`.

## Fonte da verdade da API

- Tipos: `ls -t /tmp/claude-*/bundled-skills/*/*/plugin-authoring/types/claude-code.d.ts | head -1` (20 mil linhas — use grep: `'tool.call'`, `Pane: {`, `export type UsageSnapshot`...). Nunca adivinhe nome de campo.
- Guia longo: `reference.md` na mesma pasta da skill (`.../plugin-authoring/reference.md`) e exemplos em `.../plugin-authoring/examples/`.
- Mod oficial da Anthropic com testes ricos: `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/code-modernization/` (veja `tests/fixtures/world.ts` para mocks de fs.list, env, ui.*).

## Pegadinhas que já custaram tempo

1. **`$` só pode ser passado para função declarada no topo do arquivo** (`async function x($: EngineInterface, ...)` ou `const x = function...` no topo). Função auxiliar definida dentro de `register` que recebe `$` → o módulo NÃO carrega. Fora isso, `$` é sempre `$.noun.metodo(...)`.
2. Nada de `import()` dinâmico, `require`, Node, DOM. Só `import` estático de arquivos do próprio mod.
3. Testes: nada responde por baixo do plugin — o `mundo.ts` responde `session.start`, `prompt.submit`, `fs.*`, `store.*`, `command.register`, `ui.open/toast/status`, `prompt.fill`, `process.run` e chama `mock.clock(on)`. Se o mod usa outro noun (`session.usage`, `ui.ask`, `fs.list`, `env.get`, `agent.spawn`...), acrescente o mock (`on('<noun>.<metodo>', ...)`) — a mensagem de erro diz exatamente qual falta.
4. `$.prompt.submit` no teste precisa de `{ text, origin: { kind: 'composer' }, wait: false }` (helper `prompt()` no mundo.ts).
5. `FsStat` exige `isLink`.
6. Ferramenta que falhou: `ran.deny === undefined && ran.isError !== true` = sucesso.
7. Use `$.clock.now()`, nunca `Date.now()` (o teste mocka o relógio).
8. Estado que o desenho lê vai em `$.state` via `atom/read/update` (de `'claude-code'`) com contrato em `types/index.d.ts` e `"types": "./types/index.d.ts"` no plugin.json. Render hook nunca escreve estado.
9. Pane aberto sem pedido só vira barra lateral com ≥144 colunas/fullscreen; prefira abrir por comando (`/x`) ou botão.
10. Terminal: sem `Svg`; grade colorida = um `Raster`, nunca um Box por célula.
11. **A faixa acima do prompt (`AbovePrompt`) é UMA para todos os plugins.** Para conviver com outros mods: `const resto = await next(e)` e devolva um Box column com a sua linha + `resto`; sem nada a mostrar, `return next(e)`. No teste, ponha um `ui.render` por baixo que devolva `{ type: 'Text', children: [''] }`.
12. `key` em `Text` some na árvore desenhada (só `Box`/`Button` guardam). No teste, busque Text por texto: `ui.find({ type: 'Text', text: /.../ })`.
13. O contrato `types/index.d.ts` precisa exportar ao menos um tipo (`export {}` faz o validate falhar).
14. No teste, persistência via `mock.store(on, { chave: valor })`.
15. `turn.start` precisa de mock (`({ turnId: e.turnId })`); `turn.step` é stream: leia com `for await` antes de `.result`. Tipo `Engine` vem de `'claude-code/testing'`.
16. `$.command.run` dentro de um hook que o turno espera é recusado (fica na fila até a sessão ficar livre): dispare com `$.clock.after(0, ...)`; no teste, `relogio.settle()`.
18. No teste, todos os `on(...)` (mocks) vêm ANTES da primeira chamada a `$` ("on(...) after the test first called $").
19. Mock de `fs.list` precisa de `mtimeMs` em cada entrada. `session.messages`, `ui.copy`, `session.id`, `session.end` também precisam de mock (o `mundo.ts` dos mods de painel já responde).
20. `Raster` só existe no terminal; para barra que funcione no desktop use caracteres `█░` com cor de texto. `Code format: 'diff'` funciona nos dois.
21. Em `PluginState`, o item do mod precisa ser um objeto literal ali mesmo (apontar para um tipo nomeado dá "not declared").
22. Recusa de permissão chega no `tool.call` como `isError: true` (igual a erro) — não dá para separar.
23. Hooks e testes usam o fuso da máquina; nos testes de data, use meio-dia UTC.
17. Timers de `$.clock.every` morrem num reload do módulo. A skill diz que `session.start` dispara de novo no reload (então recria); um agente observou o contrário — não confirmado, conferir numa sessão real.

## Regras do kit INEMA (não negociáveis)

- **Mod nunca chama o modelo** (`$.model.complete`/`fork` gastam cota) **nem rede** (`$.http`) **nem API paga.** Só UI, arquivos locais e processos locais seguros.
- Mensagens em **português simples** (público leigo 30–40+). Símbolos simples, **sem emoji** (alinham em qualquer fonte, inclusive Windows).
- Tudo configurável vai em `userConfig` (aparece no `/config`): limiares, listas, idioma não (só PT por ora).
- Mod que pergunta (`$.ui.ask`) precisa de caminho para `claude -p`/sem tela: `.catch(...)` com padrão seguro e explícito (negar ou avisar o modelo — nunca prosseguir calado em ação destrutiva).
- Comandos com nome curto em PT (`/recibo`, `/freio`, `/clima`...).
- Não editar nada fora de `mods/<seu-mod>/`. Não rodar git. Não instalar plugin. Não escrever em `~/.claude/dev-mods`.

## Visto ao vivo (claude -p com --plugin-dir)

- `$.command.register` é RECUSADO se o usuário já tem skill/comando com o mesmo nome (ex.: skill `clima`), e o erro derruba o hook `session.start` inteiro. Registre cada comando com `.catch(...)` próprio e escolha nomes pouco comuns.
- Comandos de mod respondem sem chamar o modelo: `claude -p "/recibo" --plugin-dir mods/recibo-sessao` é um teste de fumaça barato.
- Comandos que gravam em `$.store` (on/off) persistem de verdade fora do teste: depois de testar ao vivo, volte ao padrão.
- `$.ui.ask` pode se resolver sozinho por ausência (`afkTimeoutMs`): a opção SEGURA vai em primeiro lugar.
