-- =============================================================================
-- brand_stock RPC — hide variants returned to brand at cycle close
-- =============================================================================
-- When admin closes a cycle and returns unsold items to the brand, those
-- variants get returned_at = now(). They should no longer appear on the
-- brand's stock dashboard (otherwise the brand still sees them as if active).
-- Historical sales stay intact (sale_items reference the variant row).
-- =============================================================================

create or replace function public.brand_stock(p_token text)
returns table (
  variant_id uuid,
  product_name text,
  sku text,
  size text,
  color text,
  retail_price_xof int,
  qty_sent int,
  qty_sold int,
  qty_remaining int,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
  v_cycle_id uuid;
begin
  select id into v_brand_id from brands where share_token = p_token and is_active and has_dashboard;
  if v_brand_id is null then raise exception 'invalid token'; end if;

  select id into v_cycle_id from cycles where is_active limit 1;

  return query
  select v.id,
         p.name,
         v.sku,
         v.size,
         v.color,
         v.retail_price_xof,
         coalesce(sm.qty_confirmed, 0) as qty_sent,
         coalesce(sm.qty_sold, 0) as qty_sold,
         greatest(coalesce(sm.qty_confirmed, 0) - coalesce(sm.qty_sold, 0), 0) as qty_remaining,
         case
           when coalesce(sm.qty_confirmed, 0) - coalesce(sm.qty_sold, 0) <= 0 then 'sold'
           else 'in_stock'
         end as status
    from variants v
    join products p on p.id = v.product_id
    left join stock_movements sm on sm.variant_id = v.id and sm.cycle_id = v_cycle_id
   where v.brand_id = v_brand_id
     and v.returned_at is null -- Hide variants returned at cycle close
   order by p.name, v.size, v.color;
end;
$$;
