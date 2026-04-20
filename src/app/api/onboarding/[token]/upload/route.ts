import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createAdminClient();
  // Validate token
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('share_token', params.token)
    .eq('is_active', true)
    .maybeSingle();
  if (!brand) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (file.size > 600 * 1024) return NextResponse.json({ error: 'Max 600 KB' }, { status: 400 });

  const ext = (file as any).name?.split('.').pop()?.toLowerCase() ?? 'jpg';
  const key = `${brand.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('brand-photos')
    .upload(key, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from('brand-photos').getPublicUrl(key);
  return NextResponse.json({ url: urlData.publicUrl });
}
