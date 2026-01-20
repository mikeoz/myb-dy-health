import { Shield, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

/**
 * Guardrails Documentation Page
 * 
 * Internal documentation for developers and reviewers.
 * Explains the non-negotiable guardrails that govern MyBödy development.
 * 
 * This page is NOT for end users.
 */
const Guardrails = () => {
  return (
    <div className="page-container animate-fade-in max-w-4xl">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          MyBödy Guardrails
        </h1>
        <p className="page-description">
          Non-negotiable constraints for healthcare-grade development
        </p>
      </div>

      {/* Warning banner */}
      <div className="mb-8 p-4 rounded-lg border border-warning bg-warning/10">
        <div className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">Internal Documentation</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          This page is for developers and reviewers. It documents the invariants that must never be violated.
        </p>
      </div>

      {/* Invariants */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Invariants</h2>
        <p className="text-muted-foreground mb-6">
          These constraints must NEVER be violated. Any code that breaks these rules must be rejected.
        </p>

        <div className="space-y-4">
          <InvariantCard
            number={1}
            title="No PHI in logs"
            description="No console logs, debug output, or error messages may contain Protected Health Information. Audit logs store metadata only (IDs, counts, timestamps)."
          />
          
          <InvariantCard
            number={2}
            title="Server-only secrets"
            description="No private keys, API secrets, or tokens may appear in client code. All secrets are referenced via environment variables and accessed only in server-side code (edge functions)."
          />
          
          <InvariantCard
            number={3}
            title="Event-first data model"
            description="All health-related information is stored as immutable events. No 'current state overwrite' patterns. Events are append-only and never modified."
          />
          
          <InvariantCard
            number={4}
            title="Provenance is mandatory"
            description="Every health-related event must reference a provenance record. Provenance captures source (who/what), method (how), and timestamp (when)."
          />
          
          <InvariantCard
            number={5}
            title="Consent is explicit and snapshot-based"
            description="Consent is captured explicitly — never inferred or assumed. Each data operation references an immutable consent snapshot. Consent changes create new snapshots."
          />
          
          <InvariantCard
            number={6}
            title="Asynchronous by default"
            description="Any operation that could exceed a request lifecycle is modeled as a job. Jobs may be stubbed initially, but the async boundary must exist from the start."
          />
          
          <InvariantCard
            number={7}
            title="User isolation"
            description="Users can only access their own data. No shared data, no admin bypass, no cross-user queries. Every database query must be scoped to the authenticated user."
          />
        </div>
      </section>

      {/* Non-Goals */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Explicit Non-Goals</h2>
        <p className="text-muted-foreground mb-6">
          These features are explicitly out of scope. Do NOT implement them.
        </p>

        <div className="grid gap-3">
          <NonGoalItem>No external healthcare APIs</NonGoalItem>
          <NonGoalItem>No background workers</NonGoalItem>
          <NonGoalItem>No portal integrations</NonGoalItem>
          <NonGoalItem>No AI or LLM logic</NonGoalItem>
          <NonGoalItem>No analytics pipelines</NonGoalItem>
          <NonGoalItem>No scheduled jobs</NonGoalItem>
          <NonGoalItem>No "smart" inference of consent</NonGoalItem>
        </div>
      </section>

      {/* Why Event-Based */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Why Event-Based & Consent-First?</h2>
        
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
          <p>
            <strong className="text-foreground">Healthcare data is fundamentally temporal.</strong> A blood pressure reading isn't just a number — it's a measurement taken at a specific time, by a specific method, under specific conditions. Overwriting "current" values loses this critical context.
          </p>
          
          <p>
            <strong className="text-foreground">Events create an audit trail.</strong> In regulated healthcare, you must be able to answer: "What did we know, when did we know it, and where did it come from?" An event-based model with mandatory provenance answers these questions by design.
          </p>
          
          <p>
            <strong className="text-foreground">Consent must be auditable.</strong> Healthcare regulations require demonstrable proof of consent at the time of each data operation. Snapshot-based consent means we can always prove what the user consented to when their data was collected or processed.
          </p>
          
          <p>
            <strong className="text-foreground">Immutability prevents accidents.</strong> When data cannot be modified, entire classes of bugs become impossible. There's no "accidental overwrite" or "lost update" — the historical record is always complete.
          </p>
        </div>
      </section>

      {/* Environment Variables */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-foreground">Environment Variables</h2>
        <p className="text-muted-foreground mb-6">
          These environment variables must be configured server-side. They are never exposed to client code.
        </p>

        <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm space-y-2">
          <div><span className="text-primary">FASTEN_API_KEY</span> — Fasten Health API key</div>
          <div><span className="text-primary">FASTEN_PRIVATE_KEY</span> — Fasten request signing key</div>
          <div><span className="text-primary">FASTEN_WEBHOOK_SECRET</span> — Webhook verification secret</div>
          <div><span className="text-primary">APP_ENV</span> — Environment (development | staging | production)</div>
        </div>
      </section>
    </div>
  );
};

interface InvariantCardProps {
  number: number;
  title: string;
  description: string;
}

const InvariantCard = ({ number, title, description }: InvariantCardProps) => (
  <div className="p-4 rounded-lg border border-border bg-card">
    <div className="flex items-start gap-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold flex-shrink-0">
        {number}
      </div>
      <div>
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  </div>
);

interface NonGoalItemProps {
  children: React.ReactNode;
}

const NonGoalItem = ({ children }: NonGoalItemProps) => (
  <div className="flex items-center gap-2 text-muted-foreground">
    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
    <span className="text-sm">{children}</span>
  </div>
);

export default Guardrails;
