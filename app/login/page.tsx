import { login } from "@/app/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="eyebrow">JAXPORT planning tool</div>
        <h1>Make better exhibit decisions together.</h1>
        <p>Score each event independently, then compare the team’s ratings and recommendations.</p>
        <form action={login} className="stack">
          <label>Email<input type="email" name="email" required autoComplete="email" /></label>
          <label>Password<input type="password" name="password" required autoComplete="current-password" /></label>
          {error && <div className="error">{decodeURIComponent(error)}</div>}
          <button className="button primary" type="submit">Sign in</button>
        </form>
        <small>Accounts are created and managed by an administrator.</small>
      </section>
      <aside className="login-art"><span>Evaluate.</span><span>Compare.</span><span>Decide.</span></aside>
    </main>
  );
}
