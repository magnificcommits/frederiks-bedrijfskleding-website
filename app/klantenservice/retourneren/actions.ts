'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { rateLimit } from '@/lib/ratelimit';
import { startRetour } from '@/lib/retourportaal';

/**
 * Meldt altijd hetzelfde terug, ook als de combinatie niet klopt of het adres
 * niet bij de bestelling hoort. Anders is dit een manier om met een ordernummer
 * e-mailadressen te raden.
 */
export async function vraagRetourlinkAan(formData: FormData) {
  const ordernummer = String(formData.get('ordernummer') ?? '');
  const email = String(formData.get('email') ?? '');
  if (String(formData.get('website') ?? '')) redirect('/klantenservice/retourneren?verstuurd=1');

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'onbekend';
  if (rateLimit(`retour:${ip}`, 5, 600_000)) {
    await startRetour(ordernummer, email);
  }
  redirect('/klantenservice/retourneren?verstuurd=1');
}
