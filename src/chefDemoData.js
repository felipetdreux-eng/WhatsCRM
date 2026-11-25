import { makeOrderItem, orderTotals, productById } from './chefData.js';
import { isoOffset } from './domain.js';

// Clientes e pedidos de exemplo. Nomes e números são inventados, só pra ver a tela funcionando.
export const CHEF_DEMO_ACCOUNT = {
  id: 'demo-chef',
  name: 'Fuply Chef · Demonstração',
  email: 'demo@chef.local',
  theme: 'light',
  onboardingCompleted: true,
  onboarding: { goal: 'sales', selling: 'products' },
};
export const CHEF_DEMO_TEAM = [{ user_id: 'demo-chef', name: 'Chef', role: 'owner' }];
export const CHEF_DEMO_WHATSAPP = '21999999999';

function order(id, name, phone, status, neighborhood, picks, daysAgo) {
  const items = picks.map(([productId, qty]) => makeOrderItem(productById(productId), qty));
  const totals = orderTotals(items, neighborhood);
  return {
    id,
    name,
    company: '',
    phone,
    status,
    origin: 'WhatsApp',
    assignedTo: 'demo-chef',
    items,
    neighborhood,
    deliveryFee: totals.fee,
    value: totals.total,
    saleValue: status === 'Confirmado' ? totals.total : null,
    saleValueSource: status === 'Confirmado' ? 'confirmed' : null,
    nextContact: '',
    nextContactTime: '',
    nextAction: status === 'Confirmado' ? '' : 'Confirmar pedido',
    notes: 'Cliente de exemplo.',
    createdAt: isoOffset(-daysAgo, 12),
    updatedAt: isoOffset(-daysAgo, 12),
    soldAt: status === 'Confirmado' ? isoOffset(-daysAgo, 15) : null,
  };
}

export const CHEF_DEMO_LEADS = [
  order('c1', 'Cliente Exemplo 1', '21999990001', 'Confirmado', 'Ipanema', [['bacalhau-eca-1kg', 1], ['arroz-fortuna-1kg', 1], ['buche-serve-12', 1]], 2),
  order('c2', 'Cliente Exemplo 2', '21999990002', 'Aguardando confirmação', 'Copacabana', [['ceia-a-dois', 1]], 1),
  order('c3', 'Cliente Exemplo 3', '21999990003', 'Orçamento enviado', 'Icaraí', [['tender-caramelado', 1], ['molho-assados-natal', 2]], 1),
  order('c4', 'Cliente Exemplo 4', '21999990004', 'Cardápio enviado', 'Barra da Tijuca', [['ceia-em-familia', 1], ['chocotone-trufado', 2]], 0),
  order('c5', 'Cliente Exemplo 5', '21999990005', 'Em conversa', 'Leblon', [['quiche-lorraine', 1], ['couscous-500', 1]], 0),
  order('c6', 'Cliente Exemplo 6', '21999990006', 'Confirmado', 'Ipanema', [['rosbife-chef', 1], ['gnocchi-500', 1]], 3),
  order('c7', 'Cliente Exemplo 7', '21999990007', 'Novo pedido', 'Centro (Rio)', [], 0),
];
