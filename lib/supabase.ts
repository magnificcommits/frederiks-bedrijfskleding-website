import { env, isLeadsDbConfigured } from '@/lib/env';

/**
 * Lichte Supabase-laag zonder extra npm-package: we praten rechtstreeks met
 * de REST-API (PostgREST) met de server-side service-role key. Zonder
 * configuratie doen alle functies niets, zodat preview/lokaal blijft werken.
 * De service-role key komt NOOIT in client-code; dit bestand draait server-side.
 */

export type Lead = {
  id: string;
  created_at: string;
  name: string;
  company?: string | null;
  email: string;
  phone?: string | null;
  branche?: string | null;
  aantal?: string | null;
  bericht?: string | null;
  bron?: string | null;
  status: string;
  offertewaarde?: number | null;
  notitie?: string | null;
};

export type NieuweLead = Omit<Lead, 'id' | 'created_at' | 'status' | 'offertewaarde' | 'notitie'> & { status?: string };

function headers() {
  return {
    apikey: env.supabaseServiceKey,
    Authorization: `Bearer ${env.supabaseServiceKey}`,
    'Content-Type': 'application/json',
  };
}

const base = () => `${env.supabaseUrl.replace(/\/$/, '')}/rest/v1/leads`;

export async function saveLead(lead: NieuweLead): Promise<{ saved: boolean }> {
  if (!isLeadsDbConfigured) return { saved: false };
  try {
    const res = await fetch(base(), {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'nieuw', ...lead }),
      cache: 'no-store',
    });
    return { saved: res.ok };
  } catch {
    return { saved: false };
  }
}

export async function getLeads(): Promise<Lead[]> {
  if (!isLeadsDbConfigured) return [];
  try {
    const res = await fetch(`${base()}?select=*&order=created_at.desc&limit=1000`, {
      headers: headers(),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return (await res.json()) as Lead[];
  } catch {
    return [];
  }
}

type LeadPatch = { status?: string; offertewaarde?: number | null; notitie?: string | null };

export async function updateLead(id: string, patch: LeadPatch): Promise<boolean> {
  if (!isLeadsDbConfigured) return false;
  try {
    const res = await fetch(`${base()}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}
