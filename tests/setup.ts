import { vi } from 'vitest';

// React 18 buiten Next kent `cache` niet (Next levert zijn eigen React mee). In tests een doorgeefluik.
vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>();
  return { ...echt, cache: <T>(fn: T) => fn };
});

// Nooit per ongeluk een echte database, mailservice of boekhouding raken vanuit een test.
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.RESEND_API_KEY;
delete process.env.MONEYBIRD_API_TOKEN;
delete process.env.MONEYBIRD_ADMINISTRATIE_ID;
