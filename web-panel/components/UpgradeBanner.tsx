import { isPremiumRequired, getPremiumErrorMessage } from '@/lib/premium-utils';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface UpgradeBannerProps {
  error: any;
  onUpgrade?: () => void;
}

export function UpgradeBanner({ error, onUpgrade }: UpgradeBannerProps) {
  if (!isPremiumRequired(error)) return null;

  return (
    <Card className="p-6 border-yellow-200 bg-yellow-50">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-yellow-900 mb-1">
            Premium Özellik
          </h3>
          <p className="text-sm text-yellow-800 mb-4">
            {getPremiumErrorMessage(error)}
          </p>
          {onUpgrade && (
            <Button
              onClick={onUpgrade}
              variant="primary"
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Premium'a Yükselt
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
