import { isLeadsDbConfigured } from '@/lib/env';
import { dashAuthed, eisEigenaar } from '@/lib/kms/adminClient';
import { getLeads } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const cols = ['created_at', 'name', 'company', 'email', 'phone', 'branche', 'aantal', 'bron', 'status', 'offertewaarde', 'notitie'] as const;

export async function GET() {
  if (!(await dashAuthed())) {
    return new Response('Niet toegestaan', { status: 401 });
  }
  await eisEigenaar();
  if (!isLeadsDbConfigured) return new Response('Niet geconfigureerd', { status: 400 });

  const leads = await getLeads();
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [cols.join(','), ...leads.map((l) => cols.map((c) => esc((l as Record<string, unknown>)[c])).join(','))];
  const csv = '﻿' + rows.join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
