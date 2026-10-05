# FALHAS — inema-mods

| data | o que quebrou | menor correção | prompt \| infra |
|---|---|---|---|
| 2026-10-05 | clima-contexto: `/clima` recusado (usuário tem skill `clima`) derrubava o session.start e o `/handoff-agora` | comando virou `/contexto` e cada `command.register` tem `.catch` próprio | infra |
| 2026-10-05 | `$.ui.ask` pode se resolver sozinho por ausência com a 1ª opção; freio/guarda/vigia tinham "Prosseguir" primeiro | opção segura (Cancelar/Pular/Negar) em 1º lugar | prompt |
| 2026-10-05 | recibo-sessao não carregava: helper dentro de `register` recebia `$` | mover helper para função no topo do arquivo (regra do validador) | prompt |
