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
