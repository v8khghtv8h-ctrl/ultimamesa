-- Última Mesa · base completa (generado con "npm run db:setup", no editar a mano)
-- Pegá este archivo entero en Supabase → SQL Editor → Run, en un proyecto nuevo.
-- Incluye: 0001_esquema_inicial.sql, 0002_noche_de_servicio.sql, 0003_cierre_de_mes.sql, 0004_alta_de_restaurantes.sql
--
-- Después, ingresá a la app con tu email una vez y hacete parte del equipo:
--   insert into platform_admins (user_id) select id from auth.users where email = 'tu@email.com';

-- ===== 0001_esquema_inicial.sql =====

-- Última Mesa · esquema inicial
-- Reservar es gratis para el usuario. El restaurante paga una comisión por comensal
-- solo cuando registra la llegada. Los cupos se descuentan al reservar y vuelven al cancelar.

create extension if not exists pgcrypto;

create type offer_benefit as enum ('discount', 'gift');
create type reservation_status as enum ('confirmed', 'arrived', 'no_show', 'cancelled');
create type staff_role as enum ('owner', 'staff');

-- "Hoy" es el día en Buenos Aires: a la 1 de la madrugada UTC todavía es la noche anterior acá.
create function today_ar() returns date
language sql stable as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

-- Personas ---------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Restaurantes -----------------------------------------------------------

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  neighborhood text not null,
  cuisine text not null,
  address text,
  price_level smallint not null default 2 check (price_level between 1 and 4),
  rating numeric(2, 1),
  rating_count integer not null default 0,
  description text,
  highlights text[] not null default '{}',
  -- comisión por comensal que llega, en centavos de dólar
  fee_cents integer not null default 200 check (fee_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table restaurant_staff (
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role staff_role not null default 'staff',
  primary key (restaurant_id, user_id)
);

create function is_staff(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from restaurant_staff
    where restaurant_id = p_restaurant and user_id = auth.uid()
  );
$$;

-- Ofertas (las "cartas") y sus horarios ---------------------------------

create table offers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  benefit offer_benefit not null,
  discount_pct smallint check (discount_pct between 5 and 60),
  gift_label text check (char_length(gift_label) <= 14),
  applies_to text not null check (char_length(applies_to) between 1 and 60),
  max_party smallint not null default 4 check (max_party between 1 and 12),
  service_date date not null default today_ar(),
  card_bg text not null default '#ff6b35',
  card_fg text not null default '#1f0d05',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint benefit_matches check (
    (benefit = 'discount' and discount_pct is not null and gift_label is null)
    or (benefit = 'gift' and gift_label is not null and discount_pct is null)
  )
);

create index offers_by_date on offers (service_date) where active;

create table offer_slots (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers (id) on delete cascade,
  starts_at time not null,
  tables_left integer not null check (tables_left >= 0),
  unique (offer_id, starts_at)
);

-- Reservas ---------------------------------------------------------------

create table reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  restaurant_id uuid not null references restaurants (id),
  offer_id uuid not null references offers (id),
  slot_id uuid not null references offer_slots (id),
  user_id uuid not null references auth.users (id),
  party_size smallint not null check (party_size between 1 and 12),
  guest_name text not null,
  note text,
  status reservation_status not null default 'confirmed',
  -- se completa al registrar la llegada: party_size × fee_cents del restaurante
  fee_cents integer,
  created_at timestamptz not null default now(),
  arrived_at timestamptz,
  cancelled_at timestamptz
);

create index reservations_by_restaurant on reservations (restaurant_id, created_at);
create index reservations_by_user on reservations (user_id, created_at);

-- Reglas de acceso -------------------------------------------------------

alter table profiles enable row level security;
alter table restaurants enable row level security;
alter table restaurant_staff enable row level security;
alter table offers enable row level security;
alter table offer_slots enable row level security;
alter table reservations enable row level security;

create policy "perfil propio" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "restaurantes visibles" on restaurants
  for select using (active or is_staff(id));
create policy "staff edita su restaurante" on restaurants
  for update using (is_staff(id)) with check (is_staff(id));

create policy "staff ve su equipo" on restaurant_staff
  for select using (user_id = auth.uid() or is_staff(restaurant_id));

create policy "cartas visibles" on offers
  for select using (active or is_staff(restaurant_id));
create policy "staff gestiona sus cartas" on offers
  for all using (is_staff(restaurant_id)) with check (is_staff(restaurant_id));

create policy "horarios visibles" on offer_slots
  for select using (true);
create policy "staff gestiona sus horarios" on offer_slots
  for all using (is_staff((select restaurant_id from offers where offers.id = offer_id)))
  with check (is_staff((select restaurant_id from offers where offers.id = offer_id)));

-- Las reservas se crean y cambian solo con las funciones de abajo.
create policy "usuario ve sus reservas" on reservations
  for select using (user_id = auth.uid());
create policy "staff ve las reservas de su restaurante" on reservations
  for select using (is_staff(restaurant_id));

-- Funciones de negocio ---------------------------------------------------

create function new_reservation_code() returns text
language plpgsql as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
begin
  loop
    result := 'UM-';
    for i in 1..5 loop
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from reservations where code = result);
  end loop;
  return result;
end;
$$;

-- Reserva una mesa de un horario. Bloquea el horario para que dos personas
-- no se lleven la última mesa al mismo tiempo.
create function book_slot(p_slot uuid, p_party smallint, p_guest_name text, p_note text default null)
returns reservations
language plpgsql security definer set search_path = public as $$
declare
  v_slot offer_slots;
  v_offer offers;
  v_res reservations;
begin
  if auth.uid() is null then
    raise exception 'Necesitás iniciar sesión para reservar' using errcode = '28000';
  end if;

  select * into v_slot from offer_slots where id = p_slot for update;
  if not found then
    raise exception 'Ese horario no existe';
  end if;

  select * into v_offer from offers where id = v_slot.offer_id;
  if not v_offer.active or v_offer.service_date <> today_ar() then
    raise exception 'Esta carta ya no está disponible';
  end if;
  if v_slot.tables_left < 1 then
    raise exception 'Ya no quedan mesas en ese horario';
  end if;
  if p_party < 1 or p_party > v_offer.max_party then
    raise exception 'Esta carta es para hasta % personas', v_offer.max_party;
  end if;
  if exists (
    select 1 from reservations
    where slot_id = p_slot and user_id = auth.uid() and status = 'confirmed'
  ) then
    raise exception 'Ya tenés una reserva en ese horario';
  end if;

  update offer_slots set tables_left = tables_left - 1 where id = p_slot;

  insert into reservations (code, restaurant_id, offer_id, slot_id, user_id, party_size, guest_name, note)
  values (new_reservation_code(), v_offer.restaurant_id, v_offer.id, p_slot, auth.uid(),
          p_party, coalesce(nullif(trim(p_guest_name), ''), 'Invitado'), nullif(trim(p_note), ''))
  returning * into v_res;

  return v_res;
end;
$$;

-- El usuario cancela su reserva y la mesa vuelve a estar disponible.
create function cancel_reservation(p_reservation uuid) returns reservations
language plpgsql security definer set search_path = public as $$
declare
  v_res reservations;
begin
  update reservations
     set status = 'cancelled', cancelled_at = now()
   where id = p_reservation and user_id = auth.uid() and status = 'confirmed'
  returning * into v_res;
  if not found then
    raise exception 'No encontramos una reserva activa para cancelar';
  end if;
  update offer_slots set tables_left = tables_left + 1 where id = v_res.slot_id;
  return v_res;
end;
$$;

-- El restaurante registra la llegada (por QR o a mano). Acá se fija la comisión.
create function register_arrival(p_code text) returns reservations
language plpgsql security definer set search_path = public as $$
declare
  v_res reservations;
begin
  select * into v_res from reservations where code = upper(trim(p_code)) for update;
  if not found or not is_staff(v_res.restaurant_id) then
    raise exception 'Código desconocido para este restaurante';
  end if;
  if v_res.status = 'arrived' then
    raise exception 'Esta reserva ya figura como llegada';
  end if;
  if v_res.status <> 'confirmed' then
    raise exception 'Esta reserva no está activa';
  end if;

  update reservations r
     set status = 'arrived',
         arrived_at = now(),
         fee_cents = r.party_size * (select fee_cents from restaurants where id = r.restaurant_id)
   where r.id = v_res.id
  returning * into v_res;
  return v_res;
end;
$$;

-- El restaurante marca que la persona no vino. No se cobra comisión.
create function mark_no_show(p_reservation uuid) returns reservations
language plpgsql security definer set search_path = public as $$
declare
  v_res reservations;
begin
  update reservations
     set status = 'no_show'
   where id = p_reservation and status = 'confirmed' and is_staff(restaurant_id)
  returning * into v_res;
  if not found then
    raise exception 'No encontramos una reserva activa para marcar';
  end if;
  return v_res;
end;
$$;

revoke all on function book_slot, cancel_reservation, register_arrival, mark_no_show from public, anon;
grant execute on function book_slot, cancel_reservation, register_arrival, mark_no_show to authenticated;

-- ===== 0002_noche_de_servicio.sql =====

-- Última Mesa · noche de servicio
-- "No vino" se puede marcar recién cuando pasó la tolerancia de 15 minutos desde el horario
-- reservado, para que una reserva no se dé de baja antes de que la persona pueda llegar.

create or replace function mark_no_show(p_reservation uuid) returns reservations
language plpgsql security definer set search_path = public as $$
declare
  v_res reservations;
  v_from timestamptz;
begin
  select * into v_res from reservations where id = p_reservation for update;
  if not found or not is_staff(v_res.restaurant_id) or v_res.status <> 'confirmed' then
    raise exception 'No encontramos una reserva activa para marcar';
  end if;

  select ((o.service_date + s.starts_at) at time zone 'America/Argentina/Buenos_Aires') + interval '15 minutes'
    into v_from
    from offers o, offer_slots s
   where o.id = v_res.offer_id and s.id = v_res.slot_id;
  if now() < v_from then
    raise exception 'Todavía está en tolerancia: podés marcar que no vino desde las %',
      to_char(v_from at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI');
  end if;

  update reservations set status = 'no_show' where id = v_res.id
  returning * into v_res;
  return v_res;
end;
$$;

-- ===== 0003_cierre_de_mes.sql =====

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

-- ===== 0004_alta_de_restaurantes.sql =====

-- Última Mesa · alta de restaurantes
-- El equipo da de alta restaurantes e invita a sus dueños por email. Si la persona
-- todavía no tiene cuenta, la invitación queda guardada y se aplica cuando ingresa
-- por primera vez con ese email.

create policy "admin gestiona restaurantes" on restaurants
  for all using (is_admin()) with check (is_admin());
create policy "admin gestiona equipos" on restaurant_staff
  for all using (is_admin()) with check (is_admin());

create table restaurant_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%_@_%'),
  role staff_role not null default 'owner',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (restaurant_id, email)
);
alter table restaurant_invites enable row level security;
create policy "admin gestiona invitaciones" on restaurant_invites
  for all using (is_admin()) with check (is_admin());

-- Suma a la persona al equipo del restaurante: ya mismo si tiene cuenta, o cuando ingrese.
create function invite_to_restaurant(p_restaurant uuid, p_email text, p_role staff_role default 'owner')
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_user uuid;
begin
  if not is_admin() then
    raise exception 'Solo el equipo de Última Mesa puede invitar' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Ese email no parece válido';
  end if;
  if not exists (select 1 from restaurants where id = p_restaurant) then
    raise exception 'Ese restaurante no existe';
  end if;

  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is not null then
    insert into restaurant_staff (restaurant_id, user_id, role) values (p_restaurant, v_user, p_role)
      on conflict (restaurant_id, user_id) do update set role = excluded.role;
    return 'added';
  end if;

  insert into restaurant_invites (restaurant_id, email, role) values (p_restaurant, v_email, p_role)
    on conflict (restaurant_id, email) do update set role = excluded.role, accepted_at = null;
  return 'invited';
end;
$$;

revoke all on function invite_to_restaurant from public, anon;
grant execute on function invite_to_restaurant to authenticated;

create function accept_restaurant_invites() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into restaurant_staff (restaurant_id, user_id, role)
  select restaurant_id, new.id, role from restaurant_invites
   where email = lower(new.email) and accepted_at is null
  on conflict (restaurant_id, user_id) do nothing;
  update restaurant_invites set accepted_at = now()
   where email = lower(new.email) and accepted_at is null;
  return new;
end;
$$;

create trigger on_auth_user_accept_invites
  after insert on auth.users
  for each row execute function accept_restaurant_invites();
