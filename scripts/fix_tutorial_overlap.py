from pathlib import Path

p = Path('src/Tutorial.jsx')
text = p.read_text()

replacements = {
"""    selector: '.dashboard-header-actions .primary-button',
    title: 'Adicione seu primeiro lead',""": """    selector: '.dashboard-header-actions .primary-button',
    side: 'left',
    title: 'Adicione seu primeiro lead',""",
"""    selector: '.leads-import-button',
    title: 'Já tem contatos? Importe sua planilha',""": """    selector: '.leads-import-button',
    side: 'left',
    title: 'Já tem contatos? Importe sua planilha',""",
"""    selector: '.leads-directory',
    title: 'Organize e atualize seus leads',""": """    selector: '.leads-search',
    side: 'right',
    title: 'Organize e atualize seus leads',""",
"""    selector: '.leads-summary',
    title: 'Marque quem precisa de retorno',""": """    selector: '.leads-summary button',
    side: 'right',
    title: 'Marque quem precisa de retorno',""",
"""    selector: '.pipeline-board .pipeline-column',
    title: 'Acompanhe cada negociação no Pipeline',""": """    selector: '.pipeline-board .pipeline-column',
    side: 'right',
    title: 'Acompanhe cada negociação no Pipeline',""",
"""    selector: '.messages-controls',
    title: 'Use mensagens prontas no WhatsApp',""": """    selector: '.messages-lead-picker',
    side: 'left',
    title: 'Use mensagens prontas no WhatsApp',""",
"""    selector: '.autopilot-dashboard',
    title: 'Deixe o Autopilot montar sua fila de vendas',""": """    selector: '.autopilot-dashboard-button',
    side: 'left',
    title: 'Deixe o Autopilot montar sua fila de vendas',""",
"""    selector: '.team-metrics-grid',
    title: 'Acompanhe o desempenho da equipe',""": """    selector: '.team-metric-card',
    side: 'right',
    title: 'Acompanhe o desempenho da equipe',""",
"""    selector: '.team-heading',
    title: 'Trabalhe com sua equipe sem dividir senha',""": """    selector: '.team-actions-grid .team-action-box',
    side: 'right',
    title: 'Trabalhe com sua equipe sem dividir senha',""",
"""    selector: '.focus-tabs',
    title: 'Comece o dia pelas prioridades',""": """    selector: '.focus-tabs > div',
    side: 'right',
    title: 'Comece o dia pelas prioridades',""",
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'missing tutorial block: {old[:60]}')
    text = text.replace(old, new, 1)

old_card = """  const cardStyle = isMobile
    ? { left: 14, right: 14, bottom: 14, top: 'auto', width: 'auto' }
    : { width: 380, left: '50%', top: 18, transform: 'translateX(-50%)' };
"""
new_card = """  const cardStyle = isMobile
    ? { left: 14, right: 14, bottom: 14, top: 'auto', width: 'auto' }
    : step.side === 'left'
      ? { width: 380, left: 18, right: 'auto', top: 18, transform: 'none' }
      : { width: 380, right: 18, left: 'auto', top: 18, transform: 'none' };
"""
if old_card not in text:
    raise SystemExit('cardStyle block not found')
text = text.replace(old_card, new_card, 1)

p.write_text(text)
