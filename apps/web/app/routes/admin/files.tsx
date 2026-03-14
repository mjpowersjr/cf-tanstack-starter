import { FileIdSchema } from "@repo/db";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { adminMiddleware } from "~/lib/admin-middleware";
import { formatSize } from "~/lib/format";
import { rateLimitMiddleware } from "~/lib/rate-limit-middleware";

// --- Server Functions ---

const PAGE_SIZE = 20;

const getFilesAdmin = createServerFn({ method: "GET" })
  .middleware([adminMiddleware, tracingMiddleware])
  .inputValidator(v.object({ page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1) }))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, uploadedFiles } = await import("@repo/db");
    const { desc, sql } = await import("drizzle-orm");
    const db = createDb(env.DB);
    const offset = ((data.page ?? 1) - 1) * PAGE_SIZE;

    const [files, countResult] = await Promise.all([
      db
        .select()
        .from(uploadedFiles)
        .orderBy(desc(uploadedFiles.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(uploadedFiles),
    ]);

    return { files, total: countResult[0]?.count ?? 0 };
  });

const deleteFileAdmin = createServerFn({ method: "POST" })
  .middleware([
    adminMiddleware,
    rateLimitMiddleware({ key: "admin-delete-file", limit: 30, windowSecs: 60 }),
    tracingMiddleware,
  ])
  .inputValidator(FileIdSchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, uploadedFiles } = await import("@repo/db");
    const { eq } = await import("drizzle-orm");
    const db = createDb(env.DB);

    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, data.id))
      .limit(1);

    if (!file) throw new Error("File not found");

    await env.BUCKET.delete(file.r2Key);
    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, data.id));
    return { success: true };
  });

// --- Route ---

export const Route = createFileRoute("/admin/files")({
  head: () => ({
    meta: [
      { title: "Files | CF TanStack Starter" },
      { name: "description", content: "Manage uploaded files in R2 storage." },
      { property: "og:title", content: "Files | CF TanStack Starter" },
      { property: "og:description", content: "Manage uploaded files in R2 storage." },
    ],
  }),
  loader: () => getFilesAdmin({ data: { page: 1 } }),
  component: FilesPage,
  pendingComponent: LoadingSkeleton,
});

// --- Components ---

function FilesPage() {
  const initialData = Route.useLoaderData();
  const [files, setFiles] = useState(initialData.files);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(1);

  const fetchPage = async (p: number) => {
    const data = await getFilesAdmin({ data: { page: p } });
    setFiles(data.files);
    setTotal(data.total);
    setPage(p);
  };

  const handleDelete = async (id: number, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      await deleteFileAdmin({ data: { id } });
      toast.success(`Deleted "${filename}"`);
      await fetchPage(page);
    } catch {
      toast.error("Failed to delete file");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">File Storage</h1>
        <p className="text-muted-foreground">Manage files in R2 storage. {total} file(s) total.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Uploaded Files <Badge variant="secondary">R2</Badge>
              </CardTitle>
              <CardDescription>All files across the system</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchPage(page)}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No files uploaded yet.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>R2 Key</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead>Uploaded</TableHead>
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
                      <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                        {file.r2Key}
                      </TableCell>
                      <TableCell className="text-right">{formatSize(file.size)}</TableCell>
                      <TableCell className="text-sm">{file.createdAt}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(file.id, file.filename)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={fetchPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
