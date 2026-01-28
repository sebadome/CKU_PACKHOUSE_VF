/**
 * Service: finalizeEmpaque
 * Plantilla: REG.CKU.017 - C.K.U Empaque
 * Responsabilidades:
 * 1) Ejecutar SP dbo.usp_Load_CKU_EMPAQUE
 * 2) Leer health/completitud desde vistas
 * 3) Auditar FINALIZE_START / FINALIZE_DONE / FINALIZE_FAIL (via submissionsCore.service)
 */

import { getPool, sql } from "../db/pool";
import { auditEvent } from "./submissionsCore.service";

interface EmpaquePayload {
  id: string;
  templateId: string;
  status: string;
  data: Record<string, any>;
  template?: { title?: string; version?: string };
  user?: { id?: string; name?: string; email?: string };
  submittedBy?: string;
}

export async function finalizeEmpaque(payload: EmpaquePayload) {
  const submissionId = payload.id;
  const templateId = payload.templateId || "REG.CKU.017";
  const userName = payload.user?.name || payload.submittedBy || "unknown";
  const userEmail = payload.user?.email || "";

  let counts: Record<string, any> = {};

  try {
    await auditEvent({
      event_type: "FINALIZE_START",
      template_id: templateId,
      submission_id: submissionId,
      user_name: userName,
      user_email: userEmail,
      result: "OK",
      details: { step: "Iniciando normalización REG.CKU.017 (Empaque)" },
    });

    const pool = await getPool();
    await pool
      .request()
      .input("submission_id", sql.UniqueIdentifier, submissionId)
      .execute("dbo.usp_Load_CKU_EMPAQUE");

    // Conteos + health desde vista
    const q = `
      SELECT
        (SELECT COUNT(*) FROM dbo.CKU_EMPAQUE WHERE submission_id=@sid) AS main_rows,
        (SELECT COUNT(*) FROM dbo.CKU_EMPAQUE_PRESIONES_GRUPO WHERE submission_id=@sid) AS pres_grupo_rows,
        (SELECT COUNT(*) FROM dbo.CKU_EMPAQUE_PRESIONES_DETALLE WHERE submission_id=@sid) AS pres_det_rows,
        (SELECT COUNT(*) FROM dbo.CKU_EMPAQUE_LINEA_DATOS WHERE submission_id=@sid) AS linea_datos_cells,
        (SELECT COUNT(*) FROM dbo.CKU_EMPAQUE_DANOS_DEFECTOS_LINEA WHERE submission_id=@sid) AS danos_defectos_cells,
        (SELECT COUNT(*) FROM dbo.CKU_EMPAQUE_MERCADO_INTERNO WHERE submission_id=@sid) AS mercado_interno_cells,
        (SELECT COUNT(*) FROM dbo.CKU_EMPAQUE_CONTROL_PESO WHERE submission_id=@sid) AS control_peso_rows;

      SELECT TOP 1
        health_status, pres_expected_cells, pres_completed_cells, pres_missing_cells, pres_is_inconsistent, processed_utc
      FROM dbo.vw_CKU_EMPAQUE_SubmissionHealth
      WHERE submission_id=@sid;
    `;

    const rs = await pool.request().input("sid", sql.UniqueIdentifier, submissionId).query(q);

    const c0 = rs.recordsets?.[0]?.[0] ?? {};
    const h0 = rs.recordsets?.[1]?.[0] ?? {};

    counts = {
      ...c0,
      ...h0,
    };

    const healthStatus = String(counts.health_status || "OK");

    await auditEvent({
      event_type: "FINALIZE_DONE",
      template_id: templateId,
      submission_id: submissionId,
      user_name: userName,
      user_email: userEmail,
      result: (healthStatus === "FAIL" ? "FAIL" : healthStatus === "WARN" ? "WARN" : "OK") as any,
      details: { counts },
    });

    return { submissionId, counts };
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    const stack = error?.stack ? String(error.stack).slice(0, 2000) : "";

    await auditEvent({
      event_type: "FINALIZE_FAIL",
      template_id: templateId,
      submission_id: submissionId,
      user_name: userName,
      user_email: userEmail,
      result: "FAIL",
      error_message: errMsg,
      details: { stack, counts },
    });

    throw error;
  }
}
