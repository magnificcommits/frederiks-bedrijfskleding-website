import VerzendKnop from '@/components/dashboard/VerzendKnop';
import { nieuweLeadActie } from './actions';
import { AANTAL_OPTIES, BRANCHE_OPTIES, HANDMATIGE_BRONNEN } from '@/lib/kms/leadsModel';

/** Snelle invoer van een lead die niet via de website binnenkwam: telefoon, beurs, winkel. */
export default function NieuweLeadForm({ personen, mijnPersoon }: { personen: { id: string; naam: string }[]; mijnPersoon: string | null }) {
  return (
    <form action={nieuweLeadActie} className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="veld-label">Naam *</span>
          <input name="name" required maxLength={120} className="veld" autoComplete="off" placeholder="Voor- en achternaam" />
        </label>
        <label className="block">
          <span className="veld-label">Bedrijf</span>
          <input name="company" maxLength={160} className="veld" autoComplete="off" />
        </label>
        <label className="block">
          <span className="veld-label">Telefoon</span>
          <input name="phone" type="tel" maxLength={40} className="veld" autoComplete="off" placeholder="06 ..." />
        </label>
        <label className="block">
          <span className="veld-label">E-mail</span>
          <input name="email" type="email" maxLength={200} className="veld" autoComplete="off" />
        </label>
        <label className="block">
          <span className="veld-label">Hoe kwam deze lead binnen?</span>
          <select name="bron" className="veld" defaultValue="Telefonisch">
            {HANDMATIGE_BRONNEN.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="veld-label">Anders, namelijk</span>
          <input name="bron_anders" maxLength={120} className="veld" placeholder="Alleen bij Anders" />
        </label>
        <label className="block">
          <span className="veld-label">Branche</span>
          <select name="branche" className="veld" defaultValue="">
            <option value="">Onbekend</option>
            {BRANCHE_OPTIES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="veld-label">Aantal medewerkers</span>
          <select name="aantal" className="veld" defaultValue="">
            <option value="">Onbekend</option>
            {AANTAL_OPTIES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="veld-label">Wat zoeken ze?</span>
        <textarea name="bericht" rows={3} maxLength={2000} className="veld" placeholder="Bijv. 12 monteurs, jassen en broeken met logo, voor de winter binnen" />
      </label>

      <label className="flex items-center gap-2 text-[13px] text-ink-800">
        <input type="checkbox" name="passen" className="h-4 w-4 rounded border-line accent-amber-600" />
        Wil graag passen op locatie
      </label>

      <div className="grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2">
        {personen.length > 0 && (
          <label className="block">
            <span className="veld-label">Eigenaar</span>
            <select name="eigenaar_id" className="veld" defaultValue={mijnPersoon ?? ''}>
              <option value="">Nog niemand</option>
              {personen.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="veld-label">Opvolgen op</span>
          <input type="date" name="opvolgdatum" className="veld" />
          <span className="veld-hint">Een taak plan je daarna op de leadpagina.</span>
        </label>
      </div>

      <div className="flex justify-end">
        <VerzendKnop className="knop-primair" bezigTekst="Opslaan…">Lead opslaan</VerzendKnop>
      </div>
    </form>
  );
}
