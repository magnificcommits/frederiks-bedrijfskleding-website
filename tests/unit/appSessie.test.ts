import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/portaal/supabaseServer', () => ({ getServerSupabase: vi.fn() }));

const ID = '11111111-2222-3333-4444-555555555555';

describe('sessietoken browser en app', () => {
  beforeEach(() => { process.env.DASHBOARD_SESSION_SECRET = 'test-geheim'; vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T10:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('browser: geldig binnen 8 uur, daarna niet', async () => {
    const m = await import('@/lib/kms/adminClient');
    const t = m.maakAdminSessieToken(ID)!;
    expect(m.adminSessieUitToken(t, ID)?.duur).toBe(m.SESSIE_DUUR_SEC);
    vi.setSystemTime(new Date('2026-10-10T18:01:00Z'));
    expect(m.adminSessieUitToken(t, ID)).toBeNull();
  });

  it('app: na een maand nog geldig, na 180 dagen niet', async () => {
    const m = await import('@/lib/kms/adminClient');
    const t = m.maakAdminSessieToken(ID, true)!;
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'));
    expect(m.adminSessieUitToken(t, ID)?.duur).toBe(m.APP_SESSIE_DUUR_SEC);
    vi.setSystemTime(new Date('2027-04-09T10:00:00Z'));
    expect(m.adminSessieUitToken(t, ID)).toBeNull();
  });

  it('browsertoken is niet om te bouwen tot app-token', async () => {
    const m = await import('@/lib/kms/adminClient');
    const [v, tijd, id, sig] = m.maakAdminSessieToken(ID)!.split('.');
    expect(v).toBe('v1');
    expect(m.adminSessieUitToken(`v2.${tijd}.${id}.app.${sig}`, ID)).toBeNull();
    expect(m.adminSessieUitToken(m.maakAdminSessieToken(ID, true)!, 'ander-id')).toBeNull();
  });
});
