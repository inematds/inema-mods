# mapa-calor

**"Onde está o peso deste projeto?"** — um mapa de calor das pastas.

`/mapa` percorre as pastas do projeto e mostra uma linha por pasta de primeiro nível, com uma barra proporcional e uma cor pela intensidade (vermelho = a maior, depois amarelo, verde e ciano). Arquivos soltos na raiz aparecem como "(arquivos soltos na raiz)".

O mod **só lê a lista de arquivos** (nome e tamanho). Não abre o conteúdo de nada.

## Comandos

| Comando | O que faz |
|---|---|
| `/mapa` | Lê as pastas de novo e abre o painel, ordenado por **número de arquivos** |
| `/mapa bytes` | Alterna entre número de arquivos e **tamanho** (sem reler as pastas) |
| `/mapa arquivos` | Volta para número de arquivos |
| `/mapa reler` | Lê as pastas de novo sem mudar o modo |

No painel: **[ver por tamanho / ver por arquivos]** (tecla `t`) e **[ler de novo]** (tecla `r`), com o painel em foco.

## Opções (`/config`)

- **Pastas ignoradas**: padrão `.git,node_modules,.next,dist,build,venv,.venv,__pycache__`.
- **Profundidade máxima**: padrão 3 níveis.
- **Máximo de arquivos lidos**: padrão 5000. Passou disso, o mapa para e avisa que os números estão incompletos.

## Limites (honestos)

- Arquivos mais fundos que a profundidade máxima **não entram na conta** (a pasta aparece, mas pode parecer menor do que é). Aumente a profundidade se precisar.
- Atalhos (links simbólicos) são pulados, para não contar a mesma coisa duas vezes nem entrar em laço.
- A barra é feita com caracteres `█`/`░` e cores do texto, para funcionar igual no terminal e no app desktop.
- Projeto muito grande pode levar alguns segundos na primeira leitura.

Testado com Claude Code 2.1.289 (API de mods em acesso antecipado).
