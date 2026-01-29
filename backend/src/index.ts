// backend/src/index.ts
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { env } from "./config/env";
import { submissionsRouter } from "./routes/submissions.routes";
const catalogoRoutes = require('./routes/catalogo');
const productoresRoutes = require('./routes/productores');
const variedadesRoutes = require('./routes/variedades');

const app = express();

// Útil en deploys detrás de proxy (Render/Railway/Fly/Nginx)
// No rompe local.
app.set("trust proxy", 1);

// -----------------------
// CORS
// -----------------------
// Si defines CORS_ORIGINS (comma-separated) en prod, se aplica allowlist.
// Si NO lo defines, se permite cualquier origin (similar a tu "origin: true").
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Requests sin origin (curl / server-to-server) -> permitir
      if (!origin) return cb(null, true);

      // Sin allowlist configurada -> permitir todo (modo dev)
      if (allowedOrigins.length === 0) return cb(null, true);

      // Allowlist
      if (allowedOrigins.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS bloqueado para origin: ${origin}`));
    },
    credentials: true,
  })
);

// -----------------------
// Body parser
// -----------------------
// 10mb es más seguro para payloads con matrices grandes (sin pasarse).
app.use(express.json({ limit: "10mb" }));

// -----------------------
// Health
// -----------------------
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// -----------------------
// Routes
// -----------------------
app.use("/api/submissions", submissionsRouter);
app.use('/api/catalogo', catalogoRoutes);
app.use('/api/productores', productoresRoutes);
app.use('/api/variedades', variedadesRoutes);
// -----------------------
// 404
// -----------------------
app.use((_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: "Not Found" });
});

// -----------------------
// Error handler
// -----------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = Number(err?.statusCode ?? err?.status ?? 500);
  const msg = err?.message ?? "Internal Server Error";

  console.error("[backend] error:", {
    status,
    message: msg,
    code: err?.code ?? err?.number ?? "",
  });

  res.status(status).json({ ok: false, error: msg });
});

// -----------------------
// Listen
// -----------------------
app.listen(env.PORT, () => {
  console.log(`[backend] listening on http://localhost:${env.PORT}`);
});
