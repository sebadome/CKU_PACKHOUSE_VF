const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../db/pool');

// ===============================
// GET /api/productores
// ===============================
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT DISTINCT [NombreFantasia] AS productor
      FROM [dbo].[CKU_Fruta_Productor]
      WHERE [NombreFantasia] IS NOT NULL
      ORDER BY [NombreFantasia]
    `);

    const productores = result.recordset.map(row => row.productor?.trim() || '');

    res.json({ 
      success: true, 
      data: productores 
    });

  } catch (err) {
    console.error('❌ Error al obtener productores:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener productores',
      message: err.message 
    });
  }
});

module.exports = router;