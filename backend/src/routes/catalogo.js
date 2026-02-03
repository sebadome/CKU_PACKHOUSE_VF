// routes/catalogo.js
const express = require("express");
const router = express.Router();
const { getPool, sql } = require("../db/pool");

// Helpers
const normalize = (v) => (typeof v === "string" ? v.trim() : "");
const hasMinLen = (v, n = 2) => typeof v === "string" && v.trim().length >= n;

// ===============================
// Autocomplete Huertos
// GET /api/catalogo/autocomplete/huerto?q=sa
// ===============================
router.get("/autocomplete/huerto", async (req, res) => {
  const q = normalize(req.query.q);

  if (!hasMinLen(q, 2)) return res.json([]);

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("q", sql.VarChar(200), `%${q}%`)
      .query(`
        SELECT DISTINCT
          LTRIM(RTRIM([NombreHuerto])) AS NombreHuerto
        FROM dbo.CKU_Fruta_Productor
        WHERE [NombreHuerto] IS NOT NULL
          AND LTRIM(RTRIM([NombreHuerto])) LIKE @q
        ORDER BY NombreHuerto
      `);

    const data = (result.recordset || [])
      .map((r) => normalize(r.NombreHuerto))
      .filter(Boolean);

    return res.json(data);
  } catch (err) {
    console.error("❌ ERROR AUTOCOMPLETE HUERTO:", err);
    return res.status(500).json([]);
  }
});


// ===============================
// Autocomplete Productores (NombreFantasia)
// GET /api/catalogo/autocomplete/productor?q=sa
// ===============================
router.get("/autocomplete/productor", async (req, res) => {
  const q = normalize(req.query.q);

  if (!hasMinLen(q, 2)) return res.json([]);

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("q", sql.VarChar(200), `%${q}%`)
      .query(`
        SELECT DISTINCT LTRIM(RTRIM([NombreFantasia])) AS NombreFantasia
        FROM dbo.CKU_Fruta_Productor
        WHERE [NombreFantasia] IS NOT NULL
          AND LTRIM(RTRIM([NombreFantasia])) LIKE @q
        ORDER BY NombreFantasia
      `);

    const data = (result.recordset || [])
      .map((r) => normalize(r.NombreFantasia))
      .filter(Boolean);

    return res.json(data);
  } catch (err) {
    console.error("❌ ERROR AUTOCOMPLETE PRODUCTOR:", err);
    return res.status(500).json([]);
  }
});

// ===============================
// Código Productor por NombreFantasia (exact match)
// GET /api/catalogo/productor/codigo?nombre=SAN%20GUILLERMO
// ===============================
router.get("/productor/codigo", async (req, res) => {
  const nombre = normalize(req.query.nombre);

  if (!hasMinLen(nombre, 2)) return res.json({ codigo: "" });

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("nombre", sql.VarChar(200), nombre)
      .query(`
        SELECT TOP 1
          LTRIM(RTRIM([Productor])) AS Codigo
        FROM dbo.CKU_Fruta_Productor
        WHERE [NombreFantasia] IS NOT NULL
          AND [Productor] IS NOT NULL
          AND LTRIM(RTRIM([NombreFantasia])) = LTRIM(RTRIM(@nombre))
        ORDER BY LTRIM(RTRIM([Productor])) ASC
      `);

    const codigo = result.recordset?.[0]?.Codigo ? String(result.recordset[0].Codigo).trim() : "";
    return res.json({ codigo });
  } catch (err) {
    console.error("❌ ERROR CODIGO PRODUCTOR:", err);
    return res.status(500).json({ codigo: "" });
  }
});

module.exports = router;
