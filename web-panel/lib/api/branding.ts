/**
 * Branding API Client
 * Handles clinic branding settings (colors, logo, clinic name)
 */

export interface BrandingSettings {
  clinicName: string | null;
  logoUrl: string | null;
  primaryColorHex: string;
  accentColorHex: string;
}

export interface UpdateBrandingRequest {
  clinicName?: string | null;
  primaryColorHex: string;
  accentColorHex: string;
}

/**
 * Get current branding settings
 */
export async function getBrandingSettings(): Promise<BrandingSettings> {
  const res = await fetch('/api/dietitian/branding', {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch branding settings: ${res.status}`);
  }

  return res.json();
}

/**
 * Update branding settings (upsert)
 */
export async function updateBrandingSettings(
  data: UpdateBrandingRequest
): Promise<BrandingSettings> {
  const res = await fetch('/api/dietitian/branding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Update failed' }));
    throw new Error(error.message || `Failed to update branding: ${res.status}`);
  }

  return res.json();
}

/**
 * Upload clinic logo
 */
export async function uploadBrandingLogo(file: File): Promise<{ logoUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/dietitian/branding/logo', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || `Failed to upload logo: ${res.status}`);
  }

  return res.json();
}

/**
 * Reset branding to defaults
 */
export async function resetBrandingSettings(): Promise<BrandingSettings> {
  const res = await fetch('/api/dietitian/branding', {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`Failed to reset branding: ${res.status}`);
  }

  return res.json();
}
