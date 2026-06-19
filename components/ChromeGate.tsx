'use client';
import { usePathname } from 'next/navigation';

/**
 * Verbergt publieke website-chrome (header, footer, mobiele actiebalk) op de
 * app-routes van het klantportaal. Op /portaal en /dashboard krijgt de gebruiker
 * de eigen portaalschil, niet de marketing-navigatie.
 */
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isApp =
    pathname?.startsWith('/portaal') || pathname?.startsWith('/dashboard');
  if (isApp) return null;
  return <>{children}</>;
}
