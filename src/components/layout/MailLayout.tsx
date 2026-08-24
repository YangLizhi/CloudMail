import { ReadingPane } from "./ReadingPane";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/**
 * Mail content area: the reading pane only. The mail list now lives inside
 * the left sidebar, so the reading area gets the full remaining width.
 */
export function MailLayout() {
  return (
    <ErrorBoundary name="ReadingPane">
      <ReadingPane />
    </ErrorBoundary>
  );
}
