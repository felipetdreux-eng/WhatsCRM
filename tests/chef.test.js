import test from 'node:test';
import assert from 'node:assert/strict';
import { DELIVERY_ZONES, NEIGHBORHOODS, PRODUCTS, feeForNeighborhood, makeOrderItem, orderTotals, productById } from '../src/chefData.js';

test('frete exato por bairro, conforme a tabela do chef', () => {
  assert.equal(feeForNeighborhood('Saúde'), 15);
  assert.equal(feeForNeighborhood('Copacabana'), 15);
  assert.equal(feeForNeighborhood('Rocinha'), 15);
  assert.equal(feeForNeighborhood('Barra da Tijuca'), 25);
  assert.equal(feeForNeighborhood('Icaraí'), 30);
  assert.equal(feeForNeighborhood('Centro (Rio)'), 15);
  assert.equal(feeForNeighborhood('Centro (Niterói)'), 30);
  assert.equal(feeForNeighborhood('Bairro que não existe'), 0);
});

test('cada bairro aparece uma vez e a contagem bate com a tabela', () => {
  assert.equal(new Set(NEIGHBORHOODS.map(item => item.label)).size, NEIGHBORHOODS.length);
  assert.deepEqual(DELIVERY_ZONES.map(zone => zone.neighborhoods.length), [16, 18, 1, 6]);
});

test('ids de produto são únicos e preços do cardápio conferem', () => {
  assert.equal(new Set(PRODUCTS.map(item => item.id)).size, PRODUCTS.length);
  const price = id => productById(id).price;
  assert.equal(price('ceia-a-dois'), 569);
  assert.equal(price('ceia-em-familia'), 1369);
  assert.equal(price('ceia-assinatura'), 2209);
  assert.equal(price('bacalhau-eca-500'), 299);
  assert.equal(price('bacalhau-eca-1kg'), 489);
  assert.equal(price('filet-wellington'), 980);
  assert.equal(price('chocotone-trufado'), 199);
  assert.equal(price('chocotone-domo-tone'), 379);
  assert.equal(price('kit-completo'), 359);
  assert.equal(price('molho-curry'), 59);
});

test('total do pedido soma itens e frete do bairro', () => {
  const items = [makeOrderItem(productById('bacalhau-eca-500'), 2), makeOrderItem(productById('molho-curry'), 1)];
  assert.deepEqual(orderTotals(items, 'Icaraí'), { itemCount: 3, subtotal: 657, fee: 30, total: 687 });
  assert.deepEqual(orderTotals(items, 'Leblon'), { itemCount: 3, subtotal: 657, fee: 15, total: 672 });
  assert.deepEqual(orderTotals([], 'Leblon'), { itemCount: 0, subtotal: 0, fee: 0, total: 0 });
});
