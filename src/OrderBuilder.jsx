import React, { useMemo, useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import { DELIVERY_ZONES, NEIGHBORHOODS, PRODUCTS, PRODUCT_CATEGORIES, cleanItems, makeOrderItem, neighborhoodInfo, orderTotals } from './chefData.js';
import { currency } from './domain.js';
import './order.css';

const normalize = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Seletor de bairro e produtos. Devolve { items, neighborhood, deliveryFee, value } a cada mudança.
export default function OrderBuilder({ items, neighborhood, onChange }) {
  const [query, setQuery] = useState('');
  const current = cleanItems(items);
  const qtyById = useMemo(() => new Map(current.map(item => [item.productId, item.qty])), [current]);

  const emit = (nextItems, nextNeighborhood) => {
    const clean = cleanItems(nextItems);
    const totals = orderTotals(clean, nextNeighborhood);
    onChange({ items: clean, neighborhood: nextNeighborhood, deliveryFee: totals.fee, value: totals.total });
  };

  const setQty = (product, qty) => {
    const rest = current.filter(item => item.productId !== product.id);
    const next = qty > 0 ? [...rest, { ...(current.find(item => item.productId === product.id) || makeOrderItem(product)), qty }] : rest;
    emit(next, neighborhood || '');
  };

  const totals = orderTotals(current, neighborhood);
  const info = neighborhoodInfo(neighborhood);
  const search = normalize(query);
  const visibleCategories = PRODUCT_CATEGORIES
    .map(category => ({
      category,
      products: PRODUCTS.filter(product => product.category === category && (!search || normalize(`${product.name} ${product.option} ${category}`).includes(search))),
    }))
    .filter(group => group.products.length);

  return (
    <div className="order-builder full">
      <label className="order-field">
        <span>Bairro de entrega</span>
        <select value={neighborhood || ''} onChange={event => emit(current, event.target.value)}>
          <option value="">Escolha o bairro</option>
          {DELIVERY_ZONES.map(zone => (
            <optgroup key={zone.zone} label={`${zone.zone} · frete ${currency(zone.fee)}`}>
              {NEIGHBORHOODS.filter(item => item.zone === zone.zone).map(item => (
                <option key={item.label} value={item.label}>{item.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="order-picker">
        <label className="order-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" /></label>
        <div className="order-products">
          {visibleCategories.map(group => (
            <section key={group.category}>
              <h4>{group.category}</h4>
              {group.products.map(product => {
                const qty = qtyById.get(product.id) || 0;
                return (
                  <div key={product.id} className={`order-row ${qty ? 'selected' : ''}`}>
                    <div className="order-row-info">
                      <strong>{product.name}</strong>
                      <small>{product.option}{product.note ? ` · ${product.note}` : ''}</small>
                    </div>
                    <span className="order-price">{currency(product.price)}</span>
                    <div className="order-qty">
                      <button type="button" onClick={() => setQty(product, qty - 1)} disabled={!qty} aria-label={`Menos ${product.name}`}><Minus size={14} /></button>
                      <b aria-live="polite">{qty}</b>
                      <button type="button" onClick={() => setQty(product, qty + 1)} aria-label={`Mais ${product.name}`}><Plus size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
          {!visibleCategories.length && <p className="order-empty">Nada encontrado no cardápio.</p>}
        </div>
      </div>

      <div className="order-summary" aria-live="polite">
        <div><span>Itens ({totals.itemCount})</span><b>{currency(totals.subtotal)}</b></div>
        <div><span>Frete{info ? ` · ${info.label}` : ''}</span><b>{neighborhood ? currency(totals.fee) : '—'}</b></div>
        <div className="order-total"><span>Total</span><b>{currency(totals.total)}</b></div>
        {!neighborhood && current.length > 0 && <small>Escolha o bairro pra somar o frete.</small>}
      </div>
    </div>
  );
}
