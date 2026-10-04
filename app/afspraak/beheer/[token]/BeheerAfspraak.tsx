'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AfspraakKiezer } from '@/components/AfspraakKiezer';

/** Verzetten (nieuwe dag en tijd) of annuleren met de link uit de bevestigingsmail. */
export default function BeheerAfspraak({ token }: { token: string }) {
  const router = useRouter();
  const [modus, setModus] = useState<'keuze' | 'verzet' | 'annuleer'>('keuze');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');

  async function annuleer() {
    setBezig(true);
    setFout('');
    try {
      const res = await fetch('/api/afspraak/annuleer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error || 'Annuleren lukte niet.');
      router.refresh();
    } catch (e) {
      setFout(e instanceof Error ? e.message : 'Annuleren lukte niet.');
      setBezig(false);
    }
  }

  if (modus === 'verzet') {
    return (
      <div className="space-y-3">
        <AfspraakKiezer verzetToken={token} naVerzet={() => router.refresh()} />
        <button type="button" className="btn-ghost text-sm" onClick={() => setModus('keuze')}>
          Toch niet verzetten
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      {modus === 'annuleer' ? (
        <>
          <p className="font-semibold text-ink-900">Weet je zeker dat je wilt annuleren?</p>
          <p className="mt-1 text-sm text-warm">We halen de afspraak uit de agenda en sturen je een bevestiging.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={annuleer} disabled={bezig}>
              {bezig ? 'Bezig…' : 'Ja, annuleren'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setModus('keuze')} disabled={bezig}>
              Nee, laat staan
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="font-semibold text-ink-900">Komt het toch niet uit?</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => setModus('verzet')}>
              Ander moment kiezen
            </button>
            <button type="button" className="btn-outline" onClick={() => setModus('annuleer')}>
              Annuleren
            </button>
          </div>
        </>
      )}
      {fout && (
        <p className="mt-3 text-sm text-amber-800" role="alert">
          {fout}
        </p>
      )}
    </div>
  );
}
