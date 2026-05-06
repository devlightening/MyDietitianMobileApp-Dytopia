import type { Language } from "../context/I18nContext";

export function mapApiError(error: any, language: Language = "tr") {
  const status = error?.response?.status;
  const code = error?.code;
  const backendMessage = error?.response?.data?.detail ?? error?.response?.data?.message ?? error?.response?.data?.error;
  const isTr = language === "tr";

  if (code === "ECONNABORTED") {
    return {
      title: isTr ? "İstek zaman aşımına uğradı" : "Request timed out",
      message: isTr ? "Bağlantı yavaş görünüyor. Birazdan tekrar deneyebilirsin." : "The connection looks slow. Try again in a moment.",
      kind: "timeout" as const,
    };
  }

  if (code === "ERR_NETWORK" || !error?.response) {
    return {
      title: isTr ? "Bağlantı kurulamadı" : "Could not connect",
      message: isTr ? "İnternetini veya backend bağlantısını kontrol edip tekrar dene." : "Check your internet or backend connection and try again.",
      kind: "network" as const,
    };
  }

  if (status === 401) {
    return {
      title: isTr ? "Oturum yenilenmeli" : "Session needs refresh",
      message: isTr ? "Güvenlik için tekrar giriş yapman gerekebilir." : "For security, you may need to sign in again.",
      kind: "auth" as const,
    };
  }

  if (status === 403) {
    return {
      title: isTr ? "Bu işlem için yetki yok" : "Not allowed",
      message: isTr ? "Bu alana erişim iznin görünmüyor." : "You do not seem to have access to this area.",
      kind: "permission" as const,
    };
  }

  if (status === 404) {
    return {
      title: isTr ? "Kayıt bulunamadı" : "Not found",
      message: isTr ? "Aradığın kayıt artık mevcut olmayabilir." : "The record may no longer exist.",
      kind: "not_found" as const,
    };
  }

  if (status >= 500) {
    return {
      title: isTr ? "Sunucu biraz yoruldu" : "Server needs a moment",
      message: isTr ? "İşlem bize ulaştı ama sunucu cevap veremedi. Birazdan tekrar deneyelim." : "The request reached us, but the server could not respond. Let’s try again shortly.",
      kind: "server" as const,
    };
  }

  return {
    title: isTr ? "İşlem tamamlanamadı" : "Action could not finish",
    message: backendMessage || (isTr ? "Beklenmeyen bir sorun oluştu. Tekrar deneyebilirsin." : "Something unexpected happened. You can try again."),
    kind: "unknown" as const,
  };
}
