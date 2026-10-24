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
