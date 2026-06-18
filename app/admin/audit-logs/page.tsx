import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { canManageCustomers } from "@/lib/auth";
import { listAgentAuditLogs } from "@/lib/audit-logs";
import { getCurrentSession } from "@/lib/session";
import type { AgentAuditLog } from "@/lib/types";

type AuditLogsPageProps = {
  searchParams?: {
    action?: string;
  };
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatJson(value: unknown) {
  if (!value || (typeof value === "object" && Object.keys(value).length === 0)) {
    return "-";
  }

  return JSON.stringify(value);
}

function getEntity(log: AgentAuditLog) {
  if (log.message_id) {
    return { type: "message", id: log.message_id };
  }

  if (log.internal_note_id) {
    return { type: "internal_note", id: log.internal_note_id };
  }

  if (log.tag_id) {
    return { type: "tag", id: log.tag_id };
  }

  if (log.conversation_id) {
    return { type: "conversation", id: log.conversation_id };
  }

  if (log.customer_id) {
    return { type: "customer", id: log.customer_id };
  }

  if (log.target_agent_id) {
    return { type: "agent", id: log.target_agent_id };
  }

  return { type: "-", id: "-" };
}

function formatAgent(log: AgentAuditLog) {
  if (!log.agent) {
    return log.actor_agent_id ?? "Unknown agent";
  }

  return `${log.agent.username ?? "No username"} / ${log.agent.email}`;
}

export default async function AdminAuditLogsPage({
  searchParams
}: AuditLogsPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/staff-login");
  }

  if (!canManageCustomers(session.role)) {
    redirect("/dashboard");
  }

  const action = searchParams?.action ?? "";
  const auditLogs = await listAgentAuditLogs(action);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1 className="title">Audit Logs</h1>
          <p className="subtitle">Review recent staff actions.</p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/customers">Customers</Link>
          <Link href="/admin/agents">Agents</Link>
          <Link href="/admin/quick-replies">Quick replies</Link>
          <form action={logoutAction}>
            <button className="button button-secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="admin-section">
        <h2>Filter</h2>
        <form className="search-form" action="/admin/audit-logs">
          <input
            name="action"
            type="search"
            defaultValue={action}
            placeholder="Filter by action"
          />
          <button className="button" type="submit">
            Search
          </button>
        </form>
      </section>

      <section className="admin-section">
        <div className="section-title-row">
          <h2>Recent Logs</h2>
          <span>{auditLogs.length} shown</span>
        </div>

        <div className="audit-log-table">
          <div className="audit-log-table-head">
            <span>Created at</span>
            <span>Agent</span>
            <span>Action</span>
            <span>Entity type</span>
            <span>Entity ID</span>
            <span>Metadata</span>
          </div>

          {auditLogs.length === 0 ? (
            <p className="empty-state">No audit logs found.</p>
          ) : (
            auditLogs.map((log) => {
              const entity = getEntity(log);

              return (
                <article className="audit-log-record" key={log.id}>
                  <span>{formatDateTime(log.created_at)}</span>
                  <span>{formatAgent(log)}</span>
                  <span>{log.action}</span>
                  <span>{entity.type}</span>
                  <code>{entity.id}</code>
                  <code>{formatJson(log.metadata)}</code>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
