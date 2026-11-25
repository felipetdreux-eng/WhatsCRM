// Dados exatos do Cardápio Noël & Réveillon 26/27 (Noni) e da tabela de frete por bairro.
// Fonte: PDFs enviados pelo chef. Não alterar valores sem conferir com ele.

export const DELIVERY_ZONES = [
  {
    zone: 'Centro',
    fee: 15,
    neighborhoods: ['Saúde', 'Gamboa', 'Santo Cristo', 'Caju', 'Centro', 'Lapa', 'Catumbi', 'Rio Comprido', 'Cidade Nova', 'Estácio', 'São Cristóvão', 'Mangueira', 'Benfica', 'Vasco da Gama', 'Santa Teresa', 'Paquetá'],
  },
  {
    zone: 'Zona Sul',
    fee: 15,
    neighborhoods: ['Flamengo', 'Glória', 'Laranjeiras', 'Catete', 'Cosme Velho', 'Botafogo', 'Humaitá', 'Urca', 'Leme', 'Copacabana', 'Ipanema', 'Leblon', 'Lagoa', 'Jardim Botânico', 'Gávea', 'Vidigal', 'Rocinha'],
  },
  { zone: 'Barra da Tijuca', fee: 25, neighborhoods: ['Barra da Tijuca', 'São Conrado'] },
  {
    zone: 'Niterói',
    fee: 30,
    neighborhoods: ['Centro', 'São Domingos', 'Gragoatá', 'Boa Viagem', 'Ingá', 'Icaraí'],
  },
];

// "Centro" existe no Rio e em Niterói, com fretes diferentes. O rótulo do bairro leva a cidade quando precisa.
export const NEIGHBORHOODS = DELIVERY_ZONES.flatMap(({ zone, fee, neighborhoods }) =>
  neighborhoods.map(name => ({
    label: name === 'Centro' ? (zone === 'Niterói' ? 'Centro (Niterói)' : 'Centro (Rio)') : name,
    zone,
    fee,
  })),
);

const NEIGHBORHOOD_BY_LABEL = new Map(NEIGHBORHOODS.map(item => [item.label, item]));

export const neighborhoodInfo = label => NEIGHBORHOOD_BY_LABEL.get(label) || null;
export const feeForNeighborhood = label => neighborhoodInfo(label)?.fee ?? 0;

const p = (id, category, name, option, price, note = '') => ({ id, category, name, option, price, note });

export const PRODUCTS = [
  // Ceias completas
  p('ceia-a-dois', 'Ceias completas', 'Ceia a Dois', '2 a 3 pessoas', 569, 'Bacalhau do Eça 500g, Arroz da Fortuna 500g, Salada de Couscous Marroquino 500g, Bûche de Noël mini'),
  p('ceia-em-familia', 'Ceias completas', 'Ceia em Família', '6 a 8 pessoas', 1369, 'Tender Caramelado (aprox. 1,5kg), Bacalhau do Eça 500g, Arroz da Fortuna 1kg, Salada de Couscous 1kg, Bûche de Noël'),
  p('ceia-assinatura', 'Ceias completas', 'Ceia Assinatura', '10 a 12 pessoas', 2209, 'Bacalhau do Eça 1kg, Rosbife do Chef 1kg, Gnocchi alla Romana Tartufati 1kg, Arroz da Fortuna 1kg, Farofa Panko 1kg, Salada de Arroz Vermelho 1kg, Bûche de Noël'),

  // Entradas
  p('salmao-gravlax-250', 'Entradas', 'Salmão Gravlax do Chef', '250g', 210),
  p('salmao-gravlax-500', 'Entradas', 'Salmão Gravlax do Chef', '500g', 390),
  p('terrine-campagne-100', 'Entradas', 'Terrine de Campagne', '100g', 59),
  p('terrine-salmao-250', 'Entradas', 'Terrine de Salmão', '250g', 89),
  p('terrine-salmao-500', 'Entradas', 'Terrine de Salmão', '500g', 159),

  // Quiches
  p('quiche-cogumelos', 'Quiches', 'Quiche de Cogumelos', '22cm · 8 fatias', 299),
  p('quiche-brie-chutney', 'Quiches', 'Quiche de Brie com Chutney', '22cm · 8 fatias', 299),
  p('quiche-lorraine', 'Quiches', 'Quiche Lorraine', '22cm · 8 fatias', 299),

  // Saladas
  p('couscous-500', 'Saladas', 'Couscous Marroquino', '500g', 99),
  p('couscous-1kg', 'Saladas', 'Couscous Marroquino', '1kg', 189),
  p('arroz-vermelho-500', 'Saladas', 'Arroz Vermelho', '500g', 99),
  p('arroz-vermelho-1kg', 'Saladas', 'Arroz Vermelho', '1kg', 189),
  p('folhas-pera-gorgonzola-500', 'Saladas', 'Folhas, Pera e Gorgonzola', '500g', 99),
  p('folhas-pera-gorgonzola-1kg', 'Saladas', 'Folhas, Pera e Gorgonzola', '1kg', 189),

  // Principais
  p('bacalhau-eca-500', 'Principais', 'Bacalhau do Eça', '500g · serve 3', 299),
  p('bacalhau-eca-1kg', 'Principais', 'Bacalhau do Eça', '1kg · serve 6', 489),
  p('tender-caramelado', 'Principais', 'Tender Caramelado', '1,5kg · serve 8 a 10', 379),
  p('compota-extra', 'Principais', 'Compota extra (Tender Caramelado)', '300g', 39),
  p('rosbife-chef', 'Principais', 'Rosbife do Chef', '1kg · serve 6', 590),
  p('filet-wellington', 'Principais', 'Filet Wellington', '1,5kg · serve 4 a 6', 980),

  // Para acompanhar
  p('gnocchi-500', 'Para acompanhar', 'Gnocchi alla Romana Tartufati', '500g', 179),
  p('gnocchi-1kg', 'Para acompanhar', 'Gnocchi alla Romana Tartufati', '1kg', 279),
  p('arroz-fortuna-500', 'Para acompanhar', 'Arroz da Fortuna', '500g', 109),
  p('arroz-fortuna-1kg', 'Para acompanhar', 'Arroz da Fortuna', '1kg', 199),
  p('gratin-500', 'Para acompanhar', 'Gratin Dauphinois', '500g', 119),
  p('gratin-1kg', 'Para acompanhar', 'Gratin Dauphinois', '1kg', 219),
  p('farofa-panko-500', 'Para acompanhar', 'Farofa Panko Natalina', '500g', 109),
  p('farofa-panko-1kg', 'Para acompanhar', 'Farofa Panko Natalina', '1kg', 199),

  // Sobremesas
  p('buche-serve-2', 'Sobremesas', 'Bûche de Noël', 'serve 2', 89),
  p('buche-serve-12', 'Sobremesas', 'Bûche de Noël', 'serve 12', 379),
  p('chocotone-domo-tone', 'Sobremesas', 'Chocotone Domo Tone', '1,5kg', 379),
  p('cheesecake-caramelo-salgado', 'Sobremesas', 'Cheesecake de Caramelo Salgado', '23cm · serve 8', 369),
  // O cardápio traz "2 tamanhos · R$ 190 · 240" sem dizer qual é qual. Pedidos só a partir de 4 de janeiro.
  p('galette-rois-190', 'Sobremesas', 'Galette des Rois', 'R$ 190 (tamanho não informado no cardápio)', 190, 'Pedidos a partir de 4 de janeiro'),
  p('galette-rois-240', 'Sobremesas', 'Galette des Rois', 'R$ 240 (tamanho não informado no cardápio)', 240, 'Pedidos a partir de 4 de janeiro'),
  p('rabanadas-12', 'Sobremesas', 'Rabanadas da Casa', '12 unidades', 159),
  p('rabanadas-caramelo', 'Sobremesas', 'Rabanadas da Casa + Caramelo Noni', '12 unidades', 199),

  // Chocolates
  p('chocotone-trufado', 'Chocolates', 'Chocotone Trufado', '1kg', 199),
  p('pinheiro-brownie', 'Chocolates', 'Pinheiro de Brownie', '500g', 199),
  p('arvore-felicidade', 'Chocolates', 'Árvore da Felicidade', '500g', 169),

  // Molhos e kits (potes de 350ml)
  p('molho-curry', 'Molhos e kits', 'Molho Curry', '350ml', 59),
  p('molho-cogumelos', 'Molhos e kits', 'Molho Cogumelos', '350ml', 59),
  p('molho-agridoce', 'Molhos e kits', 'Molho Agridoce', '350ml', 59),
  p('molho-poivre', 'Molhos e kits', 'Molho Poivre', '350ml', 59),
  p('calda-caramelo-speculoos', 'Molhos e kits', 'Calda Caramelo Speculoos', '350ml', 59),
  p('calda-chocolate-framboesas', 'Molhos e kits', 'Calda Chocolate e Framboesas', '350ml', 59),
  p('molho-assados-natal', 'Molhos e kits', 'Molho Assados de Natal', '350ml', 59),
  p('molho-mostarda-mel', 'Molhos e kits', 'Molho Mostarda & Mel Especial', '350ml', 59),
  p('kit-duo', 'Molhos e kits', 'Kit Duo', '2 potes à sua escolha', 95, 'Dois molhos ou caldas à escolha do cliente'),
  p('kit-natal', 'Molhos e kits', 'Kit Natal', '3 potes', 139, 'Dois Molhos Especiais de Natal e uma Calda doce Caramelo Speculoos'),
  p('kit-completo', 'Molhos e kits', 'Kit Completo', '8 potes', 359, 'Linha completa de molhos e caldas, incluindo os Molhos Especiais de Natal'),
];

export const PRODUCT_CATEGORIES = [...new Set(PRODUCTS.map(item => item.category))];
const PRODUCT_BY_ID = new Map(PRODUCTS.map(item => [item.id, item]));
export const productById = id => PRODUCT_BY_ID.get(id) || null;

export const productLabel = item => (item.option ? `${item.name} (${item.option})` : item.name);

// Guarda uma cópia do nome e do preço no pedido, assim mudar o cardápio depois não altera pedidos antigos.
export function makeOrderItem(product, qty = 1) {
  return { productId: product.id, name: productLabel(product), price: product.price, qty };
}

export function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map(item => ({
      productId: String(item?.productId || ''),
      name: String(item?.name || ''),
      price: Number.isFinite(Number(item?.price)) ? Number(item.price) : 0,
      qty: Math.max(0, Math.floor(Number(item?.qty) || 0)),
    }))
    .filter(item => item.productId && item.qty > 0);
}

export function orderTotals(items, neighborhood) {
  const list = cleanItems(items);
  const cents = list.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0);
  const feeCents = list.length ? Math.round(feeForNeighborhood(neighborhood) * 100) : 0;
  return {
    itemCount: list.reduce((sum, item) => sum + item.qty, 0),
    subtotal: cents / 100,
    fee: feeCents / 100,
    total: (cents + feeCents) / 100,
  };
}

export const itemsSummary = items => cleanItems(items).map(item => `${item.qty}× ${item.name}`).join(', ');
