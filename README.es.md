# inema-mods — Kit INEMA de mods para Claude Code

**🇧🇷 [Português](README.md) · 🇺🇸 [English](README.en.md) · 🇪🇸 [Español](README.es.md)**

[![inema-mods — Kit INEMA de mods para Claude Code](guia/assets/banner-es.jpg)](https://inematds.github.io/inema-mods/guia/es/)

## 📖 Guía de uso

Guía completa (landing + paso a paso): **https://inematds.github.io/inema-mods/guia/es/**

**18 mods listos para usar**, para Claude Code: protecciones contra daños, un panel del contexto, recibo de lo que se creó y otros. Cada mod es un accesorio: lo enciendes, lo usas y lo apagas cuando quieras, sin tocar el motor.

> **Mod** es un pedazo de código que se mete en medio de lo que hace Claude Code: muestra cosas en pantalla (franja, panel, aviso), pregunta antes de una acción peligrosa o cambia la acción por otra más segura. No gasta crédito: ningún mod de este kit llama al modelo, a internet ni a un servicio de pago.

Probado en **Claude Code 2.1.289** (terminal y app de escritorio). La API de mods todavía está en pruebas ("early access") y puede cambiar entre versiones. Ver [Cuando Claude Code se actualice](#cuando-claude-code-se-actualice).

## Instalar (2 comandos)

```bash
claude plugin marketplace add inematds/inema-mods
claude plugin install freio-de-mao@inema-mods
```

Cambia `freio-de-mao` (freno de mano) por el mod que quieras (tabla de abajo). Después abre una sesión nueva o escribe `/reload-plugins`.

- Solo en este proyecto: agrega `--scope project`.
- Ver qué hace un mod antes de instalarlo: `claude plugin details freio-de-mao@inema-mods`, o lee `mods/freio-de-mao/hooks/register.tsx`.
- Ajustar opciones (umbrales, listas): `/config` dentro de Claude Code.

## Los 18 mods

### Protección

| Mod | Qué hace | Comando |
|---|---|---|
| [freio-de-mao](mods/freio-de-mao) | (freno de mano) Antes de `rm -rf`, `git reset --hard`, `push --force` y similares, mide el daño **sin borrar** (cuántos archivos, tamaño) y pregunta: Cancelar / Papelera / Respaldo y continuar / Continuar | `/freio` |
| [guarda-colisao](mods/guarda-colisao) | (guarda de colisión) Antes de editar un archivo que **otra sesión** cambió, pregunta si puede | `/colisao` |
| [vigia-api](mods/vigia-api) | (vigilante de API) Pregunta antes de usar un servicio de pago (generación de imagen/video, APIs), con autorización por 1 hora | `/vigia` |
| [modo-gravacao](mods/modo-gravacao) | (modo grabación) Para grabar video o en vivo: oculta en pantalla correos, claves, montos, documentos de identidad, teléfonos | `/gravar on` |
| [faixa-publicacao](mods/faixa-publicacao) | (franja de publicación) Después de `git push`, avisa dónde se publicó y que el deploy es automático | — |

### Contexto y sesión

| Mod | Qué hace | Comando |
|---|---|---|
| [clima-contexto](mods/clima-contexto) | (clima del contexto) Franja con el "clima" del contexto (despejado, nublado, lluvia, tormenta), límites de uso, botones [compactar] y [handoff] | `/contexto` |
| [linha-do-tempo](mods/linha-do-tempo) | (línea de tiempo) Panel turno por turno: modelo, herramientas, tokens, duración | `/timeline` |
| [roteador-subagente](mods/roteador-subagente) | (enrutador de subagentes) Hace que los subagentes corran en un modelo más pequeño (cuida la cuota) | `/router on` |
| [painel-longrun](mods/painel-longrun) | (panel de ejecución larga) Sigue una ejecución larga: objetivo, tiempo, checklist con % | `/longrun` |

### Productividad

| Mod | Qué hace | Comando |
|---|---|---|
| [recibo-sessao](mods/recibo-sessao) | (recibo de la sesión) "¿Qué creó Claude?" — lista de archivos creados/editados, con [abrir carpeta] | `/recibo` |
| [proximos-passos](mods/proximos-passos) | (próximos pasos) Convierte la lista de próximos pasos de la respuesta en botones | `/proximos` |
| [marcador-sessao](mods/marcador-sessao) | (marcador de sesión) Marca un punto de la conversación con un resumen, para retomarlo después | `/marcar <nombre>` |
| [replay-edicoes](mods/replay-edicoes) | (replay de ediciones) Reproduce las ediciones de la sesión paso a paso, con diff | `/replay` |
| [registrar-falha](mods/registrar-falha) | (registrar falla) Después de errores seguidos, ofrece registrar la falla en FALHAS.md | `/falha` |

### Aprender y visual

| Mod | Qué hace | Comando |
|---|---|---|
| [tradutor-acoes](mods/tradutor-acoes) | (traductor de acciones) Explica en español sencillo cada acción ("Editando archivo X"), sin esconder el comando real | `/tradutor` |
| [mapa-calor](mods/mapa-calor) | (mapa de calor) Mapa de las carpetas del proyecto por cantidad/tamaño | `/mapa` |
| [tema-inema](mods/tema-inema) | (tema INEMA) Pie de pantalla con marca, proyecto y hora, para transmisiones en vivo | `/tema on` |
| [bichinho](mods/bichinho) | (mascotita) Una mascotita que "se come" los archivos leídos (solo por diversión) | `/bichinho on` |

Cada carpeta tiene un README (en portugués) con comandos, opciones y **límites honestos** del mod.

## Botón de pánico

```bash
bash scripts/mods-off.sh            # apaga todos los plugins
bash scripts/mods-off.sh --inema    # quita solo los mods de este kit
bash scripts/mods-doctor.sh         # dice qué mods acepta todavía tu versión
```

## Crea tu propio mod

El mejor mod es el hecho a tu manera de trabajar. Prompts listos para copiar y pegar en [prompts/](prompts) (en portugués):

1. [Descubre los 5 mods que necesitas](prompts/01-auditoria-sugira-5-mods.md): Claude lee tus últimas sesiones y sugiere.
2. [Crea la "previsión del contexto"](prompts/02-criar-mod-previsao-do-contexto.md).
3. [Crea el "freno de mano"](prompts/03-criar-mod-freio-de-mao.md).

Para crear: escribe `/plugin-authoring` en Claude Code y describe el mod en lenguaje normal.

## Seguridad: lee antes de instalar mods de terceros

Un mod corre con tu usuario: puede leer archivos, ejecutar comandos y acceder a internet. Instala solo de fuentes en las que confíes y lee el `hooks/register.tsx`. En este kit:

- ningún mod llama al modelo, a internet ni a un servicio de pago;
- los mods de protección **reducen el riesgo, no lo garantizan**: la lista de comandos peligrosos nunca está completa, y el modo grabación no oculta todo (mira el README de cada uno);
- cuando no estás frente a la pantalla (`claude -p`), los mods de protección **niegan** en lugar de dejar pasar.

## Para quien desarrolla

```bash
scripts/checar-mod.sh mods/<nombre>    # claude plugin validate + tsc + claude plugin test
scripts/checar-mod.sh                  # todos
python3 scripts/gerar-marketplace.py
```

Reglas y trampas de la API, aprendidas en la práctica: [docs/COMO-FAZER-UM-MOD.md](docs/COMO-FAZER-UM-MOD.md) (en portugués).

### Cuando Claude Code se actualice

Ejecuta `bash scripts/mods-doctor.sh`. Si un mod se rompe, apágalo con `claude plugin disable <nombre>@inema-mods` y mira si el kit tiene una versión nueva (`claude plugin marketplace update inema-mods`).

---

Hecho por [INEMA.CLUB](https://inema.club): contenido abierto y gratuito sobre IA.
