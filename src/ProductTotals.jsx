import React, { useMemo, useState } from 'react';
import { cleanItems } from './chefData.js';
import './order.css';

const CHECK_KEY = 'fuply-chef-checked';

function loadChecked() {
  try { return JSON.parse(localStorage.getItem(CHECK_KEY) || '{}'); } catch { return {}; }
}

// Soma de cada produto em todos os pedidos. Marque o item pra riscar da lista.
export default function ProductTotals({ leads }) {
  const [includeSent, setIncludeSent] = useState(false);
  const [checked, setChecked] = useState(loadChecked);

  const rows = useMemo(() => {
    const map = new Map();
    leads.filter(lead => includeSent || lead.status !== 'Enviado').forEach(lead => {
      cleanItems(lead.items).forEach(item => {
        const row = map.get(item.productId) || { id: item.productId, name: item.name, qty: 0, orders: 0 };
        row.qty += item.qty;
        row.orders += 1;
        map.set(item.productId, row);
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [leads, includeSent]);

  const toggle = id => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(next)); } catch { /* ignora */ }
  };

  return (
    <main className="main-content">
      <header className="page-header">
        <div><h1>Total por produto</h1><p>Quanto produzir de cada item. Marque pra riscar da lista.</p></div>
        <label className="orders-toggle"><input type="checkbox" checked={includeSent} onChange={e => setIncludeSent(e.target.checked)} /> Incluir já enviados</label>
      </header>
      <section className="orders-production">
        {rows.length === 0 ? <p className="orders-empty">Nenhum item ainda.</p> : (
          <ul className="product-totals">
            {rows.map(row => (
              <li key={row.id} className={checked[row.id] ? 'done' : ''}>
                <label>
                  <input type="checkbox" checked={!!checked[row.id]} onChange={() => toggle(row.id)} />
                  <span>{row.name}</span>
                </label>
                <b>{row.qty}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
