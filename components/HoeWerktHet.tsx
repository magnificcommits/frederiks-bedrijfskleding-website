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
    <section className="bg-white">
      <div className="container-x sec-md">
        <h2 className="kop-2 max-w-[24ch]">Van eerste telefoontje tot kleding op de werkvloer</h2>
        <ol className="mt-7 grid grid-cols-1 gap-x-8 gap-y-7 md:grid-cols-3">
          {stappen.map((s, i) => (
            <li key={s.nr} className="relative">
              {i < stappen.length - 1 && <span className="absolute left-14 right-0 top-5 hidden border-t-2 border-dashed border-amber-400 md:block" aria-hidden="true" />}
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 font-display text-lg font-extrabold text-ink-900" aria-hidden="true">
                {s.nr}
              </span>
              <h3 className="mt-4 font-display text-xl font-extrabold text-ink-900">
                <span className="sr-only">Stap {s.nr}: </span>{s.title}
              </h3>
              <p className="mt-2 max-w-[42ch] leading-relaxed text-warm">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
