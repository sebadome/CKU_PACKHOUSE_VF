/**
 * Service: finalizeProyEmbalajePomaceas
 * Plantilla: REG.CKU.015 - PROYECCIÓN DE EMBALAJE POMÁCEAS – RECEPCIÓN
 * 
 * Responsabilidades:
 * 1. Ejecutar SP: dbo.usp_Load_PROY_EMB_POMACEAS_RECEPCION
 * 2. Leer health/completitud desde vistas
 * 3. Auditar FINALIZE_START / FINALIZE_DONE / FINALIZE_FAIL
 */

import { getPool, sql } from "../db/pool";
import { auditEvent } from "./submissionsCore.service";

interface ProyEmbalajePomaceasPayload {
  id: string;
  templateId: string;
  status: string;
  data: Record<string, any>;
  template?: { title?: string; version?: string };
  user?: { id?: string; name?: string; email?: string };
  planta?: string;
  temporada?: string;
  createdAt?: string;
  updatedAt?: string;
  submittedBy?: string;
}

interface ProyEmbalajePomaceasResult {
  submissionId: string;
  counts: {
    main_rows?: number;
    tabla_calibre_rows?: number;
    tabla_color_fondo_rows?: number;
    tabla_color_cubrimiento_rows?: number;
    danos_defectos_rows?: number;
    plagas_enfermedades_rows?: number;
    proyeccion_embalaje_rows?: number;
    proyeccion_embalaje_det_rows?: number;
    condicion_camion_rows?: number;
    resumen_exportable_rows?: number;
    health_status?: string;
    processed_utc?: string;
    
    // KPI Completitud
    proy_rows?: number;
    expected_cells_total?: number;
    completed_cells_total?: number;
    missing_cells_total?: number;
    completion_ratio?: number;
  };
}

/**
 * Finaliza un submission de REG.CKU.015:
 * - Ejecuta usp_Load_PROY_EMB_POMACEAS_RECEPCION
 * - Lee health y conteos desde vistas
 * - Audita el proceso
 */
export async function finalizeProyEmbalajePomaceas(
  payload: ProyEmbalajePomaceasPayload
): Promise<ProyEmbalajePomaceasResult> {
  const submissionId = payload.id;
  const templateId = payload.templateId || "REG.CKU.015";
  const userName = payload.user?.name || payload.submittedBy || "unknown";
  const userEmail = payload.user?.email || "";

  let counts: ProyEmbalajePomaceasResult["counts"] = {};

  try {
    // =====================================================
    // 1) AUDITAR: FINALIZE_START
    // =====================================================
    await auditEvent({
      event_type: "FINALIZE_START",
      template_id: templateId,
      submission_id: submissionId,
      user_name: userName,
      user_email: userEmail,
      result: "OK",
      details: {
        step: "Iniciando normalización REG.CKU.015",
      },
    });

    // =====================================================
    // 2) EJECUTAR SP: usp_Load_PROY_EMB_POMACEAS_RECEPCION
    // =====================================================
    const pool = await getPool();
    await pool
      .request()
      .input("submission_id", sql.UniqueIdentifier, submissionId)
      .execute("dbo.usp_Load_PROY_EMB_POMACEAS_RECEPCION");

    // =====================================================
    // 3) LEER CONTEOS DE TABLAS HIJAS
    // =====================================================
    const countQuery = `
      SELECT 
        (SELECT COUNT(*) FROM dbo.PROY_EMB_POMACEAS_RECEPCION WHERE submission_id = @sid) AS main_rows,
        (SELECT COUNT(*) FROM dbo.PROY_EMB_POMACEAS_RECEPCION_TABLA_CALIBRE WHERE submission_id = @sid) AS tabla_calibre_rows,
        (SELECT COUNT(*) FROM dbo.PROY_EMB_POMACEAS_RECEPCION_TABLA_COLOR_FONDO WHERE submission_id = @sid) AS tabla_color_fondo_rows,
        (SELECT COUNT(*) FROM dbo.PROY_EMB_POMACEAS_RECEPCION_TABLA_COLOR_CUBRIMIENTO WHERE submission_id = @sid) AS tabla_color_cubrimiento_rows,
        (SELECT COUNT(*) FROM dbo.PROY_EMB_POMACEAS_RECEPCION_DANOS_DEFECTOS WHERE submission_id = @sid) AS danos_defectos_rows,
        (SELECT COUNT(*) FROM dbo.PROY_EMB_POMACEAS_RECEPCION_PLAGAS_ENFERMEDADES WHERE submission_id = @sid) AS plagas_enfermedades_rows,
        (SELECT COUNT(*) FROM dbo.PROY_EMB_POMACEAS_RECEPCION_PROYECCION_EMBALAJE WHERE submission_id = @sid) AS proyeccion_embalaje_rows,
        (SELECT COUNT(*) FROM dbo.PROY_EMB_POMACEAS_RECEPCION_CONDICION_CAMION WHERE submission_id = @sid) AS condicion_camion_rows,
        (SELECT COUNT(*) FROM dbo.PROY_EMB_POMACEAS_RECEPCION_RESUMEN_EXPORTABLE WHERE submission_id = @sid) AS resumen_exportable_rows,
        SYSUTCDATETIME() AS processed_utc;
    `;

    const countResult = await pool
      .request()
      .input("sid", sql.UniqueIdentifier, submissionId)
      .query(countQuery);

    const row = countResult.recordset[0] || {};
    counts = {
      main_rows: row.main_rows || 0,
      tabla_calibre_rows: row.tabla_calibre_rows || 0,
      tabla_color_fondo_rows: row.tabla_color_fondo_rows || 0,
      tabla_color_cubrimiento_rows: row.tabla_color_cubrimiento_rows || 0,
      danos_defectos_rows: row.danos_defectos_rows || 0,
      plagas_enfermedades_rows: row.plagas_enfermedades_rows || 0,
      proyeccion_embalaje_rows: row.proyeccion_embalaje_rows || 0,
      condicion_camion_rows: row.condicion_camion_rows || 0,
      resumen_exportable_rows: row.resumen_exportable_rows || 0,
      processed_utc: row.processed_utc?.toISOString() || "",
    };

    // =====================================================
    // 4) DETERMINAR HEALTH STATUS
    // =====================================================
    // Esta plantilla NO tiene presiones, solo categorías + n_frutos + %
    // Por lo tanto, health OK si MAIN existe
    let healthStatus = "OK";
    
    if (counts.main_rows === 0) {
      healthStatus = "FAIL";
    }

    counts.health_status = healthStatus;

    // =====================================================
    // 6) AUDITAR: FINALIZE_DONE
    // =====================================================
    await auditEvent({
      event_type: "FINALIZE_DONE",
      template_id: templateId,
      submission_id: submissionId,
      user_name: userName,
      user_email: userEmail,
      result: healthStatus,
      details: { counts },
    });

    return {
      submissionId,
      counts,
    };
  } catch (error: any) {
    // =====================================================
    // 7) AUDITAR: FINALIZE_FAIL
    // =====================================================
    const errMsg = error?.message || String(error);
    const stack = error?.stack ? String(error.stack).substring(0, 500) : "";

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