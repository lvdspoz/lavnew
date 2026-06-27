create extension if not exists pgcrypto;

create table if not exists public.site_settings (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_sections (
  id text primary key,
  title text not null,
  sub text default '',
  aliases text[] not null default '{}',
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price text not null default '',
  cat text not null default 'other',
  tag text default '',
  description text default '',
  image_url text default '',
  mark text default '',
  flavors text default '',
  flavor_stock jsonb not null default '{}'::jsonb,
  stock int,
  active boolean not null default true,
  sold_out boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists stock int;

alter table public.products
  add column if not exists flavor_stock jsonb not null default '{}'::jsonb;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_site_settings_updated_at on public.site_settings;
create trigger touch_site_settings_updated_at
before update on public.site_settings
for each row execute function public.touch_updated_at();

drop trigger if exists touch_menu_sections_updated_at on public.menu_sections;
create trigger touch_menu_sections_updated_at
before update on public.menu_sections
for each row execute function public.touch_updated_at();

drop trigger if exists touch_products_updated_at on public.products;
create trigger touch_products_updated_at
before update on public.products
for each row execute function public.touch_updated_at();

alter table public.site_settings enable row level security;
alter table public.menu_sections enable row level security;
alter table public.products enable row level security;

drop policy if exists "Public read settings" on public.site_settings;
create policy "Public read settings"
on public.site_settings for select
to anon, authenticated
using (true);

drop policy if exists "Public read menu sections" on public.menu_sections;
create policy "Public read menu sections"
on public.menu_sections for select
to anon, authenticated
using (true);

drop policy if exists "Public read active products" on public.products;
create policy "Public read active products"
on public.products for select
to anon, authenticated
using (active = true or auth.role() = 'authenticated');

drop policy if exists "Authenticated manage settings" on public.site_settings;
create policy "Authenticated manage settings"
on public.site_settings for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated manage menu sections" on public.menu_sections;
create policy "Authenticated manage menu sections"
on public.menu_sections for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated manage products" on public.products;
create policy "Authenticated manage products"
on public.products for all
to authenticated
using (true)
with check (true);

insert into public.site_settings (id, data)
values (
  'main',
  '{
    "name": "LAVISH",
    "orderLink": "https://t.me/Lavishz_bot",
    "supportLink": "https://t.me/OfficialLavishz",
    "discordUsername": "",
    "cartNote": "Checkout opens your off-site payment link.",
    "checkoutButtonText": "Checkout",
    "hero": {
      "kicker": "Limited drops / private stock",
      "title": "LAVISH",
      "sub": "Premium candy. Low-volume releases. Clean finish.",
      "btn1": "Menu",
      "btn2": "Order Lavish",
      "note": "Payments are handled off-site"
    }
  }'::jsonb
)
on conflict (id) do nothing;

insert into public.menu_sections (id, title, sub, aliases, sort_order) values
  ('yarts', 'Yarts', 'Nicotine', array['yarts','disposables-thc','gummies','gummy'], 1),
  ('nicotine', 'Disposables', 'Nicotine', array['nicotine','nic','disposables-nic','chocolate'], 2),
  ('flower-rosin', 'Flower/Rosin', 'thc', array['flower-rosin','flower','cannabis','rosin'], 3),
  ('eddies', 'Eddies', 'thc', array['eddies','edibles-thc','sour'], 4)
on conflict (id) do nothing;

insert into public.products
  (name, price, cat, tag, description, image_url, mark, flavors, active, sold_out, sort_order)
values
  ('Skittles', '$24.99', 'yarts', 'Yarts', 'Muha 3rd gen', 'assets/products/skittles-muha.png', 'S', 'Blueberry Haze, Watermelon Zkittlez, Pineapple Express, Mango Madness, Strawberry Runtz, Grape Ape, Banana Kush, Sour Diesel, Apple Gelato, Wedding Cake', true, false, 1),
  ('Jolly Ranchers', '$24.99', 'yarts', 'Yarts', 'MadLabs', 'assets/products/jolly-ranchers-madlabs.png', 'J', 'Blue Raspberry, Watermelon, Green Apple, Grape, Cherry, Strawberry, Peach Mango, Pineapple', true, false, 2),
  ('Caramel M&Ms', '$24.99', 'yarts', 'Yarts', 'Boutiq v5', 'assets/products/caramel-mms-boutiq.png', 'C', 'Wedding Cake, Gelato 41, Banana Runtz, Pineapple Express, Strawberry Cough, OG Kush, Blueberry Haze, Watermelon Zkittlez', true, false, 3),
  ('MikeAndIke', '$24.99', 'nicotine', 'Nicotine', 'Geek bar', 'assets/products/mike-and-ike-geek.png', 'M', 'Watermelon Ice, Blue Razz Ice, Strawberry Ice, Mango Ice, Peach Ice, Grape Ice, Lemon Ice, Kiwi Passionfruit Guava', true, false, 4),
  ('Hot Tamales', '$29.99', 'nicotine', 'Nicotine', 'Foger', 'assets/products/hot-tamales-foger.png', 'H', 'Strawberry Watermelon, Blueberry Lemon, Mango Peach, Pink Lemonade, Watermelon Ice, Grape Ice, Cherry Limeade', true, false, 5),
  ('Milk Duds', '$19.99', 'nicotine', 'Nicotine', 'Lost Mary', 'assets/products/milk-duds-lost-mary.png', 'D', 'Blueberry Ice, Strawberry Ice, Watermelon Ice, Mango Ice, Peach Ice, Grape Ice, Lychee Ice, Passion Fruit Ice', true, false, 6),
  ('Trolli Peach-Ring Gummies', '$29.99', 'eddies', 'Eddies', 'Edibles (10 calories x 10 gummies)', 'assets/products/trolli-peach-rings.png', 'T', 'Watermelon, Strawberry, Peach, Tropical Punch, Sour Apple, Blue Raspberry, Grape, Cherry', true, false, 7),
  ('Whoppers', '$29.99', 'flower-rosin', 'Flower/Rosin', 'Big Buds - 3.5g', '', 'W', 'OG Kush, Gorilla Glue, Blue Dream, Purple Haze, Sour Diesel, Wedding Cake, Gelato, Runtz', true, false, 8),
  ('Swedish Fish', '$29.99', 'flower-rosin', 'Flower/Rosin', 'live-rosin-tier-3', '', 'S', 'Strawberry, Tropical, Berry Blast, Lemon, Watermelon, Peach, Grape, Cherry', true, false, 9)
on conflict do nothing;
