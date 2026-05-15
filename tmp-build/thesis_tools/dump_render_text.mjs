import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("usage: node dump_render_text.mjs input.docx output.json");
}

const artifactToolPath =
  "C:/Users/hy971/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";
const artifactTool = await import(pathToFileURL(artifactToolPath).href);

const model = await artifactTool.DocumentFile.importDocx(
  await artifactTool.FileBlob.load(path.resolve(inputPath)),
);

const canvas = new OffscreenCanvas(1, 1);
const ctx = canvas.getContext("2d");
const { pages } = artifactTool.drawDocumentToCtx(model, ctx, {
  pageIndex: 0,
  clear: false,
});
const fragments = artifactTool.collectRenderedDocumentTextFragments(pages);

const byPage = pages.map((page, pageIndex) => ({
  pageIndex,
  sectionId: page.sectionId,
  widthPx: page.widthPx,
  heightPx: page.heightPx,
  text: fragments
    .filter((fragment) => fragment.pageIndex === pageIndex)
    .map((fragment) => fragment.text)
    .join("\n"),
  fragments: fragments.filter((fragment) => fragment.pageIndex === pageIndex),
}));

await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await fs.writeFile(
  path.resolve(outputPath),
  JSON.stringify({ pageCount: pages.length, pages: byPage }, null, 2),
  "utf8",
);

console.log(`${pages.length} pages -> ${outputPath}`);
