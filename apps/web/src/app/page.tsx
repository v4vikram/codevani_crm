import { Dashboard } from "@/features/stats/components/dashboard";

export default function HomePage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Today</h1>
        <p className="text-sm text-muted-foreground">
          Builders with no website, ready to hear from you.
        </p>
      </header>
      <Dashboard />
    </div>
  );
}
