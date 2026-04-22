-- =============================================================================
-- BRAND SALES DETAIL — line-by-line sales for the brand share dashboard
-- =============================================================================
-- The brand needs to see each transaction (date, item, qty, price, share)
-- so the totals on the dashboard can be reconciled with concrete sales.
-- Net of returns. Voided sales excluded. Active cycle only.
-- =============================================================================

create or replace function public.brand_sales_detail(p_token text)
returns table (
  sale_item_id      uuid,
  sold_at           timestamptz,
  invoice_no        integer,
  product_name      text,
  sku               text,
  size              text,
  color             text,
  qty_sold          integer,
  unit_price_xof    integer,
  unit_brand_share_xof integer,
  total_brand_share_xof integer
)
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_brand_id uuid;
  v_cycle_id uuid;
begin
  select id into v_brand_id
    from brands
   where share_token = p_token and is_active and has_dashboard;
  if v_brand_id is null then
    raise exception 'invalid token';
  end if;

  select id into v_cycle_id from cycles where is_active limit 1;

  return query
  with returned as (
    select sale_item_id, sum(qty) as q
      from returns
     group by sale_item_id
  )
  select
    si.id as sale_item_id,
    s.created_at as sold_at,
    s.invoice_no,
    p.name as product_name,
    v.sku,
    v.size,
    v.color,
    -- Net qty after returns
    greatest(si.qty - coalesce(rt.q, 0), 0) as qty_sold,
    si.unit_price_xof,
    -- Per-unit brand share = retail price - commission applied to that unit
    -- commission_xof on sale_item is the Tibi cut for the FULL line; spread per unit
    case
      when si.qty > 0 then si.unit_price_xof - (si.commission_xof / si.qty)
      else 0
    end::integer as unit_brand_share_xof,
    -- Total share for the net-sold qty
    greatest(si.qty - coalesce(rt.q, 0), 0) *
      case when si.qty > 0 then si.unit_price_xof - (si.commission_xof / si.qty) else 0 end
      as total_brand_share_xof
  from sale_items si
  join sales s on s.id = si.sale_id
  join variants v on v.id = si.variant_id
  join products p on p.id = v.product_id
  left join returned rt on rt.sale_item_id = si.id
  where si.brand_id = v_brand_id
    and si.item_type = 'consignment'
    and s.voided_at is null
    and (v_cycle_id is null or s.cycle_id = v_cycle_id)
    and greatest(si.qty - coalesce(rt.q, 0), 0) > 0
  order by s.created_at desc;
end;
$body$;

revoke all on function public.brand_sales_detail(text) from public;
grant execute on function public.brand_sales_detail(text) to anon, authenticated;
