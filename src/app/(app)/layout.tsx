import { AppShell } from "@/components/shell/app-shell";
import { getViewer } from "@/server/context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return <AppShell viewer={viewer}>{children}</AppShell>;
}
