/**
 * Atmósfera Controlada Pomáceas Service (REG.CKU.022)
 * Servicio para normalización y validación de datos
 */

import { getPool, sql } from "../db/pool";
import { auditEvent } from "./submissionsCore.service";

interface AtmControladaHealthStatus {
  status: "ok" | "pending" | "error";
  message: string;
  submissionId: string;
  details?: {
    mainRecord: boolean;
    gruposPresiones: number;
    detallesPresiones: number;
    conceptosMatriz: number;
    frutosMatriz: number;
    valoresMatriz: number;
  };
}

// Helper: Validar UUID
function toUuidOrThrow(id: string): string {
  const s = String(id ?? "").trim();
  const re = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  if (!re.test(s)) throw new Error(`submissionId inválido (no UUID): "${s}"`);
  return s;
}

// Helper: Auditoría best-effort
async function auditBestEffort(params: Parameters<typeof auditEvent>[0]) {
  try {
    if (!params.result) {
      (params as any).result = "OK";
    }
    await auditEvent(params);
  } catch (e) {
    console.warn("[AtmControlada] auditEvent falló (best effort):", (e as any)?.message ?? e);
  }
}

/**
 * Obtiene counts para el router (health_status + métricas clave)
 */
async function getAtmControladaCounts(submissionId: string): Promise<Record<string, any>> {
  const pool = await getPool();

  const r = await pool
    .request()
    .input("submission_id", sql.UniqueIdentifier, submissionId)
    .query(`
      SELECT
        main_rows = (SELECT COUNT(*) FROM dbo.ATM_CONTROLADA_POMACEAS WHERE submission_id = @submission_id),
        grupos_presiones = (SELECT COUNT(*) FROM dbo.ATM_CONTROLADA_PRESIONES_GRUPO WHERE submission_id = @submission_id),
        detalles_presiones = (
          SELECT COUNT(*)
          FROM dbo.ATM_CONTROLADA_PRESIONES_DETALLE d
          INNER JOIN dbo.ATM_CONTROLADA_PRESIONES_GRUPO g ON d.grupo_id = g.id
          WHERE g.submission_id = @submission_id
        ),
        conceptos_matriz = (SELECT COUNT(*) FROM dbo.ATM_CONTROLADA_MATRIZ_FRUTO_RAW WHERE submission_id = @submission_id),
        frutos_matriz = (SELECT COUNT(DISTINCT n_fruto) FROM dbo.ATM_CONTROLADA_MATRIZ_FRUTO WHERE submission_id = @submission_id),
        valores_matriz = (SELECT COUNT(*) FROM dbo.ATM_CONTROLADA_MATRIZ_FRUTO WHERE submission_id = @submission_id),
        processed_utc = (SELECT TOP 1 processed_utc FROM dbo.ATM_CONTROLADA_POMACEAS WHERE submission_id = @submission_id)
    `);

  const row = r.recordset?.[0] ?? {};
  const mainRows = Number(row.main_rows ?? 0);

  const health_status = mainRows > 0 ? "OK" : "FAIL";

  return {
    health_status,
    processed_utc: row.processed_utc ?? null,
    main_rows: mainRows,
    grupos_presiones: Number(row.grupos_presiones ?? 0),
    detalles_presiones: Number(row.detalles_presiones ?? 0),
    conceptos_matriz: Number(row.conceptos_matriz ?? 0),
    frutos_matriz: Number(row.frutos_matriz ?? 0),
    valores_matriz: Number(row.valores_matriz ?? 0),
  };
}

/**
 * Verifica el estado de salud de un submission
 */
export async function getAtmControladaHealth(submissionIdRaw: string): Promise<AtmControladaHealthStatus> {
  const submissionId = toUuidOrThrow(submissionIdRaw);
  const pool = await getPool();

  try {
    const mainResult = await pool
      .request()
      .input("submission_id", sql.UniqueIdentifier, submissionId)
      .query(`
        SELECT
          COUNT(*) AS count,
          (SELECT COUNT(*) FROM dbo.ATM_CONTROLADA_PRESIONES_GRUPO WHERE submission_id = @submission_id) AS grupos_presiones,
          (SELECT COUNT(*)
           FROM dbo.ATM_CONTROLADA_PRESIONES_DETALLE d
           INNER JOIN dbo.ATM_CONTROLADA_PRESIONES_GRUPO g ON d.grupo_id = g.id
           WHERE g.submission_id = @submission_id) AS detalles_presiones,
          (SELECT COUNT(*) FROM dbo.ATM_CONTROLADA_MATRIZ_FRUTO_RAW WHERE submission_id = @submission_id) AS conceptos_matriz,
          (SELECT COUNT(DISTINCT n_fruto) FROM dbo.ATM_CONTROLADA_MATRIZ_FRUTO WHERE submission_id = @submission_id) AS frutos_matriz,
          (SELECT COUNT(*) FROM dbo.ATM_CONTROLADA_MATRIZ_FRUTO WHERE submission_id = @submission_id) AS valores_matriz
        FROM dbo.ATM_CONTROLADA_POMACEAS
        WHERE submission_id = @submission_id
      `);

    const record = mainResult.recordset?.[0] ?? {};
    const exists = Number(record.count ?? 0) > 0;

    if (!exists) {
      return {
        status: "pending",
        message: "Datos no normalizados aún",
        submissionId,
      };
    }

    return {
      status: "ok",
      message: "Datos normalizados correctamente",
      submissionId,
      details: {
        mainRecord: true,
        gruposPresiones: Number(record.grupos_presiones ?? 0),
        detallesPresiones: Number(record.detalles_presiones ?? 0),
        conceptosMatriz: Number(record.conceptos_matriz ?? 0),
        frutosMatriz: Number(record.frutos_matriz ?? 0),
        valoresMatriz: Number(record.valores_matriz ?? 0),
      },
    };
  } catch (error) {
    console.error("Error checking AtmControlada health:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Error desconocido",
      submissionId,
    };
  }
}

/**
 * Normaliza los datos ejecutando el SP
 */
export async function normalizeAtmControladaData(
  submissionIdRaw: string
): Promise<{
  success: boolean;
  message: string;
  submissionId: string;
}> {
  const submissionId = toUuidOrThrow(submissionIdRaw);
  const pool = await getPool();

  try {
    console.log(`[AtmControlada] Iniciando normalización para submission: ${submissionId}`);

    await pool
      .request()
      .input("submission_id", sql.UniqueIdentifier, submissionId)
      .execute("dbo.usp_Load_ATM_CONTROLADA_POMACEAS");

    console.log(`[AtmControlada] Normalización exitosa para submission: ${submissionId}`);

    await auditBestEffort({
      event_type: "atm_controlada_normalized",
      result: "OK",
      submission_id: submissionId,
      template_id: "REG.CKU.022",
      details: { template_id: "REG.CKU.022" },
    });

    return {
      success: true,
      message: "Datos de Atmósfera Controlada normalizados exitosamente",
      submissionId,
    };
  } catch (error) {
    console.error("[AtmControlada] Error en normalización:", error);

    await auditBestEffort({
      event_type: "atm_controlada_normalization_error",
      result: "FAIL",
      submission_id: submissionId,
      template_id: "REG.CKU.022",
      error_message: error instanceof Error ? error.message : "Error desconocido",
      details: {
        template_id: "REG.CKU.022",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
    });

    throw error;
  }
}

/**
 * Finaliza un submission (función principal para el router)
 */
export async function finalizeAtmControlada(
  submissionIdRaw: string
): Promise<{
  submissionId: string;
  counts: Record<string, any>;
}> {
  const submissionId = toUuidOrThrow(submissionIdRaw);

  // 1) Normalizar
  await normalizeAtmControladaData(submissionId);

  // 2) Health
  const health = await getAtmControladaHealth(submissionId);

  // 3) Counts para el router
  const counts = await getAtmControladaCounts(submissionId);

  if (health.status !== "ok") {
    counts.health_status = "FAIL";
    counts.health_message = health.message;
  }

  // Auditar finalize
  await auditBestEffort({
    event_type: "atm_controlada_finalize",
    result: counts.health_status === "OK" ? "OK" : "FAIL",
    submission_id: submissionId,
    template_id: "REG.CKU.022",
    details: { counts, health },
  });

  return { submissionId, counts };
}

/**
 * Obtiene estadísticas de completitud
 */
export async function getAtmControladaCompletitudStats(submissionIdRaw: string): Promise<{
  presiones: { completitud: number; gruposTotal: number };
  matriz: { conceptos: number; frutosActivos: number; completitudPromedio: number };
}> {
  const submissionId = toUuidOrThrow(submissionIdRaw);
  const pool = await getPool();

  try {
    const presionesResult = await pool
      .request()
      .input("submission_id", sql.UniqueIdentifier, submissionId)
      .query(`
        SELECT
          COUNT(*) AS grupos_total,
          AVG(CASE
            WHEN n_frutos > 0 THEN
              CAST((SELECT COUNT(*) FROM dbo.ATM_CONTROLADA_PRESIONES_DETALLE WHERE grupo_id = g.id) AS DECIMAL(10,2))
              / CAST(n_frutos AS DECIMAL(10,2)) * 100
            ELSE 0
          END) AS completitud_promedio
        FROM dbo.ATM_CONTROLADA_PRESIONES_GRUPO g
        WHERE submission_id = @submission_id
      `);

    const matrizResult = await pool
      .request()
      .input("submission_id", sql.UniqueIdentifier, submissionId)
      .query(`
        SELECT
          COUNT(DISTINCT concepto) AS conceptos,
          COUNT(DISTINCT n_fruto) AS frutos_activos,
          AVG(CASE WHEN valor IS NOT NULL THEN 100.0 ELSE 0.0 END) AS completitud_promedio
        FROM dbo.ATM_CONTROLADA_MATRIZ_FRUTO
        WHERE submission_id = @submission_id
      `);

    return {
      presiones: {
        completitud: Number(presionesResult.recordset?.[0]?.completitud_promedio ?? 0),
        gruposTotal: Number(presionesResult.recordset?.[0]?.grupos_total ?? 0),
      },
      matriz: {
        conceptos: Number(matrizResult.recordset?.[0]?.conceptos ?? 0),
        frutosActivos: Number(matrizResult.recordset?.[0]?.frutos_activos ?? 0),
        completitudPromedio: Number(matrizResult.recordset?.[0]?.completitud_promedio ?? 0),
      },
    };
  } catch (error) {
    console.error("Error obteniendo estadísticas de completitud:", error);
    throw error;
  }
}