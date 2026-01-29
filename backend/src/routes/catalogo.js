const express = require("express");
const router = express.Router();
const { getPool, sql } = require("../db/pool");

// ===============================
// Autocomplete Huertos
// ===============================
router.get("/autocomplete/huerto", async (req, res) => {
  const { q } = req.query;

  if (typeof q !== "string" || q.length < 2) {
    return res.json([]);
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("q", sql.VarChar(200), `%${q}%`)
      .query(`
        SELECT DISTINCT NombreHuerto
        FROM dbo.CKU_Fruta_Productor
        WHERE NombreHuerto LIKE @q
        ORDER BY NombreHuerto
      `);

    res.json(result.recordset.map(r => r.NombreHuerto?.trim() || ''));
  } catch (err) {
    console.error("❌ ERROR AUTOCOMPLETE HUERTO:", err);
    res.status(500).json([]);
  }
});

// ===============================
// Autocomplete Productores
// ===============================
router.get("/autocomplete/productor", async (req, res) => {
  const { q } = req.query;

  if (typeof q !== "string" || q.length < 2) {
    return res.json([]);
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("q", sql.VarChar(200), `%${q}%`)
      .query(`
        SELECT DISTINCT NombreFantasia
        FROM dbo.CKU_Fruta_Productor
        WHERE NombreFantasia LIKE @q
        ORDER BY NombreFantasia
      `);

    res.json(result.recordset.map(r => r.NombreFantasia?.trim() || ''));
  } catch (err) {
    console.error("❌ ERROR AUTOCOMPLETE PRODUCTOR:", err);
    res.status(500).json([]);
  }
});

module.exports = router;