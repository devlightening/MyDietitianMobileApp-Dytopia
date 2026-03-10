'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'react-hot-toast';
import { User } from 'lucide-react';
import {
  getSettings,
  updateSettings,
  type DietitianSettings,
} from '@/lib/api/settings';

// Form validation schema
const profileSchema = z.object({
  clinicName: z.string().min(1, 'Clinic name is required').max(100),
  dietitianDisplayName: z.string().min(1, 'Display name is required').max(100),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const queryClient = useQueryClient();

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  // Form setup
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      clinicName: '',
      dietitianDisplayName: '',
    },
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      form.reset({
        clinicName: settings.clinicName,
        dietitianDisplayName: settings.dietitianDisplayName,
      });
    }
  }, [settings, form]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: ProfileFormData) => {
      if (!settings) {
        throw new Error('Settings not loaded');
      }
      return updateSettings({
        clinicName: data.clinicName,
        dietitianDisplayName: data.dietitianDisplayName,
        primaryColorHex: settings.primaryColorHex,
        accentColorHex: settings.accentColorHex,
        themePresetKey: settings.themePresetKey,
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      form.reset(form.getValues()); // Reset dirty state
      toast.success('Profile updated successfully!');
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const handleSave = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    updateMutation.mutate(form.getValues());
  };

  const handleDiscard = () => {
    if (settings) {
      form.reset({
        clinicName: settings.clinicName,
        dietitianDisplayName: settings.dietitianDisplayName,
      });
      toast.success('Changes discarded');
    }
  };

  const isDirty = form.formState.isDirty;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        {/* Profile Information */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Profile Information</h2>
          </div>

          <div className="space-y-4">
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
              <p className="text-xs text-muted-foreground mt-1">
                This name will be displayed in the sidebar and throughout the application
              </p>
              {form.formState.errors.dietitianDisplayName && (
                <p className="text-xs text-red-500 mt-1">
                  {form.formState.errors.dietitianDisplayName.message}
                </p>
              )}
            </div>

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
              <p className="text-xs text-muted-foreground mt-1">
                Your clinic name will appear in the sidebar header
              </p>
              {form.formState.errors.clinicName && (
                <p className="text-xs text-red-500 mt-1">
                  {form.formState.errors.clinicName.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-muted/50 border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Note:</strong> Changes to your profile information
            will be reflected across the entire application, including the sidebar and any client-facing
            communications.
          </p>
        </div>
      </div>

      {/* Sticky Save Bar */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="text-sm text-foreground font-medium">
              You have unsaved changes
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDiscard}
                className="px-4 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
