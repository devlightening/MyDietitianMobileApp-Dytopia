import fs from "node:fs";
import path from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const csvPath = args.get("--csv");
const outputPath = args.get("--out") ?? "scripts/generated/20260503_measure_recipe_ingredients_and_steps.sql";

if (!csvPath) {
  throw new Error("Usage: node scripts/generate-measured-recipe-patch.mjs --csv <path> [--out <path>]");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);

  const [headers, ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])));
}

function normalizeUnit(unit) {
  const value = (unit ?? "").trim();
  const lower = value.toLocaleLowerCase("tr-TR");
  if (lower === "gram" || lower === "gr") return "g";
  if (lower === "litre" || lower === "liter" || lower === "lt") return "L";
  return value;
}

function formatAmount(quantity, unit, sql = false) {
  const value = Number.parseFloat(String(quantity).replace(",", "."));
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return sql ? formatted : `${formatted.replace(".", ",")} ${normalizeUnit(unit)}`;
}

function sqlQuote(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function byName(a, b) {
  return a.IngredientName.localeCompare(b.IngredientName, "tr");
}

function joinItems(rows) {
  return rows.map((row) => `${formatAmount(row.Quantity, row.Unit)} ${row.IngredientName}`).join(", ");
}

function buildMeasuredSteps(recipeName, mandatory, optional, flavoring) {
  const mandatoryText = joinItems(mandatory);
  const optionalText = joinItems(optional);
  const flavoringText = joinItems(flavoring);
  const name = recipeName.toLocaleLowerCase("tr-TR");

  if (name.includes("çorba")) {
    return [
      `Hazırlık için ${mandatoryText} ölçülü şekilde hazırla; sebze veya bakliyat varsa yıka, ayıkla ve küçük parçalara böl.`,
      optionalText ? `Lezzeti desteklemek için ${optionalText} eklenmeye hazır olacak şekilde doğra veya çırp.` : null,
      flavoringText ? `Tencereye ${flavoringText} alıp kısık-orta ateşte kısa süre ısıtarak çorbanın aroma tabanını oluştur.` : null,
      `${mandatoryText} tencereye ekle; üzerini geçecek kadar sıcak su ilave edip malzemeler yumuşayana kadar pişir.`,
      "Kıvamı kontrol et, gerekirse sıcak suyla aç; 2-3 dakika dinlendirip sıcak servis et.",
    ].filter(Boolean);
  }

  if (["salata", "cacık", "meze", "ezme", "tarator"].some((keyword) => name.includes(keyword))) {
    return [
      `${mandatoryText} malzemelerini yıka, ayıkla ve tarif dokusuna uygun şekilde doğra, rendele veya ez.`,
      optionalText ? `${optionalText} malzemelerini eklenmeye hazır hale getir; salata/meze dokusunu bozmayacak incelikte hazırla.` : null,
      flavoringText ? `Sos için ${flavoringText} malzemelerini küçük bir kapta homojen olana kadar karıştır.` : null,
      "Hazırlanan ana malzemeleri geniş bir kapta birleştir; sosu ekleyip ezmeden karıştır.",
      "Lezzetin oturması için kısa süre dinlendir, ardından soğuk veya oda sıcaklığında servis et.",
    ].filter(Boolean);
  }

  if (["omlet", "menemen", "mücver"].some((keyword) => name.includes(keyword))) {
    return [
      `${mandatoryText} malzemelerini hazırla; sebzeleri küçük doğra veya rendele, yumurtalı karışım varsa pürüzsüz olana kadar çırp.`,
      optionalText ? `${optionalText} malzemelerini karışıma ekle ve homojen dağılmasını sağla.` : null,
      flavoringText ? `Tavayı ${flavoringText} ile hafifçe yağlayıp ısıt; baharatları son aşamada dengeli ekle.` : null,
      "Karışımı tavaya alıp orta ateşte altı toparlanana kadar pişir; gerekirse çevirerek içinin de pişmesini sağla.",
      "Ocaktan aldıktan sonra 1 dakika dinlendir ve sıcak servis et.",
    ].filter(Boolean);
  }

  if (["pilav", "makarna", "erişte", "şehriye"].some((keyword) => name.includes(keyword))) {
    return [
      `${mandatoryText} malzemelerini ölçülü hazırla; tahıl veya makarna grubunu kısa süre sudan geçirip süz.`,
      flavoringText ? `Tencereye ${flavoringText} alıp ısıt; aromatikleri yakmadan kısa süre kavur.` : null,
      optionalText ? `${optionalText} malzemelerini ekleyip birkaç dakika sotele.` : null,
      `${mandatoryText} ekleyip karıştır; uygun miktarda sıcak su ilave ederek kapağı kapalı şekilde pişir.`,
      "Suyunu çekince ocaktan al, 5 dakika dinlendir ve tane tane servis et.",
    ].filter(Boolean);
  }

  if (["tavuk", "hindi", "köfte", "etli", "fırın"].some((keyword) => name.includes(keyword))) {
    return [
      `${mandatoryText} malzemelerini ölçülü hazırla; protein grubunu eşit pişecek parçalara ayır.`,
      flavoringText ? `Marine veya pişirme tabanı için ${flavoringText} malzemelerini karıştırıp ana malzemeye yedir.` : null,
      optionalText ? `${optionalText} malzemelerini ekleyerek sebze ve eşlikçi dengesini kur.` : null,
      "Tava, tencere veya fırında orta ısıda protein tamamen pişene kadar kontrollü şekilde pişir.",
      "Piştikten sonra birkaç dakika dinlendir, porsiyonlayıp sıcak servis et.",
    ].filter(Boolean);
  }

  return [
    `${mandatoryText} malzemelerini ölçülü şekilde hazırla; yıkanacak, doğranacak veya haşlanacak parçaları önceden düzenle.`,
    optionalText ? `${optionalText} malzemelerini tarifin dokusuna uygun biçimde eklenmeye hazır hale getir.` : null,
    flavoringText ? `${flavoringText} ile tarifin aroma ve sos tabanını oluştur.` : null,
    "Tüm malzemeleri uygun sırayla birleştirip orta ateşte veya tarif yapısına uygun yöntemle pişir.",
    "Kıvamı ve lezzeti kontrol edip kısa süre dinlendir; ardından porsiyonlayarak servis et.",
  ].filter(Boolean);
}

const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const missing = rows.filter((row) => !row.Quantity?.trim() || !row.Unit?.trim());
if (missing.length > 0) {
  throw new Error(`Miktar/birim eksik satır var: ${missing.length}`);
}

const grouped = Map.groupBy(rows, (row) => row.RecipeId);
const lines = [
  `-- Generated from: ${csvPath}`,
  "-- Purpose: backfill measured recipe ingredients and measured preparation steps.",
  "-- Review before running on production. Intended for PostgreSQL / pgAdmin.",
  "BEGIN;",
  "",
  "CREATE TEMP TABLE _recipe_measurement_patch (",
  '  "RecipeId" uuid NOT NULL,',
  '  "IngredientId" uuid NOT NULL,',
  '  "Role" text NOT NULL,',
  '  "Quantity" numeric NOT NULL,',
  '  "Unit" text NOT NULL',
  ") ON COMMIT DROP;",
  "",
  'INSERT INTO _recipe_measurement_patch ("RecipeId", "IngredientId", "Role", "Quantity", "Unit") VALUES',
];

lines.push(
  rows
    .map((row) => {
      const quantity = formatAmount(row.Quantity, row.Unit, true);
      const unit = normalizeUnit(row.Unit);
      return `('${row.RecipeId}'::uuid, '${row.IngredientId}'::uuid, ${sqlQuote(row.Role)}, ${quantity}, ${sqlQuote(unit)})`;
    })
    .join(",\n") + ";",
);

lines.push(
  "",
  'UPDATE public."RecipeIngredients" ri',
  'SET "Quantity" = p."Quantity",',
  '    "Unit" = p."Unit"',
  "FROM _recipe_measurement_patch p",
  'WHERE ri."RecipeId" = p."RecipeId"',
  '  AND ri."IngredientId" = p."IngredientId"',
  '  AND ri."Role" = p."Role";',
  "",
  "CREATE TEMP TABLE _recipe_steps_patch (",
  '  "RecipeId" uuid NOT NULL,',
  '  "StepsJson" text NOT NULL',
  ") ON COMMIT DROP;",
  "",
  'INSERT INTO _recipe_steps_patch ("RecipeId", "StepsJson") VALUES',
);

lines.push(
  [...grouped.entries()]
    .map(([recipeId, recipeRows]) => {
      const mandatory = recipeRows.filter((row) => row.Role === "Mandatory").sort(byName);
      const optional = recipeRows.filter((row) => row.Role === "Optional").sort(byName);
      const flavoring = recipeRows.filter((row) => row.Role === "Flavoring").sort(byName);
      const steps = buildMeasuredSteps(recipeRows[0].RecipeName, mandatory, optional, flavoring);
      return `('${recipeId}'::uuid, ${sqlQuote(JSON.stringify(steps))})`;
    })
    .join(",\n") + ";",
);

lines.push(
  "",
  'UPDATE public."Recipes" r',
  'SET "StepsJson" = p."StepsJson"',
  "FROM _recipe_steps_patch p",
  'WHERE r."Id" = p."RecipeId";',
  "",
  "-- Validation summary",
  "SELECT COUNT(*) AS missing_quantity_after_patch",
  'FROM public."RecipeIngredients" ri',
  'JOIN _recipe_measurement_patch p ON p."RecipeId" = ri."RecipeId" AND p."IngredientId" = ri."IngredientId" AND p."Role" = ri."Role"',
  'WHERE ri."Quantity" IS NULL OR ri."Unit" IS NULL;',
  "",
  "SELECT COUNT(*) AS recipes_with_measured_steps",
  'FROM public."Recipes" r',
  'JOIN _recipe_steps_patch p ON p."RecipeId" = r."Id"',
  'WHERE r."StepsJson" = p."StepsJson";',
  "",
  "COMMIT;",
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

console.log(`Generated SQL: ${outputPath}`);
console.log(`Recipes: ${grouped.size}`);
console.log(`Ingredient rows: ${rows.length}`);
