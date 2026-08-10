import { AdminDashboard } from "../../../components/admin-dashboard";
import { isAdmin, getServerSession } from "../../../lib/auth/session";
import { redirect } from "next/navigation";

export default async function AdminUsersPage() {
  const session = await getServerSession();
  if (!session) return null;
  if (!isAdmin(session.user)) redirect("/admin");

  return <AdminDashboard userName={session.user.name} />;
}
