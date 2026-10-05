#!/usr/bin/env python3
"""Gera .claude-plugin/marketplace.json a partir de mods/*/.claude-plugin/plugin.json."""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CATEGORIAS = {
    'guarda-colisao': 'seguranca', 'freio-de-mao': 'seguranca', 'vigia-api': 'seguranca',
    'modo-gravacao': 'seguranca', 'faixa-publicacao': 'seguranca',
    'clima-contexto': 'contexto', 'roteador-subagente': 'contexto', 'linha-do-tempo': 'contexto',
    'painel-longrun': 'produtividade', 'recibo-sessao': 'produtividade', 'marcador-sessao': 'produtividade',
    'proximos-passos': 'produtividade', 'registrar-falha': 'produtividade', 'replay-edicoes': 'produtividade',
    'tradutor-acoes': 'aprendizado', 'mapa-calor': 'aprendizado',
    'tema-inema': 'visual', 'bichinho': 'visual',
}

plugins = []
for manifesto in sorted(RAIZ.glob('mods/*/.claude-plugin/plugin.json')):
    dados = json.loads(manifesto.read_text())
    nome = dados['name']
    plugins.append({
        'name': nome,
        'description': dados.get('description', ''),
        'version': dados.get('version', '0.1.0'),
        'author': {'name': 'INEMA'},
        'category': CATEGORIAS.get(nome, 'outros'),
        'source': f'./mods/{manifesto.parent.parent.name}',
    })

saida = {
    '$schema': 'https://anthropic.com/claude-code/marketplace.schema.json',
    'name': 'inema-mods',
    'description': 'Kit INEMA de mods do Claude Code: proteções, contexto e produtividade, em português',
    'owner': {'name': 'INEMA', 'email': 'inematds@gmail.com'},
    'plugins': plugins,
}
destino = RAIZ / '.claude-plugin' / 'marketplace.json'
destino.parent.mkdir(exist_ok=True)
destino.write_text(json.dumps(saida, ensure_ascii=False, indent=2) + '\n')
print(f'{len(plugins)} mods em {destino.relative_to(RAIZ)}')
