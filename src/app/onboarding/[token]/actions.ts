'use server';

import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { resendConfig, getResend } from '@/lib/resend';
import { render } from '@react-email/render';
import OnboardingConfirmation from '@/emails/onboarding-confirmation';
import { buildSku } from '@/lib/sku';

const profileSchema = z.object({
  token: z.string().min(8),
  name: z.string().trim().min(1),
  country: z.string().trim().min(1),
  category: z.string().trim().optional().nullable(),
  email: z.string().trim().email(),
  instagram: z.string().trim().optional().nullable(),
  currency: z.enum(['XOF', 'NGN', 'GHS', 'MAD', 'USD', 'EUR']),
});

const itemsSchema = z.object({
  token: z.string().min(8),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        size: z.string().trim().optional().nullable(),
        color: z.string().trim().optional().nullable(),
        retail_price_xof: z.coerce.number().int().nonnegative(),
        qty: z.coerce.number().int().positive(),
        photo_url: z.string().url().optional().nullable(),
      }),
    )
    .min(1),
});

export async function saveProfile(data: z.infer<typeof profileSchema>) {
  const v = profileSchema.parse(data);
  const supabase = createAdminClient();
  const { data: brand, error } = await supabase
    .from('brands')
    .update({
      name: v.name,
      country: v.country,
      category: v.category,
      email: v.email,
      instagram: v.instagram,
      currency: v.currency,
    })
    .eq('share_token', v.token)
    .eq('type', 'consignment')
    .select('id, name')
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!brand) return { ok: false as const, error: 'Invalid link' };
  return { ok: true as const, brandId: brand.id };
}

export async function submitOnboarding(data: z.infer<typeof itemsSchema>) {
  const v = itemsSchema.parse(data);
  const supabase = createAdminClient();

  const { data: brand, error: brandErr } = await supabase
    .from('brands')
    .select('id, name, email')
    .eq('share_token', v.token)
    .eq('type', 'consignment')
    .maybeSingle();
  if (brandErr || !brand) return { ok: false as const, error: 'Invalid link' };

  const { data: cycle } = await supabase.from('cycles').select('id, name').eq('is_active', true).maybeSingle();
  if (!cycle) return { ok: false as const, error: 'No active cycle' };

  // Create product per unique item name, variants per row, qty_sent stock_movement row.
  const byProduct = new Map<string, typeof v.items>();
  for (const it of v.items) {
    const arr = byProduct.get(it.name) ?? [];
    arr.push(it);
    byProduct.set(it.name, arr);
  }

  const { count: existingCount, error: countErr } = await supabase
    .from('variants')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brand.id);
  if (countErr) return { ok: false as const, error: countErr.message };
  let seq = (existingCount ?? 0) + 1;

  for (const [name, rows] of byProduct.entries()) {
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .insert({ brand_id: brand.id, name })
      .select('id')
      .single();
    if (prodErr) return { ok: false as const, error: prodErr.message };

    for (const it of rows) {
      const sku = buildSku({ brandName: brand.name, num: seq++, size: it.size ?? null, color: it.color ?? null });
      const { data: variant, error: varErr } = await supabase
        .from('variants')
        .insert({
          product_id: product.id,
          brand_id: brand.id,
          sku,
          size: it.size,
          color: it.color,
          retail_price_xof: it.retail_price_xof,
          stock_qty: 0, // zero until admin confirms physical reception
          photo_url: it.photo_url ?? null,
          status: 'active',
        })
        .select('id')
        .single();
      if (varErr) return { ok: false as const, error: varErr.message };

      const { error: movErr } = await supabase.from('stock_movements').insert({
        variant_id: variant.id,
        brand_id: brand.id,
        cycle_id: cycle.id,
        qty_sent: it.qty,
        qty_confirmed: 0,
        qty_sold: 0,
        qty_returned: 0,
      });
      if (movErr) return { ok: false as const, error: movErr.message };
    }
  }

  // Send confirmation email (best-effort — don't fail the submission if Resend isn't configured).
  try {
    if (process.env.RESEND_API_KEY && brand.email) {
      const html = await render(
        OnboardingConfirmation({
          brandName: brand.name,
          cycleName: cycle.name,
          itemCount: v.items.reduce((s, it) => s + it.qty, 0),
        }),
      );
      await getResend().emails.send({
        from: resendConfig.from,
        to: brand.email,
        bcc: [resendConfig.adminNotify],
        subject: `Tibi — onboarding received for ${brand.name}`,
        html,
      });
    }
  } catch (err) {
    console.warn('Resend send failed', err);
  }

  return { ok: true as const };
}
