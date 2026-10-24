-- Última Mesa · cierre de mes
-- El equipo de Última Mesa (administradores) ve todo para liquidar comisiones.
-- Cada restaurante sigue viendo solo lo suyo.

create table platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table platform_admins enable row level security;
create policy "admin se ve a sí mismo" on platform_admins
  for select using (user_id = auth.uid());

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create policy "admin ve restaurantes" on restaurants for select using (is_admin());
create policy "admin ve cartas" on offers for select using (is_admin());
create policy "admin ve reservas" on reservations for select using (is_admin());

create index offers_by_restaurant_date on offers (restaurant_id, service_date);
create index reservations_by_offer on reservations (offer_id);

-- Liquidación del mes: una fila por restaurante con reservas en ese mes.
-- p_month es cualquier día del mes; cuenta por fecha de servicio (hora de Buenos Aires).
create function month_settlement(p_month date)
returns table (
  restaurant_id uuid, name text, neighborhood text, fee_per_diner_cents integer,
  reservations bigint, arrived bigint, no_shows bigint, cancelled bigint,
  diners bigint, fee_cents bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Solo el equipo de Última Mesa puede ver la liquidación' using errcode = '42501';
  end if;
  return query
  select r.id, r.name, r.neighborhood, r.fee_cents,
         count(*),
         count(*) filter (where v.status = 'arrived'),
         count(*) filter (where v.status = 'no_show'),
         count(*) filter (where v.status = 'cancelled'),
         coalesce(sum(v.party_size) filter (where v.status = 'arrived'), 0),
         coalesce(sum(v.fee_cents) filter (where v.status = 'arrived'), 0)
    from reservations v
    join offers o on o.id = v.offer_id
    join restaurants r on r.id = v.restaurant_id
   where o.service_date >= date_trunc('month', p_month)::date
     and o.service_date < (date_trunc('month', p_month) + interval '1 month')::date
   group by r.id
   order by 10 desc, r.name;
end;
$$;

revoke all on function month_settlement from public, anon;
grant execute on function month_settlement to authenticated;
