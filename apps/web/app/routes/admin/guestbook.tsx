import { AddEntrySchema, EntryIdSchema, UpdateEntrySchema } from "@repo/db";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import * as v from "valibot";
import { LoadingSkeleton } from "~/components/loading";
import { Pagination } from "~/components/pagination";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { rateLimitMiddleware } from "~/lib/rate-limit-middleware";
import { createAdminServerFn } from "~/lib/server-fn";

// --- Server Functions ---

const PAGE_SIZE = 20;

const PaginationSchema = v.object({
  page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
  sort: v.optional(v.picklist(["newest", "oldest", "name"]), "newest"),
});

const getEntries = createAdminServerFn()
  .inputValidator(PaginationSchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, guestbookEntries } = await import("@repo/db");
    const { asc, desc, sql } = await import("drizzle-orm");
    const db = createDb(env.DB);
    const offset = ((data.page ?? 1) - 1) * PAGE_SIZE;

    const orderBy =
      data.sort === "oldest"
        ? asc(guestbookEntries.createdAt)
        : data.sort === "name"
          ? asc(guestbookEntries.name)
          : desc(guestbookEntries.createdAt);

    const [entries, countResult] = await Promise.all([
      db.select().from(guestbookEntries).orderBy(orderBy).limit(PAGE_SIZE).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(guestbookEntries),
    ]);

    return { entries, total: countResult[0]?.count ?? 0 };
  });

const createEntry = createAdminServerFn({ method: "POST" })
  .middleware([rateLimitMiddleware({ key: "admin-create-entry", limit: 30, windowSecs: 60 })])
  .inputValidator(AddEntrySchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, guestbookEntries } = await import("@repo/db");
    const db = createDb(env.DB);
    await db.insert(guestbookEntries).values({ name: data.name, message: data.message });
    return { success: true };
  });

const updateEntry = createAdminServerFn({ method: "POST" })
  .middleware([rateLimitMiddleware({ key: "admin-update-entry", limit: 30, windowSecs: 60 })])
  .inputValidator(UpdateEntrySchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, guestbookEntries } = await import("@repo/db");
    const { eq } = await import("drizzle-orm");
    const db = createDb(env.DB);
    await db
      .update(guestbookEntries)
      .set({ name: data.name, message: data.message })
      .where(eq(guestbookEntries.id, data.id));
    return { success: true };
  });

const deleteEntry = createAdminServerFn({ method: "POST" })
  .middleware([rateLimitMiddleware({ key: "admin-delete-entry", limit: 30, windowSecs: 60 })])
  .inputValidator(EntryIdSchema)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const { createDb, guestbookEntries } = await import("@repo/db");
    const { eq } = await import("drizzle-orm");
    const db = createDb(env.DB);
    await db.delete(guestbookEntries).where(eq(guestbookEntries.id, data.id));
    return { success: true };
  });

// --- Route ---

export const Route = createFileRoute("/admin/guestbook")({
  head: () => ({
    meta: [
      { title: "Guestbook | CF TanStack Starter" },
      { name: "description", content: "Manage guestbook entries." },
      { property: "og:title", content: "Guestbook | CF TanStack Starter" },
      { property: "og:description", content: "Manage guestbook entries." },
    ],
  }),
  loader: () => getEntries({ data: { page: 1, sort: "newest" } }),
  component: GuestbookPage,
  pendingComponent: LoadingSkeleton,
});

// --- Types ---

interface Entry {
  id: number;
  name: string;
  message: string;
  createdAt: string;
}

// --- Components ---

function GuestbookPage() {
  const initialData = Route.useLoaderData();
  const [entries, setEntries] = useState<Entry[]>(initialData.entries);
  const [total, setTotal] = useState(initialData.total);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchPage = async (p: number, s?: "newest" | "oldest" | "name") => {
    const data = await getEntries({ data: { page: p, sort: s ?? sort } });
    setEntries(data.entries);
    setTotal(data.total);
    setPage(p);
  };

  const handleSort = async (s: "newest" | "oldest" | "name") => {
    setSort(s);
    await fetchPage(1, s);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await deleteEntry({ data: { id } });
      toast.success("Entry deleted");
      await fetchPage(page);
    } catch {
      toast.error("Failed to delete entry");
    }
  };

  const handleUpdate = async (id: number, name: string, message: string) => {
    try {
      await updateEntry({ data: { id, name, message } });
      toast.success("Entry updated");
      setEditingId(null);
      await fetchPage(page);
    } catch {
      toast.error("Failed to update entry");
    }
  };

  const handleCreate = async (name: string, message: string) => {
    try {
      await createEntry({ data: { name, message } });
      toast.success("Entry created");
      await fetchPage(1);
    } catch {
      toast.error("Failed to create entry");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guestbook</h1>
          <p className="text-muted-foreground">{total} entries total</p>
        </div>
        <div className="flex items-center gap-2">
          <CreateEntryDialog onSubmit={handleCreate} />
          <Button variant="outline" size="sm" onClick={() => fetchPage(page)}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Entries</CardTitle>
              <CardDescription>All guestbook entries</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              {(["newest", "oldest", "name"] as const).map((s) => (
                <Button
                  key={s}
                  variant={sort === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSort(s)}
                >
                  {s === "newest" ? "Newest" : s === "oldest" ? "Oldest" : "By Name"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead className="w-32">Name</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-36">Date</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) =>
                    editingId === entry.id ? (
                      <EditRow
                        key={entry.id}
                        entry={entry}
                        onSave={handleUpdate}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {entry.id}
                        </TableCell>
                        <TableCell className="font-medium">{entry.name}</TableCell>
                        <TableCell className="max-w-md truncate">{entry.message}</TableCell>
                        <TableCell className="text-sm">{entry.createdAt}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(entry.id)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(entry.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
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

function EditRow({
  entry,
  onSave,
  onCancel,
}: {
  entry: Entry;
  onSave: (id: number, name: string, message: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(entry.name);
  const [message, setMessage] = useState(entry.message);

  return (
    <TableRow className="bg-muted/50">
      <TableCell className="font-mono text-xs text-muted-foreground">{entry.id}</TableCell>
      <TableCell>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      </TableCell>
      <TableCell>
        <Input value={message} onChange={(e) => setMessage(e.target.value)} className="h-8" />
      </TableCell>
      <TableCell className="text-sm">{entry.createdAt}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" onClick={() => onSave(entry.id, name, message)}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CreateEntryDialog({ onSubmit }: { onSubmit: (name: string, message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    onSubmit(name.trim(), message.trim());
    setName("");
    setMessage("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New Entry</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Entry</DialogTitle>
          <DialogDescription>Add a new guestbook entry.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Author name"
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Input
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message..."
              required
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
