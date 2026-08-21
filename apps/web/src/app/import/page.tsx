import { CsvUpload } from "@/features/import/components/csv-upload";

export default function ImportPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Import leads</h1>
        <p className="text-sm text-muted-foreground">
          Firms with a real website are dropped automatically — only the pitchable ones are kept.
        </p>
      </header>
      <CsvUpload />
    </div>
  );
}
