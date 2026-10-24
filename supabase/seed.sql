-- Datos de ejemplo para desarrollo. Restaurantes ficticios, con cartas para el día de hoy.
-- Se pueden volver a cargar: borran y recrean solo estas filas de ejemplo.

delete from restaurants where slug like 'demo-%';

with r as (
  insert into restaurants (slug, name, neighborhood, cuisine, price_level, rating, rating_count, description, highlights)
  values
    ('demo-brasa-del-bajo', 'Brasa del Bajo', 'Palermo', 'Parrilla', 3, 4.8, 1240,
     'Parrilla a leña con cortes madurados en casa.', '{"Cortes madurados","Vino por copa","Patio"}'),
    ('demo-casa-ombu', 'Casa Ombú', 'Recoleta', 'De autor', 3, 4.7, 890,
     'Cocina de estación con producto de pequeños productores.', '{"Menú de estación","Opción vegetariana"}'),
    ('demo-lupe', 'Lupe', 'Chacarita', 'Mexicana', 2, 4.6, 530,
     'Tacos de maíz nixtamalizado en casa y barra de mezcales.', '{"Tacos al pastor","Barra de mezcal"}'),
    ('demo-almacen-arevalo', 'Almacén Arévalo', 'Palermo', 'Bodegón', 2, 4.5, 620,
     'Bodegón de barrio con vermú de la casa y picadas generosas.', '{"Mesas largas","Para grupos"}'),
    ('demo-nami', 'Nami Omakase', 'Belgrano', 'Sushi', 4, 4.9, 1100,
     'Ocho lugares en barra frente al itamae.', '{"Solo barra","Pescado del día"}'),
    ('demo-trattoria-lucca', 'Trattoria Lucca', 'Villa Crespo', 'Italiana', 2, 4.6, 640,
     'Pastas amasadas cada mañana y tiramisú de la nonna.', '{"Pasta fresca","Para grupos"}')
  returning id, slug
),
o as (
  insert into offers (restaurant_id, benefit, discount_pct, gift_label, applies_to, max_party, card_bg, card_fg)
  select r.id, v.benefit::offer_benefit, v.pct, v.gift, v.applies_to, v.max_party, v.bg, v.fg
  from r join (values
    ('demo-brasa-del-bajo', 'discount', 30, null, 'Ojo de bife para dos', 4, '#ff6b35', '#1f0d05'),
    ('demo-casa-ombu', 'discount', 25, null, 'Menú de 3 pasos', 4, '#7a1f2b', '#ffe9e0'),
    ('demo-lupe', 'gift', null, 'Mezcal', 'Copa de mezcal de bienvenida', 4, '#0f7b6c', '#e6fff8'),
    ('demo-almacen-arevalo', 'discount', 15, null, 'Vermú y picada', 8, '#ffd23f', '#2a1d00'),
    ('demo-nami', 'gift', null, 'Barra', 'Dos piezas extra del chef', 2, '#1d2b44', '#d9f0ff'),
    ('demo-trattoria-lucca', 'discount', 20, null, 'Pastas frescas y postre', 6, '#3f5b2a', '#f2f7d8')
  ) as v(slug, benefit, pct, gift, applies_to, max_party, bg, fg) on v.slug = r.slug
  returning id, restaurant_id
)
insert into offer_slots (offer_id, starts_at, tables_left)
select o.id, s.starts_at::time, s.tables_left
from o
join r on r.id = o.restaurant_id
join (values
  ('demo-brasa-del-bajo', '21:30', 1), ('demo-brasa-del-bajo', '22:00', 2),
  ('demo-casa-ombu', '21:30', 2), ('demo-casa-ombu', '22:15', 1),
  ('demo-lupe', '21:45', 3), ('demo-lupe', '22:30', 2),
  ('demo-almacen-arevalo', '21:30', 2), ('demo-almacen-arevalo', '23:00', 4),
  ('demo-nami', '22:00', 1),
  ('demo-trattoria-lucca', '21:30', 3), ('demo-trattoria-lucca', '22:30', 2)
) as s(slug, starts_at, tables_left) on s.slug = r.slug;
