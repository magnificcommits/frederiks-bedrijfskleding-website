/**
 * Laadstaten voor loading.tsx: grijze blokken in de vorm van de pagina die
 * eraan komt, zodat het scherm niet verspringt als de gegevens binnen zijn.
 * Voor schermlezers één zin: "Bezig met laden".
 */

function Blok({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skelet block ${className}`} />;
}

function Kop({ knop = true, kruimel = false }: { knop?: boolean; kruimel?: boolean }) {
  return (
    <div className="dash-kop justify-between gap-4">
      <div className="space-y-1.5">
        {kruimel && <Blok className="h-3 w-20" />}
        <Blok className="h-5 w-40" />
      </div>
      {knop && <Blok className="h-8 w-28 rounded-md" />}
    </div>
  );
}

function Status({ tekst = 'Bezig met laden' }: { tekst?: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {tekst}
    </p>
  );
}

/** Lijstpagina: kop, filterregel, tabel. */
export function SkeletLijst({ rijen = 8, kolommen = 5, tekst }: { rijen?: number; kolommen?: number; tekst?: string }) {
  return (
    <main className="container-app py-6" aria-busy="true">
      <Status tekst={tekst} />
      <Kop />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Blok key={i} className="h-7 w-20 rounded-md" />
        ))}
      </div>
      <div className="panel mt-4 overflow-hidden">
        <div className="flex gap-4 border-b border-line bg-mist px-3 py-2.5">
          {Array.from({ length: kolommen }, (_, i) => (
            <Blok key={i} className={`h-2.5 ${i === 0 ? 'w-16' : 'flex-1'}`} />
          ))}
        </div>
        {Array.from({ length: rijen }, (_, r) => (
          <div key={r} className="flex items-center gap-4 border-b border-line px-3 py-3 last:border-b-0">
            {Array.from({ length: kolommen }, (_, k) => (
              <Blok key={k} className={`h-3 ${k === 0 ? 'w-16' : k === 1 ? 'flex-[2]' : 'flex-1'}`} />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

/** Detailpagina: kruimelpad en kop, werkblad links, zijspoor rechts. */
export function SkeletDetail({ tekst }: { tekst?: string }) {
  return (
    <main className="container-app py-6" aria-busy="true">
      <Status tekst={tekst} />
      <Kop kruimel />
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="panel space-y-3 p-4">
            <Blok className="h-4 w-32" />
            <Blok className="h-3 w-full" />
            <Blok className="h-3 w-5/6" />
            <Blok className="h-3 w-2/3" />
          </div>
          <div className="panel space-y-3 p-4">
            <Blok className="h-4 w-24" />
            {Array.from({ length: 4 }, (_, i) => (
              <Blok key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        <div className="space-y-4 lg:col-span-4">
          <div className="panel space-y-3 p-4">
            <Blok className="h-4 w-28" />
            <Blok className="h-6 w-24" />
            <Blok className="h-3 w-full" />
          </div>
          <div className="panel space-y-2 p-4">
            <Blok className="h-9 w-full rounded-md" />
            <Blok className="h-9 w-full rounded-md" />
          </div>
        </div>
      </div>
    </main>
  );
}

/** Startpagina: kop, Vandaag en Vraagt aandacht, kerncijfers. */
export function SkeletStart({ tekst }: { tekst?: string }) {
  return (
    <main className="container-app py-6" aria-busy="true">
      <Status tekst={tekst} />
      <Kop />
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="panel space-y-3 p-4 lg:col-span-7">
          <Blok className="h-4 w-24" />
          {Array.from({ length: 4 }, (_, i) => (
            <Blok key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="panel space-y-2 p-4 lg:col-span-5">
          <Blok className="h-4 w-32" />
          {Array.from({ length: 4 }, (_, i) => (
            <Blok key={i} className="h-11 w-full rounded-md" />
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="panel space-y-2 p-4">
            <Blok className="h-3 w-24" />
            <Blok className="h-6 w-20" />
            <Blok className="h-3 w-32" />
          </div>
        ))}
      </div>
    </main>
  );
}

/** Formulier of instellingenpagina: kop en een paar velden. */
export function SkeletFormulier({ tekst }: { tekst?: string }) {
  return (
    <main className="container-smal py-6" aria-busy="true">
      <Status tekst={tekst} />
      <Kop knop={false} kruimel />
      <div className="panel mt-5 space-y-4 p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Blok className="h-2.5 w-24" />
            <Blok className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    </main>
  );
}
