create or replace function public.submit_site_lead(
  _site_key uuid,
  _name text,
  _phone text,
  _service text default null,
  _budget text default null,
  _message text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  cfg public.site_integrations%rowtype;
  lead_id uuid;
  clean_name text;
  clean_phone text;
  clean_service text;
  clean_budget text;
  clean_message text;
  note_text text;
  potential_value numeric := 0;
begin
  select * into cfg
  from public.site_integrations
  where public_key = _site_key and enabled = true
  limit 1;

  if not found then
    raise exception 'Integração de site inválida ou desativada.';
  end if;

  clean_name := left(trim(coalesce(_name, '')), 120);
  clean_phone := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  clean_service := left(trim(coalesce(_service, '')), 160);
  clean_budget := left(trim(coalesce(_budget, '')), 120);
  clean_message := left(trim(coalesce(_message, '')), 1500);

  if char_length(clean_name) < 2 then
    raise exception 'Nome inválido.';
  end if;

  if char_length(clean_phone) < 8 or char_length(clean_phone) > 15 then
    raise exception 'WhatsApp inválido.';
  end if;

  potential_value := case clean_budget
    when 'Até R$ 10 mil' then 10000
    when 'R$ 10 mil a R$ 25 mil' then 17500
    when 'R$ 25 mil a R$ 50 mil' then 37500
    when 'Acima de R$ 50 mil' then 50000
    else 0
  end;

  note_text := concat_ws(E'\n',
    case when clean_service <> '' then 'Interesse: ' || clean_service end,
    case when clean_budget <> '' then 'Faixa de investimento: ' || clean_budget end,
    case when clean_message <> '' then 'Mensagem do site: ' || clean_message end,
    'Captado automaticamente pelo site ' || cfg.site_name
  );

  insert into public.leads (
    user_id,
    workspace_id,
    assigned_to,
    last_modified_by,
    name,
    company,
    phone,
    value,
    status,
    origin,
    notes,
    next_action,
    created_at,
    updated_at
  ) values (
    cfg.owner_id,
    cfg.workspace_id,
    cfg.owner_id,
    null,
    clean_name,
    clean_service,
    clean_phone,
    potential_value,
    'Novo lead',
    cfg.origin_label,
    note_text,
    'Responder lead do site',
    now(),
    now()
  )
  on conflict (user_id, phone) do update
  set
    name = excluded.name,
    company = excluded.company,
    value = case when excluded.value > 0 then excluded.value else public.leads.value end,
    notes = excluded.notes,
    origin = excluded.origin,
    next_action = 'Responder novo pedido do site',
    updated_at = now(),
    last_modified_by = null
  returning id into lead_id;

  return lead_id;
end;
$function$;
