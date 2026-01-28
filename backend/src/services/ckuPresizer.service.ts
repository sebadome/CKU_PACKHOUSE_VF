/**
 * CKU Presizer Service (REG.CKU.018)
 * Servicio para normalización y validación de datos de Presizer
 *
 * ✅ Fix principal:
 * - CKU_APP_AUDIT_LOG.result NO permite NULL → auditEvent SIEMPRE debe recibir result.
 * - auditEvent es "best effort": si falla el audit, NO debe botar la normalización.
 *
 * ✅ Compatibilidad con tu router:
 * - Tu router /finalize espera que finalizePresizer(submissionId) devuelva algo con `.counts`
 *   (y que counts tenga health_status, tarjas_entrada, camaras, canales_activos, etc).
 * - Este servicio devuelve: { submissionId, counts }
 *   y además mantiene getPresizerHealth y getPresizerCompletitudStats sin recortar.
 */

import { getPool, sql } from "../db/pool";
import { auditEvent } from "./submissionsCore.service";

interface PresizerHealthStatus {
  status: "ok" | "pending" | "error";
  message: string;
  submissionId: string;
  details?: {
    mainRecord: boolean;
    tarjasEntrada: number;
    camaras: number;
    gruposPresiones: number;
    detallesPresiones: number;
    gruposPesos: number;
    detallesPesos: number;
    canalesActivos: number;
    frutosMercadoInterno: number;
  };
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
function toUuidOrThrow(id: string): string {
  const s = String(id ?? "").trim();
  const re =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  if (!re.test(s)) throw new Error(`submissionId inválido (no UUID): "${s}"`);
  return s;
}

async function auditBestEffort(params: Parameters<typeof auditEvent>[0]) {
  try {
    // Importante: result es obligatorio (tabla no permite NULL)
    if (!params.result) {
      (params as any).result = "OK";
    }
    await auditEvent(params);
  } catch (e) {
    // NO romper el flujo por auditoría
    // (esto es EXACTAMENTE lo que te estaba botando las pruebas)
    // eslint-disable-next-line no-console
    console.warn("[Presizer] auditEvent falló (best effort):", (e as any)?.message ?? e);
  }
}

/**
 * Obtiene counts estilo router (health_status + métricas clave).
 * Tu /finalize usa counts.health_status + counts.tarjas_entrada, etc.
 */
async function getPresizerCounts(submissionId: string): Promise<Record<string, any>> {
  const pool = await getPool();

  // Cuenta main + hijas relevantes en una sola ida
  const r = await pool
    .request()
    .input("submission_id", sql.UniqueIdentifier, submissionId)
    .query(`
      SELECT
        main_rows = (SELECT COUNT(*) FROM dbo.CKU_PRESIZER WHERE submission_id = @submission_id),
        tarjas_entrada = (SELECT COUNT(*) FROM dbo.CKU_PRESIZER_TARJAS_ENTRADA WHERE submission_id = @submission_id),
        camaras = (SELECT COUNT(*) FROM dbo.CKU_PRESIZER_CAMARAS WHERE submission_id = @submission_id),
        pres_grupos = (SELECT COUNT(*) FROM dbo.CKU_PRESIZER_PRESIONES_GRUPO WHERE submission_id = @submission_id),
        pres_detalles = (
          SELECT COUNT(*)
          FROM dbo.CKU_PRESIZER_PRESIONES_DETALLE pd
          INNER JOIN dbo.CKU_PRESIZER_PRESIONES_GRUPO pg ON pd.grupo_id = pg.id
          WHERE pg.submission_id = @submission_id
        ),
        pesos_grupos = (SELECT COUNT(*) FROM dbo.CKU_PRESIZER_PESOS_GRUPO WHERE submission_id = @submission_id),
        pesos_detalles = (
          SELECT COUNT(*)
          FROM dbo.CKU_PRESIZER_PESOS_DETALLE pd
          INNER JOIN dbo.CKU_PRESIZER_PESOS_GRUPO pg ON pd.grupo_id = pg.id
          WHERE pg.submission_id = @submission_id
        ),
        canales_activos = (SELECT COUNT(DISTINCT canal_num) FROM dbo.CKU_PRESIZER_DATOS_CANAL WHERE submission_id = @submission_id),
        frutos_mercado_interno = (SELECT COUNT(DISTINCT n_fruto) FROM dbo.CKU_PRESIZER_MERCADO_INTERNO WHERE submission_id = @submission_id),
        processed_utc = (SELECT TOP 1 processed_utc FROM dbo.CKU_PRESIZER WHERE submission_id = @submission_id)
    `);

  const row = r.recordset?.[0] ?? {};
  const mainRows = Number(row.main_rows ?? 0);

  // health simple para el router
  // (si tú tienes una vista health específica, se puede reemplazar por esa)
  const health_status = mainRows > 0 ? "OK" : "FAIL";

  return {
    health_status,
    processed_utc: row.processed_utc ?? null,

    main_rows: mainRows,
    tarjas_entrada: Number(row.tarjas_entrada ?? 0),
    camaras: Number(row.camaras ?? 0),

    pres_grupos: Number(row.pres_grupos ?? 0),
    pres_detalles: Number(row.pres_detalles ?? 0),

    pesos_grupos: Number(row.pesos_grupos ?? 0),
    pesos_detalles: Number(row.pesos_detalles ?? 0),

    canales_activos: Number(row.canales_activos ?? 0),
    frutos_mercado_interno: Number(row.frutos_mercado_interno ?? 0),
  };
}

/**
 * Verifica el estado de salud de un submission de Presizer
 * @param submissionId - UUID del submission
 * @returns Estado de salud con detalles
 */
export async function getPresizerHealth(submissionIdRaw: string): Promise<PresizerHealthStatus> {
  const submissionId = toUuidOrThrow(submissionIdRaw);
  const pool = await getPool();

  try {
    const mainResult = await pool
      .request()
      .input("submission_id", sql.UniqueIdentifier, submissionId)
      .query(`
        SELECT
          COUNT(*) AS count,
          (SELECT COUNT(*) FROM dbo.CKU_PRESIZER_TARJAS_ENTRADA WHERE submission_id = @submission_id) AS tarjas,
          (SELECT COUNT(*) FROM dbo.CKU_PRESIZER_CAMARAS WHERE submission_id = @submission_id) AS camaras,
          (SELECT COUNT(*) FROM dbo.CKU_PRESIZER_PRESIONES_GRUPO WHERE submission_id = @submission_id) AS grupos_presiones,
          (SELECT COUNT(*)
           FROM dbo.CKU_PRESIZER_PRESIONES_DETALLE pd
           INNER JOIN dbo.CKU_PRESIZER_PRESIONES_GRUPO pg ON pd.grupo_id = pg.id
           WHERE pg.submission_id = @submission_id) AS detalles_presiones,
          (SELECT COUNT(*) FROM dbo.CKU_PRESIZER_PESOS_GRUPO WHERE submission_id = @submission_id) AS grupos_pesos,
          (SELECT COUNT(*)
           FROM dbo.CKU_PRESIZER_PESOS_DETALLE pd
           INNER JOIN dbo.CKU_PRESIZER_PESOS_GRUPO pg ON pd.grupo_id = pg.id
           WHERE pg.submission_id = @submission_id) AS detalles_pesos,
          (SELECT COUNT(DISTINCT canal_num) FROM dbo.CKU_PRESIZER_DATOS_CANAL WHERE submission_id = @submission_id) AS canales_activos,
          (SELECT COUNT(DISTINCT n_fruto) FROM dbo.CKU_PRESIZER_MERCADO_INTERNO WHERE submission_id = @submission_id) AS frutos_mercado_interno
        FROM dbo.CKU_PRESIZER
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
        tarjasEntrada: Number(record.tarjas ?? 0),
        camaras: Number(record.camaras ?? 0),
        gruposPresiones: Number(record.grupos_presiones ?? 0),
        detallesPresiones: Number(record.detalles_presiones ?? 0),
        gruposPesos: Number(record.grupos_pesos ?? 0),
        detallesPesos: Number(record.detalles_pesos ?? 0),
        canalesActivos: Number(record.canales_activos ?? 0),
        frutosMercadoInterno: Number(record.frutos_mercado_interno ?? 0),
      },
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error checking Presizer health:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Error desconocido",
      submissionId,
    };
  }
}

/**
 * Normaliza los datos de un submission de Presizer
 * Ejecuta el SP usp_Load_CKU_PRESIZER
 * @param submissionId - UUID del submission
 * @returns Resultado de la normalización
 */
export async function normalizePresizerData(
  submissionIdRaw: string
): Promise<{
  success: boolean;
  message: string;
  submissionId: string;
}> {
  const submissionId = toUuidOrThrow(submissionIdRaw);
  const pool = await getPool();

  try {
    // eslint-disable-next-line no-console
    console.log(`[Presizer] Iniciando normalización para submission: ${submissionId}`);

    await pool
      .request()
      .input("submission_id", sql.UniqueIdentifier, submissionId)
      .execute("dbo.usp_Load_CKU_PRESIZER");

    // eslint-disable-next-line no-console
    console.log(`[Presizer] Normalización exitosa para submission: ${submissionId}`);

    // ✅ FIX: result obligatorio + best effort (no botar el flujo)
    await auditBestEffort({
      event_type: "presizer_normalized",
      result: "OK",
      submission_id: submissionId,
      template_id: "REG.CKU.018",
      details: { template_id: "REG.CKU.018" },
    });

    return {
      success: true,
      message: "Datos de Presizer normalizados exitosamente",
      submissionId,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Presizer] Error en normalización:", error);

    await auditBestEffort({
      event_type: "presizer_normalization_error",
      result: "FAIL",
      submission_id: submissionId,
      template_id: "REG.CKU.018",
      error_message: error instanceof Error ? error.message : "Error desconocido",
      details: {
        template_id: "REG.CKU.018",
        error: error instanceof Error ? error.message : "Error desconocido",
      },
    });

    throw error;
  }
}

/**
 * Finaliza un submission de Presizer
 * Wrapper que ejecuta la normalización y verifica el estado
 *
 * ✅ Importante: Esta firma devuelve `.counts` para calzar con tu router.
 * Tu router hace:
 *   const result = await finalizePresizer(submissionId)
 *   const counts = result.counts
 *   counts.health_status, counts.tarjas_entrada, ...
 */
export async function finalizePresizer(
  submissionIdRaw: string
): Promise<{
  submissionId: string;
  counts: Record<string, any>;
}> {
  const submissionId = toUuidOrThrow(submissionIdRaw);

  // 1) Normalizar
  await normalizePresizerData(submissionId);

  // 2) Health (tu health detallado)
  const health = await getPresizerHealth(submissionId);

  // 3) Counts para el router / teams card
  const counts = await getPresizerCounts(submissionId);

  // Si health no está ok, reflejar en counts (sin romper; tu router ya maneja WARN/FAIL)
  if (health.status !== "ok") {
    counts.health_status = "FAIL";
    counts.health_message = health.message;
  }

  // Auditar finalize (best effort)
  await auditBestEffort({
    event_type: "presizer_finalize",
    result: counts.health_status === "OK" ? "OK" : "FAIL",
    submission_id: submissionId,
    template_id: "REG.CKU.018",
    details: { counts, health },
  });

  return { submissionId, counts };
}

/**
 * Obtiene estadísticas de completitud para un submission
 * @param submissionId - UUID del submission
 * @returns Estadísticas de completitud
 */
export async function getPresizerCompletitudStats(submissionIdRaw: string): Promise<{
  presiones: { completitud: number; gruposTotal: number };
  pesos: { completitud: number; gruposTotal: number };
  canales: { activos: number; completitudPromedio: number };
  mercadoInterno: { frutosActivos: number; completitudPromedio: number };
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
              CAST((SELECT COUNT(*) FROM dbo.CKU_PRESIZER_PRESIONES_DETALLE WHERE grupo_id = pg.id) AS DECIMAL(10,2))
              / CAST(n_frutos AS DECIMAL(10,2)) * 100
            ELSE 0
          END) AS completitud_promedio
        FROM dbo.CKU_PRESIZER_PRESIONES_GRUPO pg
        WHERE submission_id = @submission_id
      `);

    const pesosResult = await pool
      .request()
      .input("submission_id", sql.UniqueIdentifier, submissionId)
      .query(`
        SELECT
          COUNT(*) AS grupos_total,
          AVG(CASE
            WHEN n_frutos > 0 THEN
              CAST((SELECT COUNT(*) FROM dbo.CKU_PRESIZER_PESOS_DETALLE WHERE grupo_id = pg.id) AS DECIMAL(10,2))
              / CAST(n_frutos AS DECIMAL(10,2)) * 100
            ELSE 0
          END) AS completitud_promedio
        FROM dbo.CKU_PRESIZER_PESOS_GRUPO pg
        WHERE submission_id = @submission_id
      `);

    const canalesResult = await pool
      .request()
      .input("submission_id", sql.UniqueIdentifier, submissionId)
      .query(`
        SELECT
          COUNT(DISTINCT canal_num) AS canales_activos,
          AVG(CAST((
            CASE WHEN canal_salida IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN calibre IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN categoria IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN peso IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN n_frutos IS NOT NULL THEN 1 ELSE 0 END
          ) AS DECIMAL(10,2)) / 5.0 * 100) AS completitud_promedio
        FROM dbo.CKU_PRESIZER_DATOS_CANAL
        WHERE submission_id = @submission_id
      `);

    const mercadoResult = await pool
      .request()
      .input("submission_id", sql.UniqueIdentifier, submissionId)
      .query(`
        SELECT
          COUNT(DISTINCT n_fruto) AS frutos_activos,
          AVG(CASE WHEN valor IS NOT NULL THEN 100.0 ELSE 0.0 END) AS completitud_promedio
        FROM dbo.CKU_PRESIZER_MERCADO_INTERNO
        WHERE submission_id = @submission_id
      `);

    return {
      presiones: {
        completitud: Number(presionesResult.recordset?.[0]?.completitud_promedio ?? 0),
        gruposTotal: Number(presionesResult.recordset?.[0]?.grupos_total ?? 0),
      },
      pesos: {
        completitud: Number(pesosResult.recordset?.[0]?.completitud_promedio ?? 0),
        gruposTotal: Number(pesosResult.recordset?.[0]?.grupos_total ?? 0),
      },
      canales: {
        activos: Number(canalesResult.recordset?.[0]?.canales_activos ?? 0),
        completitudPromedio: Number(canalesResult.recordset?.[0]?.completitud_promedio ?? 0),
      },
      mercadoInterno: {
        frutosActivos: Number(mercadoResult.recordset?.[0]?.frutos_activos ?? 0),
        completitudPromedio: Number(mercadoResult.recordset?.[0]?.completitud_promedio ?? 0),
      },
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error obteniendo estadísticas de completitud:", error);
    throw error;
  }
}
