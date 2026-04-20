-- =============================================================================
-- BRAND SUMMARY — net figures (excludes voided sales + deducts returns)
-- =============================================================================
-- The previous brand_summary RPC computed balance_due from raw sale_items
-- without filtering voided sales or subtracting returned quantities.
-- This version makes the numbers match what Tibi actually owes.
-- =============================================================================

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
  v_sold int;      -- net sold (qty_sold already reflects returns)
  v_returned int;  -- units returned in this cycle
  v_remaining int;
  v_balance bigint;
  v_paid bigint;
begin
  select * into v_brand from brands where share_token = p_token and is_active and has_dashboard;
  if not found then
    raise exception 'invalid token';
  end if;

  select * into v_cycle from cycles where is_active limit 1;

  -- qty_sold and qty_returned come from stock_movements and are kept in sync
  -- by the app's processReturn action.
  select coalesce(sum(qty_confirmed),0),
         coalesce(sum(qty_sold),0),
         coalesce(sum(qty_returned),0)
    into v_sent, v_sold, v_returned
    from stock_movements
    where brand_id = v_brand.id and (v_cycle.id is null or cycle_id = v_cycle.id);

  v_remaining := greatest(v_sent - v_sold, 0);

  -- Balance due: consignment items in active cycle, NOT voided, NET of returns.
  -- For each sale_item: (qty - returned_qty) * unit_price - commission
  select coalesce(sum(
           greatest(si.qty - coalesce(rt.returned_qty, 0), 0) * si.unit_price_xof
           - si.commission_xof
         ), 0)
    into v_balance
    from sale_items si
    join sales s on s.id = si.sale_id
    left join (
      select sale_item_id, sum(qty) as returned_qty
        from returns
       group by sale_item_id
    ) rt on rt.sale_item_id = si.id
    where si.brand_id = v_brand.id
      and si.item_type = 'consignment'
      and s.voided_at is null
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
      'returned', v_returned,
      'remaining', v_remaining,
      'balance_due_xof', greatest(v_balance - v_paid, 0),
      'paid_xof', v_paid
    )
  );
end;
$$;
