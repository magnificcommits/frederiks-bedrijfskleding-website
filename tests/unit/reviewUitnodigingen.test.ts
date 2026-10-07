import { describe, expect, it } from 'vitest';
import { isoWeek, kiesKandidaten } from '@/lib/reviews/uitnodigingRegels';

const nu = new Date('2026-10-12T06:00:00Z'); // maandag
const dagenTerug = (n: number) => new Date(nu.getTime() - n * 86_400_000).toISOString();
const order = (org: string, dagen: number, nr = 1) => ({ id: `o-${org}-${dagen}`, organisatie_id: org, geleverd_op: dagenTerug(dagen), ordernummer: nr });

describe('review-uitnodigingen', () => {
  it('rekent het ISO-weeknummer', () => {
    expect(isoWeek(nu)).toBe('2026-W42');
    expect(isoWeek(new Date('2027-01-01T12:00:00Z'))).toBe('2026-W53');
  });

  it('stelt recent beleverde klanten voor, promotors eerst', () => {
    const v = kiesKandidaten(
      [order('a', 10), order('b', 5), order('c', 90)],
      [{ klant_id: 'a', score: 10, beantwoord_op: dagenTerug(3), created_at: dagenTerug(4) }],
      [],
      nu,
    );
    expect(v.map((x) => x.organisatie_id)).toEqual(['a', 'b']);
    expect(v[0].reden).toContain('gaf een 10');
  });

  it('slaat lage scores, recent uitgenodigde en overgeslagen klanten over', () => {
    const v = kiesKandidaten(
      [order('laag', 5), order('al', 5), order('weg', 5), order('ok', 5)],
      [{ klant_id: 'laag', score: 5, beantwoord_op: dagenTerug(2), created_at: dagenTerug(3) }],
      [
        { organisatie_id: 'al', status: 'verstuurd', created_at: dagenTerug(200), verstuurd_op: dagenTerug(200) },
        { organisatie_id: 'weg', status: 'overgeslagen', created_at: dagenTerug(30), verstuurd_op: null },
      ],
      nu,
    );
    expect(v.map((x) => x.organisatie_id)).toEqual(['ok']);
  });

  it('één voorstel per klant, met de laatste levering', () => {
    const v = kiesKandidaten([order('a', 40, 1), order('a', 8, 2)], [], [], nu);
    expect(v).toHaveLength(1);
    expect(v[0].reden).toContain('#2');
  });
});
