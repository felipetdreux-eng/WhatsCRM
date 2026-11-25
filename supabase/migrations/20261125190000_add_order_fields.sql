-- Pedido do chef: bairro de entrega, frete e itens comprados ficam no próprio lead.
-- As políticas de RLS de public.leads já cobrem as colunas novas.
alter table public.leads
  add column if not exists neighborhood text not null default '',
  add column if not exists delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  add column if not exists items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array');

create index if not exists leads_workspace_neighborhood_idx on public.leads (workspace_id, neighborhood);
