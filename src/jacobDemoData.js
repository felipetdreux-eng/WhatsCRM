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

export const JACOB_DEMO_ACCOUNT = {
  id: 'demo-jacob',
  name: 'Jacob Engenharia',
  email: 'demo@jacobengenharia.com.br',
  theme: 'light',
  onboardingCompleted: true,
  onboarding: { goal: 'sales', selling: 'services' },
};

export const JACOB_DEMO_TEAM = [
  { user_id: 'demo-jacob', name: 'Comercial Jacob', role: 'owner' },
  { user_id: 'demo-jacob-eng', name: 'Engenharia', role: 'member' },
  { user_id: 'demo-jacob-dir', name: 'Diretoria', role: 'admin' },
];

export const JACOB_DEMO_LEADS = [
  { id:'jacob-1', name:'Carlos Almeida', company:'Reforma apto. Jardins', phone:'11900000001', value:185000, status:'Novo lead', origin:'Site', assignedTo:'demo-jacob', nextContact:dateKey(0), nextContactTime:'14:30', nextAction:'Entender escopo e metragem', notes:'Cliente pediu estimativa inicial para reforma completa do apartamento.', createdAt:isoOffset(0), updatedAt:isoOffset(0), lastFollowupAt:null },
  { id:'jacob-2', name:'Mariana Costa', company:'Retrofit escritório Vila Olímpia', phone:'11900000002', value:420000, status:'Contatado', origin:'Indicação', assignedTo:'demo-jacob-eng', nextContact:dateKey(0), nextContactTime:'16:00', nextAction:'Agendar visita técnica', notes:'Empresa de tecnologia avaliando retrofit de dois pavimentos.', createdAt:isoOffset(3), updatedAt:isoOffset(1), lastFollowupAt:isoOffset(1) },
  { id:'jacob-3', name:'Roberto Nunes', company:'Reforma cobertura Moema', phone:'11900000003', value:310000, status:'Interessado', origin:'WhatsApp', assignedTo:'demo-jacob-eng', nextContact:dateKey(1), nextContactTime:'10:00', nextAction:'Enviar estudo preliminar', notes:'Cliente já enviou planta e referências. Interesse alto.', createdAt:isoOffset(6), updatedAt:isoOffset(2), lastFollowupAt:isoOffset(2) },
  { id:'jacob-4', name:'Dra. Fernanda Lima', company:'Adequação clínica Pinheiros', phone:'11900000004', value:265000, status:'Proposta enviada', origin:'Google Maps', assignedTo:'demo-jacob', nextContact:dateKey(2), nextContactTime:'09:30', nextAction:'Confirmar análise da proposta', notes:'Proposta enviada com duas opções de acabamento.', createdAt:isoOffset(10), updatedAt:isoOffset(3), lastFollowupAt:isoOffset(3) },
  { id:'jacob-5', name:'Eduardo Martins', company:'Obra residencial Alphaville', phone:'11900000005', value:680000, status:'Negociação', origin:'Indicação', assignedTo:'demo-jacob-dir', nextContact:dateKey(2), nextContactTime:'15:00', nextAction:'Revisar prazo e condições', notes:'Negociação final de prazo, condições e início da obra.', createdAt:isoOffset(18), updatedAt:isoOffset(1), lastFollowupAt:isoOffset(1) },
  { id:'jacob-6', name:'Paula Ribeiro', company:'Reforma corporativa Itaim', phone:'11900000006', value:540000, status:'Negociação', origin:'Site', assignedTo:'demo-jacob', nextContact:dateKey(3), nextContactTime:'11:00', nextAction:'Apresentar contraproposta', notes:'Escritório jurídico pediu ajuste de cronograma e condição de pagamento.', createdAt:isoOffset(22), updatedAt:isoOffset(4), lastFollowupAt:isoOffset(4) },
  { id:'jacob-7', name:'Gustavo Freitas', company:'Modernização apartamento Perdizes', phone:'11900000007', value:228000, saleValue:218000, saleValueSource:'confirmed', status:'Fechado', origin:'WhatsApp', assignedTo:'demo-jacob-eng', nextContact:'', nextContactTime:'', nextAction:'', notes:'Contrato aprovado. Kickoff alinhado com o cliente.', createdAt:isoOffset(31), updatedAt:isoOffset(2), soldAt:isoOffset(2), lastFollowupAt:isoOffset(2) },
  { id:'jacob-8', name:'Ana Beatriz Souza', company:'Loja conceito Oscar Freire', phone:'11900000008', value:390000, status:'Contatado', origin:'Instagram', assignedTo:'demo-jacob', nextContact:dateKey(4), nextContactTime:'13:30', nextAction:'Solicitar briefing detalhado', notes:'Lead comercial vindo de indicação no Instagram.', createdAt:isoOffset(2), updatedAt:isoOffset(1), lastFollowupAt:isoOffset(1) },
];

export const JACOB_DEMO_WHATSAPP = '11932318724';

export const JACOB_DEMO_ACCESS = {
  token: 'DR06Fe9IRsebUfJk892O1ihX',
  expiresAt: '2026-09-14T21:23:44.305612-03:00',
};
