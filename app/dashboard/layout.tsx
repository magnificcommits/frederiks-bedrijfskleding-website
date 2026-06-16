import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

const DASH_COOKIE = 'fb_dash';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authed = Boolean(env.dashboardPassword) && (await cookies()).get(DASH_COOKIE)?.value === env.dashboardPassword.trim();
  if (!authed) return <>{children}</>;
  return <DashboardShell>{children}</DashboardShell>;
}
