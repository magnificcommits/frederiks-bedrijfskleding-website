import { dashAuthed, getHuidigeAdmin } from '@/lib/kms/adminClient';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authed = await dashAuthed();
  if (!authed) return <>{children}</>;
  const huidige = await getHuidigeAdmin();
  return (
    <DashboardShell adminNaam={huidige?.naam ?? huidige?.email ?? null} adminRol={huidige?.rol ?? null}>
      {children}
    </DashboardShell>
  );
}
