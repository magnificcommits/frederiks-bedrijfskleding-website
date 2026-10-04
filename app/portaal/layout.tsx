import type { CSSProperties } from 'react';
import Link from 'next/link';
import { isPortalConfigured } from '@/lib/env';
import { getHuisstijl, veiligeKleur } from '@/lib/portaal/huisstijl';
import { getMijnToegang, type PortaalRol } from '@/lib/portaal/team';
import PwaRegistratie from '@/components/pwa/PwaRegistratie';
import { pwaMetadata, pwaViewport } from '@/lib/pwa/apps';
import { getTaalInfo, getVertaler, WOORDENBOEKEN } from '@/lib/i18n/portaal/server';
import { TaalProvider } from '@/lib/i18n/portaal/client';
import TaalKiezer from './TaalKiezer';

// Installeerbaar als app "Frederiks Kledingportaal" (scope /portaal), los van het KMS.
export const metadata = pwaMetadata('portaal');
export const viewport = pwaViewport('portaal');

export const dynamic = 'force-dynamic';

function initialen(naam: string): string {
  const woorden = naam.trim().split(/\s+/).filter(Boolean);
  const letters = woorden.slice(0, 2).map((w) => w[0] ?? '').join('');
  return (letters || naam.slice(0, 2)).toUpperCase();
}

/**
 * Premium portaalschil: een gebrande kop met het logo en de naam van de klant,
 * de huisstijlkleur als accent en een rustige mist-achtergrond zodat de witte
 * kaarten uitkomen. Login en niet-ingelogde pagina's blijven kaal.
 */
export default async function PortaalLayout({ children }: { children: React.ReactNode }) {
  // Taal: cookie, opgeslagen voorkeur, Accept-Language of nl. <html lang> zit in de root
  // layout en kan niet per route; daarom staat lang op de wrapper hieronder.
  const { taal, bron } = await getTaalInfo();
  const { t } = await getVertaler();
  const kaal = () => (
    <TaalProvider taal={taal} woordenboek={WOORDENBOEKEN[taal]}>
      <div lang={taal}>
        <PwaRegistratie gebied="portaal" />
        <div className="container-x flex justify-end pt-4">
          <TaalKiezer bron={bron} />
        </div>
        {children}
      </div>
    </TaalProvider>
  );

  if (!isPortalConfigured) return kaal();

  let naam: string | null = null;
  let kleur: string | null = null;
  let logoUrl: string | null = null;
  let sfeerUrl: string | null = null;
  try {
    const h = await getHuisstijl();
    if (h) { naam = h.naam; kleur = h.kleur; logoUrl = h.logoUrl; sfeerUrl = h.sfeerafbeeldingUrl; }
  } catch { /* niet ingelogd */ }

  // Geen organisatie betekent: login of niet-gekoppeld. Kale weergave.
  if (!naam) return kaal();

  let rol: PortaalRol | null = null;
  try { rol = (await getMijnToegang()).rol; } catch { /* rol optioneel */ }

  const accent = veiligeKleur(kleur);
  const style = { '--portaal-accent': accent } as CSSProperties;

  return (
    <TaalProvider taal={taal} woordenboek={WOORDENBOEKEN[taal]}>
    <div lang={taal} style={style} className="min-h-screen bg-mist">
      <PwaRegistratie gebied="portaal" />
      <header className="border-b border-line bg-white">
        <div className="container-x flex items-center justify-between gap-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              <span className="inline-flex items-center rounded-lg border border-line bg-white px-2 py-1 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt={t('kop.logo', { naam })} className="h-9 w-auto max-w-[150px] object-contain" />
              </span>
            ) : (
              <span
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-display text-base font-extrabold text-white"
                style={{ backgroundColor: 'var(--portaal-accent)' }}
                aria-hidden="true"
              >
                {initialen(naam)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--portaal-accent)' }}>{t('algemeen.klantportaal')}</p>
              <p className="truncate font-display text-lg font-extrabold leading-tight text-ink-900">{naam}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-3 sm:flex">
              {rol && <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-ink-700">{t(`rol.${rol}`)}</span>}
              <span className="text-xs text-warm">{t('kop.portaalVan')}</span>
              <Link href="/" className="text-xs font-medium text-warm hover:text-ink-900">{t('kop.naarWebsite')}</Link>
            </div>
            <TaalKiezer bron={bron} ingelogd />
          </div>
        </div>
        <div className="h-1 w-full" style={{ backgroundColor: 'var(--portaal-accent)' }} aria-hidden="true" />
      </header>

      {sfeerUrl && (
        <div className="container-x pt-5">
          <div
            className="relative h-28 w-full overflow-hidden rounded-2xl border border-line bg-white sm:h-40"
            style={{ backgroundImage: `url(${sfeerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            role="img"
            aria-label={t('kop.sfeerbeeld', { naam })}
          >
            <div className="absolute inset-0" style={{ backgroundColor: 'color-mix(in srgb, var(--portaal-accent) 16%, transparent)' }} aria-hidden="true" />
          </div>
        </div>
      )}

      {children}
    </div>
    </TaalProvider>
  );
}
