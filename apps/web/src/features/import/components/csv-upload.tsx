"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, apiErrorMessage } from "@/lib/api-client";
import { leadKeys } from "@/features/leads/api/leads.api";

interface ImportResult {
  fileName: string;
  rowsRead: number;
  inserted: number;
  updated: number;
  dropped: {
    hasWebsite: number;
    noPhone: number;
    closed: number;
    duplicate: number;
    unusable: number;
  };
  detectedColumns: Record<string, string>;
}

export function CsvUpload() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<ImportResult>("/api/import", form, {
        // Let the browser set the multipart boundary itself.
        headers: { "Content-Type": undefined },
      });
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: leadKeys.all }),
  });

  const handleFile = (file?: File | null) => {
    if (file) upload.mutate(file);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={
          dragging
            ? "rounded-lg border-2 border-dashed border-primary bg-primary/5 p-8 text-center"
            : "rounded-lg border-2 border-dashed border-border p-8 text-center"
        }
      >
        <FileSpreadsheet className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Drop your Apify CSV here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Or tap to choose a file. Works with Apify, RERA and plain sheets.
        </p>
        <Button
          className="mt-4"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload />
          {upload.isPending ? "Importing…" : "Choose CSV"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = ""; // let the same file be re-selected
          }}
        />
      </div>

      {upload.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {apiErrorMessage(upload.error)}
        </p>
      )}

      {upload.isSuccess && <ImportSummary result={upload.data} />}
    </div>
  );
}

function ImportSummary({ result }: { result: ImportResult }) {
  const { dropped } = result;
  const totalDropped =
    dropped.hasWebsite + dropped.noPhone + dropped.closed + dropped.duplicate + dropped.unusable;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <p className="font-medium">
        {result.inserted} new lead{result.inserted === 1 ? "" : "s"} added
        {result.updated > 0 && `, ${result.updated} refreshed`}
      </p>
      <p className="text-sm text-muted-foreground">
        Read {result.rowsRead} rows from {result.fileName}.
      </p>

      {totalDropped > 0 && (
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Skipped {totalDropped}:</p>
          <ul className="space-y-0.5">
            {dropped.hasWebsite > 0 && <li>{dropped.hasWebsite} already have a real website</li>}
            {dropped.noPhone > 0 && <li>{dropped.noPhone} had no usable phone number</li>}
            {dropped.closed > 0 && <li>{dropped.closed} permanently closed</li>}
            {dropped.duplicate > 0 && <li>{dropped.duplicate} duplicates within the file</li>}
            {dropped.unusable > 0 && <li>{dropped.unusable} had no business name</li>}
          </ul>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Columns detected</summary>
        <ul className="mt-2 space-y-0.5 text-muted-foreground">
          {Object.entries(result.detectedColumns).map(([field, col]) => (
            <li key={field}>
              {field} → <code className="text-foreground">{col}</code>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-sm text-muted-foreground">
        Re-importing the same file is safe — it refreshes ratings and reviews without touching your
        outreach progress.
      </p>
    </div>
  );
}
