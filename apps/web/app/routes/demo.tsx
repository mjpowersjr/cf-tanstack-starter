import { AddEntrySchema, UploadFileSchema } from "@repo/db";
import { tracingMiddleware } from "@repo/observability/middleware";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Textarea } from "~/components/ui/textarea";

// --- Server Functions ---

const getEntries = createServerFn({ method: "GET" })
  .middleware([tracingMiddleware])
  .handler(async () => {
    const { env } = await import("cloudflare:workers");
    const { createDb, guestbookEntries } = await import("@repo/db");
    const { desc } = await import("drizzle-orm");
    const db = createDb(env.DB);
    return db.select().from(guestbookEntries).orderBy(desc(guestbookEntries.createdAt));
  });

const addEntry = createServerFn({ method: "POST" })
  .middleware([tracingMiddleware])
  .inputValidator(AddEntrySchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, guestbookEntries } = await import("@repo/db");
    const db = createDb(env.DB);
    await db.insert(guestbookEntries).values({
      name: data.name,
      message: data.message,
    });
    return { success: true };
  });

const getFiles = createServerFn({ method: "GET" })
  .middleware([tracingMiddleware])
  .handler(async () => {
    const { env } = await import("cloudflare:workers");
    const { createDb, uploadedFiles } = await import("@repo/db");
    const { desc } = await import("drizzle-orm");
    const db = createDb(env.DB);
    return db.select().from(uploadedFiles).orderBy(desc(uploadedFiles.createdAt));
  });

const uploadFile = createServerFn({ method: "POST" })
  .middleware([tracingMiddleware])
  .inputValidator(UploadFileSchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, uploadedFiles } = await import("@repo/db");
    const db = createDb(env.DB);
    const r2Key = `uploads/${Date.now()}-${data.filename}`;
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));

    await env.BUCKET.put(r2Key, bytes, {
      httpMetadata: { contentType: data.contentType },
    });

    await db.insert(uploadedFiles).values({
      filename: data.filename,
      r2Key,
      contentType: data.contentType,
      size: bytes.length,
    });

    return { success: true };
  });

// --- Route ---

export const Route = createFileRoute("/demo")({
  loader: async () => {
    const [entries, files] = await Promise.all([getEntries(), getFiles()]);
    return { entries, files };
  },
  component: DemoPage,
});

function DemoPage() {
  const { entries, files } = Route.useLoaderData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Demo</h1>
        <p className="text-muted-foreground">
          Try out D1 (SQLite) and R2 (object storage) powered by Cloudflare Workers.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <GuestbookSection entries={entries} />
        <FileUploadSection files={files} />
      </div>
    </div>
  );
}

// --- Guestbook ---

function GuestbookSection({
  entries,
}: {
  entries: { id: number; name: string; message: string; createdAt: string }[];
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setSubmitting(true);
    await addEntry({ data: { name: name.trim(), message: message.trim() } });
    setName("");
    setMessage("");
    setSubmitting(false);
    window.location.reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Guestbook <Badge variant="secondary">D1</Badge>
        </CardTitle>
        <CardDescription>
          Sign the guestbook — entries are stored in Cloudflare D1 via Drizzle ORM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Textarea
            placeholder="Your message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Signing..." : "Sign Guestbook"}
          </Button>
        </form>

        <Separator />

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet. Be the first to sign!</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{entry.name}</span>
                  <span className="text-xs text-muted-foreground">{entry.createdAt}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{entry.message}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- File Upload ---

function FileUploadSection({
  files,
}: {
  files: {
    id: number;
    filename: string;
    r2Key: string;
    contentType: string;
    size: number;
    createdAt: string;
  }[];
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
    );

    await uploadFile({
      data: {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        base64,
      },
    });

    setUploading(false);
    window.location.reload();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          File Upload <Badge variant="secondary">R2</Badge>
        </CardTitle>
        <CardDescription>Upload files to Cloudflare R2 — metadata tracked in D1.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Input
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            className="cursor-pointer"
          />
          {uploading && <p className="mt-2 text-sm text-muted-foreground">Uploading...</p>}
        </div>

        <Separator />

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">{file.filename}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{file.contentType}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatSize(file.size)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
