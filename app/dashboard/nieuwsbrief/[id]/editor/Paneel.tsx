'use client';

/**
 * Het rechterpaneel, net als in Mailblue: tabbladen Inhoud en Algemene
 * instellingen. Onder Inhoud de uitklappers Structuren, Blokken en Modules;
 * is er iets geselecteerd, dan de instellingen daarvan met Terug en Naar container.
 */
import { useEffect, useState, type Dispatch, type KeyboardEvent, type ReactNode } from 'react';
import { BLOKTYPEN, STRUCTUREN, type BlokType, type Module, type Ontwerp, type Sectie } from '@/lib/nieuwsbrief/types';
import { slaModuleOp, verwijderModule } from '../actions';
import { BLOK_LABEL } from './BlokView';
import { BlokIcoon, IcoonChevron, IcoonPijlLinks, IcoonPijlOmhoog, IcoonPrullenbak, StructuurPlaatje } from './iconen';
import { AlgemeneInstellingen, BlokInstellingen, SectieInstellingen } from './Instellingen';
import { startSleep, stopSleep } from './slepen';
import { vindBlok, type Actie, type Selectie } from './state';

/**
 * Een tegel die je kunt slepen én aanklikken. Een <button draggable> sleept
 * niet in Firefox, daarom een div met de rol en toetsen van een knop.
 */
function klikbaar(onClick: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
  };
}

function Uitklapper({ titel, open, onToggle, children, aantal }: { titel: string; open: boolean; onToggle: () => void; children: ReactNode; aantal?: number }) {
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[14px] font-bold text-ink-900 hover:bg-mist"
      >
        <IcoonChevron open={open} />
        {titel}
        {aantal !== undefined && <span className="ml-auto rounded-full bg-mist px-2 py-0.5 text-[11px] font-semibold text-warm">{aantal}</span>}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/** Formulier om een sectie als module te bewaren. */
function ModuleOpslaan({
  sectie,
  onKlaar,
  onAnnuleer,
}: {
  sectie: Sectie;
  onKlaar: (m: Module) => void;
  onAnnuleer?: () => void;
}) {
  const [naam, setNaam] = useState(sectie.naam ?? '');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const bewaar = async () => {
    if (!naam.trim()) {
      setFout('Geef de module een naam.');
      return;
    }
    setBezig(true);
    setFout(null);
    try {
      const uit = await slaModuleOp(naam.trim(), sectie);
      if (uit.ok) onKlaar(uit.module);
      else setFout(uit.fout);
    } catch {
      setFout('Bewaren is mislukt. Probeer het nog een keer.');
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
      <label className="block text-[13px] font-semibold text-ink-900" htmlFor={`module-naam-${sectie.id}`}>
        Bewaar deze sectie als module
      </label>
      <p className="mt-0.5 text-[12px] text-warm">Zo kun je hem in een volgende nieuwsbrief met één klik weer invoegen.</p>
      <input
        id={`module-naam-${sectie.id}`}
        autoFocus
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') bewaar();
        }}
        placeholder="Bijv. Header, Footer of Bezoek ons"
        className="veld mt-2 text-[14px]"
      />
      {fout && (
        <p role="alert" className="mt-1.5 text-[12px] font-semibold text-red-700">
          {fout}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={bewaar} disabled={bezig} className="knop-donker">
          {bezig ? 'Bezig...' : 'Bewaren als module'}
        </button>
        {onAnnuleer && (
          <button type="button" onClick={onAnnuleer} className="knop-tekst">
            Annuleren
          </button>
        )}
      </div>
    </div>
  );
}

function ModuleRij({ module: m, onInvoegen, onVerwijderd }: { module: Module; onInvoegen: () => void; onVerwijderd: () => void }) {
  const [zeker, setZeker] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const blokken = m.sectie.kolommen.reduce((a, k) => a + k.blokken.length, 0);

  return (
    <li
      draggable
      onDragStart={(e) => startSleep(e, { soort: 'module', moduleId: m.id })}
      onDragEnd={stopSleep}
      className="cursor-grab rounded-md border border-line bg-white p-2.5 active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0">
          <StructuurPlaatje verhouding={m.sectie.verhouding} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink-900">{m.naam}</span>
          <span className="block text-[11px] text-warm">
            {m.sectie.kolommen.length} {m.sectie.kolommen.length === 1 ? 'kolom' : 'kolommen'}, {blokken} {blokken === 1 ? 'blok' : 'blokken'}
          </span>
        </span>
        <button type="button" onClick={onInvoegen} className="knop-stil">
          Invoegen
        </button>
        <button
          type="button"
          onClick={() => setZeker(true)}
          aria-label={`Module ${m.naam} verwijderen`}
          title="Verwijderen"
          className="flex h-7 w-7 items-center justify-center rounded-md text-warm hover:bg-red-50 hover:text-red-700"
        >
          <IcoonPrullenbak />
        </button>
      </div>
      {zeker && (
        <div className="mt-2 rounded bg-red-50 p-2 text-[12px] text-red-800">
          Module &apos;{m.naam}&apos; voorgoed verwijderen? Nieuwsbrieven waarin hij al staat, blijven gewoon zoals ze zijn.
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              disabled={bezig}
              onClick={async () => {
                setBezig(true);
                setFout(null);
                try {
                  const uit = await verwijderModule(m.id);
                  if (uit.ok) onVerwijderd();
                  else setFout(uit.fout);
                } catch {
                  setFout('Verwijderen is mislukt.');
                } finally {
                  setBezig(false);
                }
              }}
              className="knop bg-red-600 text-white hover:bg-red-700"
            >
              {bezig ? 'Bezig...' : 'Ja, verwijderen'}
            </button>
            <button type="button" onClick={() => setZeker(false)} className="knop-tekst">
              Nee
            </button>
          </div>
          {fout && <p className="mt-1 font-semibold">{fout}</p>}
        </div>
      )}
    </li>
  );
}

type Props = {
  ontwerp: Ontwerp;
  selectie: Selectie;
  dispatch: Dispatch<Actie>;
  modules: Module[];
  onModuleOpgeslagen: (m: Module) => void;
  onModuleVerwijderd: (id: string) => void;
  moduleVoor: string | null;
  setModuleVoor: (id: string | null) => void;
  voegStructuurToe: (verhouding: number[]) => void;
  voegBlokToe: (type: BlokType) => void;
  voegModuleIn: (m: Module) => void;
};

export default function Paneel({
  ontwerp,
  selectie,
  dispatch,
  modules,
  onModuleOpgeslagen,
  onModuleVerwijderd,
  moduleVoor,
  setModuleVoor,
  voegStructuurToe,
  voegBlokToe,
  voegModuleIn,
}: Props) {
  const [tab, setTab] = useState<'inhoud' | 'algemeen'>('inhoud');
  const [open, setOpen] = useState({ structuren: true, blokken: true, modules: false });

  const plek = selectie?.soort === 'blok' ? vindBlok(ontwerp, selectie.blokId) : null;
  const sectie = selectie?.soort === 'sectie' ? ontwerp.secties.find((s) => s.id === selectie.sectieId) ?? null : null;
  // Iets aangeklikt op het canvas? Dan meteen de instellingen daarvan laten zien.
  const selectieSleutel = selectie ? (selectie.soort === 'blok' ? selectie.blokId : selectie.sectieId) : null;
  useEffect(() => {
    if (selectieSleutel) setTab('inhoud');
  }, [selectieSleutel]);

  let inhoud: ReactNode;
  if (tab === 'algemeen') {
    inhoud = <AlgemeneInstellingen inst={ontwerp.instellingen} dispatch={dispatch} />;
  } else if (plek || sectie) {
    inhoud = (
      <div>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-3 py-2">
          <button type="button" onClick={() => dispatch({ type: 'selecteer', selectie: null })} className="knop-tekst text-blue-700">
            <IcoonPijlLinks />
            Terug
          </button>
          {plek && (
            <button type="button" onClick={() => dispatch({ type: 'naarContainer' })} className="knop-tekst text-blue-700" title="Selecteer de sectie waar dit blok in staat">
              <IcoonPijlOmhoog />
              Naar container
            </button>
          )}
        </div>
        <p className="border-b border-line bg-blue-50 px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-blue-800">
          {plek ? `Blok · ${BLOK_LABEL[plek.blok.type] ?? plek.blok.type}` : `Sectie${sectie?.naam ? ` · ${sectie.naam}` : ''}`}
        </p>
        {plek && <BlokInstellingen key={plek.blok.id} blok={plek.blok} dispatch={dispatch} />}
        {sectie && (
          <SectieInstellingen
            key={sectie.id}
            sectie={sectie}
            dispatch={dispatch}
            moduleFormulier={
              moduleVoor === sectie.id ? (
                <div className="border-b border-line p-3">
                  <ModuleOpslaan
                    sectie={sectie}
                    onKlaar={(m) => {
                      onModuleOpgeslagen(m);
                      setModuleVoor(null);
                    }}
                    onAnnuleer={() => setModuleVoor(null)}
                  />
                </div>
              ) : (
                <div className="border-b border-line px-4 py-3">
                  <button type="button" onClick={() => setModuleVoor(sectie.id)} className="knop-stil w-full justify-center">
                    Bewaar deze sectie als module
                  </button>
                </div>
              )
            }
          />
        )}
      </div>
    );
  } else {
    inhoud = (
      <div>
        <Uitklapper titel="Structuren" open={open.structuren} onToggle={() => setOpen((o) => ({ ...o, structuren: !o.structuren }))}>
          <p className="mb-2 text-[12px] text-warm">Sleep een indeling naar de nieuwsbrief, of klik om hem onderaan toe te voegen.</p>
          <div className="grid grid-cols-2 gap-2">
            {STRUCTUREN.map((s) => (
              <div
                key={s.id}
                {...klikbaar(() => voegStructuurToe(s.verhouding))}
                draggable
                onDragStart={(e) => startSleep(e, { soort: 'structuur', verhouding: s.verhouding })}
                onDragEnd={stopSleep}
                className="flex cursor-grab flex-col items-center gap-1.5 rounded-md border border-line bg-white p-2 text-[11px] font-medium text-ink-700 hover:border-blue-400 active:cursor-grabbing"
              >
                <StructuurPlaatje verhouding={s.verhouding} />
                {s.label}
              </div>
            ))}
          </div>
        </Uitklapper>

        <Uitklapper titel="Blokken" open={open.blokken} onToggle={() => setOpen((o) => ({ ...o, blokken: !o.blokken }))}>
          <p className="mb-2 text-[12px] text-warm">Sleep een blok naar een kolom, of klik om het toe te voegen.</p>
          <div className="grid grid-cols-2 gap-2">
            {BLOKTYPEN.map((b) => (
              <div
                key={b.type}
                {...klikbaar(() => voegBlokToe(b.type))}
                draggable
                onDragStart={(e) => startSleep(e, { soort: 'nieuwBlok', blokType: b.type })}
                onDragEnd={stopSleep}
                title={b.uitleg}
                className="flex cursor-grab flex-col items-center gap-1 rounded-md border border-line bg-white px-2 py-3 text-[12px] font-semibold text-ink-800 hover:border-blue-400 hover:text-blue-800 active:cursor-grabbing"
              >
                <BlokIcoon type={b.type} />
                {b.label}
              </div>
            ))}
          </div>
        </Uitklapper>

        <Uitklapper titel="Modules" open={open.modules} onToggle={() => setOpen((o) => ({ ...o, modules: !o.modules }))} aantal={modules.length}>
          <p className="mb-2 text-[12px] text-warm">Opgeslagen onderdelen, zoals je header en footer. Sleep ze naar de nieuwsbrief of klik op Invoegen.</p>
          {modules.length === 0 ? (
            <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-[13px] text-warm">Nog geen modules bewaard.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {modules.map((m) => (
                <ModuleRij key={m.id} module={m} onInvoegen={() => voegModuleIn(m)} onVerwijderd={() => onModuleVerwijderd(m.id)} />
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-warm">
            Een sectie bewaren als module? Klik in de nieuwsbrief op die sectie en kies &apos;Bewaar deze sectie als module&apos;, of gebruik het menu (...)
            naast de sectie.
          </p>
        </Uitklapper>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Paneel" className="flex shrink-0 border-b border-line">
        {(
          [
            ['inhoud', 'Inhoud'],
            ['algemeen', 'Algemene instellingen'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px flex-1 border-b-2 px-3 py-3 text-[13px] font-semibold ${tab === id ? 'border-blue-600 text-ink-900' : 'border-transparent text-warm hover:text-ink-800'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{inhoud}</div>
    </div>
  );
}
