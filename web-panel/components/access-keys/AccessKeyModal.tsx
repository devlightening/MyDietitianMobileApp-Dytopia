'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createAccessKeyForClient } from '@/lib/api/access-keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Check } from 'lucide-react';
import { toast } from '@/components/ui/Toast';

interface AccessKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'generate' | 'extend' | 'revoke';
  initialClientId?: string;
  existingKey?: {
    id: string;
    key: string;
    endDate: string;
  };
}

export function AccessKeyModal({ isOpen, onClose, mode, existingKey, initialClientId }: AccessKeyModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    clientPublicUserId: initialClientId || '',
    startDate: '',
    endDate: '',
  });
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync initialClientId when prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        clientPublicUserId: initialClientId || ''
      }));
    }
  }, [isOpen, initialClientId]);

  const generateMutation = useMutation({
    mutationFn: (data: { clientPublicUserId: string; startDate: string; endDate: string }) =>
      createAccessKeyForClient(data.clientPublicUserId, {
        createdAtUtc: data.startDate,
        expiresAtUtc: data.endDate,
      }),
    onSuccess: (data) => {
      setGeneratedKey(data.key ?? data.accessKey);
      queryClient.invalidateQueries({ queryKey: ['accessKeys'] });
      toast.success('Access key generated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to generate access key');
    },
  });

  const handlePublicUserIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');

    if (!value.startsWith('MD-') && value.length > 0) {
      value = 'MD-' + value.replace(/^MD-?/, '');
    }

    if (value.length > 7 && value[7] !== '-') {
      value = value.slice(0, 7) + '-' + value.slice(7);
    }
    if (value.length > 12 && value[12] !== '-') {
      value = value.slice(0, 12) + '-' + value.slice(12);
    }

    value = value.slice(0, 17);
    setFormData((prev) => ({ ...prev, clientPublicUserId: value }));
  };

  const isValidPublicUserId = (id: string) => {
    return /^MD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'generate') {
      if (!isValidPublicUserId(formData.clientPublicUserId)) {
        toast.error('Invalid User ID format. Format: MD-XXXX-XXXX-XX');
        return;
      }
      generateMutation.mutate(formData);
    }
  };

  const handleCopy = async () => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      toast.success('Access key copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setFormData({ clientPublicUserId: '', startDate: '', endDate: '' });
    setGeneratedKey(null);
    setCopied(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} Access Key`}>
      <div className="p-6">
        {generatedKey ? (
          <div className="space-y-4">
            <div className="p-4 bg-action/10 border border-action/20 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Generated Access Key:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-lg font-semibold text-action break-all">
                  {generatedKey}
                </code>
                <Button
                  variant="ghost"
                  onClick={handleCopy}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-action" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Make sure to copy this key now. You won't be able to see it again!
            </p>
            <Button variant="primary" onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'generate' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Client ID (MD-XXXX-XXXX-XX)
                  </label>
                  <input
                    type="text"
                    value={formData.clientPublicUserId}
                    onChange={handlePublicUserIdChange}
                    placeholder="MD-"
                    className={`w-full p-2 border border-border rounded-lg font-mono bg-background text-foreground ${initialClientId ? 'bg-muted cursor-not-allowed opacity-80' : ''
                      }`}
                    required
                    disabled={!!initialClientId}
                  />
                  {formData.clientPublicUserId &&
                    !isValidPublicUserId(formData.clientPublicUserId) && (
                      <p className="text-sm text-destructive mt-1">
                        Invalid format. Example: MD-A1B2-C3D4-E5
                      </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Start Date"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    required
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="action"
                  disabled={generateMutation.isPending}
                  className="w-full"
                >
                  {generateMutation.isPending ? 'Generating...' : 'Generate Access Key'}
                </Button>
              </>
            )}

            {mode === 'extend' && existingKey && (
              <>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Current Key:</p>
                  <code className="font-mono text-sm">{existingKey.key}</code>
                  <p className="text-sm text-muted-foreground mt-2">
                    Current Expiry: {existingKey.endDate}
                  </p>
                </div>

                <Input
                  label="New End Date"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                  required
                />

                <Button type="submit" variant="action" className="w-full">
                  Extend Access Key
                </Button>
              </>
            )}

            {mode === 'revoke' && existingKey && (
              <>
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium mb-2">Warning</p>
                  <p className="text-sm text-muted-foreground">
                    Revoking this access key will immediately prevent the client from accessing
                    their account. This action cannot be undone.
                  </p>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Key to Revoke:</p>
                  <code className="font-mono text-sm">{existingKey.key}</code>
                </div>

                <Button type="submit" variant="danger" className="w-full">
                  Revoke Access Key
                </Button>
              </>
            )}
          </form>
        )}
      </div>
    </Modal>
  );
}
