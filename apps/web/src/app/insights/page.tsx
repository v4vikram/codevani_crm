import { InsightsPanel } from "@/features/insights/components/insights-panel";

export default function InsightsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Insights</h1>
        <p className="text-sm text-muted-foreground">
          What is actually converting, and how much to trust it.
        </p>
      </header>
      <InsightsPanel />
    </div>
  );
}
