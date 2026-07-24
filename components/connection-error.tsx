import { DatabaseZapIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Shown when a server component cannot reach MongoDB. */
export function ConnectionError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <DatabaseZapIcon />
      <AlertTitle>Cannot reach MongoDB</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <p className="text-muted-foreground">
          Set <code className="font-mono">MONGODB_URI</code> and{" "}
          <code className="font-mono">APP_SECRET</code> in{" "}
          <code className="font-mono">.env.local</code>, then restart{" "}
          <code className="font-mono">npm run dev</code>.
        </p>
      </AlertDescription>
    </Alert>
  );
}

export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
