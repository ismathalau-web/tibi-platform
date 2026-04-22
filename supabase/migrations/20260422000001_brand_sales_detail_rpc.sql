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
  -- Rename the join column to avoid clashing with the OUT parameter
  -- sale_item_id (which is a plpgsql variable inside the function scope)
  with returned_qty as (
    select r.sale_item_id as item_id, sum(r.qty) as q
      from returns r
     group by r.sale_item_id
  )
  select
    si.id, s.created_at, s.invoice_no, p.name, v.sku, v.size, v.color,
    greatest(si.qty - coalesce(rt.q, 0), 0)::integer,
    si.unit_price_xof,
    case
      when si.qty > 0 then si.unit_price_xof - (si.commission_xof / si.qty)
      else 0
    end::integer,
    (greatest(si.qty - coalesce(rt.q, 0), 0) *
      case when si.qty > 0 then si.unit_price_xof - (si.commission_xof / si.qty) else 0 end
    )::integer
  from sale_items si
  join sales s on s.id = si.sale_id
  join variants v on v.id = si.variant_id
  join products p on p.id = v.product_id
  left join returned_qty rt on rt.item_id = si.id
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
