import { kmsAdmin } from '@/lib/kms/adminClient';
import { campagneModelV2 } from '@/lib/kms/campagne-engine';
import { getCampagneInstellingen } from '@/lib/kms/campagneInstellingen';
import { contactSleutel, laadContacten, schrijfContactenIn } from '@/lib/kms/campagneContacten';
import { normaliseerTrigger } from '@/lib/campagnes/flow';

/**
 * Een nieuwe lead meteen inschrijven in actieve campagnes met trigger "lead_nieuw".
 * Zelfde filters als de cron (lib/kms/campagne-engine.ts triggerKandidaten):
 * bron bevat, ingang (bron_kanaal) en branche. De cron zou de lead de volgende
 * werkdag om 09:00 ook vinden; dit zorgt dat hij direct in de flow staat en de
 * eerste mail bij de eerstvolgende run meegaat. Dubbel inschrijven kan niet:
 * schrijfContactenIn slaat bestaande inschrijvingen over.
 *
 * Best effort: geeft het aantal campagnes terug waarin de lead nieuw is ingeschreven.
 */
export async function schrijfLeadInBijTriggers(leadId: string): Promise<number> {
  const sb = kmsAdmin();
  if (!sb) return 0;
  if (!(await campagneModelV2())) return 0;
  const inst = await getCampagneInstellingen();
  if (inst.allesGepauzeerd) return 0;

  const { data } = await sb.from('campagnes').select('id, trigger, geactiveerd_op, created_at').eq('status', 'actief');
  const campagnes = ((data as { id: string; trigger: unknown; geactiveerd_op: string | null; created_at: string }[]) ?? [])
    .map((c) => ({ ...c, t: normaliseerTrigger(c.trigger) }))
    .filter((c) => c.t.soort === 'lead_nieuw');
  if (!campagnes.length) return 0;

  const contacten = await laadContacten({ leadIds: [leadId] });
  const contact = contacten.get(contactSleutel('lead', leadId));
  if (!contact || !/@/.test(contact.email ?? '')) return 0;

  const { data: leadData } = await sb.from('leads').select('bron, bron_kanaal, created_at').eq('id', leadId).maybeSingle();
  const lead = leadData as { bron: string | null; bron_kanaal: string | null; created_at: string } | null;
  if (!lead) return 0;

  const bevatEen = (waarde: string | null, lijst: string) => {
    const w = String(waarde ?? '').toLowerCase();
    return !!w && lijst.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).some((s) => w.includes(s));
  };

  let ingeschreven = 0;
  for (const c of campagnes) {
    const sinds = c.geactiveerd_op || c.created_at;
    if (lead.created_at < sinds) continue;
    if (c.t.bron && !String(lead.bron ?? '').toLowerCase().includes(c.t.bron.toLowerCase())) continue;
    if (c.t.kanaal && lead.bron_kanaal !== c.t.kanaal) continue;
    if (c.t.branche && !bevatEen(contact.branche, c.t.branche)) continue;
    try {
      const r = await schrijfContactenIn(c.id, [contact], { bron: 'trigger', herhaalNaDagen: c.t.herhalen ? c.t.herhaalNaDagen : null });
      ingeschreven += r.nieuw + r.heropend;
    } catch (e) {
      console.error('[lead] inschrijven in campagne mislukt:', c.id, e);
    }
  }
  return ingeschreven;
}
