'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'react-hot-toast';
import { Check, Upload, X, Palette, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRESET_THEMES } from '@/lib/constants/themes';
import { applyBrandingToDom } from '@/lib/branding/applyBranding';
import {
  getSettings,
  updateSettings,
  uploadLogo,
  deleteLogo,
  type DietitianSettings,
} from '@/lib/api/settings';

// Form validation schema
const settingsSchema = z.object({
  clinicName: z.string().min(1, 'Clinic name is required').max(100),
  dietitianDisplayName: z.string().min(1, 'Display name is required').max(100),
  primaryColorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  accentColorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  themePresetKey: z.string().nullable().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function BrandingPage() {
  const queryClient = useQueryClient();

  // Separate saved (persisted) vs draft (preview) state
  const [savedSettings, setSavedSettings] = useState<DietitianSettings | null>(null);
  const [draftSettings, setDraftSettings] = useState<DietitianSettings | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  // Form setup
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      clinicName: '',
      dietitianDisplayName: '',
      primaryColorHex: '#4A7C59',
      accentColorHex: '#8FBC8F',
      themePresetKey: 'sage',
    },
  });

  // Initialize saved and draft when settings load
  useEffect(() => {
    if (settings) {
      setSavedSettings(settings);
      setDraftSettings(settings);
      form.reset({
        clinicName: settings.clinicName,
        dietitianDisplayName: settings.dietitianDisplayName,
        primaryColorHex: settings.primaryColorHex,
        accentColorHex: settings.accentColorHex,
        themePresetKey: settings.themePresetKey,
      });
      setLogoPreview(settings.logoUrl);
      setLastSaved(new Date(settings.updatedAt));
    }
  }, [settings, form]);

  // Detect unsaved changes (deep compare)
  const hasUnsavedChanges = useMemo(() => {
    if (!savedSettings || !draftSettings) return false;

    return (
      savedSettings.primaryColorHex !== draftSettings.primaryColorHex ||
      savedSettings.accentColorHex !== draftSettings.accentColorHex ||
      savedSettings.themePresetKey !== draftSettings.themePresetKey ||
      savedSettings.clinicName !== draftSettings.clinicName ||
      savedSettings.dietitianDisplayName !== draftSettings.dietitianDisplayName ||
      logoFile !== null
    );
  }, [savedSettings, draftSettings, logoFile]);

  // Warn on browser refresh/close if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      setLastSaved(new Date(data.updatedAt));
      form.reset(form.getValues()); // Reset dirty state
      toast.success('Settings saved successfully!');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  // Logo upload mutation
  const uploadMutation = useMutation({
    mutationFn: uploadLogo,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      setLogoPreview(data.logoUrl);
      setLogoFile(null);
      toast.success('Logo uploaded successfully!');
    },
    onError: () => {
      toast.error('Failed to upload logo');
    },
  });

  // Logo delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteLogo,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      setLogoPreview(null);
      setLogoFile(null);
      toast.success('Logo removed successfully!');
    },
    onError: () => {
      toast.error('Failed to remove logo');
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Only PNG, JPG, and WebP images are allowed');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    // Cleanup old object URL
    if (logoObjectUrl) {
      URL.revokeObjectURL(logoObjectUrl);
    }

    // Create new object URL for local preview
    const objectUrl = URL.createObjectURL(file);
    setLogoObjectUrl(objectUrl);
    setLogoFile(file);
  };

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (logoObjectUrl) {
        URL.revokeObjectURL(logoObjectUrl);
      }
    };
  }, [logoObjectUrl]);

  const handleSave = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    // Prevent double-submit
    if (uploadMutation.isPending || updateMutation.isPending) return;

    try {
      let updatedSettings = savedSettings;

      // 1. Upload logo first if changed
      if (logoFile) {
        updatedSettings = await uploadMutation.mutateAsync(logoFile);
        setLogoFile(null);
        // Cleanup object URL after upload
        if (logoObjectUrl) {
          URL.revokeObjectURL(logoObjectUrl);
          setLogoObjectUrl(null);
        }
      }

      // 2. Update settings with DRAFT values
      const values = form.getValues();
      updatedSettings = await updateMutation.mutateAsync({
        clinicName: values.clinicName!,
        dietitianDisplayName: values.dietitianDisplayName!,
        primaryColorHex: values.primaryColorHex!,
        accentColorHex: values.accentColorHex!,
        themePresetKey: values.themePresetKey ?? null,
      });

      // 3. Update BOTH saved and draft to response
      setSavedSettings(updatedSettings);
      setDraftSettings(updatedSettings);
      setLastSaved(new Date(updatedSettings.updatedAt));

      // 4. Invalidate cache
      await queryClient.invalidateQueries({ queryKey: ['settings'] });

      // 5. Apply global theme (will happen via BrandingContext watching savedSettings)
      applyBrandingToDom(updatedSettings);

      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleDiscard = () => {
    if (!savedSettings) return;

    // 1. Revert draft to saved
    setDraftSettings(savedSettings);

    // 2. Reset form to saved values
    form.reset({
      clinicName: savedSettings.clinicName,
      dietitianDisplayName: savedSettings.dietitianDisplayName,
      primaryColorHex: savedSettings.primaryColorHex,
      accentColorHex: savedSettings.accentColorHex,
      themePresetKey: savedSettings.themePresetKey,
    });

    // 3. Clear logo preview
    if (logoObjectUrl) {
      URL.revokeObjectURL(logoObjectUrl);
      setLogoObjectUrl(null);
    }
    setLogoPreview(savedSettings.logoUrl);
    setLogoFile(null);

    toast.success('Changes discarded');
  };

  const handlePresetSelect = (preset: typeof PRESET_THEMES[number]) => {
    // Update form values
    form.setValue('primaryColorHex', preset.primary, { shouldDirty: true });
    form.setValue('accentColorHex', preset.accent, { shouldDirty: true });
    form.setValue('themePresetKey', preset.key, { shouldDirty: true });

    // Update DRAFT only (not global theme)
    if (draftSettings) {
      setDraftSettings({
        ...draftSettings,
        primaryColorHex: preset.primary,
        accentColorHex: preset.accent,
        themePresetKey: preset.key,
      });
    }

    // DO NOT apply globally - only preview should change
  };

  const isDirty = form.formState.isDirty || logoFile !== null;

  // Use draft settings for preview
  const previewPrimary = draftSettings?.primaryColorHex || '#4A7C59';
  const previewAccent = draftSettings?.accentColorHex || '#8FBC8F';
  const previewClinicName = draftSettings?.clinicName || 'Clinic Name';

  // Use form values for inputs
  const primaryColor = form.watch('primaryColorHex');
  const accentColor = form.watch('accentColorHex');
  const clinicName = form.watch('clinicName');
  const selectedPreset = form.watch('themePresetKey');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Last Saved Indicator */}
      {lastSaved && (
        <div className="text-sm text-muted-foreground">
          Last saved: {lastSaved.toLocaleString()}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Settings Form (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Theme Picker */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Theme Colors</h2>
            </div>

            {/* Preset Themes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-3">
                Preset Themes
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PRESET_THEMES.map((preset) => {
                  const isSelected = selectedPreset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      onClick={() => handlePresetSelect(preset)}
                      className={cn(
                        'relative flex flex-col items-start gap-2 p-4 border-2 rounded-lg transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <div
                          className="w-8 h-8 rounded border border-border"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <div
                          className="w-8 h-8 rounded border border-border"
                          style={{ backgroundColor: preset.accent }}
                        />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{preset.name}</div>
                        <div className="text-xs text-muted-foreground">{preset.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Colors */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-foreground">
                Custom Colors
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      {...form.register('primaryColorHex')}
                      className="w-16 h-10 rounded border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      {...form.register('primaryColorHex')}
                      className="flex-1 px-3 py-2 border border-border rounded-lg font-mono text-sm bg-background"
                    />
                  </div>
                  {form.formState.errors.primaryColorHex && (
                    <p className="text-xs text-red-500 mt-1">
                      {form.formState.errors.primaryColorHex.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      {...form.register('accentColorHex')}
                      className="w-16 h-10 rounded border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      {...form.register('accentColorHex')}
                      className="flex-1 px-3 py-2 border border-border rounded-lg font-mono text-sm bg-background"
                    />
                  </div>
                  {form.formState.errors.accentColorHex && (
                    <p className="text-xs text-red-500 mt-1">
                      {form.formState.errors.accentColorHex.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Logo Upload */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Clinic Logo</h2>
            </div>

            <div className="space-y-4">
              {logoPreview && (
                <div className="relative flex items-center justify-center p-6 bg-muted/30 rounded-lg border border-border">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="max-h-32 object-contain"
                  />
                  <button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div>
                <label className="block">
                  <span className="sr-only">Choose logo</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleLogoChange}
                    className="block w-full text-sm text-muted-foreground
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary file:text-white
                      hover:file:bg-primary/90
                      cursor-pointer"
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  PNG, JPG, or WebP. Maximum 2MB.
                </p>
              </div>
            </div>
          </div>

          {/* Clinic Info */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Clinic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Clinic Name
                </label>
                <input
                  type="text"
                  {...form.register('clinicName')}
                  placeholder="Enter your clinic name"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                {form.formState.errors.clinicName && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.clinicName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Dietitian Display Name
                </label>
                <input
                  type="text"
                  {...form.register('dietitianDisplayName')}
                  placeholder="Enter your display name"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                {form.formState.errors.dietitianDisplayName && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.dietitianDisplayName.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Preview (1/3, Sticky) */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Live Preview</h2>
            <div className="space-y-4">
              {/* Sidebar Preview - uses DRAFT settings */}
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: previewPrimary }}
              >
                <div className="flex items-center gap-3 mb-4">
                  {(logoObjectUrl || logoPreview) ? (
                    <img
                      src={logoObjectUrl || `${logoPreview}?v=${lastSaved?.getTime() || Date.now()}`}
                      alt="Logo"
                      className="w-10 h-10 rounded object-cover bg-white p-1"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center text-white font-bold">
                      {clinicName?.[0]?.toUpperCase() || 'C'}
                    </div>
                  )}
                  <div className="text-white font-semibold truncate">
                    {clinicName || 'Clinic Name'}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-white/70 text-sm">Dashboard</div>
                  <div className="text-white/70 text-sm">Clients</div>
                  <div
                    className="text-white text-sm font-medium px-3 py-2 rounded"
                    style={{ backgroundColor: accentColor }}
                  >
                    Settings
                  </div>
                </div>
              </div>

              {/* Button Previews */}
              <div className="space-y-2">
                <button
                  className="w-full px-4 py-2 rounded-lg text-white font-medium"
                  style={{ backgroundColor: primaryColor }}
                >
                  Primary Button
                </button>
                <button
                  className="w-full px-4 py-2 rounded-lg text-white font-medium"
                  style={{ backgroundColor: accentColor }}
                >
                  Accent Button
                </button>
              </div>

              {/* Color Info */}
              <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t border-border">
                <div>Primary: {primaryColor}</div>
                <div>Accent: {accentColor}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-medium">You have unsaved changes</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDiscard}
                disabled={!hasUnsavedChanges}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || uploadMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {uploadMutation.isPending || uploadMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
