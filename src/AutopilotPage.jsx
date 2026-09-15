import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Flame,
  MessageCircle,
  PauseCircle,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
  X,
} from 'lucide-react';
import Autopilot, { buildAutopilotQueue } from './Autopilot';
import {
  DEFAULT_AUTOMATION_SETTINGS,
  automationKindLabel,
  automationStatusLabel,
  cancelAutomationItem,
  loadAutomationDashboard,
  runAutomationsNow,
  saveAutomationSettings,
} from './automationBackend';
import './dashboard.css';
import './daily-pages.css';
import './daily-pages-dark.css';
import './automation.css';

const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(Number(value || 0));

function priorityLabel(priority) {
  if (priority === 'high') return 'Urgente';
  if (priority === 'medium') return 'Importante';
  return 'Revisar';
}

function prettyDate(value) {
  if (!value) return 'Agora';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Agora';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AutopilotPage({ leads, openLead, openWhatsApp, onAutopilotOutcome }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState({ ...DEFAULT_AUTOMATION_SETTINGS });
  const [outbox, setOutbox] = useState([]);
  const [automationLoading, setAutomationLoading] = useState(true);
  const [automationBusy, setAutomationBusy] = useState(false);
  const [automationNotice, setAutomationNotice] = useState('');
  const [automationError, setAutomationError] = useState('');
  const [canConfigure, setCanConfigure] = useState(true);
  const [workspaceName, setWorkspaceName] = useState('');
  const [demoAutomation, setDemoAutomation] = useState(false);

  const queue = useMemo(() => buildAutopilotQueue(leads), [leads]);
  const urgent = queue.filter(item => item.priority === 'high').length;
  const important = queue.filter(item => item.priority === 'medium').length;
  const value = queue.reduce((sum, item) => sum + Number(item.lead?.value || 0), 0);
  const activeAutomations = outbox.filter(item => ['pending', 'ready'].includes(item.status));
  const readyAutomations = outbox.filter(item => item.status === 'ready');

  const refreshAutomationDashboard = async () => {
    setAutomationError('');
    const dashboard = await loadAutomationDashboard();
    setSettings(dashboard.settings || { ...DEFAULT_AUTOMATION_SETTINGS });
    setOutbox(dashboard.outbox || []);
    setCanConfigure(dashboard.canConfigure !== false);
    setWorkspaceName(dashboard.workspaceName || '');
    setDemoAutomation(Boolean(dashboard.demo));
  };

  useEffect(() => {
    let active = true;
    setAutomationLoading(true);
    loadAutomationDashboard()
      .then(dashboard => {
        if (!active) return;
        setSettings(dashboard.settings || { ...DEFAULT_AUTOMATION_SETTINGS });
        setOutbox(dashboard.outbox || []);
        setCanConfigure(dashboard.canConfigure !== false);
        setWorkspaceName(dashboard.workspaceName || '');
        setDemoAutomation(Boolean(dashboard.demo));
      })
      .catch(error => {
        if (active) setAutomationError(error?.message || 'Não foi possível carregar as automações.');
      })
      .finally(() => {
        if (active) setAutomationLoading(false);
      });
    return () => { active = false; };
  }, []);

  const changeSetting = (key, value) => {
    setSettings(current => ({ ...current, [key]: value }));
    setAutomationNotice('');
  };

  const saveSettings = async () => {
    setAutomationBusy(true);
    setAutomationError('');
    setAutomationNotice('');
    try {
      const saved = await saveAutomationSettings(settings);
      setSettings(saved);
      setAutomationNotice(demoAutomation ? 'Configuração salva nesta demonstração.' : 'Automações atualizadas. O motor já usa essas regras.');
    } catch (error) {
      setAutomationError(error?.message || 'Não foi possível salvar as automações.');
    } finally {
      setAutomationBusy(false);
    }
  };

  const runNow = async () => {
    setAutomationBusy(true);
    setAutomationError('');
    setAutomationNotice('');
    try {
      if (canConfigure) await saveAutomationSettings(settings);
      const affected = await runAutomationsNow();
      await refreshAutomationDashboard();
      setAutomationNotice(demoAutomation
        ? 'Demonstração atualizada. Em uma conta real, o motor roda no servidor.'
        : affected > 0
          ? `${affected} ação${affected === 1 ? '' : 'ões'} processada${affected === 1 ? '' : 's'} agora.`
          : 'Motor executado. Nenhuma nova ação precisava ser criada agora.');
    } catch (error) {
      setAutomationError(error?.message || 'Não foi possível executar o motor agora.');
    } finally {
      setAutomationBusy(false);
    }
  };

  const cancelItem = async item => {
    setAutomationBusy(true);
    setAutomationError('');
    try {
      await cancelAutomationItem(item.id);
      await refreshAutomationDashboard();
      setAutomationNotice('Ação automática cancelada.');
    } catch (error) {
      setAutomationError(error?.message || 'Não foi possível cancelar essa ação.');
    } finally {
      setAutomationBusy(false);
    }
  };

  const leadFor = item => leads.find(lead => lead.id === item.lead_id);

  return (
    <main className="main-content dashboard-page autopilot-page-shell">
      <header className="dashboard-header">
        <div>
          <span className="dashboard-kicker">Automação de vendas</span>
          <h1>Autopilot</h1>
          <p>O Fuply acompanha o pipeline, cria próximos contatos e prepara follow-ups sem você precisar caçar lead por lead.</p>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="secondary-button" onClick={runNow} disabled={automationBusy || automationLoading}><RefreshCw size={17} className={automationBusy ? 'spin' : ''} /> Executar agora</button>
          <button type="button" className="primary-button" onClick={saveSettings} disabled={automationBusy || automationLoading || !canConfigure}><Save size={17} /> Salvar regras</button>
        </div>
      </header>

      <section className="automation-control-panel">
        <div className="automation-control-head">
          <div>
            <span className={`automation-engine-dot ${settings.enabled ? 'on' : 'off'}`} />
            <div><strong>{settings.enabled ? 'Motor automático ativo' : 'Motor automático pausado'}</strong><span>{workspaceName ? `${workspaceName} · ` : ''}verificação a cada 5 minutos</span></div>
          </div>
          <label className="automation-master-switch">
            <input type="checkbox" checked={Boolean(settings.enabled)} disabled={!canConfigure || automationLoading} onChange={event => changeSetting('enabled', event.target.checked)} />
            <span>{settings.enabled ? 'Ligado' : 'Pausado'}</span>
          </label>
        </div>

        <div className="automation-rule-grid">
          <article className={`automation-rule-card ${settings.first_contact_enabled ? 'active' : ''}`}>
            <div className="automation-rule-title"><div className="automation-rule-icon"><Bot size={18} /></div><div><strong>Novo lead</strong><span>Não deixa contato recém-chegado parado.</span></div></div>
            <label className="automation-inline-toggle"><input type="checkbox" checked={Boolean(settings.first_contact_enabled)} disabled={!canConfigure} onChange={event => changeSetting('first_contact_enabled', event.target.checked)} /><span>Automático</span></label>
            <div className="automation-rule-flow"><span>Lead entra</span><ArrowRight size={14} /><span>espera</span><select value={settings.first_contact_delay_minutes} disabled={!canConfigure || !settings.first_contact_enabled} onChange={event => changeSetting('first_contact_delay_minutes', Number(event.target.value))}><option value={0}>agora</option><option value={5}>5 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 h</option></select><ArrowRight size={14} /><strong>primeiro contato</strong></div>
          </article>

          <article className={`automation-rule-card ${settings.followup_enabled ? 'active' : ''}`}>
            <div className="automation-rule-title"><div className="automation-rule-icon"><Clock3 size={18} /></div><div><strong>Sem resposta</strong><span>Retoma negociações que ficaram silenciosas.</span></div></div>
            <label className="automation-inline-toggle"><input type="checkbox" checked={Boolean(settings.followup_enabled)} disabled={!canConfigure} onChange={event => changeSetting('followup_enabled', event.target.checked)} /><span>Automático</span></label>
            <div className="automation-rule-flow"><span>Sem interação</span><select value={settings.followup_delay_hours} disabled={!canConfigure || !settings.followup_enabled} onChange={event => changeSetting('followup_delay_hours', Number(event.target.value))}><option value={12}>12 h</option><option value={24}>24 h</option><option value={48}>2 dias</option><option value={72}>3 dias</option><option value={168}>7 dias</option></select><ArrowRight size={14} /><strong>follow-up</strong></div>
            <label className="automation-small-field"><span>Máximo de tentativas</span><select value={settings.max_followup_attempts} disabled={!canConfigure || !settings.followup_enabled} onChange={event => changeSetting('max_followup_attempts', Number(event.target.value))}>{[1, 2, 3, 4, 5].map(value => <option value={value} key={value}>{value}</option>)}</select></label>
          </article>

          <article className="automation-rule-card active">
            <div className="automation-rule-title"><div className="automation-rule-icon"><ShieldCheck size={18} /></div><div><strong>Proteções</strong><span>Impede o Fuply de insistir quando a situação mudou.</span></div></div>
            <label className="automation-protection"><input type="checkbox" checked={Boolean(settings.pause_on_response)} disabled={!canConfigure} onChange={event => changeSetting('pause_on_response', event.target.checked)} /><div><strong>Parar quando responder</strong><span>Cancela ações pendentes assim que uma resposta for registrada.</span></div></label>
            <label className="automation-protection"><input type="checkbox" checked={Boolean(settings.pause_on_stage_change)} disabled={!canConfigure} onChange={event => changeSetting('pause_on_stage_change', event.target.checked)} /><div><strong>Parar quando mudar de etapa</strong><span>Recalcula o acompanhamento quando a negociação avança.</span></div></label>
          </article>
        </div>

        <div className="automation-channel-note">
          <Send size={17} />
          <div><strong>Motor funcionando; canal de envio é a próxima conexão.</strong><span>Hoje o Fuply cria, agenda, prioriza e cancela as mensagens automaticamente. As ações ficam em “Pronta” até conectarmos WhatsApp Cloud API ou WAHA, sem fingir que abrir uma janela é envio automático.</span></div>
        </div>

        {!canConfigure && <div className="automation-warning"><PauseCircle size={16} /> Você pode acompanhar a fila, mas somente o dono da equipe altera as regras.</div>}
        {automationNotice && <div className="automation-success"><CheckCircle2 size={16} /> {automationNotice}</div>}
        {automationError && <div className="automation-error"><X size={16} /> {automationError}</div>}
      </section>

      <section className="automation-outbox-panel">
        <div className="dashboard-panel-head">
          <div><h2>Fila automática</h2><p>{activeAutomations.length ? `${activeAutomations.length} ações aguardando execução, ${readyAutomations.length} prontas agora.` : 'Nenhuma ação automática pendente agora.'}</p></div>
          <span className="automation-outbox-counter"><Send size={15} /> {readyAutomations.length} prontas</span>
        </div>
        <div className="automation-outbox-list">
          {automationLoading ? (
            <div className="dashboard-empty daily-empty"><RefreshCw size={24} className="spin" /><strong>Carregando automações</strong></div>
          ) : activeAutomations.length ? activeAutomations.slice(0, 8).map(item => {
            const lead = leadFor(item);
            return (
              <article className="automation-outbox-item" key={item.id}>
                <div className={`automation-outbox-status ${item.status}`}><span />{automationStatusLabel(item.status)}</div>
                <button type="button" className="automation-outbox-lead" onClick={() => lead && openLead(lead)} disabled={!lead}>
                  <strong>{lead?.name || 'Lead'}</strong>
                  <span>{automationKindLabel(item.kind)} · tentativa {item.attempt_no}</span>
                </button>
                <div className="automation-outbox-message"><span>{item.reason}</span><p>{item.message}</p></div>
                <time>{item.status === 'ready' ? 'Pronta agora' : prettyDate(item.scheduled_at)}</time>
                <div className="automation-outbox-actions">
                  {lead && <button type="button" onClick={() => openWhatsApp(lead)} title="Abrir WhatsApp"><MessageCircle size={16} /></button>}
                  <button type="button" onClick={() => cancelItem(item)} disabled={automationBusy} title="Cancelar ação"><X size={16} /></button>
                </div>
              </article>
            );
          }) : (
            <div className="dashboard-empty daily-empty"><CheckCircle2 size={28} /><strong>Fila limpa</strong><span>O motor não encontrou nenhuma ação automática pendente.</span></div>
          )}
        </div>
      </section>

      <section className="autopilot-page-hero">
        <div className="autopilot-page-icon"><Sparkles size={28} /></div>
        <div className="autopilot-page-copy">
          <span>Prioridade humana</span>
          <h2>{queue.length ? `${queue.length} oportunidades ainda merecem sua atenção` : 'Sua fila prioritária está limpa'}</h2>
          <p>{queue.length ? 'O motor resolve o repetitivo. Aqui ficam as negociações em que ainda vale você entrar, decidir e avançar.' : 'Nenhuma oportunidade urgente agora. Você pode focar em prospectar e alimentar o pipeline.'}</p>
        </div>
        <button type="button" className="autopilot-page-start" onClick={() => setOpen(true)}>
          <Sparkles size={17} /> {queue.length ? `Revisar ${queue.length}` : 'Abrir revisão'} <ArrowRight size={16} />
        </button>
      </section>

      <section className="dashboard-metrics" aria-label="Resumo do Autopilot">
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon red"><Flame size={18} /></div><div><span>Urgentes</span><strong>{urgent}</strong><small>prioridade alta</small></div></article>
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon purple"><Target size={18} /></div><div><span>Importantes</span><strong>{important}</strong><small>pedem revisão</small></div></article>
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon blue"><Sparkles size={18} /></div><div><span>Na fila</span><strong>{queue.length}</strong><small>ações recomendadas</small></div></article>
        <article className="dashboard-metric-card"><div className="dashboard-metric-icon green"><CheckCircle2 size={18} /></div><div><span>Valor em jogo</span><strong>{currency(value)}</strong><small>potencial priorizado</small></div></article>
      </section>

      <section className="autopilot-preview-panel">
        <div className="dashboard-panel-head">
          <div><h2>Próximas oportunidades</h2><p>O que ainda precisa de decisão humana.</p></div>
          <button type="button" onClick={() => setOpen(true)}>Revisar agora <ArrowRight size={15} /></button>
        </div>

        <div className="autopilot-preview-list">
          {queue.length ? queue.slice(0, 7).map((item, index) => (
            <article className="autopilot-preview-card" key={item.lead.id}>
              <span className="autopilot-rank">{index + 1}</span>
              <button type="button" className="autopilot-preview-lead" onClick={() => openLead(item.lead)}>
                <div className="dashboard-avatar">{item.lead.name.slice(0, 2).toUpperCase()}</div>
                <div><strong>{item.lead.name}</strong><span>{item.lead.status} · {currency(item.lead.value)}</span></div>
              </button>
              <div className="autopilot-preview-reason">
                <strong className={`autopilot-priority ${item.priority}`}>{priorityLabel(item.priority)}</strong>
                <span>{item.reasons?.[0] || 'Revisar oportunidade'}</span>
              </div>
              <button type="button" className="autopilot-preview-whatsapp" onClick={() => openWhatsApp(item.lead)} aria-label={`Abrir WhatsApp de ${item.lead.name}`}><MessageCircle size={16} /></button>
            </article>
          )) : (
            <div className="dashboard-empty daily-empty"><CheckCircle2 size={28} /><strong>Nada urgente agora</strong><span>O Autopilot não encontrou oportunidades prioritárias.</span></div>
          )}
        </div>
      </section>

      <Autopilot
        open={open}
        onClose={() => setOpen(false)}
        leads={leads}
        openLead={openLead}
        openWhatsApp={openWhatsApp}
        onOutcome={onAutopilotOutcome}
      />
    </main>
  );
}
