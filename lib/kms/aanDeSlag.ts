import { kmsAdmin, type HuidigeAdmin } from '@/lib/kms/adminClient';
import { tweeStapStatus } from '@/lib/kms/adminGebruikers';

/**
 * De "Aan de slag"-lijst op de startpagina: vijf stappen die het KMS echt
 * bruikbaar maken. Elke stap wordt afgeleid uit wat er al in de database
 * staat, dus afvinken gebeurt vanzelf. Zijn alle stappen klaar, dan geeft
 * dit null en verdwijnt de lijst.
 */

/** Cookie waarmee de lijst verborgen is (gezet door de knop Verbergen). */
export const AAN_DE_SLAG_COOKIE = 'fb_aandeslag';

export type AanDeSlagStap = {
  sleutel: 'klant' | 'logo' | 'product' | 'beheerder' | 'tweestap';
  titel: string;
  uitleg: string;
  href: string;
  knop: string;
  klaar: boolean;
};

async function tel(tabel: string, alleenActief = false): Promise<number | null> {
  const sb = kmsAdmin();
  if (!sb) return null;
  try {
    const basis = sb.from(tabel).select('id', { count: 'exact', head: true });
    const { count, error } = await (alleenActief ? basis.eq('actief', true) : basis);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export async function getAanDeSlag(admin: HuidigeAdmin | null): Promise<AanDeSlagStap[] | null> {
  if (!kmsAdmin()) return null;
  const [klanten, logos, producten, beheerders, tweeStap] = await Promise.all([
    tel('organisaties'),
    tel('logos'),
    tel('producten'),
    tel('admin_gebruikers', true),
    admin ? tweeStapStatus().catch(() => ({}) as Record<string, boolean>) : Promise.resolve(null),
  ]);

  // Kon een telling niet worden gedaan, dan die stap niet als open tonen: liever
  // niets zeggen dan Jessi iets laten doen wat al gedaan is.
  const klaar = (n: number | null, min = 1) => n === null || n >= min;

  const stappen: AanDeSlagStap[] = [
    {
      sleutel: 'klant',
      titel: 'Zet je eerste klant erin',
      uitleg: 'Een bedrijf met contactpersoon. Daarna kun je offertes en orders voor ze maken.',
      href: '/dashboard/klanten/nieuw',
      knop: 'Klant toevoegen',
      klaar: klaar(klanten),
    },
    {
      sleutel: 'logo',
      titel: 'Upload het logo van een klant',
      uitleg: 'Het logo komt op werkbonnen en drukproeven, zodat bedrukken en borduren goed gaat.',
      href: '/dashboard/logos',
      knop: 'Logo uploaden',
      klaar: klaar(logos),
    },
    {
      sleutel: 'product',
      titel: 'Voeg je eerste product toe',
      uitleg: 'Een artikel met maten en kleuren. Of lees de prijslijst van een leverancier in.',
      href: '/dashboard/producten',
      knop: 'Naar producten',
      klaar: klaar(producten),
    },
    {
      sleutel: 'beheerder',
      titel: 'Geef een collega toegang',
      uitleg: 'Iedereen logt in met een eigen account. Zo zie je in het logboek wie wat heeft gedaan.',
      href: '/dashboard/admins',
      knop: 'Beheerder toevoegen',
      klaar: klaar(beheerders, 2),
    },
  ];
  if (admin) {
    stappen.push({
      sleutel: 'tweestap',
      titel: 'Zet inloggen met een code aan (2FA)',
      uitleg: 'Een code van een app op je telefoon bij het inloggen. Dan kan niemand met alleen je wachtwoord of e-mail binnen.',
      href: '/dashboard/beveiliging',
      knop: '2FA aanzetten',
      klaar: tweeStap === null ? true : tweeStap[admin.email.toLowerCase()] === true || Object.keys(tweeStap).length === 0,
    });
  }

  return stappen.every((s) => s.klaar) ? null : stappen;
}
