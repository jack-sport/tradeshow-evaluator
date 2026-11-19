import { updatePassword } from "@/app/actions";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="login-shell"><section className="login-panel"><div className="eyebrow">Account setup</div><h1>Create your password.</h1><p>Use at least 10 characters. After saving, you’ll continue to the event dashboard.</p><form action={updatePassword} className="stack"><label>New password<input type="password" name="password" minLength={10} required autoComplete="new-password" /></label><label>Confirm password<input type="password" name="confirmation" minLength={10} required autoComplete="new-password" /></label>{error && <div className="error">{decodeURIComponent(error)}</div>}<button className="button primary">Set password</button></form></section><aside className="login-art"><span>Welcome.</span><span>Evaluate.</span><span>Decide.</span></aside></main>;
}
