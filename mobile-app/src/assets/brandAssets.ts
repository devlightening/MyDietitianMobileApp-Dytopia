import { Asset } from "expo-asset";
import { Image } from "react-native";

export const BRAND_LOGO = require("../../assets/dytopia-logo.png");

const BRAND_IMAGE_ASSETS = [BRAND_LOGO];

let brandAssetsPreloadPromise: Promise<void> | null = null;

export function preloadBrandAssets(): Promise<void> {
  if (!brandAssetsPreloadPromise) {
    brandAssetsPreloadPromise = Promise.all(
      BRAND_IMAGE_ASSETS.map((asset) => Asset.fromModule(asset).downloadAsync()),
    )
      .then(() => {
        BRAND_IMAGE_ASSETS.forEach((asset) => {
          const resolved = Image.resolveAssetSource(asset);
          if (resolved?.uri) {
            void Image.prefetch(resolved.uri).catch(() => undefined);
          }
        });
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn("[brandAssets] preload failed", error);
        }
      });
  }

  return brandAssetsPreloadPromise;
}
