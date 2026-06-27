alter table public.products add column if not exists stock int;
alter table public.products add column if not exists flavor_stock jsonb not null default '{}'::jsonb;

with product_flavors as (
  select
    p.id,
    trim(f.flavor) as flavor,
    f.ordinality as pos
  from public.products p
  cross join lateral unnest(string_to_array(coalesce(p.flavors, ''), ',')) with ordinality as f(flavor, ordinality)
  where trim(coalesce(f.flavor, '')) <> ''
), randomized as (
  select
    id,
    flavor,
    pos,
    case
      when r < 0.05 then 0
      when r < 0.12 then 1
      when r < 0.20 then 2
      else 3 + floor((r - 0.20) / 0.80 * 6)::int
    end as qty
  from (
    select id, flavor, pos, random() as r
    from product_flavors
  ) t
), rolled as (
  select
    id,
    jsonb_object_agg(flavor, qty order by pos) as flavor_stock,
    sum(qty) as total_stock
  from randomized
  group by id
)
update public.products p
set flavor_stock = rolled.flavor_stock,
    stock = rolled.total_stock,
    sold_out = rolled.total_stock <= 0
from rolled
where p.id = rolled.id;

notify pgrst, 'reload schema';
