'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const OK_TEKSTEN: Record<string, string> = {
  opgeslagen: 'Opgeslagen.',
  status: 'Status bijgewerkt.',
  gemaild: 'E-mail verstuurd.',
  aangemaakt: 'Aangemaakt.',
  toegevoegd: 'Toegevoegd.',
  verwijderd: 'Verwijderd.',
  bijgewerkt: 'Bijgewerkt.',
  'uit-offerte': 'Order aangemaakt uit de offerte.',
  betaald: 'Gemarkeerd als betaald.',
};
const FOUT_TEKSTEN: Record<string, string> = {
  order: 'Kon geen order maken. Koppel eerst een klant.',
  mail: 'Vul een e-mailadres in.',
  'geen-toegang': 'Geen toegang. Dit onderdeel is alleen voor de eigenaar.',
  verzenden: 'Versturen is mislukt. De mail is niet verstuurd; controleer het adres of probeer het later opnieuw.',
};

function ToastInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const ok = sp.get('ok');
  const fout = sp.get('fout');
  const [zichtbaar, setZichtbaar] = useState(false);
  const [bericht, setBericht] = useState<{ tekst: string; soort: 'ok' | 'fout' } | null>(null);

  useEffect(() => {
    if (!ok && !fout) return;
    const tekst = fout ? FOUT_TEKSTEN[fout] : OK_TEKSTEN[ok as string];
    if (!tekst) return; // onbekende code: de pagina toont zelf eventueel een eigen melding
    setBericht({ tekst, soort: fout ? 'fout' : 'ok' });
    setZichtbaar(true);
    // ok/fout uit de URL halen zodat de melding niet terugkomt bij refresh of navigeren.
    const params = new URLSearchParams(sp.toString());
    params.delete('ok');
    params.delete('fout');
    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(url, { scroll: false });
    const t = setTimeout(() => setZichtbaar(false), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, fout]);

  if (!zichtbaar || !bericht) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0">
      <div
        role="status"
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-card ${
          bericht.soort === 'fout' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'
        }`}
      >
        <span>{bericht.tekst}</span>
        <button type="button" onClick={() => setZichtbaar(false)} aria-label="Sluiten" className="opacity-60 hover:opacity-100">
          ✕
        </button>
      </div>
    </div>
  );
}

/** Globale toast: leest ?ok / ?fout uit de URL en toont kort een melding. */
export default function Toast() {
  return (
    <Suspense fallback={null}>
      <ToastInner />
    </Suspense>
  );
}
