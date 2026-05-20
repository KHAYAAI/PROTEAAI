/**
 * Vercel serverless entry point.
 *
 * Vercel wraps the exported Express app as a serverless function.
 * All HTTP routes (auth, billing, IPC bridge, etc.) are handled by the
 * shared Express app defined in server/app.ts.
 *
 * Note: WebSocket push events are NOT available in Vercel serverless mode
 * (no persistent connections).  The web-ipc-adapter falls back to HTTP
 * polling when the WebSocket connection is unavailable.
 */
import app from "../server/app";

export default app;
