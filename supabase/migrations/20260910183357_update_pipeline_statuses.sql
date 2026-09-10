alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads drop constraint if exists sold_value_consistency;

update public.leads
set status = 'Fechado'
where status = 'Vendido';

alter table public.leads
  add constraint leads_status_check
  check (status in ('Novo lead','Contatado','Interessado','Proposta enviada','Negociação','Fechado','Perdido'));

alter table public.leads
  add constraint sold_value_consistency
  check ((status='Fechado' and sale_value is not null) or (status<>'Fechado' and sale_value is null));
