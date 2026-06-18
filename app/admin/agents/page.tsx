import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import {
  AgentPasswordForm,
  CreateAgentForm,
  DeactivateAgentForm,
  EditAgentForm
} from "@/components/AgentForms";
import { canManageCustomers } from "@/lib/auth";
import { listAgents } from "@/lib/agents";
import { getCurrentSession } from "@/lib/session";

type AgentsPageProps = {
  searchParams?: {
    q?: string;
  };
};

export default async function AdminAgentsPage({ searchParams }: AgentsPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/staff-login");
  }

  if (!canManageCustomers(session.role)) {
    redirect("/dashboard");
  }

  const search = searchParams?.q ?? "";
  const agents = await listAgents(search);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1 className="title">Agent Management</h1>
          <p className="subtitle">Manage staff access, roles, and passwords.</p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/customers">Customers</Link>
          <Link href="/admin/audit-logs">Audit logs</Link>
          <Link href="/admin/quick-replies">Quick replies</Link>
          <form action={logoutAction}>
            <button className="button button-secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="admin-section">
        <h2>Search</h2>
        <form className="search-form" action="/admin/agents">
          <input
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search username, email, or full name"
          />
          <button className="button" type="submit">
            Search
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2>Add Agent</h2>
        <CreateAgentForm />
      </section>

      <section className="admin-section">
        <div className="section-title-row">
          <h2>Agents</h2>
          <span>{agents.length} shown</span>
        </div>

        <div className="agent-table">
          <div className="agent-table-head">
            <span>Username</span>
            <span>Email</span>
            <span>Full name</span>
            <span>Role</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {agents.length === 0 ? (
            <p className="empty-state">No agents found.</p>
          ) : (
            agents.map((agent) => (
              <article className="agent-record" key={agent.id}>
                <EditAgentForm agent={agent} />
                <div className="agent-control-row">
                  <AgentPasswordForm agentId={agent.id} />
                  {agent.is_active ? (
                    <DeactivateAgentForm agentId={agent.id} />
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
