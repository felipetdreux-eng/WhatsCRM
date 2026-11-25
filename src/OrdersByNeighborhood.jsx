import React, { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { cleanItems, itemsSummary, neighborhoodInfo, orderTotals } from './chefData.js';
import { currency } from './domain.js';
import './order.css';

const NO_NEIGHBORHOOD = 'Sem bairro definido';

export default function OrdersByNeighborhood({ leads, openLead, openWhatsApp }) {
  const { groups, production, totals } = useMemo(() => {
    const active = leads.filter(lead => lead.status !== 'Perdido' && (cleanItems(lead.items).length || lead.neighborhood));
    const byNeighborhood = new Map();
    const byProduct = new Map();
    let all = 0;
    active.forEach(lead => {
      const key = lead.neighborhood || NO_NEIGHBORHOOD;
      const order = orderTotals(lead.items, lead.neighborhood);
      if (!byNeighborhood.has(key)) byNeighborhood.set(key, { name: key, info: neighborhoodInfo(key), orders: [], total: 0 });
      const group = byNeighborhood.get(key);
      group.orders.push({ lead, ...order });
      group.total += order.total;
      all += order.total;
      cleanItems(lead.items).forEach(item => {
        const row = byProduct.get(item.productId) || { name: item.name, qty: 0 };
        row.qty += item.qty;
        byProduct.set(item.productId, row);
      });
    });
    const sorted = [...byNeighborhood.values()].sort((a, b) => b.orders.length - a.orders.length || a.name.localeCompare(b.name, 'pt-BR'));
    return {
      groups: sorted,
      production: [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      totals: { orders: active.length, neighborhoods: sorted.length, value: all },
    };
  }, [leads]);

  return (
    <main className="main-content dashboard-page orders-page">
      <header>
        <h1>Pedidos por bairro</h1>
        <p>Pedidos ativos (sem os perdidos), agrupados pelo bairro de entrega.</p>
      </header>

      <div className="orders-kpis">
        <div><small>Pedidos</small><b>{totals.orders}</b></div>
        <div><small>Bairros</small><b>{totals.neighborhoods}</b></div>
        <div><small>Total (itens + frete)</small><b>{currency(totals.value)}</b></div>
      </div>

      {!groups.length && <p className="orders-empty">Nenhum pedido com bairro ou itens ainda. Crie um pedido e escolha o bairro e os produtos.</p>}

      <div className="orders-grid">
        {groups.map(group => (
          <section key={group.name} className="orders-card">
            <div className="orders-card-head">
              <h3>{group.name}</h3>
              <small>{group.info ? `${group.info.zone} · frete ${currency(group.info.fee)}` : 'frete não definido'}</small>
            </div>
            <div className="orders-card-totals">
              <span>{group.orders.length} {group.orders.length === 1 ? 'pedido' : 'pedidos'}</span>
              <b>{currency(group.total)}</b>
            </div>
            <div className="orders-list">
              {group.orders.map(({ lead, total }) => (
                <div key={lead.id} className="orders-order" role="button" tabIndex={0} onClick={() => openLead(lead)} onKeyDown={event => { if (event.key === 'Enter') openLead(lead); }}>
                  <div><strong>{lead.name}</strong><b>{currency(total)}</b></div>
                  <small>{itemsSummary(lead.items) || 'Sem itens'}</small>
                  <div>
                    <small>{lead.status}</small>
                    <button type="button" className="icon-button" aria-label={`WhatsApp de ${lead.name}`} onClick={event => { event.stopPropagation(); openWhatsApp(lead); }}><MessageCircle size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {production.length > 0 && (
        <section className="orders-production">
          <h2>Quantidade por produto</h2>
          <table>
            <tbody>
              {production.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.qty}</td></tr>)}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
