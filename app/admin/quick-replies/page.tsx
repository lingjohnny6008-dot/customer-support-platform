import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import {
  CreateQuickReplyForm,
  DeactivateQuickReplyForm,
  EditQuickReplyForm
} from "@/components/QuickReplyForms";
import { canManageCustomers } from "@/lib/auth";
import { listQuickReplies } from "@/lib/quick-replies";
import { getCurrentSession } from "@/lib/session";

type QuickRepliesPageProps = {
  searchParams?: {
    q?: string;
  };
};

export default async function AdminQuickRepliesPage({
  searchParams
}: QuickRepliesPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/staff-login");
  }

  if (!canManageCustomers(session.role)) {
    redirect("/dashboard");
  }

  const search = searchParams?.q ?? "";
  const quickReplies = await listQuickReplies(search);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1 className="title">Quick Replies</h1>
          <p className="subtitle">Manage reusable staff reply templates.</p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/customers">Customers</Link>
          <Link href="/admin/agents">Agents</Link>
          <form action={logoutAction}>
            <button className="button button-secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="admin-section">
        <h2>Search</h2>
        <form className="search-form" action="/admin/quick-replies">
          <input
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search category, title, or content"
          />
          <button className="button" type="submit">
            Search
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2>Add Quick Reply</h2>
        <CreateQuickReplyForm />
      </section>

      <section className="admin-section">
        <div className="section-title-row">
          <h2>Quick Replies</h2>
          <span>{quickReplies.length} shown</span>
        </div>

        <div className="quick-reply-table">
          <div className="quick-reply-table-head">
            <span>Category</span>
            <span>Title</span>
            <span>Content</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {quickReplies.length === 0 ? (
            <p className="empty-state">No quick replies found.</p>
          ) : (
            quickReplies.map((quickReply) => (
              <article className="quick-reply-record" key={quickReply.id}>
                <EditQuickReplyForm quickReply={quickReply} />
                {quickReply.is_active ? (
                  <DeactivateQuickReplyForm quickReplyId={quickReply.id} />
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
