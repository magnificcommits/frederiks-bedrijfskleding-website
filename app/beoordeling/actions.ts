'use server';
import { ipUitHeaders, publiekeLimiet } from '@/lib/ratelimit';
import { slaScoreOp, slaToelichtingOp } from '@/lib/reviews/reviews';

/** Publieke acties achter het token uit de tevredenheidsmail. */

export async function scoreActie(token: string, score: number): Promise<{ ok: boolean }> {
  // auth: token (uit de tevredenheidsmail) plus databaselimiet.
  if (!(await publiekeLimiet('beoordeling-score', await ipUitHeaders(), 30, 600_000))) return { ok: false };
  const res = await slaScoreOp(String(token ?? ''), Number(score));
  return { ok: res.ok };
}

export async function toelichtingActie(
  token: string,
  v: { tekst: string; toestemming: boolean; naam: string; bedrijf: string },
): Promise<{ ok: boolean }> {
  // auth: token (uit de tevredenheidsmail) plus databaselimiet.
  if (!(await publiekeLimiet('beoordeling-tekst', await ipUitHeaders(), 10, 600_000))) return { ok: false };
  const ok = await slaToelichtingOp(String(token ?? ''), {
    tekst: String(v?.tekst ?? ''),
    toestemming: Boolean(v?.toestemming),
    naam: String(v?.naam ?? ''),
    bedrijf: String(v?.bedrijf ?? ''),
  });
  return { ok };
}
