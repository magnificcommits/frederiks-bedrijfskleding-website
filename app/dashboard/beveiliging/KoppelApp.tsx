'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startKoppeling, bevestigKoppeling } from './actions';

type Stap =
  | { soort: 'begin' }
  | { soort: 'scannen'; factorId: string; qr: string; sleutel: string }
  | { soort: 'klaar' };

/** Stappenplan om een authenticator-app te koppelen: QR scannen, code bevestigen. */
export default function KoppelApp() {
  const router = useRouter();
  const [stap, setStap] = useState<Stap>({ soort: 'begin' });
  const [code, setCode] = useState('');
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);
  const [toonSleutel, setToonSleutel] = useState(false);

  async function begin() {
    setFout('');
    setBezig(true);
    try {
      const res = await startKoppeling();
      if (res.ok) setStap({ soort: 'scannen', factorId: res.factorId, qr: res.qr, sleutel: res.sleutel });
      else setFout(res.fout);
    } catch {
      setFout('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setBezig(false);
    }
  }

  async function bevestig(e: React.FormEvent) {
    e.preventDefault();
    if (stap.soort !== 'scannen') return;
    setFout('');
    setBezig(true);
    try {
      const res = await bevestigKoppeling(stap.factorId, code);
      if (res.ok) {
        setStap({ soort: 'klaar' });
        router.refresh();
      } else {
        setFout(res.fout ?? 'Deze code klopt niet.');
      }
    } catch {
      setFout('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setBezig(false);
    }
  }

  if (stap.soort === 'klaar') {
    return (
      <p className="rounded-md bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
        Gelukt. Vanaf nu vragen we bij het inloggen ook om de code uit je app.
      </p>
    );
  }

  if (stap.soort === 'begin') {
    return (
      <div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-800">
          <li>Installeer op je telefoon een authenticator-app, bijvoorbeeld Google Authenticator of Microsoft Authenticator.</li>
          <li>Klik hieronder op de knop. Er verschijnt een QR-code.</li>
          <li>Scan de QR-code met de app en vul de code in die de app laat zien.</li>
        </ol>
        {fout && <p className="mt-3 text-sm font-medium text-amber-700">{fout}</p>}
        <button type="button" onClick={begin} disabled={bezig} className="btn-primary mt-4">
          {bezig ? 'Even geduld' : 'Authenticator-app koppelen'}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stap.qr} alt="QR-code om te scannen met je authenticator-app" width={220} height={220} className="rounded-md border border-line bg-white p-2" />
        <button type="button" onClick={() => setToonSleutel((v) => !v)} className="mt-2 text-xs font-semibold text-warm hover:text-ink-800">
          {toonSleutel ? 'Verberg sleutel' : 'Lukt scannen niet? Toon de sleutel'}
        </button>
        {toonSleutel && (
          <p className="mt-1 break-all rounded bg-mist px-2 py-1 font-mono text-xs text-ink-900">{stap.sleutel}</p>
        )}
      </div>
      <form onSubmit={bevestig}>
        <p className="text-sm text-ink-800">Scan de QR-code met je authenticator-app. Vul daarna de 6 cijfers in die de app toont.</p>
        <label htmlFor="koppelcode" className="veld-label mt-4">Code uit de app</label>
        <input
          id="koppelcode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          placeholder="123456"
          className="w-48 rounded-md border border-line bg-white px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        {fout && <p className="mt-3 text-sm font-medium text-amber-700">{fout}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" disabled={bezig} className="btn-primary">{bezig ? 'Controleren' : 'Bevestigen'}</button>
          <button type="button" onClick={() => { setStap({ soort: 'begin' }); setCode(''); setFout(''); }} className="text-sm font-semibold text-warm hover:text-ink-800">
            Annuleren
          </button>
        </div>
      </form>
    </div>
  );
}
