import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = [
  path.join(__dirname, "../node_modules/react-toastify/dist/ReactToastify.css"),
  path.join(__dirname, "../node_modules/react-toastify/dist/ReactToastify.min.css"),
  path.join(__dirname, "../node_modules/react-toastify/dist/react-toastify.esm.mjs"),
  path.join(__dirname, "../node_modules/react-toastify/dist/react-toastify.js"),
  path.join(__dirname, "../node_modules/react-toastify/dist/react-toastify.min.js"),
];

console.log("🧹 Stripping sourcemap references from react-toastify...");

for (const f of files) {
  if (!fs.existsSync(f)) {
    // File doesn't exist, skip silently
    continue;
  }

  try {
    const txt = fs.readFileSync(f, "utf8");
    // Remove both styles of sourcemap comments:
    // //# sourceMappingURL=...
    // /*# sourceMappingURL=... */
    const cleaned = txt
      .split("\n")
      .filter((line) => !line.includes("sourceMappingURL="))
      .join("\n");
    fs.writeFileSync(f, cleaned, "utf8");
    console.log(`✅ Stripped: ${path.basename(f)}`);
  } catch (error) {
    console.error(`❌ Error processing ${f}:`, error.message);
  }
}

console.log("✨ Sourcemap cleanup complete!");
