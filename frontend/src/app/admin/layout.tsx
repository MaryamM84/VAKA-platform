import AdminGuard from "@/components/admin/AdminGuard";

export const instant = false;

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminGuard>{children}</AdminGuard>;
}