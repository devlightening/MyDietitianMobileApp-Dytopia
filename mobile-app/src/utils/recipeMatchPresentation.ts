import type { RecipeMatchResult } from "../api/kitchen";

type Lang = "tr" | "en";

export function normalizeRecipeScorePercent(score?: number | null): number {
  if (typeof score !== "number" || Number.isNaN(score)) return 0;
  const percentLike = score <= 1 ? score * 100 : score;
  return Math.max(0, Math.min(100, Math.round(percentLike)));
}

export function formatRecipeScore(score?: number | null): string {
  return `%${normalizeRecipeScorePercent(score)}`;
}

export function normalizeCompatibilityPercent(result?: Partial<Pick<RecipeMatchResult, "compatibilityPercent" | "score">> | null): number {
  if (!result) return 0;
  if (typeof result.compatibilityPercent === "number" && Number.isFinite(result.compatibilityPercent)) {
    return Math.max(0, Math.min(100, Math.round(result.compatibilityPercent)));
  }
  return normalizeRecipeScorePercent(result.score);
}

export function formatCompatibilityPercent(result?: Partial<Pick<RecipeMatchResult, "compatibilityPercent" | "score">> | null): string {
  return `%${normalizeCompatibilityPercent(result)}`;
}

export function getMatchTier(result: RecipeMatchResult): "full" | "partial" | "discovery" {
  if (result.matchStatus === "FULL_MATCH") return "full";
  if (result.matchStatus === "ONE_MISSING") return "partial";
  return "discovery";
}

export function getMatchTierLabel(result: RecipeMatchResult, lang: Lang): string {
  const tier = getMatchTier(result);
  if (lang === "en") {
    if (tier === "full") return "Full Match";
    if (tier === "partial") return "Partial Match";
    return "Discovery";
  }
  if (tier === "full") return "Tam Uyum";
  if (tier === "partial") return "Kısmi Uyum";
  return "Keşif Önerisi";
}

export function getSourceLabel(result: RecipeMatchResult, lang: Lang): string {
  const isClinic =
    result.isOwnedByActiveDietitian === true ||
    (typeof result.sourceType === "string" && result.sourceType.startsWith("LINKED_CLINIC"));
  const isFallback =
    result.isPublicFallback === true ||
    result.sourceType === "GLOBAL_PUBLIC_FALLBACK" ||
    result.sourceType === "OTHER_DIETITIAN_PUBLIC";
  if (lang === "en") {
    if (isClinic) return "Clinic recipe";
    if (isFallback) return "General catalog";
    return "General recipe";
  }
  if (isClinic) return "Klinik tarifi";
  if (isFallback) return "Genel katalog";
  return "Genel tarif";
}

export function buildWhySuggested(result: RecipeMatchResult, lang: Lang): {
  summaryLine: string;
  paragraph: string;
  facts: Array<{ label: string; value: string }>;
} {
  const exp = result.explanation;
  const mandatoryTotal = result.mandatoryCount ?? exp?.totalMandatoryCount ?? 0;
  const mandatoryMatched = result.matchedMandatoryCount ?? exp?.matchedMandatoryCount ?? 0;
  const optionalTotal = exp?.optionalCount ?? 0;
  const optionalMatched = exp?.matchedOptionalCount ?? 0;
  const flavoringTotal = exp?.flavoringTotalCount ?? exp?.supportTotalCount ?? 0;
  const flavoringMatched = exp?.flavoringMatchedCount ?? exp?.supportMatchedCount ?? 0;

  const summaryLine = `${getMatchTierLabel(result, lang)} · ${getSourceLabel(result, lang)}`;
  const source = getSourceLabel(result, lang);

  let paragraph: string;
  if (lang === "en") {
    if (result.matchStatus === "FULL_MATCH") {
      paragraph = `This recipe is recommended because all mandatory ingredients are already available. It is one of the strongest matches in your ${source.toLowerCase()} pool.`;
    } else if (result.matchStatus === "ONE_MISSING") {
      paragraph = `This recipe is close to ready with your current ingredients. Mandatory coverage is high, and adding one missing item can make it fully ready.`;
    } else {
      paragraph = `This recipe is suggested as a discovery option based on your current ingredient profile and overall compatibility.`;
    }
  } else {
    if (result.matchStatus === "FULL_MATCH") {
      paragraph = `Bu tarif, zorunlu malzemelerin tamamı elinizde olduğu için önerildi. ${source} havuzunuzdaki güçlü eşleşmelerden biridir.`;
    } else if (result.matchStatus === "ONE_MISSING") {
      paragraph = `Bu tarif, elinizdeki malzemelerle yüksek uyum gösterdiği için önerildi. Tek bir eksik malzeme eklendiğinde tarif tam uyuma yaklaşır.`;
    } else {
      paragraph = `Bu tarif, mevcut malzeme profilinize göre keşif odaklı bir alternatif olarak önerildi.`;
    }
  }

  const facts = lang === "en"
    ? [
        { label: "Mandatory match", value: `${mandatoryMatched}/${mandatoryTotal}` },
        { label: "Optional match", value: `${optionalMatched}/${optionalTotal}` },
        { label: "Flavoring match", value: `${flavoringMatched}/${flavoringTotal}` },
      ]
    : [
        { label: "Zorunlu eşleşme", value: `${mandatoryMatched}/${mandatoryTotal}` },
        { label: "Opsiyonel eşleşme", value: `${optionalMatched}/${optionalTotal}` },
        { label: "Lezzetlendirici eşleşme", value: `${flavoringMatched}/${flavoringTotal}` },
      ];

  return { summaryLine, paragraph, facts };
}
