import React from 'react';
import { Settings, Sparkles } from 'lucide-react';
import Messages from './Messages';
import { getActiveAccount } from './accountStorage';
import './comingsoon.css';

function loadLeads() {
  try {
    const saved = JSON.parse(localStorage.getItem('zapflow-leads'));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export default function ComingSoon({ type, goDashboard }) {
  if (type === 'Mensagens') {
    const account = getActiveAccount();
    const leads = loadLeads();
    const openWhatsApp = (lead, message = '') => {
      const phone = normalizePhone(lead.phone);
      if (!phone) return;
      const text = message ? `?text=${encodeURIComponent(message)}` : '';
      window.open(`https://wa.me/${phone}${text}`, '_blank', 'noopener,noreferrer');
    };
    return <Messages leads={leads} openWhatsApp={openWhatsApp} userId={account?.id || ''} />;
  }

  return (
    <main className="main-content comingsoon-page">
      <section className="comingsoon-card">
        <div className="comingsoon-icon"><Settings size={26} /></div>
        <span className="comingsoon-kicker"><Sparkles size={13} /> Em breve</span>
        <h1>{type}</h1>
        <p>As configurações completas entram depois que o núcleo do ZapFlow estiver fechado e testado.</p>
        <button className="primary-button" onClick={goDashboard}>Voltar ao Dashboard</button>
      </section>
    </main>
  );
}
