from pathlib import Path
import re

app = Path('src/App.jsx')
text = app.read_text()

if "import CentralDoDia from './CentralDoDia';" not in text:
    text = text.replace(
        "import Dashboard from './Dashboard';\n",
        "import Dashboard from './Dashboard';\nimport CentralDoDia from './CentralDoDia';\nimport AutopilotPage from './AutopilotPage';\n",
        1,
    )

if "  Sparkles,\n" not in text:
    text = text.replace("  Search,\n", "  Search,\n  Sparkles,\n", 1)

old_nav = """const NAV_ITEMS = [
  ['Dashboard', LayoutDashboard],
  ['Pipeline', ListFilter],
  ['Leads', UsersRound],
  ['Mensagens', MessagesSquare],
  ['Configurações', Settings],
];"""
new_nav = """const NAV_ITEMS = [
  ['Dashboard', LayoutDashboard],
  ['Central do Dia', CalendarClock],
  ['Autopilot 2.0', Sparkles],
  ['Pipeline', ListFilter],
  ['Leads', UsersRound],
  ['Mensagens', MessagesSquare],
  ['Configurações', Settings],
];"""
if old_nav in text:
    text = text.replace(old_nav, new_nav, 1)
elif "['Central do Dia', CalendarClock]" not in text:
    raise SystemExit('NAV_ITEMS pattern not found')

old_render = """    if (activePage === 'Dashboard') return <Dashboard leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onAutopilotOutcome={applyAutopilotOutcome} onNewLead={() => openNewLead()} goPipeline={() => setActivePage('Pipeline')} goFollowUps={() => setActivePage('Leads')} />;
    if (activePage === 'Leads') return <FollowUps leads={leads} setLeads={setLeads} openLead={openLead} openWhatsApp={openWhatsApp} updateLeadStatus={requestStatusChange} onNewLead={() => openNewLead()} onActivity={handleLeadActivity} />;"""
new_render = """    if (activePage === 'Dashboard') return <Dashboard leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onNewLead={() => openNewLead()} goPipeline={() => setActivePage('Pipeline')} goFollowUps={() => setActivePage('Leads')} />;
    if (activePage === 'Central do Dia') return <CentralDoDia leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onNewLead={() => openNewLead()} goPipeline={() => setActivePage('Pipeline')} goFollowUps={() => setActivePage('Leads')} />;
    if (activePage === 'Autopilot 2.0') return <AutopilotPage leads={leads} openLead={openLead} openWhatsApp={openWhatsApp} onAutopilotOutcome={applyAutopilotOutcome} />;
    if (activePage === 'Leads') return <FollowUps leads={leads} setLeads={setLeads} openLead={openLead} openWhatsApp={openWhatsApp} updateLeadStatus={requestStatusChange} onNewLead={() => openNewLead()} onActivity={handleLeadActivity} />;"""
if old_render in text:
    text = text.replace(old_render, new_render, 1)
elif "activePage === 'Central do Dia'" not in text:
    raise SystemExit('renderActivePage pattern not found')

app.write_text(text)

dash = Path('src/Dashboard.jsx')
d = dash.read_text()
d = d.replace("import React, { useMemo, useState } from 'react';", "import React, { useMemo } from 'react';", 1)
d = d.replace("  Sparkles,\n", "", 1)
d = d.replace("import Autopilot, { buildAutopilotQueue } from './Autopilot';\n", "", 1)
d = d.replace(
    "export default function Dashboard({ leads, openLead, openWhatsApp, onAutopilotOutcome, onNewLead, goPipeline, goFollowUps }) {\n  const [autopilotOpen, setAutopilotOpen] = useState(false);\n",
    "export default function Dashboard({ leads, openLead, openWhatsApp, onNewLead, goPipeline, goFollowUps }) {\n",
    1,
)

autopilot_calc = """    const autopilotQueue = buildAutopilotQueue(leads);
    const autopilotHigh = autopilotQueue.filter(item => item.priority === 'high').length;
    const autopilotValue = autopilotQueue.reduce((sum, item) => sum + Number(item.lead.value || 0), 0);

"""
d = d.replace(autopilot_calc, '', 1)
d = d.replace("      autopilotQueue,\n      autopilotHigh,\n      autopilotValue,\n", "", 1)

if 'className="autopilot-dashboard"' in d:
    d, count = re.subn(
        r'\n      <section className="autopilot-dashboard"[\s\S]*?\n      </section>\n',
        '\n',
        d,
        count=1,
    )
    if count != 1:
        raise SystemExit('Autopilot dashboard section not found')

if '\n      <Autopilot\n' in d:
    d, count = re.subn(
        r'\n      <Autopilot\n[\s\S]*?\n      />\n',
        '\n',
        d,
        count=1,
    )
    if count != 1:
        raise SystemExit('Autopilot modal block not found')

dash.write_text(d)
