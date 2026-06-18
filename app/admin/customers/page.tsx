import { redirect } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import {
  CreateCustomerForm,
  EditCustomerForm,
  ResetCustomerPasswordForm
} from "@/components/CustomerForms";
import { AddCustomerTagForm, TagBadgeList } from "@/components/CustomerTags";
import { canManageCustomers } from "@/lib/auth";
import { listCustomers } from "@/lib/customers";
import { getCurrentSession } from "@/lib/session";
import { listTagsForCustomers } from "@/lib/tags";

type CustomersPageProps = {
  searchParams?: {
    q?: string;
  };
};

export default async function AdminCustomersPage({
  searchParams
}: CustomersPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/staff-login");
  }

  if (!canManageCustomers(session.role)) {
    redirect("/dashboard");
  }

  const search = searchParams?.q ?? "";
  const customers = await listCustomers(search);
  const tagsByCustomer = await listTagsForCustomers(
    customers.map((customer) => customer.id)
  );

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1 className="title">Customer Management</h1>
          <p className="subtitle">Manage customer access and support labels.</p>
        </div>
        <div className="admin-header-actions">
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
        <h2>Search</h2>
        <form className="search-form" action="/admin/customers">
          <input
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search phone or internal name"
          />
          <button className="button" type="submit">
            Search
          </button>
        </form>
      </section>

      <section className="admin-section">
        <h2>Add Customer</h2>
        <CreateCustomerForm />
      </section>

      <section className="admin-section">
        <div className="section-title-row">
          <h2>Customers</h2>
          <span>{customers.length} shown</span>
        </div>

        <div className="customer-table">
          <div className="customer-table-head">
            <span>Phone</span>
            <span>Internal name</span>
            <span>Full name</span>
            <span>Email</span>
            <span>Country</span>
            <span>Language</span>
            <span>Status</span>
            <span>Summary</span>
            <span>Action</span>
          </div>

          {customers.length === 0 ? (
            <p className="empty-state">No customers found.</p>
          ) : (
            customers.map((customer) => (
              <article className="customer-record" key={customer.id}>
                <EditCustomerForm customer={customer} />
                <ResetCustomerPasswordForm customerId={customer.id} />
                <div className="admin-customer-tags">
                  <TagBadgeList
                    tags={tagsByCustomer.get(customer.id) ?? []}
                    canDelete
                  />
                  <AddCustomerTagForm customerId={customer.id} />
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
