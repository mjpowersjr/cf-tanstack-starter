import { createFileRoute } from "@tanstack/react-router";

// @public — file downloads are intentionally open for the demo template
export const Route = createFileRoute("/api/files/download/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { env } = await import("cloudflare:workers");
        const { createDb, uploadedFiles } = await import("@repo/db");
        const { eq } = await import("drizzle-orm");

        const id = Number(params.id);
        if (!id || Number.isNaN(id)) {
          return new Response("Invalid file ID", { status: 400 });
        }

        const db = createDb(env.DB);
        const [file] = await db
          .select()
          .from(uploadedFiles)
          .where(eq(uploadedFiles.id, id))
          .limit(1);

        if (!file) {
          return new Response("File not found", { status: 404 });
        }

        const object = await env.BUCKET.get(file.r2Key);
        if (!object) {
          return new Response("File not found in storage", { status: 404 });
        }

        return new Response(object.body, {
          headers: {
            "Content-Type": file.contentType,
            "Content-Disposition": `inline; filename="${file.filename}"`,
            "Content-Length": String(file.size),
            "Cache-Control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
