/**
 * Drie processtappen op de homepage. Volgorde: eerst wat jij doet, dan wat we
 * samen doen, dan wat wij overnemen. Zo ziet iemand vooraf hoe weinig het hem kost.
 */
const stappen = [
  {
    nr: '1',
    title: 'Jij vertelt wat je zoekt',
    text: 'Wat voor werk, hoeveel mensen, welke normen. Eén telefoontje of het formulier, en binnen 24 uur ligt er een voorstel.',
  },
  {
    nr: '2',
    title: 'We komen bij je langs om te passen',
    text: 'Bij jou op de zaak, in werktijd. Iedereen past, wij noteren de maten. Geen showroombezoek, geen verloren uren.',
  },
  {
    nr: '3',
    title: 'Wij regelen de rest, ook later',
    text: 'Logo erop in eigen huis, geleverd per medewerker. Een nieuwe collega bestelt zelf in het portaal, binnen jouw budget.',
  },
];

export function HoeWerktHet() {
  return (
    <section className="bg-mist py-16 sm:py-24">
      <div className="container-x">
        <p className="eyebrow">Zo werkt het</p>
        <h2 className="mt-4 max-w-2xl font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          Van eerste telefoontje tot kleding op de werkvloer
        </h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {stappen.map((s) => (
            <li key={s.nr} className="seam-card h-full">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 font-display text-lg font-extrabold text-white"
                aria-hidden="true"
              >
                {s.nr}
              </span>
              <h3 className="mt-4 font-display text-lg font-extrabold text-ink-900">
                <span className="sr-only">Stap {s.nr}: </span>{s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-warm">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
