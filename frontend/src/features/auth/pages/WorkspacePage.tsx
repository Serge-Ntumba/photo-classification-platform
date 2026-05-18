import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { StatusMessage } from "@/components/layout/feedback";
import { Button } from "@/components/ui/button";
import { useSession } from "@/app/providers";

export function WorkspacePage() {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showReturnFallback = searchParams.get("notice") === "return-unavailable";

  function handleSignOut() {
    signOut();
    navigate("/login?signedOut=1", { replace: true });
  }

  return (
    <AppShell user={session.user} onSignOut={handleSignOut}>
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Workspace</h1>
          <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
            Continue with photo submissions and review their asynchronous status.
          </p>
        </div>

        {showReturnFallback ? (
          <StatusMessage
            tone="warning"
            label="We could not return to the requested page."
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-md border border-border p-4">
            <h2 className="text-base font-semibold tracking-normal">
              Account identity
            </h2>
            <p className="mt-2 break-words text-sm text-muted-foreground">
              {session.user?.email || session.user?.username || "Signed in"}
            </p>
          </section>
          <section className="rounded-md border border-border p-4">
            <h2 className="text-base font-semibold tracking-normal">Start work</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/app/submissions/new">Create submission</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/submissions">Submissions</Link>
              </Button>
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
