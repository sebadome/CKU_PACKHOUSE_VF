// backend/src/routes/submissions.routes.ts
import { Router } from "express";
import { env } from "../config/env";
import { sendTeamsCard } from "../utils/teams";
import { nowChileString, nowUtcString } from "../utils/time";
import { getPool, sql } from "../db/pool";
import {
  auditFail,
  finalizePrecosechaManzanas,
  SubmissionPayload,
} from "../services/precosechaManzanas.service";
import { finalizeRecepMadurezPomaceas } from "../services/recepMadPomaceas.service";
import { finalizeProyEmbalajePomaceas } from "../services/proyEmbalajePomaceas.service";
import { finalizeEmpaque } from "../services/empaque.service";
import { finalizePresizer } from "../services/ckuPresizer.service";
import { finalizeAtmControlada } from "../services/atmControlada.service";

export const submissionsRouter = Router();

// =========================================================
// Helpers
// =========================================================
function normalizeSubmissionId(payload: any): string {
  const raw =
    payload?.id?.id ??
    payload?.id?.value ??
    payload?.id ??
    payload?.submission_id ??
    "";

  if (typeof raw !== "string") {
    throw new Error(`submission_id inválido: ${JSON.stringify(raw)}`);
  }

  return raw;
}


function makeRequestId(): string {
  // Node 18+ a veces NO expone crypto en globalThis según runtime/bundler.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyCrypto = (globalThis as any).crypto;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractErrorInfo(e: any) {
  return {
    name: e?.name ?? "",
    message: e?.message ?? String(e),
    code: e?.code ?? e?.number ?? "",
    stack: e?.stack ?? "",
  };
}

function safeKeys(obj: any, max = 40): string {
  if (!obj || typeof obj !== "object") return "";
  try {
    return Object.keys(obj).slice(0, max).join(", ");
  } catch {
    return "";
  }
}

function safeJsonStringify(obj: any, maxChars = 200_000): string {
  try {
    const seen = new WeakSet();
    const s = JSON.stringify(obj, (_k, v) => {
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    });
    if (s.length <= maxChars) return s;
    return s.slice(0, maxChars) + `... (TRUNCADO, len=${s.length})`;
  } catch {
    return "(no se pudo stringify)";
  }
}

function toNonEmptyStr(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/**
 * Protege /finalize con x-api-key si env.API_KEY existe.
 */
function requireApiKey(req: any) {
  if (!env.API_KEY) return;
  const k = req.header("x-api-key");
  if (!k || k !== env.API_KEY) {
    const err: any = new Error("unauthorized");
    err.statusCode = 401;
    throw err;
  }
}

/**
 * Persistencia RAW SIEMPRE (idempotente).
 * Garantiza que exista fila en dbo.CKU_Submissions aunque la plantilla no esté implementada.
 */
async function upsertCkuSubmissionRaw(payload: any) {
  const pool = await getPool();

  const submissionId = payload?.id;
  if (!submissionId) throw new Error("Payload sin id (submission_id).");

  const templateId = String(payload?.templateId ?? "");
  const templateTitle = String(payload?.template?.title ?? "");
  const templateVersion = String(payload?.template?.version ?? "");
  const status = String(payload?.status ?? "");

  const createdAt = payload?.createdAt ? new Date(payload.createdAt) : null;
  const updatedAt = payload?.updatedAt ? new Date(payload.updatedAt) : null;

  const submittedBy = String(payload?.submittedBy ?? "");

  const userId = String(payload?.user?.id ?? payload?.user?.userId ?? "");
  const userName = String(payload?.user?.name ?? "");
  const userEmail = String(payload?.user?.email ?? "");

  const data = payload?.data ?? {};

  // Fallbacks típicos para estas plantillas (encabezado.*)
  const planta =
    String(payload?.planta ?? data?.planta ?? data?.encabezado?.planta ?? "") ?? "";
  const temporada = String(data?.temporada ?? data?.encabezado?.temporada ?? "") ?? "";
  const tipoFruta = String(data?.tipo_fruta ?? data?.encabezado?.tipo_fruta ?? "") ?? "";

  const dataJson = safeJsonStringify(data, 2_000_000);
  const rawJson = safeJsonStringify(payload, 2_000_000);

  const q = `
MERGE dbo.CKU_Submissions AS target
USING (SELECT CAST(@submission_id AS UNIQUEIDENTIFIER) AS submission_id) AS src
ON target.submission_id = src.submission_id
WHEN MATCHED THEN
  UPDATE SET
    template_id = @template_id,
    template_title = @template_title,
    template_version = @template_version,
    status = @status,
    created_at = COALESCE(target.created_at, @created_at),
    updated_at = COALESCE(@updated_at, SYSUTCDATETIME()),
    submitted_by = @submitted_by,
    user_id = @user_id,
    user_name = @user_name,
    user_email = @user_email,
    planta = @planta,
    temporada = @temporada,
    tipo_fruta = @tipo_fruta,
    data_json = @data_json,
    raw_submission_json = @raw_submission_json
WHEN NOT MATCHED THEN
  INSERT (
    submission_id, template_id, template_title, template_version, status,
    created_at, updated_at, submitted_by,
    user_id, user_name, user_email,
    planta, temporada, tipo_fruta,
    data_json, raw_submission_json
  )
  VALUES (
    CAST(@submission_id AS UNIQUEIDENTIFIER), @template_id, @template_title, @template_version, @status,
    COALESCE(@created_at, SYSUTCDATETIME()), COALESCE(@updated_at, SYSUTCDATETIME()), @submitted_by,
    @user_id, @user_name, @user_email,
    @planta, @temporada, @tipo_fruta,
    @data_json, @raw_submission_json
  );
`;

  await pool
    .request()
    .input("submission_id", sql.UniqueIdentifier, submissionId)
    .input("template_id", sql.NVarChar(50), templateId)
    .input("template_title", sql.NVarChar(200), templateTitle)
    .input("template_version", sql.NVarChar(50), templateVersion)
    .input("status", sql.NVarChar(50), status)
    .input("created_at", sql.DateTime2, createdAt)
    .input("updated_at", sql.DateTime2, updatedAt)
    .input("submitted_by", sql.NVarChar(200), submittedBy)
    .input("user_id", sql.NVarChar(100), userId)
    .input("user_name", sql.NVarChar(200), userName)
    .input("user_email", sql.NVarChar(200), userEmail)
    .input("planta", sql.NVarChar(100), planta)
    .input("temporada", sql.NVarChar(50), temporada)
    .input("tipo_fruta", sql.NVarChar(50), tipoFruta)
    .input("data_json", sql.NVarChar(sql.MAX), dataJson)
    .input("raw_submission_json", sql.NVarChar(sql.MAX), rawJson)
    .query(q);
}

/**
 * Auditoría estándar al CKU_APP_AUDIT_LOG (router-level).
 */
async function auditEvent(params: {
  event_type: string;
  result: "OK" | "WARN" | "FAIL";
  submission_id?: string;
  template_id?: string;
  template_title?: string;
  user_name?: string;
  user_id?: string;
  user_email?: string;
  error_message?: string;
  details?: any;
}) {
  const pool = await getPool();

  const q = `
INSERT INTO dbo.CKU_APP_AUDIT_LOG (
  event_time_utc, event_type, result,
  submission_id, template_id, template_title,
  user_name, user_id, user_email,
  error_message, details_json
)
VALUES (
  SYSUTCDATETIME(), @event_type, @result,
  @submission_id, @template_id, @template_title,
  @user_name, @user_id, @user_email,
  @error_message, @details_json
);
`;

  const detailsJson = params.details ? safeJsonStringify(params.details, 500_000) : null;

  await pool
    .request()
    .input("event_type", sql.NVarChar(60), params.event_type)
    .input("result", sql.NVarChar(20), params.result)
    .input("submission_id", sql.UniqueIdentifier, params.submission_id ?? null)
    .input("template_id", sql.NVarChar(50), params.template_id ?? "")
    .input("template_title", sql.NVarChar(200), params.template_title ?? "")
    .input("user_name", sql.NVarChar(200), params.user_name ?? "")
    .input("user_id", sql.NVarChar(100), params.user_id ?? "")
    .input("user_email", sql.NVarChar(200), params.user_email ?? "")
    .input("error_message", sql.NVarChar(sql.MAX), params.error_message ?? "")
    .input("details_json", sql.NVarChar(sql.MAX), detailsJson)
    .query(q);
}

function healthToStatus(hs: any): "OK" | "WARN" | "FAIL" {
  const v = String(hs ?? "OK").toUpperCase();
  if (v === "FAIL") return "FAIL";
  if (v === "WARN") return "WARN";
  return "OK";
}

function statusToEmoji(status: "OK" | "WARN" | "FAIL"): string {
  if (status === "OK") return "✅";
  if (status === "WARN") return "⚠️";
  return "❌";
}

// =========================================================
// POST /api/submissions/finalize
// =========================================================
submissionsRouter.post("/finalize", async (req, res) => {
  const requestId = makeRequestId();
  const t0 = Date.now();

  try {
    requireApiKey(req);

    const payload = req.body;
    const templateId = String(payload?.templateId ?? "");
    const templateTitle = String(payload?.template?.title ?? "");
    const submissionId = payload?.id ?? "";
    const data = payload?.data ?? {};
    const tipoFruta = String(data?.tipo_fruta ?? data?.encabezado?.tipo_fruta ?? "");
    const userName = String(payload?.user?.name ?? payload?.submittedBy ?? "");
    const userId = String(payload?.user?.id ?? "");
    const userEmail = String(payload?.user?.email ?? "");

    const baseFacts: any = {
      request_id: requestId,
      submission_id: submissionId,
      template_id: templateId,
      template_title: templateTitle,
      tipo_fruta: tipoFruta,
      user: userName,
      chile_time: nowChileString(),
      utc_time: nowUtcString(),
    };

    // ---------------------------------------------------------
    // 1) Persistencia RAW (SIEMPRE, idempotente)
    // ---------------------------------------------------------
    try {
      await upsertCkuSubmissionRaw(payload);

      await auditEvent({
        event_type: "FINALIZE_RECEIVED",
        result: "OK",
        submission_id: submissionId,
        template_id: templateId,
        template_title: templateTitle,
        user_name: userName,
        user_id: userId,
        user_email: userEmail,
        details: {
          request_id: requestId,
          data_keys: Object.keys(data ?? {}),
        },
      });
    } catch (e: any) {
      const info = extractErrorInfo(e);

      await sendTeamsCard(
        env.TEAMS_WEBHOOK_URL,
        "❌ FINALIZE FAIL (CRÍTICO) - PERSISTENCIA RAW",
        `No se pudo guardar CKU_Submissions (RAW). ${info.message}`,
        {
          ...baseFacts,
          "tiempo(ms)": String(Date.now() - t0),
        }
      );

      return res.status(500).json({
        ok: false,
        error: `Fallo persistencia RAW: ${info.message}`,
        requestId,
      });
    }

    // ---------------------------------------------------------
    // 2) Finalize por plantilla
    // ---------------------------------------------------------
    // =========================================================
    // 2.A) PRE-COSECHA MANZANAS (REG.CKU.013)
    // =========================================================
    if (templateId === "REG.CKU.013" && tipoFruta === "MANZANA") {
      const result = await finalizePrecosechaManzanas(payload);

      const counts: Record<string, any> =
        (result as any)?.counts && typeof (result as any).counts === "object"
          ? (result as any).counts
          : {};

      await auditEvent({
        event_type: "FINALIZE_OK",
        result: "OK",
        submission_id: String((result as any)?.submissionId ?? submissionId),
        template_id: templateId,
        template_title: templateTitle,
        user_name: String(userName ?? ""),
        user_id: String(userId ?? ""),
        user_email: String(userEmail ?? ""),
        details: { request_id: requestId, counts },
      });

      await sendTeamsCard(
        env.TEAMS_WEBHOOK_URL,
        "✅ FINALIZE OK - PRE_COSECHA_MANZANAS (API)",
        "Registro guardado en CKU_Submissions + PRE_COSECHA_MANZANAS + HIJAS + AUDIT.",
        {
          ...baseFacts,
          submission_id: String((result as any)?.submissionId ?? submissionId),
          "tiempo(ms)": String(Date.now() - t0),
          ...(Object.keys(counts).length
            ? {
              "hijas/grupos_pres": String(counts.presiones_grupos ?? ""),
              "hijas/detalles_pres": String(counts.presiones_detalles ?? ""),
              "hijas/almidon_filas": String(counts.almidon_filas ?? ""),
              "hijas/semilla_filas": String(counts.semilla_filas ?? ""),
              "hijas/semilla_sum": String(counts.semilla_sum ?? ""),
            }
            : {}),
        }
      );

      return res.json({
        ok: true,
        submissionId: String((result as any)?.submissionId ?? submissionId),
        requestId,
      });
    }

    // =========================================================
    // 2.B) RECEPCIÓN MADUREZ POMÁCEAS (REG.CKU.014)
    // =========================================================
    if (templateId === "REG.CKU.014") {
      // este service ejecuta el SP, lee health y audita START/DONE/FAIL
      const result = await finalizeRecepMadurezPomaceas(payload);

      const counts: Record<string, any> =
        (result as any)?.counts && typeof (result as any).counts === "object"
          ? (result as any).counts
          : {};

      const status = healthToStatus(counts?.health_status);
      const emoji = statusToEmoji(status);

      await sendTeamsCard(
        env.TEAMS_WEBHOOK_URL,
        `${emoji} FINALIZE ${status} - RECEP_MAD_POMACEAS (API)`,
        "Normalización ejecutada: CKU_Submissions → loader SQL (SP) → tablas + health.",
        {
          ...baseFacts,
          submission_id: String((result as any)?.submissionId ?? submissionId),
          "tiempo(ms)": String(Date.now() - t0),
          ...(Object.keys(counts).length
            ? {
              "hijas/pres_rows": String(counts.pres_rows ?? ""),
              "hijas/almidon_rows": String(counts.almidon_rows ?? ""),
              "hijas/madurez_rows": String(counts.madurez_rows ?? ""),
              "res/resPres": String(counts.resumen_presion_rows ?? ""),
              "res/resAlm": String(counts.resumen_almidon_rows ?? ""),
              "res/resAlmG": String(counts.resumen_almidon_global_rows ?? ""),
              "pres/esperadas": String(counts.pres_mediciones_esperadas ?? ""),
              "pres/completadas": String(counts.pres_mediciones_completadas ?? ""),
              "pres/faltantes": String(counts.pres_mediciones_faltantes ?? ""),
              health_status: String(counts.health_status ?? ""),
              processed_utc: String(counts.processed_utc ?? ""),
            }
            : {}),
        }
      );

      return res.json({
        ok: true,
        submissionId: String((result as any)?.submissionId ?? submissionId),
        requestId,
        health_status: status,
        counts,
      });
    }

    // =========================================================
    // 2.C) PROYECCIÓN EMBALAJE POMÁCEAS - RECEPCIÓN (REG.CKU.015)
    // =========================================================
    if (templateId === "REG.CKU.015") {
      const result = await finalizeProyEmbalajePomaceas(payload);

      const counts: Record<string, any> =
        (result as any)?.counts && typeof (result as any).counts === "object"
          ? (result as any).counts
          : {};

      const status = healthToStatus(counts?.health_status);
      const emoji = statusToEmoji(status);

      await sendTeamsCard(
        env.TEAMS_WEBHOOK_URL,
        `${emoji} FINALIZE ${status} - PROY_EMB_POMACEAS (API)`,
        "Normalización ejecutada: CKU_Submissions → usp_Load_PROY_EMB_POMACEAS_RECEPCION → tablas + KPI.",
        {
          ...baseFacts,
          submission_id: String((result as any)?.submissionId ?? submissionId),
          "tiempo(ms)": String(Date.now() - t0),
          ...(Object.keys(counts).length
            ? {
              "main_rows": String(counts.main_rows ?? ""),
              "tabla_calibre": String(counts.tabla_calibre_rows ?? ""),
              "tabla_color_fondo": String(counts.tabla_color_fondo_rows ?? ""),
              "tabla_color_cubr": String(counts.tabla_color_cubrimiento_rows ?? ""),
              "danos_defectos": String(counts.danos_defectos_rows ?? ""),
              "plagas_enfermedades": String(counts.plagas_enfermedades_rows ?? ""),
              "proy_embalaje": String(counts.proyeccion_embalaje_rows ?? ""),
              "proy_embalaje_det": String(counts.proyeccion_embalaje_det_rows ?? ""),
              "condicion_camion": String(counts.condicion_camion_rows ?? ""),
              "resumen_exportable": String(counts.resumen_exportable_rows ?? ""),
              "KPI/proy_rows": String(counts.proy_rows ?? ""),
              "KPI/expected_cells": String(counts.expected_cells_total ?? ""),
              "KPI/completed_cells": String(counts.completed_cells_total ?? ""),
              "KPI/missing_cells": String(counts.missing_cells_total ?? ""),
              "KPI/completion_ratio": String(counts.completion_ratio ?? ""),
              health_status: String(counts.health_status ?? ""),
              processed_utc: String(counts.processed_utc ?? ""),
            }
            : {}),
        }
      );

      return res.json({
        ok: true,
        submissionId: String((result as any)?.submissionId ?? submissionId),
        requestId,
        health_status: status,
        counts,
      });
    }

    // =========================================================
    // 2.D) C.K.U EMPAQUE (REG.CKU.017)
    // =========================================================
    if (templateId === "REG.CKU.017") {
      const result = await finalizeEmpaque(payload);

      const counts: Record<string, any> =
        (result as any)?.counts && typeof (result as any).counts === "object"
          ? (result as any).counts
          : {};

      const status = healthToStatus(counts?.health_status);
      const emoji = statusToEmoji(status);

      await sendTeamsCard(
        env.TEAMS_WEBHOOK_URL,
        `${emoji} FINALIZE ${status} - CKU_EMPAQUE (API)`,
        "Normalización ejecutada: CKU_Submissions → usp_Load_CKU_EMPAQUE → tablas + vistas PBI + health/KPI.",
        {
          ...baseFacts,
          submission_id: String((result as any)?.submissionId ?? submissionId),
          "tiempo(ms)": String(Date.now() - t0),
          ...(Object.keys(counts).length
            ? {
              main_rows: String(counts.main_rows ?? ""),
              pres_grupos: String(counts.pres_grupos ?? ""),
              pres_detalles: String(counts.pres_detalles ?? ""),
              paso3a_cells: String(counts.paso3a_cells ?? ""),
              paso3b_cells: String(counts.paso3b_cells ?? ""),
              paso3c_cells: String(counts.paso3c_cells ?? ""),
              paso4_cells: String(counts.paso4_cells ?? ""),
              paso5_rows: String(counts.paso5_rows ?? ""),
              health_status: String(counts.health_status ?? ""),
              processed_utc: String(counts.processed_utc ?? ""),
            }
            : {}),
        }
      );

      return res.json({
        ok: true,
        submissionId: String((result as any)?.submissionId ?? submissionId),
        requestId,
        health_status: status,
        counts,
      });
    }
    // =========================================================
    // 2.C) C.K.U PRESIZER (REG.CKU.018)
    // =========================================================
    if (templateId === "REG.CKU.018") {
  const submissionId = normalizeSubmissionId(payload);

  const result = await finalizePresizer(submissionId);

  const counts: Record<string, any> =
    (result as any)?.counts && typeof (result as any).counts === "object"
      ? (result as any).counts
      : {};

  const status = healthToStatus(counts?.health_status);
  const emoji = statusToEmoji(status);

  await sendTeamsCard(
    env.TEAMS_WEBHOOK_URL,
    `${emoji} FINALIZE ${status} - C.K.U PRESIZER (API)`,
    "Normalización ejecutada: CKU_Submissions → loader SQL (SP) → 13 tablas + health.",
    {
      ...baseFacts,
      submission_id: String((result as any)?.submissionId ?? submissionId),
      "tiempo(ms)": String(Date.now() - t0),
      ...(Object.keys(counts).length
        ? {
            "tablas/tarjas": String(counts.tarjas_entrada ?? ""),
            "tablas/camaras": String(counts.camaras ?? ""),
            "tablas/canales_activos": String(counts.canales_activos ?? ""),
            health_status: String(counts.health_status ?? ""),
          }
        : {}),
    }
  );

  return res.json({
    ok: true,
    submissionId: String((result as any)?.submissionId ?? submissionId),
    requestId,
    health_status: status,
    counts,
  });
}
// =========================================================
    // 2.D) ATMÓSFERA CONTROLADA POMÁCEAS (REG.CKU.022)
    // =========================================================
    if (templateId === "REG.CKU.022") {
      const submissionId = normalizeSubmissionId(payload);

      const result = await finalizeAtmControlada(submissionId);

      const counts: Record<string, any> =
        (result as any)?.counts && typeof (result as any).counts === "object"
          ? (result as any).counts
          : {};

      const status = healthToStatus(counts?.health_status);
      const emoji = statusToEmoji(status);

      await sendTeamsCard(
        env.TEAMS_WEBHOOK_URL,
        `${emoji} FINALIZE ${status} - ATMÓSFERA CONTROLADA POMÁCEAS (API)`,
        "Normalización ejecutada: CKU_Submissions → loader SQL (SP) → 5 tablas + health.",
        {
          ...baseFacts,
          submission_id: String((result as any)?.submissionId ?? submissionId),
          "tiempo(ms)": String(Date.now() - t0),
          ...(Object.keys(counts).length
            ? {
                "tablas/grupos_presiones": String(counts.grupos_presiones ?? ""),
                "tablas/detalles_presiones": String(counts.detalles_presiones ?? ""),
                "tablas/conceptos_matriz": String(counts.conceptos_matriz ?? ""),
                "tablas/frutos_matriz": String(counts.frutos_matriz ?? ""),
                health_status: String(counts.health_status ?? ""),
              }
            : {}),
        }
      );

      return res.json({
        ok: true,
        submissionId: String((result as any)?.submissionId ?? submissionId),
        requestId,
        health_status: status,
        counts,
      });
    }
    // =========================================================
    // 2.Z) NO IMPLEMENTADO
    // =========================================================
    const msg =
      `Plantilla no implementada aún: templateId=${templateId}` +
      (tipoFruta ? `, tipo_fruta=${tipoFruta}` : "");

    await auditEvent({
      event_type: "FINALIZE_NOT_IMPLEMENTED",
      result: "WARN",
      submission_id: submissionId,
      template_id: templateId,
      template_title: templateTitle,
      user_name: String(userName ?? ""),
      user_id: String(userId ?? ""),
      user_email: String(userEmail ?? ""),
      details: {
        request_id: requestId,
        data_keys: Object.keys(data ?? {}),
        data_preview: safeJsonStringify(data, 20_000),
      },
    });

    await sendTeamsCard(
      env.TEAMS_WEBHOOK_URL,
      "⚠️ FINALIZE NO IMPLEMENTADO (API)",
      msg,
      {
        request_id: requestId,
        submission_id: submissionId,
        template_id: templateId,
        "tiempo(ms)": String(Date.now() - t0),
        "data.keys": safeKeys(data),
      }
    );

    return res.status(501).json({
      ok: false,
      error: msg,
      requestId,
    });
  } catch (e: any) {
    const info = extractErrorInfo(e);

    // Si fue API KEY
    if (info.message === "unauthorized") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    // Intento auditoría legacy (best effort)
    try {
      const payload = req.body as SubmissionPayload;
      if (payload?.id) await auditFail(payload, info.message);
    } catch { }

    // Auditoría estándar (best effort)
    try {
      const payload = req.body as any;
      await auditEvent({
        event_type: "FINALIZE_FAIL",
        result: "FAIL",
        submission_id: toNonEmptyStr(payload?.id) ?? undefined,
        template_id: String(payload?.templateId ?? ""),
        template_title: String(payload?.template?.title ?? ""),
        user_name: String(payload?.user?.name ?? payload?.submittedBy ?? ""),
        user_id: String(payload?.user?.id ?? ""),
        user_email: String(payload?.user?.email ?? ""),
        error_message: info.message,
        details: {
          request_id: requestId,
          code: info.code,
          name: info.name,
          stack: String(info.stack ?? "").slice(0, 50_000),
        },
      });
    } catch { }

    // Teams (best effort)
    try {
      await sendTeamsCard(
        env.TEAMS_WEBHOOK_URL,
        "❌ FINALIZE FAIL (API)",
        `${info.message}\n\nname: ${info.name}\ncode: ${info.code}\n\nstack(trunc):\n${String(
          info.stack ?? ""
        ).slice(0, 3000)}`,
        {
          request_id: requestId,
          "tiempo(ms)": String(Date.now() - t0),
        }
      );
    } catch { }

    return res.status(500).json({
      ok: false,
      error: info.message,
      requestId,
    });
  }
});
