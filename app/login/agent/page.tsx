import Link from "next/link";
import { staffLoginAction } from "@/app/actions/auth";
import { LoginForm } from "@/components/LoginForm";

export default function AgentLoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <h1 className="title">Agent Login</h1>
        <p className="subtitle">Sign in as an agent or admin.</p>
        <LoginForm mode="staff" action={staffLoginAction} />
        <div className="link-row">
          <Link href="/login/customer">Customer login</Link>
        </div>
      </section>
    </main>
  );
}
