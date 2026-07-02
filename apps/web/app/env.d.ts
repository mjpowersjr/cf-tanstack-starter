declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    RATE_LIMIT: KVNamespace;
    FLAGS: KVNamespace;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    SIGNUP_ENABLED: string;
    /** Comma-separated emails auto-promoted to admin at account creation. */
    ADMIN_EMAILS?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
  }
}
