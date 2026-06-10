import Link from "next/link";
import { customerLoginAction } from "@/app/actions/auth";
import { LoginForm } from "@/components/LoginForm";

export default function CustomerLoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <h1 className="title">Customer Login</h1>
        <p className="subtitle">Sign in with your phone number and password.</p>
        <LoginForm mode="customer" action={customerLoginAction} />
        <div className="link-row">
          <Link href="/login/agent">Agent or admin login</Link>
        </div>
      </section>
    </main>
  );
}
