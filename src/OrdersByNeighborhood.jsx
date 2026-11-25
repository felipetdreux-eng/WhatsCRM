import React, { useMemo, useState } from 'react';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { DELIVERY_ZONES, cleanItems, neighborhoodInfo, orderTotals } from './chefData.js';
import { currency, whatsappPhone } from './domain.js';
import './order.css';

const NO_NEIGHBORHOOD = 'Sem bairro';
const zoneIndex = zone => {
  const index = DELIVERY_ZONES.findIndex(item => item.zone === zone);
  return index < 0 ? 99 : index;
};

// Uma coluna ("torre") por bairro, com todos os pedidos que vão pra lá.
export default function OrdersByNeighborhood({ leads, openLead, onMarkSent }) {
  const [showSent, setShowSent] = useState(false);

  const { towers, production, totals } = useMemo(() => {
    const visible = leads.filter(lead => showSent || lead.status !== 'Enviado');
    const byNeighborhood = new Map();
    const byProduct = new Map();
    let all = 0;

    visible.forEach(lead => {
      const key = lead.neighborhood || NO_NEIGHBORHOOD;
      const order = orderTotals(lead.items, lead.neighborhood);
      if (!byNeighborhood.has(key)) byNeighborhood.set(key, { name: key, info: neighborhoodInfo(key), orders: [], total: 0 });
      const tower = byNeighborhood.get(key);
      tower.orders.push({ lead, total: order.total });
      tower.total += order.total;
      all += order.total;
      cleanItems(lead.items).forEach(item => {
        const row = byProduct.get(item.productId) || { name: item.name, qty: 0 };
        row.qty += item.qty;
        byProduct.set(item.productId, row);
      });
    });

    const sorted = [...byNeighborhood.values()].sort((a, b) =>
      zoneIndex(a.info?.zone) - zoneIndex(b.info?.zone) || a.name.localeCompare(b.name, 'pt-BR'));
    return {
      towers: sorted,
      production: [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      totals: { orders: visible.length, neighborhoods: sorted.length, value: all },
    };
  }, [leads, showSent]);

  return (
    <main className="main-content orders-page">
      <header className="page-header">
        <div><h1>Pedidos por bairro</h1><p>Cada coluna é um bairro, com todos os pedidos que vão pra lá.</p></div>
        <label className="orders-toggle"><input type="checkbox" checked={showSent} onChange={event => setShowSent(event.target.checked)} /> Mostrar já enviados</label>
      </header>

      <div className="orders-kpis">
        <div><small>Pedidos</small><b>{totals.orders}</b></div>
        <div><small>Bairros</small><b>{totals.neighborhoods}</b></div>
        <div><small>Total (itens + frete)</small><b>{currency(totals.value)}</b></div>
      </div>

      {!towers.length && <p className="orders-empty">Nenhum pedido {showSent ? '' : 'para enviar '}ainda.</p>}

      <div className="orders-towers">
        {towers.map(tower => (
          <section key={tower.name} className="orders-tower">
            <div className="orders-tower-head">
              <h3>{tower.name}</h3>
              <small>{tower.info ? `${tower.info.zone} · frete ${currency(tower.info.fee)}` : 'frete não definido'}</small>
              <div className="orders-tower-sum"><span>{tower.orders.length} {tower.orders.length === 1 ? 'pedido' : 'pedidos'}</span><b>{currency(tower.total)}</b></div>
            </div>
            <div className="orders-tower-body">
              {tower.orders.map(({ lead, total }) => (
                <article key={lead.id} className="orders-order" role="button" tabIndex={0} onClick={() => openLead(lead)} onKeyDown={event => { if (event.key === 'Enter') openLead(lead); }}>
                  <div><strong>{lead.name}</strong><b>{currency(total)}</b></div>
                  <ul className="orders-lines">
                    {cleanItems(lead.items).map(item => <li key={item.productId}>{item.qty}× {item.name}</li>)}
                  </ul>
                  {lead.notes && <small className="orders-address">{lead.notes}</small>}
                  <div className="orders-order-foot">
                    <small>{lead.phone}</small>
                    <a className="orders-send orders-wa" href={`https://wa.me/${whatsappPhone(lead.phone)}`} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}><MessageCircle size={14} /> WhatsApp</a>
                    {lead.status === 'Enviado'
                      ? <small className="orders-sent">Enviado</small>
                      : <button type="button" className="orders-send" onClick={event => { event.stopPropagation(); onMarkSent(lead.id); }}><CheckCircle2 size={14} /> Enviado</button>}
                  </div>
                </article>
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
