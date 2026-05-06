import * as ImageManipulator from "expo-image-manipulator";

export type AnalysisMode = "receipt" | "ingredient_photo";

const MODE_CONFIG: Record<AnalysisMode, { width: number; quality: number }> = {
  receipt: { width: 1800, quality: 0.8 },
  ingredient_photo: { width: 1280, quality: 0.7 },
};

export interface CompressedImage {
  base64: string;
  mediaType: "image/jpeg";
  approxBytes: number;
}

/**
 * Resizes and JPEG-compresses an image URI before uploading to vision API.
 * Receipt mode keeps higher resolution (1800px) for OCR accuracy.
 * Ingredient photo mode uses 1280px for faster transfer.
 */
export async function compressImage(
  uri: string,
  mode: AnalysisMode,
): Promise<CompressedImage> {
  const config = MODE_CONFIG[mode];

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

  console.log(
    `[imageCompressor] mode=${mode} approxBytes=${approxBytes} (${(approxBytes / 1024 / 1024).toFixed(2)} MB)`,
  );

  return { base64, mediaType: "image/jpeg", approxBytes };
}
