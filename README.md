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

1. Creá un proyecto gratis en [supabase.com](https://supabase.com) (región São Paulo).
2. En **SQL Editor**, pegá y ejecutá `supabase/setup.sql`: crea toda la base de un saque. Si querés restaurantes ficticios para probar, ejecutá también `supabase/seed.sql` (no lo uses en el piloto real).
3. En **Authentication → URL Configuration**, poné la URL de la app como Site URL y agregá `https://TU-DOMINIO/auth/callback` y `http://localhost:3000/auth/callback` como Redirect URLs.
4. Copiá **Project URL** y la clave **anon public** (Project Settings → API) en `.env.local` para correrla en tu computadora, y en Vercel (Settings → Environment Variables) como `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. En Vercel, volvé a publicar para que las tome.
5. Ingresá a la app con tu email una vez y hacete parte del equipo en el SQL Editor:

```sql
insert into platform_admins (user_id)
select id from auth.users where email = 'tu@email.com';
```

Desde ahí, en `/admin/restaurantes` das de alta restaurantes e invitás a sus dueños por email: cuando ingresan con ese email, ven su panel en `/panel`.

Si cambiás algo en `supabase/migrations/`, regenerá el archivo único con `npm run db:setup`.

### Emails de ingreso

Supabase manda los links de ingreso con un servidor de prueba que permite pocos emails por hora. Para el piloto, configurá un SMTP propio (por ejemplo [Resend](https://resend.com)) en **Authentication → Emails → SMTP Settings**, con un remitente de tu dominio.

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
- `month_settlement`: liquidación del mes por restaurante (solo para el equipo).
- `mark_no_show`: el restaurante marca que no vino; no se cobra. Se puede recién 15 minutos después del horario reservado (la tolerancia).

"Hoy" se calcula con la hora de Buenos Aires (`today_ar()`), porque la base de datos usa UTC.

## Etapas

1. Base: proyecto, base de datos, ingreso, diseño de cartas.
2. **Lado restaurante** (lista): publicar, pausar y editar cartas en `/panel`. Sin Supabase, el panel funciona en modo de ejemplo.
3. **Lado usuario** (lista): reserva con QR, guardadas (`/guardadas`) y reservas con cancelación (`/reservas`). En modo de ejemplo quedan en el navegador.
4. **Noche de servicio** (lista): en `/panel`, pestaña "Servicio de hoy" con las reservas del día, escaneo del QR con la cámara (o el código a mano), "llegó" y "no vino", y la comisión del día.
5. **Cierre de mes** (lista): pestaña "Mes" en `/panel` con el resumen día por día y CSV de reservas; `/admin` con la liquidación por restaurante y su CSV.
6. **Piloto** (en curso): base en un solo archivo, alta de restaurantes e invitaciones desde `/admin/restaurantes`; falta conectar Supabase, emails y dominio.
