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
