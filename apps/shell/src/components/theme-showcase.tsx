import { useId } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@feel-your-website/ui";

/**
 * The Phase 1 proof of the theming contract.
 *
 * Defined exactly once and takes no styling props. The proving page renders
 * it several times, each wrapped in a `ThemeProvider` with a different
 * theme. If they render differently, the contract holds: a theme is one
 * object, and swapping it requires zero component changes.
 *
 * Lives in its own file rather than inline in the route so it can be
 * rendered directly by tests without going through the router.
 */
export function ThemeShowcase() {
  // The proving page renders this component several times on one page, so a
  // literal id would produce duplicate DOM ids and break label association.
  const customerId = useId();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session capture</CardTitle>
        <CardDescription>One component tree, rendered under three themes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge>Synced</Badge>
          <Badge variant="secondary">Pending</Badge>
          <Badge variant="destructive">Failed</Badge>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={customerId}>Customer name</Label>
          <Input id={customerId} placeholder="Sharma Paints" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </CardContent>
    </Card>
  );
}
