import { Suspense } from "react";
import { LeadsView } from "@/features/leads/components/leads-view";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeadsPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LeadsView />
      </Suspense>
    </div>
  );
}
