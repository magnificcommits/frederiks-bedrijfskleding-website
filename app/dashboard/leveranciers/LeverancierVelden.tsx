import type { LeverancierVol } from '@/lib/kms/leveranciers';

/**
 * De velden van een leverancier, voor zowel "nieuw" als "bewerken". Gegroepeerd
 * zoals Jessi erover nadenkt: wie is het, hoe bestel je, wat is afgesproken.
 */
export default function LeverancierVelden({ l, nieuwKlaar = true }: { l?: Partial<LeverancierVol>; nieuwKlaar?: boolean }) {
  const pct = l?.kortingspercentage != null ? String(l.kortingspercentage).replace('.', ',') : '';
  const franco = l?.franco_bedrag != null ? String(l.franco_bedrag).replace('.', ',') : '';
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-display text-[15px] font-bold text-ink-900">Wie</legend>
        <div className="sm:col-span-2">
          <label className="veld-label" htmlFor="lv-naam">Naam (merk)</label>
          <input id="lv-naam" name="naam" required defaultValue={l?.naam ?? ''} placeholder="Bijv. Tricorp" className="veld" />
        </div>
        <div>
          <label className="veld-label" htmlFor="lv-bij">Inkoop bij</label>
          <input id="lv-bij" name="inkoop_bij" defaultValue={l?.inkoop_bij ?? ''} placeholder="Bijv. Houweling" className="veld" />
          <p className="veld-hint">De groothandel waar je dit merk bestelt. Merken met dezelfde partij komen samen in één inkooporder.</p>
        </div>
        <div>
          <label className="veld-label" htmlFor="lv-merken">Merken</label>
          <input id="lv-merken" name="merken" defaultValue={(l?.merken ?? []).join(', ')} placeholder="Merk A, Merk B" className="veld" />
          <p className="veld-hint">Komma ertussen. Producten met dit merk horen bij deze leverancier.</p>
        </div>
        <div>
          <label className="veld-label" htmlFor="lv-web">Website</label>
          <input id="lv-web" name="website" defaultValue={l?.website ?? ''} placeholder="www.leverancier.nl" className="veld" disabled={!nieuwKlaar} />
        </div>
        <div>
          <label className="veld-label" htmlFor="lv-nr">Leveranciersnummer (eigen)</label>
          <input id="lv-nr" name="leveranciersnummer" defaultValue={l?.leveranciersnummer ?? ''} className="veld" />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-display text-[15px] font-bold text-ink-900">Algemeen contact</legend>
        <div>
          <label className="veld-label" htmlFor="lv-cp">Contactpersoon</label>
          <input id="lv-cp" name="contactpersoon" defaultValue={l?.contactpersoon ?? ''} className="veld" />
        </div>
        <div>
          <label className="veld-label" htmlFor="lv-mail">E-mail voor bestellingen</label>
          <input id="lv-mail" name="email" type="email" defaultValue={l?.email ?? ''} placeholder="inkoop@leverancier.nl" className="veld" />
        </div>
        <div>
          <label className="veld-label" htmlFor="lv-tel">Telefoon</label>
          <input id="lv-tel" name="telefoon" defaultValue={l?.telefoon ?? ''} className="veld" />
        </div>
        <div>
          <label className="veld-label" htmlFor="lv-tel2">Telefoon hoofdkantoor</label>
          <input id="lv-tel2" name="telefoon_hoofdkantoor" defaultValue={l?.telefoon_hoofdkantoor ?? ''} className="veld" />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-display text-[15px] font-bold text-ink-900">Bestellen</legend>
        <div className="sm:col-span-2">
          <label className="veld-label" htmlFor="lv-portaal">Bestelportaal (B2B-webshop)</label>
          <input id="lv-portaal" name="bestelportaal_url" defaultValue={l?.bestelportaal_url ?? ''} placeholder="https://..." className="veld" />
        </div>
        <div className="sm:col-span-2">
          <label className="veld-label" htmlFor="lv-wijze">Bestelwijze</label>
          <input id="lv-wijze" name="bestelwijze" defaultValue={l?.bestelwijze ?? ''} placeholder="Bijv. bestellen via mail: inkoop@velkro.nl" className="veld" />
        </div>
        <div>
          <label className="veld-label" htmlFor="lv-klant">Ons klantnummer daar</label>
          <input id="lv-klant" name="klantnummer" defaultValue={l?.klantnummer ?? ''} className="veld" disabled={!nieuwKlaar} />
        </div>
        <div>
          <label className="veld-label" htmlFor="lv-lt">Levertijd (dagen)</label>
          <input id="lv-lt" name="levertijd_dagen" inputMode="numeric" defaultValue={l?.levertijd_dagen ?? ''} placeholder="bijv. 5" className="veld" />
          <p className="veld-hint">Vult de verwachte leverdatum van een inkooporder.</p>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 font-display text-[15px] font-bold text-ink-900">Afspraken</legend>
        <div>
          <label className="veld-label" htmlFor="lv-korting">Korting (%)</label>
          <input id="lv-korting" name="kortingspercentage" inputMode="decimal" defaultValue={pct} className="veld" />
        </div>
        <div>
          <label className="veld-label" htmlFor="lv-franco">Franco vanaf (EUR)</label>
          <input id="lv-franco" name="franco_bedrag" inputMode="decimal" defaultValue={franco} className="veld" disabled={!nieuwKlaar} />
        </div>
        <div>
          <label className="veld-label" htmlFor="lv-betaal">Betaalcondities</label>
          <input id="lv-betaal" name="betaalcondities" defaultValue={l?.betaalcondities ?? ''} placeholder="30 dagen netto" className="veld" />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-display text-[15px] font-bold text-ink-900">Logo</legend>
        <label className="veld-label" htmlFor="lv-logo">Link naar logo</label>
        <input id="lv-logo" name="logo_url" defaultValue={l?.logo_url ?? ''} placeholder="Leeg laten: logo uit de map Logo's leveranciers" className="veld" disabled={!nieuwKlaar} />
      </fieldset>
      {!nieuwKlaar && <p className="veld-hint">Website, klantnummer, franco en logo kunnen pas na de databasemigratie van 4 oktober.</p>}
    </div>
  );
}
