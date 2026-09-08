import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MessageCircle, Plus, Search, Trash2, ExternalLink } from 'lucide-react';
import './styles.css';

const STATUS = ['Não respondido', 'Em andamento', 'Trabalhando', 'Vendido', 'Descartado'];

function App() {
  const [leads, setLeads] = useState(() => {
    try { return JSON.parse(localStorage.getItem('whatscrm-leads')) || []; } catch { return []; }
  });
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', status: 'Não respondido', notes: '' });

  useEffect(() => localStorage.setItem('whatscrm-leads', JSON.stringify(leads)), [leads]);

  const filtered = useMemo(() => leads.filter(l =>
    `${l.name} ${l.phone} ${l.status} ${l.notes}`.toLowerCase().includes(query.toLowerCase())
  ), [leads, query]);

  const addLead = e => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setLeads([{ id: crypto.randomUUID(), ...form, createdAt: Date.now() }, ...leads]);
    setForm({ name: '', phone: '', status: 'Não respondido', notes: '' });
  };

  const updateStatus = (id, status) => setLeads(leads.map(l => l.id === id ? { ...l, status } : l));
  const remove = id => setLeads(leads.filter(l => l.id !== id));
  const whatsapp = phone => `https://wa.me/${phone.replace(/\D/g, '')}`;

  return <main className="shell">
    <header>
      <div className="brand"><MessageCircle size={30}/><div><h1>WhatsCRM</h1><p>Prospecção simples, sem planilha infernal.</p></div></div>
      <div className="stats"><strong>{leads.length}</strong><span>leads</span><strong>{leads.filter(l => l.status === 'Vendido').length}</strong><span>vendidos</span></div>
    </header>

    <section className="panel">
      <h2>Novo contato</h2>
      <form onSubmit={addLead} className="lead-form">
        <input placeholder="Nome do estabelecimento" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
        <input placeholder="WhatsApp / telefone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
        <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{STATUS.map(s=><option key={s}>{s}</option>)}</select>
        <input placeholder="Observações" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
        <button><Plus size={18}/> Adicionar</button>
      </form>
    </section>

    <section className="panel">
      <div className="toolbar"><h2>Negociações</h2><label className="search"><Search size={17}/><input placeholder="Buscar..." value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
      {filtered.length === 0 ? <div className="empty">Nenhum contato ainda. Adicione o primeiro lead acima.</div> :
      <div className="table-wrap"><table><thead><tr><th>Estabelecimento</th><th>Telefone</th><th>Status</th><th>Observações</th><th>Ações</th></tr></thead><tbody>
        {filtered.map(l=><tr key={l.id}>
          <td><strong>{l.name}</strong></td><td>{l.phone}</td>
          <td><select className="status" value={l.status} onChange={e=>updateStatus(l.id,e.target.value)}>{STATUS.map(s=><option key={s}>{s}</option>)}</select></td>
          <td>{l.notes || '—'}</td>
          <td className="actions"><a href={whatsapp(l.phone)} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><ExternalLink size={18}/></a><button onClick={()=>remove(l.id)} title="Excluir"><Trash2 size={18}/></button></td>
        </tr>)}
      </tbody></table></div>}
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
