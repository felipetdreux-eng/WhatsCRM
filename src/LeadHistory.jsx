import React, { useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  History,
  MessageCircle,
  Pencil,
  Plus,
  Target,
} from 'lucide-react';
import { loadLeadActivities } from './backendBridge';

const ICONS = {
  lead_created: Plus,
  whatsapp_opened: MessageCircle,
  status_changed: Target,
  followup_scheduled: CalendarClock,
  followup_completed: CheckCircle2,
  sale_closed: CircleDollarSign,
  lead_updated: Pencil,
};

function formatActivityDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `Hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
}

export default function LeadHistory({ userId, leadId, demoMode = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    if (demoMode) {
      const now = new Date().toISOString();
      setItems([
        { id: `demo-${leadId}-3`, kind: 'followup_scheduled', title: 'Próximo contato agendado', detail: 'Retorno comercial programado para esta oportunidade.', createdAt: now },
        { id: `demo-${leadId}-2`, kind: 'whatsapp_opened', title: 'WhatsApp aberto', detail: 'Conversa aberta pelo Fuply.', createdAt: now },
        { id: `demo-${leadId}-1`, kind: 'lead_created', title: 'Lead criado', detail: 'Oportunidade adicionada ao pipeline da demonstração.', createdAt: now },
      ]);
      setError(''); setLoading(false); return;
    }
    if (!userId || !leadId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setItems(await loadLeadActivities(userId, leadId));
    } catch (loadError) {
      console.error('Lead activity history load failed:', loadError);
      setError('Não foi possível carregar o histórico agora.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const onRecorded = event => {
      if (!event.detail?.leadId || event.detail.leadId === leadId) refresh();
    };
    window.addEventListener('zapflow:activity-recorded', onRecorded);
    return () => window.removeEventListener('zapflow:activity-recorded', onRecorded);
  }, [userId, leadId, demoMode]);

  return (
    <section className="detail-card activity-card" aria-labelledby="lead-history-title">
      <div className="section-heading activity-heading">
        <div>
          <h2 id="lead-history-title">Histórico</h2>
          <p>O que aconteceu nesta negociação, em ordem cronológica.</p>
        </div>
        <History size={18} />
      </div>

      {loading ? (
        <div className="activity-empty">Carregando histórico...</div>
      ) : error ? (
        <div className="activity-error">{error}</div>
      ) : items.length ? (
        <div className="activity-list">
          {items.map(item => {
            const Icon = ICONS[item.kind] || History;
            return (
              <article className={`activity-item activity-${item.kind}`} key={item.id}>
                <div className="activity-icon"><Icon size={15} /></div>
                <div className="activity-copy">
                  <div><strong>{item.title}</strong><time>{formatActivityDate(item.createdAt)}</time></div>
                  {item.detail && <p>{item.detail}</p>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="activity-empty">
          <History size={19} />
          <strong>Histórico começando agora</strong>
          <span>Novas ações, follow-ups e mudanças de status aparecerão aqui.</span>
        </div>
      )}
    </section>
  );
}
