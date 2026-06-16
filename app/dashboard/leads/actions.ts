'use server';
import { redirect } from 'next/navigation';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';

export async function converteerLead(formData: FormData) {
  if (!(await dashAuthed())) redirect('/dashboard');
  const id = String(formData.get('id') ?? '');
  const sb = kmsAdmin();
  if (!sb || !id) redirect('/dashboard/leads');
  const { data: lead } = await sb.from('leads').select('*').eq('id', id).maybeSingle();
  const l = lead as { id: string; name: string; company: string | null; email: string | null; phone: string | null; organisatie_id: string | null } | null;
  if (!l) redirect('/dashboard/leads');
  if (l.organisatie_id) redirect('/dashboard/klanten/' + l.organisatie_id);
  const { data: org } = await sb
    .from('organisaties')
    .insert({ naam: l.company || l.name, contactpersoon: l.name, email_algemeen: l.email })
    .select('id')
    .single();
  const orgId = (org as { id: string } | null)?.id;
  if (!orgId) redirect('/dashboard/leads');
  await sb.from('contactpersonen').insert({ organisatie_id: orgId, naam: l.name, email: l.email, telefoon: l.phone, hoofdcontact: true });
  await sb.from('leads').update({ organisatie_id: orgId }).eq('id', id);
  redirect('/dashboard/klanten/' + orgId);
}
