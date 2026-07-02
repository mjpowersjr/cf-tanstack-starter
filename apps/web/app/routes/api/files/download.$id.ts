import { createFileRoute } from "@tanstack/react-router";

// @public — file downloads are intentionally open for the demo template
export const Route = createFileRoute("/api/files/download/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { env } = await import("cloudflare:workers");
        const { createDb, uploadedFiles } = await import("@repo/db");
        const { eq } = await import("drizzle-orm");

        const id = Number(params.id);
        if (!Number.isInteger(id) || id < 1) {
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

        if (request.headers.get("if-none-match") === object.httpEtag) {
          return new Response(null, { status: 304, headers: { ETag: object.httpEtag } });
        }

        // Force download for types that could execute scripts (SVG, HTML, XML)
        const INLINE_SAFE_TYPES = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf",
          "text/plain",
          "text/csv",
        ];
        const disposition = INLINE_SAFE_TYPES.includes(file.contentType) ? "inline" : "attachment";
        const safeFilename = file.filename.replace(/["\\\r\n]/g, "_");

        return new Response(object.body, {
          headers: {
            "Content-Type": file.contentType,
            "Content-Disposition": `${disposition}; filename="${safeFilename}"`,
            // Size from the object, not the DB row — they can disagree.
            "Content-Length": String(object.size),
            ETag: object.httpEtag,
            "Cache-Control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
