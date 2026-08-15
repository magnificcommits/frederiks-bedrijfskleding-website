import { site } from '@/content/site';

/**
 * Het werkgebied, typografisch in plaats van als kaartje.
 *
 * Hier stond een zelfgetekende SVG met 23 stippen op geprojecteerde coördinaten.
 * Het idee klopte - een landelijke webshop kan die kaart niet maken - maar de
 * uitvoering niet: zonder provincie- of gemeentegrens is er niets om op te
 * projecteren, dus las een bezoeker geen kaart maar een spreidingsdiagram. De
 * labels botsten aantoonbaar (Keijenborg viel binnen de ring om Hengelo Gld),
 * elke plaats kreeg dezelfde stip of het er nu 500 of 48.000 inwoners waren, en
 * de tekstgrootte stond in viewBox-eenheden, waardoor het op mobiel neerkwam op
 * 8 px. Bovendien was de achtergrond van de kaart dezelfde kleur als de sectie
 * eromheen, dus het vlak was er visueel niet eens.
 *
 * Wat er nu staat zegt hetzelfde ding sterker: hoe ver we rijden, in minuten.
 * Een reistijd is een controleerbaar argument, een stippenwolk niet. Het is
 * leesbaar voor een zoekmachine (tekst, geen SVG), het kan niet stukgaan op een
 * klein scherm, en de plaatsnamen doen gewoon hun werk voor lokale zoekopdrachten.
 */
const RINGEN = [
  {
    tijd: '25 min.',
    plaatsen: ['Doetinchem', 'Zutphen', 'Zelhem', 'Vorden', 'Ruurlo', 'Steenderen', 'Keijenborg', 'Baak', 'Wehl', 'Gaanderen'],
  },
  {
    tijd: '45 min.',
    plaatsen: ['Winterswijk', 'Aalten', 'Groenlo', 'Lichtenvoorde', 'Eibergen', 'Borculo', 'Varsseveld', 'Terborg', 'Ulft', 'Didam', 'Zevenaar', 'Duiven'],
  },
];

export function RegioKaart({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-white p-6 shadow-card sm:p-8 ${className}`}>
      <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-warm">
        Vanuit Hengelo Gld
      </p>

      <dl className="mt-6 space-y-6">
        {RINGEN.map((r) => (
          <div key={r.tijd} className="border-l-2 border-amber-500 pl-5">
            <dt className="font-display text-4xl font-extrabold leading-none text-ink-900 sm:text-5xl">
              {r.tijd}
            </dt>
            <dd className="mt-2 text-sm leading-relaxed text-warm">{r.plaatsen.join(' · ')}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-7 border-t border-line pt-5 text-sm text-warm">
        Zit je plaats er niet bij? Bel{' '}
        <a href={`tel:${site.phoneIntl}`} className="font-semibold text-amber-700 underline underline-offset-2">
          {site.phone}
        </a>{' '}
        — we rijden vaker dan je denkt.
      </p>
    </div>
  );
}
