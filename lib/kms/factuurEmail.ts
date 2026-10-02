import { kmsAdmin } from '@/lib/kms/adminClient';

/**
 * Welk e-mailadres krijgt de factuur van deze klant?
 *
 * Volgorde (eerste niet-lege wint):
 *  1. de contactpersoon met `facturatie = true` (max. één per klant)
 *  2. organisaties.factuur_email
 *  3. organisaties.email_algemeen
 *  4. de hoofdcontact
 *
 * `bron` zegt waar het adres vandaan kwam, zodat de factuurpagina dat kan tonen.
 * Alleen server-side gebruiken, achter dashAuthed().
 */
export type FactuurEmailBron = 'facturatiecontact' | 'factuur_email' | 'email_algemeen' | 'hoofdcontact';

export async function factuurEmailVoor(
  organisatieId: string,
): Promise<{ email: string; bron: FactuurEmailBron; naam: string | null } | null> {
  const sb = kmsAdmin();
  if (!sb || !organisatieId) return null;
  const schoon = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  const [{ data: contacten }, { data: org }] = await Promise.all([
    sb
      .from('contactpersonen')
      .select('naam, email, hoofdcontact, facturatie')
      .eq('organisatie_id', organisatieId),
    sb.from('organisaties').select('factuur_email, email_algemeen').eq('id', organisatieId).maybeSingle(),
  ]);

  const lijst = (contacten ?? []) as { naam: string | null; email: string | null; hoofdcontact: boolean; facturatie: boolean }[];
  const fact = lijst.find((c) => c.facturatie && schoon(c.email));
  if (fact) return { email: schoon(fact.email)!, bron: 'facturatiecontact', naam: fact.naam };
  if (schoon(org?.factuur_email)) return { email: schoon(org?.factuur_email)!, bron: 'factuur_email', naam: null };
  if (schoon(org?.email_algemeen)) return { email: schoon(org?.email_algemeen)!, bron: 'email_algemeen', naam: null };
  const hoofd = lijst.find((c) => c.hoofdcontact && schoon(c.email));
  if (hoofd) return { email: schoon(hoofd.email)!, bron: 'hoofdcontact', naam: hoofd.naam };
  return null;
}
