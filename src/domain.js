const VALID_DDDS = new Set([
  '11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38',
  '41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69',
  '71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99',
]);

export const currency = value => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

export function canonicalPhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  return digits;
}

export function validBrazilPhone(phone) {
  const digits = canonicalPhone(phone);
  if (!/^\d{10,11}$/.test(digits)) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  if (!VALID_DDDS.has(digits.slice(0, 2))) return false;
  const subscriber = digits.slice(2);
  if (digits.length === 11) return subscriber.startsWith('9');
  return ['2', '3', '4', '5'].includes(subscriber[0]);
}

export function whatsappPhone(phone) {
  const digits = canonicalPhone(phone);
  return validBrazilPhone(digits) ? `55${digits}` : '';
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateKeyOffset(days, baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function isoOffset(days, hour = 12, baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

export function buildDemoLeads(baseDate = new Date()) {
  return [
    { id: '1', name: 'Studio Bella', company: 'Salão de beleza', phone: '21999999991', value: 350, status: 'Novo lead', origin: 'Google Maps', nextContact: dateKeyOffset(-1, baseDate), nextContactTime: '15:00', nextAction: 'Fazer primeiro contato', notes: 'Primeiro contato pendente.', createdAt: isoOffset(-2, 12, baseDate) },
    { id: '2', name: 'Mercado Silva', company: 'Mercado', phone: '21999999992', value: 250, status: 'Novo lead', origin: 'Google Maps', nextContact: dateKeyOffset(0, baseDate), nextContactTime: '', nextAction: 'Apresentar serviço', notes: '', createdAt: isoOffset(-2, 11, baseDate) },
    { id: '3', name: 'Pet Care Feliz', company: 'Pet shop', phone: '21999999993', value: 400, status: 'Novo lead', origin: 'Instagram', nextContact: dateKeyOffset(-2, baseDate), nextContactTime: '16:30', nextAction: 'Enviar mensagem', notes: '', createdAt: isoOffset(-3, 18, baseDate) },
    { id: '4', name: 'Barbearia Prime', company: 'Barbearia', phone: '21999999994', value: 300, status: 'Contatado', origin: 'Google Maps', nextContact: dateKeyOffset(-1, baseDate), nextContactTime: '11:00', nextAction: 'Perguntar se recebeu', notes: 'Mensagem enviada.', createdAt: isoOffset(-3, 15, baseDate) },
    { id: '5', name: 'Padaria do João', company: 'Padaria', phone: '21999999995', value: 500, status: 'Contatado', origin: 'Indicação', nextContact: dateKeyOffset(1, baseDate), nextContactTime: '14:00', nextAction: 'Retornar contato', notes: '', createdAt: isoOffset(-4, 17, baseDate) },
    { id: '6', name: 'João Fotografia', company: 'Estúdio de fotografia', phone: '21999999996', value: 600, status: 'Interessado', origin: 'Instagram', nextContact: dateKeyOffset(0, baseDate), nextContactTime: '10:00', nextAction: 'Mandar proposta', notes: 'Gostou da proposta inicial.', createdAt: isoOffset(-4, 14, baseDate) },
    { id: '7', name: 'Ana Design', company: 'Design gráfico', phone: '21999999997', value: 450, status: 'Interessado', origin: 'Instagram', nextContact: dateKeyOffset(1, baseDate), nextContactTime: '', nextAction: 'Alinhar escopo', notes: '', createdAt: isoOffset(-5, 13, baseDate) },
    { id: '8', name: 'Alpha Elétrica', company: 'Serviços elétricos', phone: '21999999998', value: 750, status: 'Proposta enviada', origin: 'Google Maps', nextContact: dateKeyOffset(2, baseDate), nextContactTime: '15:30', nextAction: 'Cobrar retorno da proposta', notes: 'Proposta enviada por WhatsApp.', createdAt: isoOffset(-5, 10, baseDate) },
    { id: '9', name: 'Oficina JM', company: 'Oficina mecânica', phone: '21999999999', value: 850, status: 'Proposta enviada', origin: 'Google Maps', nextContact: dateKeyOffset(3, baseDate), nextContactTime: '09:30', nextAction: 'Fazer follow-up', notes: '', createdAt: isoOffset(-6, 18, baseDate) },
    { id: '10', name: 'Personal Lucas', company: 'Personal trainer', phone: '21999999980', value: 650, saleValue: 600, status: 'Vendido', origin: 'Indicação', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Cliente ativo.', createdAt: isoOffset(-7, 14, baseDate), soldAt: isoOffset(-2, 16, baseDate) },
    { id: '11', name: 'Restaurante Sabor', company: 'Restaurante', phone: '21999999981', value: 700, saleValue: 700, status: 'Vendido', origin: 'Site', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Cliente ativo.', createdAt: isoOffset(-8, 15, baseDate), soldAt: isoOffset(-3, 16, baseDate) },
    { id: '12', name: 'Tech Solutions', company: 'TI e informática', phone: '21999999982', value: 400, status: 'Perdido', origin: 'Google Maps', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Sem retorno.', createdAt: isoOffset(-9, 14, baseDate), lostAt: isoOffset(-3, 11, baseDate) },
    { id: '13', name: 'Academia Move', company: 'Academia', phone: '21999999983', value: 550, status: 'Perdido', origin: 'Instagram', nextContact: '', nextContactTime: '', nextAction: '', notes: 'Escolheu concorrente.', createdAt: isoOffset(-10, 12, baseDate), lostAt: isoOffset(-4, 12, baseDate) },
  ];
}
