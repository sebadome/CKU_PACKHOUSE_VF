// backend/scripts/copy-js-routes.js
const fs = require("fs");
const path = require("path");

function copyDir(srcDir, outDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(outDir, { recursive: true });

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(outDir, entry.name);

    if (entry.isDirectory()) {
      copyDir(src, dst);
    } else {
      // copia todo (js/json/etc) por si mañana agregas algo
      fs.copyFileSync(src, dst);
      console.log("[copy]", src, "->", dst);
    }
  }
}

const srcRoutes = path.resolve(__dirname, "../src/routes");
const distRoutes = path.resolve(__dirname, "../dist/routes");

copyDir(srcRoutes, distRoutes);
