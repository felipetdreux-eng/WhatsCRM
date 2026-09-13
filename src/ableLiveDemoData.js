const today = new Date();
const dateKey = offset => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const isoOffset = days => {
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

export const ABLE_DEMO_ACCOUNT = {
  id: 'demo-able-live',
  name: 'Able Live · Demonstração',
  email: 'demo@ablelive.local',
  theme: 'light',
  onboardingCompleted: true,
  onboarding: { goal: 'sales', selling: 'services' },
};

export const ABLE_DEMO_TEAM = [
  { user_id: 'demo-able-live', name: 'Comercial', role: 'owner' },
  { user_id: 'demo-able-account', name: 'Atendimento', role: 'member' },
  { user_id: 'demo-able-dir', name: 'Diretoria', role: 'admin' },
];

export const ABLE_DEMO_LEADS = [
  { id:'able-1', name:'Marina Alves', company:'Projeto Live Commerce · Marca Aurora', phone:'11900010001', value:48000, status:'Novo lead', origin:'Site', assignedTo:'demo-able-live', nextContact:dateKey(0), nextContactTime:'14:00', nextAction:'Entender briefing e objetivo da campanha', notes:'Dado fictício criado somente para demonstração do Fuply.', createdAt:isoOffset(0), updatedAt:isoOffset(0), lastFollowupAt:null },
  { id:'able-2', name:'Rafael Costa', company:'Campanha de lançamento · Studio Nexo', phone:'11900010002', value:72000, status:'Contatado', origin:'Indicação', assignedTo:'demo-able-account', nextContact:dateKey(0), nextContactTime:'16:30', nextAction:'Agendar call comercial', notes:'Dado fictício criado somente para demonstração do Fuply.', createdAt:isoOffset(3), updatedAt:isoOffset(1), lastFollowupAt:isoOffset(1) },
  { id:'able-3', name:'Bruna Martins', company:'Projeto always-on · Casa Uno', phone:'11900010003', value:95000, status:'Interessado', origin:'WhatsApp', assignedTo:'demo-able-live', nextContact:dateKey(1), nextContactTime:'10:30', nextAction:'Enviar escopo preliminar', notes:'Dado fictício criado somente para demonstração do Fuply.', createdAt:isoOffset(6), updatedAt:isoOffset(2), lastFollowupAt:isoOffset(2) },
  { id:'able-4', name:'Lucas Ferreira', company:'Live de lançamento · Vitta', phone:'11900010004', value:38000, status:'Proposta enviada', origin:'Site', assignedTo:'demo-able-account', nextContact:dateKey(1), nextContactTime:'15:00', nextAction:'Confirmar análise da proposta', notes:'Proposta fictícia para demonstrar follow-up e pipeline.', createdAt:isoOffset(9), updatedAt:isoOffset(3), lastFollowupAt:isoOffset(3) },
  { id:'able-5', name:'Camila Ribeiro', company:'Operação mensal · Bloom', phone:'11900010005', value:126000, status:'Negociação', origin:'Indicação', assignedTo:'demo-able-dir', nextContact:dateKey(2), nextContactTime:'11:00', nextAction:'Revisar escopo e próximos passos', notes:'Negociação fictícia para demonstrar priorização comercial.', createdAt:isoOffset(15), updatedAt:isoOffset(1), lastFollowupAt:isoOffset(1) },
  { id:'able-6', name:'Eduardo Lima', company:'Projeto especial · Atlas', phone:'11900010006', value:64000, status:'Negociação', origin:'Outro', assignedTo:'demo-able-live', nextContact:dateKey(3), nextContactTime:'09:30', nextAction:'Retomar decisão com o cliente', notes:'Dado fictício criado somente para demonstração do Fuply.', createdAt:isoOffset(18), updatedAt:isoOffset(4), lastFollowupAt:isoOffset(4) },
  { id:'able-7', name:'Fernanda Rocha', company:'Campanha sazonal · Forma', phone:'11900010007', value:52000, saleValue:50000, saleValueSource:'confirmed', status:'Fechado', origin:'WhatsApp', assignedTo:'demo-able-account', nextContact:'', nextContactTime:'', nextAction:'', notes:'Venda fictícia fechada para demonstrar resultados.', createdAt:isoOffset(26), updatedAt:isoOffset(2), soldAt:isoOffset(2), lastFollowupAt:isoOffset(2) },
  { id:'able-8', name:'João Pedro', company:'Projeto institucional · Onda', phone:'11900010008', value:44000, status:'Contatado', origin:'Instagram', assignedTo:'demo-able-live', nextContact:dateKey(4), nextContactTime:'13:00', nextAction:'Confirmar interesse e briefing', notes:'Dado fictício criado somente para demonstração do Fuply.', createdAt:isoOffset(2), updatedAt:isoOffset(1), lastFollowupAt:isoOffset(1) },
];

export const ABLE_DEMO_WHATSAPP = '11900019999';
