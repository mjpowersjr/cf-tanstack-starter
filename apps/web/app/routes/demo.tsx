import {
  AddEntrySchema,
  ALLOWED_CONTENT_TYPES,
  FileIdSchema,
  MAX_FILE_SIZE,
  UploadFileSchema,
} from "@repo/db";
import { tracingMiddleware } from "@repo/observability/middleware";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import * as v from "valibot";
import { LoadingSkeleton } from "~/components/loading";
import { Pagination } from "~/components/pagination";
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
import { authMiddleware } from "~/lib/auth-middleware";
import { formatDate, formatSize } from "~/lib/format";
import { rateLimitMiddleware } from "~/lib/rate-limit-middleware";

// --- Server Functions ---
//
// Security posture of this demo page:
// - Guestbook write and file list/download are PUBLIC (that's the demo).
// - File upload/delete require a signed-in user; deletes are scoped to the
//   uploader (admins may delete anything).
// If you build on this page, revisit whether the public pieces should stay
// public in your app.

const ENTRIES_PAGE_SIZE = 10;

const getEntries = createServerFn({ method: "GET" })
  .middleware([tracingMiddleware])
  .validator(v.object({ page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1) }))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, guestbookEntries } = await import("@repo/db");
    const { desc, sql } = await import("drizzle-orm");
    const db = createDb(env.DB);
    const offset = ((data.page ?? 1) - 1) * ENTRIES_PAGE_SIZE;
    const [entries, countResult] = await Promise.all([
      db
        .select()
        .from(guestbookEntries)
        .orderBy(desc(guestbookEntries.createdAt))
        .limit(ENTRIES_PAGE_SIZE)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(guestbookEntries),
    ]);
    return { entries, total: countResult[0]?.count ?? 0 };
  });

// @public-fn — anonymous guestbook signing is the point of the demo; rate-limited per IP
const addEntry = createServerFn({ method: "POST" })
  .middleware([
    rateLimitMiddleware({ key: "add-entry", limit: 30, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .validator(AddEntrySchema)
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
  .middleware([
    authMiddleware,
    rateLimitMiddleware({ key: "upload-file", limit: 10, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .validator(UploadFileSchema)
  .handler(async ({ data, context }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, uploadedFiles } = await import("@repo/db");
    const db = createDb(env.DB);
    // Random key: user filenames collide (same-millisecond uploads shared a
    // key and overwrote each other) and don't belong in storage paths.
    const r2Key = `uploads/${crypto.randomUUID()}`;
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));

    await env.BUCKET.put(r2Key, bytes, {
      httpMetadata: { contentType: data.contentType },
    });

    try {
      await db.insert(uploadedFiles).values({
        filename: data.filename,
        r2Key,
        contentType: data.contentType,
        size: bytes.length,
        userId: context.session.user.id,
      });
    } catch (err) {
      // Don't leave an orphaned object if the metadata insert fails.
      await env.BUCKET.delete(r2Key).catch(() => {});
      throw err;
    }

    return { success: true };
  });

const deleteFile = createServerFn({ method: "POST" })
  .middleware([
    authMiddleware,
    rateLimitMiddleware({ key: "delete-file", limit: 20, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .validator(FileIdSchema)
  .handler(async ({ data, context }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, uploadedFiles } = await import("@repo/db");
    const { eq } = await import("drizzle-orm");
    const db = createDb(env.DB);

    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, data.id))
      .limit(1);

    if (!file) {
      throw new Error("File not found");
    }

    const { user } = context.session;
    const isAdmin = (user as { role?: string }).role === "admin";
    if (!isAdmin && file.userId !== user.id) {
      throw new Error("You can only delete files you uploaded");
    }

    // DB row first: a failure here leaves everything intact. R2 delete is
    // best-effort — a dangling object costs pennies, a dangling row 404s.
    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, data.id));
    await env.BUCKET.delete(file.r2Key).catch(() => {});

    return { success: true };
  });

// --- Route ---

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo | CF TanStack Starter" },
      {
        name: "description",
        content: "Try out D1 (SQLite) and R2 (object storage) powered by Cloudflare Workers.",
      },
      { property: "og:title", content: "Demo | CF TanStack Starter" },
      {
        property: "og:description",
        content: "Try out D1 (SQLite) and R2 (object storage) powered by Cloudflare Workers.",
      },
    ],
  }),
  loader: async () => {
    const [entriesData, files] = await Promise.all([getEntries({ data: { page: 1 } }), getFiles()]);
    return { entriesData, files };
  },
  component: DemoPage,
  pendingComponent: LoadingSkeleton,
});

function DemoPage() {
  const { entriesData, files } = Route.useLoaderData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Demo</h1>
        <p className="text-muted-foreground">
          Try out D1 (SQLite) and R2 (object storage) powered by Cloudflare Workers.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <GuestbookSection initialEntries={entriesData.entries} initialTotal={entriesData.total} />
        <FileUploadSection initialFiles={files} />
      </div>
    </div>
  );
}

// --- Guestbook ---

function GuestbookSection({
  initialEntries,
  initialTotal,
}: {
  initialEntries: { id: number; name: string; message: string; createdAt: Date }[];
  initialTotal: number;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPage = async (p: number) => {
    try {
      const data = await getEntries({ data: { page: p } });
      // Don't strand the user on an empty trailing page.
      if (data.entries.length === 0 && p > 1) {
        await fetchPage(p - 1);
        return;
      }
      setEntries(data.entries);
      setTotal(data.total);
      setPage(p);
    } catch {
      toast.error("Failed to load entries");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      await addEntry({ data: { name: name.trim(), message: message.trim() } });
      setName("");
      setMessage("");
      toast.success("Entry added to guestbook");
      await fetchPage(1);
    } catch {
      toast.error("Failed to add entry");
    } finally {
      setSubmitting(false);
    }
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
                  <span className="text-xs text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{entry.message}</p>
              </div>
            ))}
            <Pagination
              page={page}
              pageSize={ENTRIES_PAGE_SIZE}
              total={total}
              onPageChange={fetchPage}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- File Upload ---

function FileUploadSection({
  initialFiles,
}: {
  initialFiles: {
    id: number;
    filename: string;
    r2Key: string;
    contentType: string;
    size: number;
    userId: string | null;
    createdAt: Date;
  }[];
}) {
  const [files, setFiles] = useState(initialFiles);
  const [uploading, setUploading] = useState(false);

  const refreshFiles = async () => {
    const updated = await getFiles();
    setFiles(updated);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate before encoding — a 100MB file shouldn't freeze the tab just
    // to be rejected by the server.
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large (max 5MB)");
      e.target.value = "";
      return;
    }
    const contentType = ALLOWED_CONTENT_TYPES.find((t) => t === file.type);
    if (!contentType) {
      toast.error(`Unsupported file type: ${file.type || "unknown"}`);
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      // Chunked encoding: byte-by-byte string concatenation is O(n²) and
      // freezes the main thread for multi-MB files.
      const CHUNK = 0x8000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(binary);

      await uploadFile({
        data: {
          filename: file.name,
          contentType,
          base64,
        },
      });

      toast.success(`Uploaded ${file.name}`);
      await refreshFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">
                    <a
                      href={`/api/files/download/${file.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {file.filename}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{file.contentType}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatSize(file.size)}</TableCell>
                  <TableCell className="text-right">
                    <DeleteFileButton id={file.id} onDeleted={refreshFiles} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteFileButton({ id, onDeleted }: { id: number; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this file?")) return;
    setDeleting(true);
    try {
      await deleteFile({ data: { id } });
      toast.success("File deleted");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete file");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
      {deleting ? "..." : "Delete"}
    </Button>
  );
}
