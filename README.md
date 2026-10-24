# Última Mesa

Mesas de último momento en los mejores restaurantes. Los restaurantes publican mesas libres con un beneficio (descuento o regalo), los usuarios las descubren como cartas, reservan gratis y reciben un QR. El restaurante paga una comisión por comensal **solo cuando registra la llegada**.

Es una app web instalable (PWA) hecha con Next.js y Supabase.

## Correrla en tu computadora

Necesitás Node.js 20 o más nuevo.

```bash
npm install
npm run dev
```

Abrí http://localhost:3000. Sin configurar nada, la app muestra **datos de ejemplo** y el ingreso queda desactivado.

## Conectar la base de datos (Supabase)

1. Creá un proyecto gratis en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecutá en orden los archivos de `supabase/migrations/` (`0001_esquema_inicial.sql`, `0002_noche_de_servicio.sql`) y después `supabase/seed.sql` (restaurantes ficticios con cartas para hoy).
3. En **Authentication → URL Configuration**, agregá `http://localhost:3000/auth/callback` (y la URL de producción cuando la tengas) como Redirect URL.
4. Copiá `.env.example` como `.env.local` y completá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project settings → API).
5. Reiniciá `npm run dev`.

Para dar acceso al panel a un restaurante, una vez que la persona ingresó con su email:

```sql
insert into restaurant_staff (restaurant_id, user_id, role)
select r.id, u.id, 'owner'
from restaurants r, auth.users u
where r.slug = 'demo-brasa-del-bajo' and u.email = 'duenio@ejemplo.com';
```

## Cómo está organizado

| Carpeta | Qué hay |
| --- | --- |
| `app/` | Pantallas: mazo de cartas (`/`), ingreso (`/login`), cuenta (`/cuenta`), panel del restaurante (`/panel`, con servicio de hoy y cartas) y sus acciones (`app/panel/actions.ts`) |
| `components/` | Carta, mazo con gestos para deslizar y detalle de la mesa |
| `lib/` | Tipos, lectura de cartas desde Supabase y datos de ejemplo |
| `supabase/` | Esquema, reglas de acceso y funciones de negocio en SQL |

### Reglas de negocio en la base de datos

Las reservas se crean y cambian solo con funciones de Postgres, no escribiendo la tabla desde el navegador:

- `book_slot`: reserva una mesa. Bloquea el horario para que dos personas no se lleven la última, valida cupo y cantidad de personas, y genera el código `UM-XXXXX`.
- `cancel_reservation`: la persona cancela y la mesa vuelve a estar disponible.
- `register_arrival`: el restaurante registra la llegada con el código y se fija la comisión (personas × comisión del restaurante).
- `mark_no_show`: el restaurante marca que no vino; no se cobra. Se puede recién 15 minutos después del horario reservado (la tolerancia).

"Hoy" se calcula con la hora de Buenos Aires (`today_ar()`), porque la base de datos usa UTC.

## Etapas

1. Base: proyecto, base de datos, ingreso, diseño de cartas.
2. **Lado restaurante** (lista): publicar, pausar y editar cartas en `/panel`. Sin Supabase, el panel funciona en modo de ejemplo.
3. **Lado usuario** (lista): reserva con QR, guardadas (`/guardadas`) y reservas con cancelación (`/reservas`). En modo de ejemplo quedan en el navegador.
4. **Noche de servicio** (lista): en `/panel`, pestaña "Servicio de hoy" con las reservas del día, escaneo del QR con la cámara (o el código a mano), "llegó" y "no vino", y la comisión del día.
5. Cierre de mes: resumen y liquidación en CSV.
6. Piloto: dominio, emails y primeros restaurantes.
