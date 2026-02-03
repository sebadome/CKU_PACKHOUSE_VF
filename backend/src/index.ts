// backend/src/index.ts
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { env } from "./config/env";
import { submissionsRouter } from "./routes/submissions.routes";
import authRouter from "./routes/auth";

const catalogoRoutes = require("./routes/catalogo");
const productoresRoutes = require("./routes/productores");
const variedadesRoutes = require("./routes/variedades");

const app = express();

// Útil en deploys detrás de proxy (Render/Railway/Fly/Nginx)
app.set("trust proxy", 1);

// -----------------------
// CORS
// -----------------------
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
app.use(express.json({ limit: "10mb" }));

// -----------------------
// Health
// -----------------------
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// -----------------------
// Routes API
// -----------------------
app.use("/api/auth", authRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/catalogo", catalogoRoutes);
app.use("/api/productores", productoresRoutes);
app.use("/api/variedades", variedadesRoutes);

// -----------------------
// Servir frontend (Vite dist) + SPA fallback
// -----------------------
// Asumiendo estructura:
// - frontend/dist (generado por "vite build")
// - backend/dist (generado por "tsc")
// En runtime __dirname apunta a backend/dist
const frontendDistPath =
  process.env.FRONTEND_DIST_PATH?.trim() ||
  path.resolve(__dirname, "../../frontend/dist");

const indexHtml = path.join(frontendDistPath, "index.html");

if (fs.existsSync(indexHtml)) {
  // Servir archivos estáticos (assets)
  app.use(express.static(frontendDistPath));

  // SPA fallback: cualquier ruta que NO sea /api debe devolver index.html
  // IMPORTANTE: esto debe ir antes del 404
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(indexHtml);
  });

  console.log(`[backend] Frontend servido desde: ${frontendDistPath}`);
} else {
  console.warn(
    `[backend] No se encontró frontend build en: ${frontendDistPath}. ` +
      `Se servirá SOLO la API. ` +
      `Tip: ejecuta "vite build" en el frontend o define FRONTEND_DIST_PATH.`
  );
}

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
