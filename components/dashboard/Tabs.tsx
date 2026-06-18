'use client';

import { useState, type ReactNode } from 'react';

export type TabDef = {
  id: string;
  label: string;
  content: ReactNode;
  badge?: string | number | null;
};

/**
 * Eenvoudige tabbladen voor het dashboard. Inhoud mag server-gerenderde JSX zijn
 * (forms met server actions werken gewoon), die wordt als `content` doorgegeven.
 */
export default function Tabs({ tabs, initial }: { tabs: TabDef[]; initial?: string }) {
  const [actief, setActief] = useState(initial ?? tabs[0]?.id);
  const huidig = tabs.find((t) => t.id === actief) ?? tabs[0];

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t) => {
          const aan = t.id === actief;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActief(t.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                aan ? 'border-amber-600 text-ink-900' : 'border-transparent text-warm hover:text-ink-800'
              }`}
            >
              {t.label}
              {t.badge != null && t.badge !== '' && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    aan ? 'bg-amber-100 text-amber-800' : 'bg-mist text-warm'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-6">{huidig?.content}</div>
    </div>
  );
}
