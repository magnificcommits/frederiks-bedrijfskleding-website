import { NextResponse } from 'next/server';
import { kmsAdmin, dashAuthed } from '@/lib/kms/adminClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Hit = { type: string; label: string; sub: string; href: string };
type OrgJoin = { naam: string | null } | { naam: string | null }[] | null;

/** Pakt de organisatienaam uit een Supabase-join (object of array). */
function orgNaam(j: OrgJoin): string {
  if (!j) return '';
  const o = Array.isArray(j) ? j[0] : j;
  return o?.naam ?? '';
}

const euro = (n: number | null | undefined) =>
  n == null ? '' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

const datum = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * Universeel zoeken voor het Cmd+K-palet. Zoekt parallel in klanten,
 * contactpersonen, werknemers, orders, offertes, facturen, producten, leads,
 * prospects, taken, nieuwsbrieven en drukproeven. Orders, offertes en facturen
 * vind je op nummer én op klantnaam ("wassink" geeft ook hun orders).
 */
export async function GET(req: Request) {
  if (!(await dashAuthed())) return NextResponse.json({ results: [] }, { status: 401 });
  const ruw = (new URL(req.url).searchParams.get('q') ?? '').trim();
  // Tekens die de PostgREST or()-syntaxis breken eruit; '#1004' wordt '1004'.
  const q = ruw.replace(/[,()*%\\]/g, ' ').replace(/^#/, '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const sb = kmsAdmin();
  if (!sb) return NextResponse.json({ results: [] });

  const like = `%${q}%`;
  // ordernummer en offertenummer zijn integer-kolommen: daar werkt ilike niet op.
  const nummer = /^\d+$/.test(q) ? Number(q) : null;

  // Eerst de klanten die op naam passen: hun orders/offertes/facturen tonen we ook.
  const { data: orgData } = await sb
    .from('organisaties')
    .select('id, naam, plaats, klantnummer')
    .or(`naam.ilike.${like},plaats.ilike.${like},klantnummer.ilike.${like}`)
    .order('naam')
    .limit(6);
  const orgs = (orgData as { id: string; naam: string; plaats: string | null; klantnummer: string | null }[]) ?? [];
  const orgIds = orgs.map((o) => o.id);

  const leeg = Promise.resolve({ data: [] as unknown[] });
  const [contacten, werknemers, orders, offertes, facturen, prods, leads, prospects, taken, brieven, proeven] = await Promise.all([
    sb.from('contactpersonen').select('id, naam, email, functie, organisatie_id, organisaties(naam)').or(`naam.ilike.${like},email.ilike.${like}`).limit(5),
    sb
      .from('medewerkers')
      .select('id, naam, voornaam, achternaam, email, personeelsnummer, organisatie_id, organisaties(naam)')
      .or(`naam.ilike.${like},voornaam.ilike.${like},achternaam.ilike.${like},email.ilike.${like},personeelsnummer.ilike.${like}`)
      .limit(5),
    nummer !== null
      ? sb.from('orders').select('id, ordernummer, status, bedrag, besteldatum, organisaties(naam)').eq('ordernummer', nummer).limit(5)
      : orgIds.length
        ? sb.from('orders').select('id, ordernummer, status, bedrag, besteldatum, organisaties(naam)').in('organisatie_id', orgIds).order('created_at', { ascending: false }).limit(5)
        : sb.from('orders').select('id, ordernummer, status, bedrag, besteldatum, organisaties(naam)').ilike('referentienr', like).limit(5),
    nummer !== null
      ? sb.from('offertes').select('id, offertenummer, status, created_at, organisaties(naam)').eq('offertenummer', nummer).limit(5)
      : orgIds.length
        ? sb.from('offertes').select('id, offertenummer, status, created_at, organisaties(naam)').in('organisatie_id', orgIds).order('created_at', { ascending: false }).limit(4)
        : leeg,
    orgIds.length && nummer === null
      ? sb.from('facturen').select('id, factuurnummer, status, bedrag_incl, organisaties(naam)').in('organisatie_id', orgIds).order('created_at', { ascending: false }).limit(4)
      : sb.from('facturen').select('id, factuurnummer, status, bedrag_incl, organisaties(naam)').ilike('factuurnummer', like).limit(5),
    sb.from('producten').select('id, naam, merk, sku').or(`naam.ilike.${like},merk.ilike.${like},sku.ilike.${like}`).limit(6),
    sb.from('leads').select('id, name, company, email, status').or(`name.ilike.${like},company.ilike.${like},email.ilike.${like}`).order('created_at', { ascending: false }).limit(4),
    sb.from('prospecten').select('id, bedrijfsnaam, plaats, status').or(`bedrijfsnaam.ilike.${like},contactpersoon.ilike.${like},plaats.ilike.${like}`).limit(4),
    sb
      .from('taken')
      .select('id, titel, omschrijving, soort, vervaldatum, organisaties(naam)')
      .is('verwijderd_op', null)
      .or(`titel.ilike.${like},omschrijving.ilike.${like}`)
      .order('vervaldatum', { ascending: false, nullsFirst: false })
      .limit(4),
    sb.from('nieuwsbrieven').select('id, naam, onderwerp, status, is_template').or(`naam.ilike.${like},onderwerp.ilike.${like}`).limit(4),
    sb.from('drukproeven').select('id, naam, status, organisaties(naam)').ilike('naam', like).limit(4),
  ]);

  const results: Hit[] = [];
  for (const o of orgs) {
    results.push({ type: 'Klant', label: o.naam, sub: [o.klantnummer, o.plaats].filter(Boolean).join(' · '), href: `/dashboard/klanten/${o.id}` });
  }
  for (const c of (contacten.data as { id: string; naam: string | null; email: string | null; functie: string | null; organisatie_id: string; organisaties: OrgJoin }[]) ?? []) {
    results.push({
      type: 'Contact',
      label: c.naam || c.email || 'Contactpersoon',
      sub: [orgNaam(c.organisaties), c.functie, c.email].filter(Boolean).join(' · '),
      href: `/dashboard/klanten/${c.organisatie_id}?tab=contact`,
    });
  }
  for (const w of (werknemers.data as {
    id: string;
    naam: string | null;
    voornaam: string | null;
    achternaam: string | null;
    email: string | null;
    personeelsnummer: string | null;
    organisatie_id: string;
    organisaties: OrgJoin;
  }[]) ?? []) {
    results.push({
      type: 'Werknemer',
      label: w.naam || [w.voornaam, w.achternaam].filter(Boolean).join(' ') || w.email || 'Werknemer',
      sub: [orgNaam(w.organisaties), w.personeelsnummer ? `nr. ${w.personeelsnummer}` : '', w.email].filter(Boolean).join(' · '),
      href: `/dashboard/klanten/${w.organisatie_id}?tab=werknemers&maten=${w.id}`,
    });
  }
  for (const o of (orders.data as { id: string; ordernummer: number | null; status: string; bedrag: number | null; besteldatum: string | null; organisaties: OrgJoin }[]) ?? []) {
    results.push({
      type: 'Order',
      label: `Order #${o.ordernummer ?? ''} · ${orgNaam(o.organisaties)}`,
      sub: [o.status?.replace(/_/g, ' '), datum(o.besteldatum), euro(o.bedrag)].filter(Boolean).join(' · '),
      href: `/dashboard/orders/${o.id}`,
    });
  }
  for (const o of (offertes.data as { id: string; offertenummer: number | null; status: string; created_at: string; organisaties: OrgJoin }[]) ?? []) {
    results.push({
      type: 'Offerte',
      label: `Offerte #${o.offertenummer ?? ''} · ${orgNaam(o.organisaties)}`,
      sub: [o.status, datum(o.created_at)].filter(Boolean).join(' · '),
      href: `/dashboard/offertes/${o.id}`,
    });
  }
  for (const f of (facturen.data as { id: string; factuurnummer: string | null; status: string | null; bedrag_incl: number | null; organisaties: OrgJoin }[]) ?? []) {
    results.push({
      type: 'Factuur',
      label: `${f.factuurnummer ?? f.id.slice(0, 8)} · ${orgNaam(f.organisaties)}`,
      sub: [f.status, euro(f.bedrag_incl)].filter(Boolean).join(' · '),
      href: `/dashboard/facturen/${f.id}`,
    });
  }
  for (const p of (prods.data as { id: string; naam: string; merk: string | null; sku: string | null }[]) ?? []) {
    results.push({ type: 'Product', label: p.naam, sub: [p.merk, p.sku].filter(Boolean).join(' · '), href: `/dashboard/producten/${p.id}` });
  }
  for (const l of (leads.data as { id: string; name: string | null; company: string | null; email: string | null; status: string | null }[]) ?? []) {
    results.push({
      type: 'Lead',
      label: l.company || l.name || l.email || 'Lead',
      sub: [l.company ? l.name : '', l.email, l.status].filter(Boolean).join(' · '),
      href: `/dashboard/leads?q=${encodeURIComponent(l.email || l.company || l.name || '')}`,
    });
  }
  for (const p of (prospects.data as { id: string; bedrijfsnaam: string; plaats: string | null; status: string | null }[]) ?? []) {
    results.push({ type: 'Prospect', label: p.bedrijfsnaam, sub: [p.plaats, p.status].filter(Boolean).join(' · '), href: `/dashboard/prospects/${p.id}` });
  }
  for (const t of (taken.data as { id: string; titel: string | null; omschrijving: string | null; soort: string | null; vervaldatum: string | null; organisaties: OrgJoin }[]) ?? []) {
    results.push({
      type: t.soort === 'afspraak' ? 'Afspraak' : 'Taak',
      label: t.titel || t.omschrijving || 'Taak',
      sub: [orgNaam(t.organisaties), datum(t.vervaldatum)].filter(Boolean).join(' · '),
      href: `/dashboard/taken?taak=${t.id}`,
    });
  }
  for (const n of (brieven.data as { id: string; naam: string; onderwerp: string | null; status: string | null; is_template: boolean | null }[]) ?? []) {
    results.push({
      type: n.is_template ? 'Template' : 'Nieuwsbrief',
      label: n.naam,
      sub: [n.onderwerp, n.status].filter(Boolean).join(' · '),
      href: `/dashboard/nieuwsbrief/${n.id}`,
    });
  }
  for (const d of (proeven.data as { id: string; naam: string | null; status: string | null; organisaties: OrgJoin }[]) ?? []) {
    results.push({ type: 'Drukproef', label: d.naam || 'Drukproef', sub: [orgNaam(d.organisaties), d.status].filter(Boolean).join(' · '), href: `/dashboard/drukproeven/${d.id}` });
  }

  return NextResponse.json({ results });
}
