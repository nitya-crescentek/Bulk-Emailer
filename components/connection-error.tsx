import { DatabaseZapIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Shown when a server component cannot reach the database. */
export function ConnectionError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <DatabaseZapIcon />
      <AlertTitle>Cannot reach the database</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <p className="text-muted-foreground">
          Set <code className="font-mono">DATABASE_URL</code> and{" "}
          <code className="font-mono">APP_SECRET</code> in{" "}
          <code className="font-mono">.env.local</code>, run{" "}
          <code className="font-mono">npm run db:deploy</code>, then restart{" "}
          <code className="font-mono">npm run dev</code>.
        </p>
      </AlertDescription>
    </Alert>
  );
}

export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
