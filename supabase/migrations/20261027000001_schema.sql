-- Migración 1: esquema base (combos, perfiles de administrador, pedidos).
-- La seguridad (RLS, permisos) está en la migración 2 y las operaciones en la 3.

-- ---------------------------------------------------------------------------
-- Administradores autorizados. Un usuario de Supabase Auth NO es admin por
-- el simple hecho de existir: solo lo es si tiene una fila aquí.
-- ---------------------------------------------------------------------------
create table public.admin_profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Combos configurables desde el panel.
-- ---------------------------------------------------------------------------
create table public.combos (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  price      numeric(10, 2) not null check (price > 0 and price <= 9999.99),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index combos_name_unique on public.combos (lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- Pedidos. El pago y la entrega son estados independientes.
-- ---------------------------------------------------------------------------
create table public.orders (
  id             uuid primary key default gen_random_uuid(),

  -- Código corto legible (para mostrar y para teclear a mano). NO da acceso público.
  short_code     text not null unique check (short_code ~ '^[A-Z2-9]{6}$'),

  -- Identificador público e impredecible del cupón (va dentro del QR).
  -- Solo existe cuando el pago está confirmado.
  coupon_token   text unique check (coupon_token ~ '^[0-9a-f]{32}$'),

  buyer_name     text not null check (char_length(btrim(buyer_name)) between 1 and 120),
  buyer_contact  text check (buyer_contact is null or char_length(buyer_contact) <= 120),

  combo_id       uuid not null references public.combos (id) on delete restrict,
  -- Copia del nombre del combo al momento de la compra: renombrar el combo
  -- después no cambia lo que dice un cupón ya emitido.
  combo_name     text not null,

  quantity       integer not null check (quantity between 1 and 100),
  unit_price     numeric(10, 2) not null check (unit_price > 0 and unit_price <= 9999.99),
  -- El total NUNCA lo envía el cliente: lo calcula la base de datos.
  total          numeric(12, 2) generated always as (quantity * unit_price) stored,

  payment_status text not null default 'pendiente'
                 check (payment_status in ('pendiente', 'pagado')),
  paid_at        timestamptz,
  paid_by        uuid references auth.users (id) on delete set null,

  delivery_status text not null default 'pendiente'
                 check (delivery_status in ('pendiente', 'entregado')),
  delivered_at   timestamptz,
  delivered_by   uuid references auth.users (id) on delete set null,

  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id) on delete set null,

  -- Cupón válido <=> pago confirmado.
  constraint orders_token_iff_paid
    check ((payment_status = 'pagado') = (coupon_token is not null)),
  constraint orders_paid_at_iff_paid
    check ((payment_status = 'pagado') = (paid_at is not null)),

  -- Solo se entrega lo pagado, y entregado <=> hay fecha de entrega.
  constraint orders_delivery_consistent
    check (
      (delivery_status = 'pendiente' and delivered_at is null)
      or (delivery_status = 'entregado' and payment_status = 'pagado' and delivered_at is not null)
    )
);

-- short_code y coupon_token ya tienen índice por su restricción UNIQUE.
-- Con cientos de pedidos no hacen falta más índices; la búsqueda por nombre usa ILIKE.
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_combo_id_idx on public.orders (combo_id);
