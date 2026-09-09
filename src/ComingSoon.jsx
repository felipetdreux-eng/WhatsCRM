import React from 'react';
import { MessagesSquare, Settings, Sparkles } from 'lucide-react';
import './comingsoon.css';

export default function ComingSoon({ type, goDashboard }) {
  const isMessages = type === 'Mensagens';
  const Icon = isMessages ? MessagesSquare : Settings;
  return (
    <main className="main-content comingsoon-page">
      <section className="comingsoon-card">
        <div className="comingsoon-icon"><Icon size={26} /></div>
        <span className="comingsoon-kicker"><Sparkles size={13} /> Em breve</span>
        <h1>{type}</h1>
        <p>{isMessages
          ? 'Esta será a última etapa do MVP: modelos de primeiro contato, follow-up, proposta e última tentativa. Por enquanto, o botão funciona e deixa claro que a função ainda não foi liberada.'
          : 'As configurações completas entram depois que o núcleo do ZapFlow estiver fechado e testado.'}</p>
        <button className="primary-button" onClick={goDashboard}>Voltar ao Dashboard</button>
      </section>
    </main>
  );
}
