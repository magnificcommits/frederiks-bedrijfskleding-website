/**
 * Vijf processtappen op de homepage, tekst uit Jessi's werkdocument (20 okt
 * 2026). Compact, zonder formulier en zonder vaste doorlooptijd.
 */
const stappen = [
  {
    title: 'We bespreken jouw wensen',
    text: 'Wat je zoekt, voor welke werkzaamheden de kleding bedoeld is en wat belangrijk is voor jouw bedrijf. Persoonlijk, telefonisch of via WhatsApp.',
  },
  {
    title: 'Je ontvangt een uitgewerkt voorstel',
    text: 'Een digitaal voorstel met de geselecteerde kleding, de positie van je logo voor bedrukking of borduring en een overzichtelijke offerte.',
  },
  {
    title: 'We plannen een passessie',
    text: 'Bij jou op locatie of in onze showroom, net wat voor jou het prettigst is. Zo krijgt iedereen de juiste maat.',
  },
  {
    title: 'Wij gaan voor je aan de slag',
    text: 'Na het vaststellen van de maten zetten we de bestelling in gang en verzorgen we de personalisatie. We houden je op de hoogte van de voortgang.',
  },
  {
    title: 'Levering en nazorg',
    text: 'We zorgen dat de kleding bij je terechtkomt en blijven daarna je aanspreekpunt. Nabestellen kan eenvoudig via ons online kledingportaal.',
  },
];

export function HoeWerktHet() {
  return (
    <section className="bg-white">
      <div className="container-x sec-md">
        <h2 className="kop-2 max-w-[28ch]">Van eerste kennismaking tot kleding op de werkvloer</h2>
        <ol className="mt-8 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
          {stappen.map((s, i) => (
            <li key={s.title} className="relative">
              {i < stappen.length - 1 && <span className="absolute left-12 right-0 top-5 hidden border-t-2 border-dashed border-amber-400 lg:block" aria-hidden="true" />}
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 font-display text-lg font-extrabold text-ink-900" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="mt-3 font-display text-lg font-extrabold leading-snug text-ink-900">
                <span className="sr-only">Stap {i + 1}: </span>{s.title}
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-warm">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
