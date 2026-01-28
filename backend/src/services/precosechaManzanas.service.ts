// backend/src/services/precosechaManzanas.service.ts
import { getPool, sql } from "../db/pool";

// =======================
// TYPES
// =======================
export type SubmissionPayload = {
  id: string;
  templateId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  submittedBy: string;
  data: Record<string, any>;
  user?: { id?: string; name?: string; email?: string };
  template?: { title?: string; version?: string };
};

// =======================
// TABLE NAMES (anti-typos)
// =======================
const T = {
  CKU_SUBMISSIONS: "dbo.CKU_Submissions",
  AUDIT: "dbo.CKU_APP_AUDIT_LOG",
  PRE: "dbo.PRE_COSECHA_MANZANAS",
  PRES_G: "dbo.PRE_COSECHA_MANZANAS_PRESIONES_GRUPO",
  PRES_D: "dbo.PRE_COSECHA_MANZANAS_PRESIONES_DETALLE",
  ALMIDON: "dbo.PRE_COSECHA_MANZANAS_ALMIDON_FILA",
  SEM_F: "dbo.PRE_COSECHA_MANZANAS_SEMILLA_FILA",
  SEM_S: "dbo.PRE_COSECHA_MANZANAS_SEMILLA_SUM",
} as const;

// =======================
// SQL (MERGE / AUDIT)
// =======================
const MERGE_CKU_SUBMISSIONS = `
MERGE ${T.CKU_SUBMISSIONS} AS target
USING (SELECT CAST(@submission_id AS UNIQUEIDENTIFIER) AS submission_id) AS src
ON target.submission_id = src.submission_id
WHEN MATCHED THEN
  UPDATE SET
    template_id = @template_id,
    template_title = @template_title,
    template_version = @template_version,
    status = @status,
    created_at = @created_at,
    updated_at = @updated_at,
    user_name = @user_name,
    user_id = @user_id,
    user_email = @user_email,
    tipo_fruta = @tipo_fruta,
    planta = @planta,
    temporada = @temporada,
    data_json = @data_json,
    dynamic_schemas_json = @dynamic_schemas_json,
    raw_submission_json = @raw_submission_json
WHEN NOT MATCHED THEN
  INSERT (
    submission_id, template_id, template_title, template_version,
    status, created_at, updated_at,
    user_name, user_id, user_email,
    tipo_fruta, planta, temporada,
    data_json, dynamic_schemas_json, raw_submission_json
  )
  VALUES (
    CAST(@submission_id AS UNIQUEIDENTIFIER), @template_id, @template_title, @template_version,
    @status, @created_at, @updated_at,
    @user_name, @user_id, @user_email,
    @tipo_fruta, @planta, @temporada,
    @data_json, @dynamic_schemas_json, @raw_submission_json
  );
`;

const MERGE_PRE_COSECHA_MANZANAS = `
MERGE ${T.PRE} AS target
USING (SELECT CAST(@submission_id AS UNIQUEIDENTIFIER) AS submission_id) AS src
ON target.submission_id = src.submission_id
WHEN MATCHED THEN
  UPDATE SET
    template_id = @template_id,
    template_version = @template_version,
    status = @status,
    created_at = @created_at,
    updated_at = @updated_at,

    submitted_by_name = @submitted_by_name,
    submitted_by_user_id = @submitted_by_user_id,
    submitted_by_email = @submitted_by_email,

    planta = @planta,
    temporada = @temporada,
    tipo_fruta = @tipo_fruta,

    productor = @productor,
    variedad = @variedad,
    variedad_rotulada_grupo = @variedad_rotulada_grupo,
    huerto_cuartel = @huerto_cuartel,
    agronomo = @agronomo,
    fecha_muestra = @fecha_muestra,
    fecha_analisis = @fecha_analisis,

    n_frutos_muestra = @n_frutos_muestra,
    promedio_diametro_mm = @promedio_diametro_mm,
    promedio_peso_g = @promedio_peso_g,
    promedio_color_cubrimiento_pct = @promedio_color_cubrimiento_pct,

    matriz_frutos_externo_json = @matriz_frutos_externo_json,
    matriz_color_cubrimiento_json = @matriz_color_cubrimiento_json,
    matriz_categorias_calibre_json = @matriz_categorias_calibre_json,

    color_pulpa = @color_pulpa,
    presion_promedio = @presion_promedio,
    presion_max = @presion_max,
    presion_min = @presion_min,
    sol_promedio = @sol_promedio,
    matriz_presiones_json = @matriz_presiones_json,

    almidon_promedio = @almidon_promedio,
    almidon_max = @almidon_max,
    almidon_min = @almidon_min,
    matriz_almidon_sol_json = @matriz_almidon_sol_json,
    matriz_color_semilla_json = @matriz_color_semilla_json,
    suma_color_semilla_json = @suma_color_semilla_json,

    ph = @ph,
    acidez = @acidez,
    gasto_ml = @gasto_ml,
    ac_malico_pct = @ac_malico_pct,
    matriz_cor_acuoso_json = @matriz_cor_acuoso_json,
    matriz_cor_mohoso_json = @matriz_cor_mohoso_json,

    observaciones = @observaciones,
    tecnico = @tecnico,
    ayudante = @ayudante
WHEN NOT MATCHED THEN
  INSERT (
    submission_id, template_id, template_version, status, created_at, updated_at,
    submitted_by_name, submitted_by_user_id, submitted_by_email,
    planta, temporada, tipo_fruta,
    productor, variedad, variedad_rotulada_grupo, huerto_cuartel, agronomo, fecha_muestra, fecha_analisis,
    n_frutos_muestra, promedio_diametro_mm, promedio_peso_g, promedio_color_cubrimiento_pct,
    matriz_frutos_externo_json, matriz_color_cubrimiento_json, matriz_categorias_calibre_json,
    color_pulpa, presion_promedio, presion_max, presion_min, sol_promedio, matriz_presiones_json,
    almidon_promedio, almidon_max, almidon_min, matriz_almidon_sol_json, matriz_color_semilla_json, suma_color_semilla_json,
    ph, acidez, gasto_ml, ac_malico_pct, matriz_cor_acuoso_json, matriz_cor_mohoso_json,
    observaciones, tecnico, ayudante
  )
  VALUES (
    CAST(@submission_id AS UNIQUEIDENTIFIER), @template_id, @template_version, @status, @created_at, @updated_at,
    @submitted_by_name, @submitted_by_user_id, @submitted_by_email,
    @planta, @temporada, @tipo_fruta,
    @productor, @variedad, @variedad_rotulada_grupo, @huerto_cuartel, @agronomo, @fecha_muestra, @fecha_analisis,
    @n_frutos_muestra, @promedio_diametro_mm, @promedio_peso_g, @promedio_color_cubrimiento_pct,
    @matriz_frutos_externo_json, @matriz_color_cubrimiento_json, @matriz_categorias_calibre_json,
    @color_pulpa, @presion_promedio, @presion_max, @presion_min, @sol_promedio, @matriz_presiones_json,
    @almidon_promedio, @almidon_max, @almidon_min, @matriz_almidon_sol_json, @matriz_color_semilla_json, @suma_color_semilla_json,
    @ph, @acidez, @gasto_ml, @ac_malico_pct, @matriz_cor_acuoso_json, @matriz_cor_mohoso_json,
    @observaciones, @tecnico, @ayudante
  );
`;

const INSERT_AUDIT = `
INSERT INTO ${T.AUDIT} (
  event_type, result, submission_id, template_id, template_title,
  user_name, user_id, user_email,
  error_message, details_json
) VALUES (
  @event_type, @result, CAST(@submission_id AS UNIQUEIDENTIFIER), @template_id, @template_title,
  @user_name, @user_id, @user_email,
  @error_message, @details_json
);
`;

// =======================
// HELPERS
// =======================
function j(v: any) {
  return JSON.stringify(v ?? null);
}

function toNumOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v: any): number | null {
  const n = toNumOrNull(v);
  if (n === null) return null;
  return Math.trunc(n);
}

function isUuid(v: any): boolean {
  if (typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

// Soporta "YYYY-MM-DD", "DD-MM-YYYY", "YYYY/MM/DD", "DD/MM/YYYY"
function parseDateOnly(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v !== "string") return null;

  const s = v.trim();
  if (!s) return null;

  const m1 = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/); // yyyy-mm-dd
  if (m1) {
    const yyyy = Number(m1[1]);
    const mm = Number(m1[2]);
    const dd = Number(m1[3]);
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const m2 = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/); // dd-mm-yyyy
  if (m2) {
    const dd = Number(m2[1]);
    const mm = Number(m2[2]);
    const yyyy = Number(m2[3]);
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d3 = new Date(s);
  return Number.isNaN(d3.getTime()) ? null : d3;
}

function cryptoRandomUuidFallback(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyCrypto = (globalThis as any).crypto;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();

  const s4 = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

// =======================
// CHILD TYPES (match DB)
// =======================
type PresionGrupo = {
  submission_id: string;
  grupo_id: string;
  idx_grupo: number;
  calibre: string | null;
  n_frutos: number | null;
  brix: number | null;
  created_at: Date;
  updated_at: Date;
};

type PresionDetalle = {
  submission_id: string;
  grupo_id: string;
  idx_detalle: number;
  p1: number | null;
  p2: number | null;
};

type AlmidonFila = {
  submission_id: string;
  fila_id: string;
  idx_fila: number;
  calibre: string | null;
  f1: number | null;
  f2: number | null;
  f3: number | null;
  f4: number | null;
  f5: number | null;
  f6: number | null;
  f7: number | null;
  f8: number | null;
  f9: number | null;
  f10: number | null;
  created_at: Date;
  updated_at: Date;
};

type SemillaFila = {
  submission_id: string;
  fila_id: string;
  idx_fila: number;
  calibre: string | null;
  sem_0: number | null;
  sem_1_8: number | null;
  sem_1_4: number | null;
  sem_1_2: number | null;
  sem_3_4: number | null;
  sem_1: number | null;
  created_at: Date;
  updated_at: Date;
};

type SemillaSum = {
  submission_id: string;
  sem_0: number | null;
  sem_1_8: number | null;
  sem_1_4: number | null;
  sem_1_2: number | null;
  sem_3_4: number | null;
  sem_1: number | null;
  created_at: Date;
  updated_at: Date;
};

// =======================
// EXTRACTORS (from payload.data)
// =======================
function extractPresiones(
  data: Record<string, any>,
  submissionId: string,
  createdAt: Date,
  updatedAt: Date
) {
  // Fuente principal + fallbacks SOLO si la principal no existe
  const rawPrimary = data?.matriz_presiones;

  const rawFallback =
    rawPrimary ??
    data?.tabla_presiones ??
    data?.presiones_matriz ??
    data?.matrizPresiones ??
    data?.matriz_de_presiones ??
    data?.presiones;

  const raw = rawFallback;

  if (!Array.isArray(raw)) {
    return { grupos: [] as PresionGrupo[], detalles: [] as PresionDetalle[] };
  }

  const grupos: PresionGrupo[] = [];
  const detalles: PresionDetalle[] = [];

  raw.forEach((g: any, idx: number) => {
    const gid = isUuid(g?._id) ? g._id : cryptoRandomUuidFallback();

    const calibre = (g?.calibre ?? "").toString().trim() || null;
    const n_frutos = toIntOrNull(g?.n_frutos);
    const brix = toNumOrNull(g?.brix);

    // detalles reales: g.detalles = [{p1,p2}, ...]
    const detArr = Array.isArray(g?.detalles) ? g.detalles : [];

    // Normalizamos detalles pero NO insertamos vacíos
    const detNorm: PresionDetalle[] = [];
    detArr.forEach((d: any, jdx: number) => {
      const p1 = toNumOrNull(d?.p1 ?? d?.lado1);
      const p2 = toNumOrNull(d?.p2 ?? d?.lado2);

      // si ambos null => es una fila vacía de la UI
      if (p1 === null && p2 === null) return;

      detNorm.push({
        submission_id: submissionId,
        grupo_id: gid,
        idx_detalle: jdx,
        p1,
        p2,
      });
    });

    // Grupo está "vacío" si no tiene info propia ni detalles con datos
    const grupoVacio =
      calibre === null &&
      n_frutos === null &&
      brix === null &&
      detNorm.length === 0;

    // Si el usuario apretó "Añadir fila" pero no llenó nada => NO insertamos
    if (grupoVacio) return;

    // Insertamos grupo
    grupos.push({
      submission_id: submissionId,
      grupo_id: gid,
      idx_grupo: idx,
      calibre,
      n_frutos,
      brix,
      created_at: createdAt,
      updated_at: updatedAt,
    });

    // Insertamos detalles válidos
    detalles.push(...detNorm);
  });

  return { grupos, detalles };
}


function extractAlmidonFilas(
  data: Record<string, any>,
  submissionId: string,
  createdAt: Date,
  updatedAt: Date
) {
  const raw = data?.matriz_almidon_sol;
  if (!Array.isArray(raw)) return [] as AlmidonFila[];

  return raw.map((r: any, idx: number) => {
    const fid = isUuid(r?._id) ? r._id : cryptoRandomUuidFallback();
    return {
      submission_id: submissionId,
      fila_id: fid,
      idx_fila: idx,
      calibre: (r?.calibre ?? "").toString().trim() || null,
      f1: toNumOrNull(r?.f1),
      f2: toNumOrNull(r?.f2),
      f3: toNumOrNull(r?.f3),
      f4: toNumOrNull(r?.f4),
      f5: toNumOrNull(r?.f5),
      f6: toNumOrNull(r?.f6),
      f7: toNumOrNull(r?.f7),
      f8: toNumOrNull(r?.f8),
      f9: toNumOrNull(r?.f9),
      f10: toNumOrNull(r?.f10),
      created_at: createdAt,
      updated_at: updatedAt,
    };
  });
}

function extractSemillaFilas(
  data: Record<string, any>,
  submissionId: string,
  createdAt: Date,
  updatedAt: Date
) {
  const raw = data?.matriz_color_semilla;
  if (!Array.isArray(raw)) return [] as SemillaFila[];

  return raw.map((r: any, idx: number) => {
    const fid = isUuid(r?._id) ? r._id : cryptoRandomUuidFallback();
    return {
      submission_id: submissionId,
      fila_id: fid,
      idx_fila: idx,
      calibre: (r?.calibre ?? "").toString().trim() || null,
      sem_0: toIntOrNull(r?.sem_0),
      sem_1_8: toIntOrNull(r?.sem_1_8),
      sem_1_4: toIntOrNull(r?.sem_1_4),
      sem_1_2: toIntOrNull(r?.sem_1_2),
      sem_3_4: toIntOrNull(r?.sem_3_4),
      sem_1: toIntOrNull(r?.sem_1),
      created_at: createdAt,
      updated_at: updatedAt,
    };
  });
}

function extractSemillaSum(
  data: Record<string, any>,
  submissionId: string,
  createdAt: Date,
  updatedAt: Date
): SemillaSum | null {
  // front: suma_color_semilla suele ser array (normalmente 1 elemento)
  const arr = Array.isArray(data?.suma_color_semilla) ? data.suma_color_semilla : [];
  const r = arr[0] ?? null;

  // Si no hay nada, puedes devolver null y no insertar.
  // Para trazabilidad BI, aquí lo dejamos igual (fila con nulls) solo si existe array (aunque vacío).
  if (!r && arr.length === 0) return null;

  return {
    submission_id: submissionId,
    sem_0: toIntOrNull(r?.sem_0),
    sem_1_8: toIntOrNull(r?.sem_1_8),
    sem_1_4: toIntOrNull(r?.sem_1_4),
    sem_1_2: toIntOrNull(r?.sem_1_2),
    sem_3_4: toIntOrNull(r?.sem_3_4),
    sem_1: toIntOrNull(r?.sem_1),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

// =======================
// BULK SQL BUILDERS (param-safe)
// =======================
function buildBulkInsertPresionesGrupos(request: any, grupos: PresionGrupo[]) {
  if (grupos.length === 0) return "";

  const valuesSql: string[] = [];
  grupos.forEach((g, i) => {
    request.input(`pg_grupo_id_${i}`, sql.UniqueIdentifier, g.grupo_id);
    request.input(`pg_idx_${i}`, sql.Int, g.idx_grupo);
    request.input(`pg_calibre_${i}`, sql.NVarChar(50), g.calibre);
    request.input(`pg_nfrutos_${i}`, sql.Int, g.n_frutos);
    request.input(`pg_brix_${i}`, sql.Decimal(10, 2), g.brix);
    request.input(`pg_created_${i}`, sql.DateTime2, g.created_at);
    request.input(`pg_updated_${i}`, sql.DateTime2, g.updated_at);

    valuesSql.push(
      `(@submission_id, @pg_grupo_id_${i}, @pg_idx_${i}, @pg_calibre_${i}, @pg_nfrutos_${i}, @pg_brix_${i}, @pg_created_${i}, @pg_updated_${i})`
    );
  });

  return `
    INSERT INTO ${T.PRES_G}
      (submission_id, grupo_id, idx_grupo, calibre, n_frutos, brix, created_at, updated_at)
    VALUES
      ${valuesSql.join(",\n      ")};`;
}

function buildBulkInsertPresionesDetalles(request: any, detalles: PresionDetalle[]) {
  if (detalles.length === 0) return "";

  const valuesSql: string[] = [];
  detalles.forEach((d, i) => {
    request.input(`pd_grupo_id_${i}`, sql.UniqueIdentifier, d.grupo_id);
    request.input(`pd_idx_${i}`, sql.Int, d.idx_detalle);
    request.input(`pd_p1_${i}`, sql.Decimal(10, 2), d.p1);
    request.input(`pd_p2_${i}`, sql.Decimal(10, 2), d.p2);

    valuesSql.push(
      `(@submission_id, @pd_grupo_id_${i}, @pd_idx_${i}, @pd_p1_${i}, @pd_p2_${i})`
    );
  });

  return `
    INSERT INTO ${T.PRES_D}
      (submission_id, grupo_id, idx_detalle, p1, p2)
    VALUES
      ${valuesSql.join(",\n      ")};`;
}

function buildBulkInsertAlmidon(request: any, filas: AlmidonFila[]) {
  if (filas.length === 0) return "";

  const valuesSql: string[] = [];
  filas.forEach((f, i) => {
    request.input(`a_fila_id_${i}`, sql.UniqueIdentifier, f.fila_id);
    request.input(`a_idx_${i}`, sql.Int, f.idx_fila);
    request.input(`a_calibre_${i}`, sql.NVarChar(20), f.calibre);

    request.input(`a_f1_${i}`, sql.Decimal(10, 2), f.f1);
    request.input(`a_f2_${i}`, sql.Decimal(10, 2), f.f2);
    request.input(`a_f3_${i}`, sql.Decimal(10, 2), f.f3);
    request.input(`a_f4_${i}`, sql.Decimal(10, 2), f.f4);
    request.input(`a_f5_${i}`, sql.Decimal(10, 2), f.f5);
    request.input(`a_f6_${i}`, sql.Decimal(10, 2), f.f6);
    request.input(`a_f7_${i}`, sql.Decimal(10, 2), f.f7);
    request.input(`a_f8_${i}`, sql.Decimal(10, 2), f.f8);
    request.input(`a_f9_${i}`, sql.Decimal(10, 2), f.f9);
    request.input(`a_f10_${i}`, sql.Decimal(10, 2), f.f10);

    request.input(`a_created_${i}`, sql.DateTime2, f.created_at);
    request.input(`a_updated_${i}`, sql.DateTime2, f.updated_at);

    valuesSql.push(
      `(@submission_id, @a_fila_id_${i}, @a_idx_${i}, @a_calibre_${i},
        @a_f1_${i}, @a_f2_${i}, @a_f3_${i}, @a_f4_${i}, @a_f5_${i},
        @a_f6_${i}, @a_f7_${i}, @a_f8_${i}, @a_f9_${i}, @a_f10_${i},
        @a_created_${i}, @a_updated_${i})`
    );
  });

  return `
    INSERT INTO ${T.ALMIDON}
      (submission_id, fila_id, idx_fila, calibre, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, created_at, updated_at)
    VALUES
      ${valuesSql.join(",\n      ")};`;
}

function buildBulkInsertSemillaFilas(request: any, filas: SemillaFila[]) {
  if (filas.length === 0) return "";

  const valuesSql: string[] = [];
  filas.forEach((f, i) => {
    request.input(`s_fila_id_${i}`, sql.UniqueIdentifier, f.fila_id);
    request.input(`s_idx_${i}`, sql.Int, f.idx_fila);
    request.input(`s_calibre_${i}`, sql.NVarChar(20), f.calibre);

    request.input(`s_sem0_${i}`, sql.Int, f.sem_0);
    request.input(`s_sem18_${i}`, sql.Int, f.sem_1_8);
    request.input(`s_sem14_${i}`, sql.Int, f.sem_1_4);
    request.input(`s_sem12_${i}`, sql.Int, f.sem_1_2);
    request.input(`s_sem34_${i}`, sql.Int, f.sem_3_4);
    request.input(`s_sem1_${i}`, sql.Int, f.sem_1);

    request.input(`s_created_${i}`, sql.DateTime2, f.created_at);
    request.input(`s_updated_${i}`, sql.DateTime2, f.updated_at);

    valuesSql.push(
      `(@submission_id, @s_fila_id_${i}, @s_idx_${i}, @s_calibre_${i},
        @s_sem0_${i}, @s_sem18_${i}, @s_sem14_${i}, @s_sem12_${i}, @s_sem34_${i}, @s_sem1_${i},
        @s_created_${i}, @s_updated_${i})`
    );
  });

  return `
    INSERT INTO ${T.SEM_F}
      (submission_id, fila_id, idx_fila, calibre, sem_0, sem_1_8, sem_1_4, sem_1_2, sem_3_4, sem_1, created_at, updated_at)
    VALUES
      ${valuesSql.join(",\n      ")};`;
}

function buildUpsertSemillaSum(request: any, sum: SemillaSum | null) {
  if (!sum) return "";

  request.input("sum_sem0", sql.Int, sum.sem_0);
  request.input("sum_sem18", sql.Int, sum.sem_1_8);
  request.input("sum_sem14", sql.Int, sum.sem_1_4);
  request.input("sum_sem12", sql.Int, sum.sem_1_2);
  request.input("sum_sem34", sql.Int, sum.sem_3_4);
  request.input("sum_sem1", sql.Int, sum.sem_1);
  request.input("sum_created", sql.DateTime2, sum.created_at);
  request.input("sum_updated", sql.DateTime2, sum.updated_at);

  return `
    DELETE FROM ${T.SEM_S}
     WHERE submission_id = CAST(@submission_id AS UNIQUEIDENTIFIER);

    INSERT INTO ${T.SEM_S}
      (submission_id, sem_0, sem_1_8, sem_1_4, sem_1_2, sem_3_4, sem_1, created_at, updated_at)
    VALUES
      (CAST(@submission_id AS UNIQUEIDENTIFIER),
       @sum_sem0, @sum_sem18, @sum_sem14, @sum_sem12, @sum_sem34, @sum_sem1,
       @sum_created, @sum_updated);`;
}

// =======================
// MAIN FINALIZE
// =======================
export async function finalizePrecosechaManzanas(payload: SubmissionPayload) {
  const pool = await getPool();

  const data = payload.data ?? {};
  const user = payload.user ?? {};
  const template = payload.template ?? {};

  const submissionId = payload.id;

  const createdAt = new Date(payload.createdAt);
  const updatedAt = new Date(payload.updatedAt);

  const request = pool.request();

  // -----------------------
  // Common inputs (RAW)
  // -----------------------
  request.input("submission_id", sql.UniqueIdentifier, submissionId);
  request.input("template_id", sql.VarChar(50), payload.templateId);
  request.input("template_title", sql.NVarChar(200), template.title ?? "C.K.U PRE-COSECHA");
  request.input("template_version", sql.VarChar(20), template.version ?? "2.8");
  request.input("status", sql.VarChar(30), payload.status);
  request.input("created_at", sql.DateTime2, createdAt);
  request.input("updated_at", sql.DateTime2, updatedAt);

  request.input("user_name", sql.NVarChar(200), user.name ?? payload.submittedBy ?? "Usuario (CKU)");
  request.input("user_id", sql.NVarChar(100), user.id ?? "unknown");
  request.input("user_email", sql.NVarChar(200), user.email ?? null);

  request.input("tipo_fruta", sql.VarChar(30), data.tipo_fruta ?? null);
  request.input("planta", sql.NVarChar(100), data.planta ?? null);
  request.input("temporada", sql.NVarChar(50), data.temporada ?? null);

  request.input("data_json", sql.NVarChar(sql.MAX), j(data));
  request.input("dynamic_schemas_json", sql.NVarChar(sql.MAX), null);
  request.input("raw_submission_json", sql.NVarChar(sql.MAX), j(payload));

  // -----------------------
  // Curated (main table)
  // -----------------------
  request.input(
    "submitted_by_name",
    sql.NVarChar(200),
    user.name ?? payload.submittedBy ?? "Usuario (CKU)"
  );
  request.input("submitted_by_user_id", sql.NVarChar(100), user.id ?? "unknown");
  request.input("submitted_by_email", sql.NVarChar(200), user.email ?? null);

  request.input("productor", sql.NVarChar(200), data.productor ?? null);
  request.input("variedad", sql.NVarChar(100), data.variedad ?? null);
  request.input("variedad_rotulada_grupo", sql.NVarChar(100), data.variedad_rotulada_grupo ?? null);
  request.input("huerto_cuartel", sql.NVarChar(200), data.huerto_cuartel ?? null);
  request.input("agronomo", sql.NVarChar(200), data.agronomo ?? null);

  // Dates can arrive "DD-MM-YYYY" or "YYYY-MM-DD"
  request.input("fecha_muestra", sql.Date, parseDateOnly(data.fecha_muestra));
  request.input("fecha_analisis", sql.Date, parseDateOnly(data.fecha_analisis));

  request.input("n_frutos_muestra", sql.Int, toIntOrNull(data.n_frutos_muestra));
  request.input("promedio_diametro_mm", sql.Decimal(18, 4), toNumOrNull(data.promedio_diametro));
  request.input("promedio_peso_g", sql.Decimal(18, 4), toNumOrNull(data.promedio_peso));
  request.input(
    "promedio_color_cubrimiento_pct",
    sql.Decimal(18, 4),
    toNumOrNull(data.promedio_color_cubrimiento)
  );

  request.input("matriz_frutos_externo_json", sql.NVarChar(sql.MAX), j(data.matriz_frutos_externo));
  request.input(
    "matriz_color_cubrimiento_json",
    sql.NVarChar(sql.MAX),
    j(data.matriz_color_cubrimiento)
  );
  request.input(
    "matriz_categorias_calibre_json",
    sql.NVarChar(sql.MAX),
    j(data.matriz_categorias_calibre)
  );

  request.input("color_pulpa", sql.NVarChar(50), data.color_pulpa ?? null);
  request.input("presion_promedio", sql.Decimal(18, 4), toNumOrNull(data.presion_promedio));
  request.input("presion_max", sql.Decimal(18, 4), toNumOrNull(data.presion_max));
  request.input("presion_min", sql.Decimal(18, 4), toNumOrNull(data.presion_min));
  request.input("sol_promedio", sql.Decimal(18, 4), toNumOrNull(data.sol_promedio));

  // backup JSON (even though we normalize)
  request.input("matriz_presiones_json", sql.NVarChar(sql.MAX), j(data.matriz_presiones));

  request.input("almidon_promedio", sql.Decimal(18, 4), toNumOrNull(data.almidon_promedio));
  request.input("almidon_max", sql.Decimal(18, 4), toNumOrNull(data.almidon_max));
  request.input("almidon_min", sql.Decimal(18, 4), toNumOrNull(data.almidon_min));
  request.input("matriz_almidon_sol_json", sql.NVarChar(sql.MAX), j(data.matriz_almidon_sol));
  request.input("matriz_color_semilla_json", sql.NVarChar(sql.MAX), j(data.matriz_color_semilla));
  request.input("suma_color_semilla_json", sql.NVarChar(sql.MAX), j(data.suma_color_semilla));

  request.input("ph", sql.Decimal(18, 4), toNumOrNull(data.ph));
  request.input("acidez", sql.Decimal(18, 4), toNumOrNull(data.acidez));
  request.input("gasto_ml", sql.Decimal(18, 4), toNumOrNull(data.gasto_ml));
  request.input("ac_malico_pct", sql.Decimal(18, 4), toNumOrNull(data.ac_malico_pct));

  request.input("matriz_cor_acuoso_json", sql.NVarChar(sql.MAX), j(data.matriz_cor_acuoso));
  request.input("matriz_cor_mohoso_json", sql.NVarChar(sql.MAX), j(data.matriz_cor_mohoso));

  request.input("observaciones", sql.NVarChar(sql.MAX), data.observaciones ?? null);
  request.input("tecnico", sql.NVarChar(200), data.tecnico ?? null);
  request.input("ayudante", sql.NVarChar(200), data.ayudante ?? null);

  // -----------------------
  // Audit
  // -----------------------
  request.input("event_type", sql.VarChar(30), "FINALIZE");
  request.input("result", sql.VarChar(20), "SUCCESS");
  request.input("error_message", sql.NVarChar(sql.MAX), null);

  // -----------------------
  // Children normalization
  // -----------------------
  const { grupos: presGrupos, detalles: presDetalles } = extractPresiones(
    data,
    submissionId,
    createdAt,
    updatedAt
  );
  const almidonFilas = extractAlmidonFilas(data, submissionId, createdAt, updatedAt);
  const semillaFilas = extractSemillaFilas(data, submissionId, createdAt, updatedAt);
  const semillaSum = extractSemillaSum(data, submissionId, createdAt, updatedAt);

  const insertPresGruposSql = buildBulkInsertPresionesGrupos(request, presGrupos);
  const insertPresDetallesSql = buildBulkInsertPresionesDetalles(request, presDetalles);
  const insertAlmidonSql = buildBulkInsertAlmidon(request, almidonFilas);
  const insertSemillaFilasSql = buildBulkInsertSemillaFilas(request, semillaFilas);
  const upsertSemillaSumSql = buildUpsertSemillaSum(request, semillaSum);

  request.input(
    "details_json",
    sql.NVarChar(sql.MAX),
    JSON.stringify({
      source: "backend_api",
      counts: {
        presiones_grupos: presGrupos.length,
        presiones_detalles: presDetalles.length,
        almidon_filas: almidonFilas.length,
        semilla_filas: semillaFilas.length,
        semilla_sum: semillaSum ? 1 : 0,
      },
    })
  );

  // IMPORTANT: delete order for FKs (detail before group)
  const BATCH_SQL = `
BEGIN TRAN;

  ${MERGE_CKU_SUBMISSIONS}
  ${MERGE_PRE_COSECHA_MANZANAS}

  -- ==========================
  -- CHILDREN: ATOMIC REPLACE
  -- ==========================

  -- PRESIONES
  DELETE FROM ${T.PRES_D}
   WHERE submission_id = CAST(@submission_id AS UNIQUEIDENTIFIER);

  DELETE FROM ${T.PRES_G}
   WHERE submission_id = CAST(@submission_id AS UNIQUEIDENTIFIER);

  ${insertPresGruposSql}
  ${insertPresDetallesSql}

  -- ALMIDON
  DELETE FROM ${T.ALMIDON}
   WHERE submission_id = CAST(@submission_id AS UNIQUEIDENTIFIER);

  ${insertAlmidonSql}

  -- SEMILLA (filas)
  DELETE FROM ${T.SEM_F}
   WHERE submission_id = CAST(@submission_id AS UNIQUEIDENTIFIER);

  ${insertSemillaFilasSql}

  -- SEMILLA (sum 1-row)
  ${upsertSemillaSumSql}

  ${INSERT_AUDIT}

COMMIT TRAN;
`;

  await request.batch(BATCH_SQL);

  return {
    submissionId,
    counts: {
      presiones_grupos: presGrupos.length,
      presiones_detalles: presDetalles.length,
      almidon_filas: almidonFilas.length,
      semilla_filas: semillaFilas.length,
      semilla_sum: semillaSum ? 1 : 0,
    },
  };
}

// =======================
// AUDIT FAIL (best-effort)
// =======================
export async function auditFail(payload: SubmissionPayload, errorMessage: string) {
  const pool = await getPool();
  const data = payload.data ?? {};
  const user = payload.user ?? {};

  const req = pool.request();
  req.input("event_type", sql.VarChar(30), "FINALIZE");
  req.input("result", sql.VarChar(20), "ERROR");
  req.input("submission_id", sql.UniqueIdentifier, payload.id);
  req.input("template_id", sql.VarChar(50), payload.templateId);
  req.input("template_title", sql.NVarChar(200), "C.K.U PRE-COSECHA");
  req.input("user_name", sql.NVarChar(200), user.name ?? payload.submittedBy ?? "Usuario (CKU)");
  req.input("user_id", sql.NVarChar(100), user.id ?? "unknown");
  req.input("user_email", sql.NVarChar(200), user.email ?? null);
  req.input("error_message", sql.NVarChar(sql.MAX), errorMessage);
  req.input(
    "details_json",
    sql.NVarChar(sql.MAX),
    JSON.stringify({
      source: "backend_api",
      dataKeys: Object.keys(data),
    })
  );

  await req.query(INSERT_AUDIT);
}
