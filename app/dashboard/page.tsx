import { redirect } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { canAccessDashboard } from "@/lib/auth";
import { getCurrentSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login/customer");
  }

  if (!canAccessDashboard(session.role)) {
    redirect("/login/customer");
  }

  return (
    <main className="auth-shell">
      <section className="dashboard-panel">
        <h1 className="title">Dashboard</h1>
        <p className="subtitle">Authenticated access only.</p>

        <dl className="meta-list">
          <div>
            <dt>User ID</dt>
            <dd>{session.id}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{session.role}</dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>{session.displayName}</dd>
          </div>
        </dl>

        {session.role === "admin" ? (
          <div className="link-row">
            <Link href="/admin/customers">Manage customers</Link>
            <Link href="/admin/agents">Manage agents</Link>
            <Link href="/admin/quick-replies">Quick replies</Link>
          </div>
        ) : null}

        {session.role === "agent" || session.role === "admin" ? (
          <div className="link-row">
            <Link href="/dashboard/conversations">Conversations</Link>
          </div>
        ) : null}

        {session.role === "customer" ? (
          <div className="link-row">
            <Link href="/chat">Open chat</Link>
          </div>
        ) : null}

        <form action={logoutAction}>
          <button className="button" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
