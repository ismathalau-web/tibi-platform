-- ============================================================================
-- Brand share-link RPCs
-- Anonymous callers pass a brand share_token. Functions are SECURITY DEFINER
-- and only ever return data scoped to that one brand.
-- ============================================================================

create or replace function public.brand_summary(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand brands%rowtype;
  v_cycle cycles%rowtype;
  v_sent int;
  v_sold int;
  v_remaining int;
  v_balance bigint;
  v_paid bigint;
begin
  select * into v_brand from brands where share_token = p_token and is_active and has_dashboard;
  if not found then
    raise exception 'invalid token';
  end if;

  select * into v_cycle from cycles where is_active limit 1;

  select coalesce(sum(qty_confirmed),0), coalesce(sum(qty_sold),0)
    into v_sent, v_sold
    from stock_movements
    where brand_id = v_brand.id and (v_cycle.id is null or cycle_id = v_cycle.id);

  v_remaining := greatest(v_sent - v_sold, 0);

  -- balance due = sum( unit_price * qty * (1 - commission_pct/100) ) for items in active cycle
  select coalesce(sum( si.qty * si.unit_price_xof - si.commission_xof ), 0)
    into v_balance
    from sale_items si
    join sales s on s.id = si.sale_id
    where si.brand_id = v_brand.id
      and si.item_type = 'consignment'
      and (v_cycle.id is null or s.cycle_id = v_cycle.id);

  select coalesce(sum(amount_xof), 0) into v_paid
    from brand_payments
    where brand_id = v_brand.id and (v_cycle.id is null or cycle_id = v_cycle.id);

  return jsonb_build_object(
    'brand', jsonb_build_object(
      'id', v_brand.id,
      'name', v_brand.name,
      'country', v_brand.country,
      'category', v_brand.category,
      'currency', v_brand.currency,
      'commission_pct', v_brand.commission_pct,
      'commission_status', v_brand.commission_status
    ),
    'cycle', case when v_cycle.id is not null then jsonb_build_object(
      'id', v_cycle.id, 'name', v_cycle.name,
      'start_date', v_cycle.start_date, 'end_date', v_cycle.end_date
    ) else null end,
    'stats', jsonb_build_object(
      'sent', v_sent,
      'sold', v_sold,
      'remaining', v_remaining,
      'balance_due_xof', v_balance - v_paid,
      'paid_xof', v_paid
    )
  );
end;
$$;

revoke all on function public.brand_summary(text) from public;
grant execute on function public.brand_summary(text) to anon, authenticated;


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
   order by p.name, v.size, v.color;
end;
$$;

revoke all on function public.brand_stock(text) from public;
grant execute on function public.brand_stock(text) to anon, authenticated;


create or replace function public.brand_payment_history(p_token text)
returns table (
  cycle_name text,
  start_date date,
  end_date date,
  amount_xof int,
  paid_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
begin
  select id into v_brand_id from brands where share_token = p_token and is_active and has_dashboard;
  if v_brand_id is null then raise exception 'invalid token'; end if;

  return query
  select c.name, c.start_date, c.end_date, bp.amount_xof, bp.paid_at
    from brand_payments bp
    join cycles c on c.id = bp.cycle_id
   where bp.brand_id = v_brand_id
   order by bp.paid_at desc;
end;
$$;

revoke all on function public.brand_payment_history(text) from public;
grant execute on function public.brand_payment_history(text) to anon, authenticated;
