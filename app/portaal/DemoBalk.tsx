import { DEMO_LABEL, DEMO_ROLLEN, type DemoRol } from '@/lib/demo';

/**
 * Balk boven het portaal zolang je in de demo zit: wisselen tussen werkgever,
 * leidinggevende en werknemer, de demo terugzetten, of terug naar het KMS.
 */
export function DemoBalk({ rol, melding }: { rol: DemoRol; melding?: string | null }) {
  return (
    <div className="bg-ink-900 text-white" data-plek="demo-balk">
      <div className="container-x flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 text-sm">
        <span className="font-semibold text-amber-300">Demo</span>
        <span className="text-ink-200">Je bekijkt het portaal als</span>
        <nav aria-label="Demo-rol" className="flex flex-wrap gap-1.5">
          {DEMO_ROLLEN.map((r) => (
            // Gewone link (geen client-navigatie): de sessie wisselt op de server en de hele pagina moet opnieuw laden.
            <a
              key={r}
              href={`/portaal/demo/wissel?rol=${r}`}
              aria-current={r === rol ? 'true' : undefined}
              className={`rounded-full px-3 py-1 font-semibold transition ${r === rol ? 'bg-amber-500 text-ink-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              {DEMO_LABEL[r]}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {melding && <span className="text-xs text-ink-200">{melding}</span>}
          <form action="/portaal/demo/reset" method="post">
            <button type="submit" className="rounded-full border border-white/30 px-3 py-1 font-semibold text-white hover:bg-white/10">Demo resetten</button>
          </form>
          <form action="/portaal/demo/stop" method="post">
            <button type="submit" className="rounded-full border border-white/30 px-3 py-1 font-semibold text-white hover:bg-white/10">Terug naar KMS</button>
          </form>
        </div>
      </div>
    </div>
  );
}
