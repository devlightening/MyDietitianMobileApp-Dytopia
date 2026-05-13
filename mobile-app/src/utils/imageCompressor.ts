import * as ImageManipulator from "expo-image-manipulator";

export type AnalysisMode = "receipt" | "ingredient";

const MAX_UPLOAD_BYTES = Math.floor(3.8 * 1024 * 1024);

const MODE_CONFIG: Record<AnalysisMode, Array<{ width: number; quality: number }>> = {
  receipt: [{ width: 1800, quality: 0.8 }],
  ingredient: [
    { width: 1600, quality: 0.75 },
    { width: 1280, quality: 0.65 },
    { width: 1024, quality: 0.6 },
    { width: 896, quality: 0.55 },
    { width: 768, quality: 0.5 },
  ],
};

export interface CompressedImage {
  base64: string;
  mediaType: "image/jpeg";
  approxBytes: number;
}

/**
 * Resizes and JPEG-compresses an image URI before uploading to vision API.
 * Receipt mode keeps higher resolution (1800px) for OCR accuracy.
 * Ingredient mode adaptively compresses normal phone photos under the API target.
 */
export async function compressImage(
  uri: string,
  mode: AnalysisMode,
): Promise<CompressedImage> {
  let best: CompressedImage | null = null;

  for (const config of MODE_CONFIG[mode]) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: config.width } }],
      {
        compress: config.quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );

    const base64 = result.base64 ?? "";
    const approxBytes = Math.floor((base64.length * 3) / 4);
    best = { base64, mediaType: "image/jpeg", approxBytes };

    if (mode !== "ingredient" || approxBytes <= MAX_UPLOAD_BYTES) {
      break;
    }
  }

  if (!best?.base64) {
    throw new Error("Image compression failed.");
  }

  console.log(
    `[imageCompressor] mode=${mode} approxBytes=${best.approxBytes} (${(best.approxBytes / 1024 / 1024).toFixed(2)} MB)`,
  );

  return best;
}
