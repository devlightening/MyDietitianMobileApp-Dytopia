'use client';

import { Card } from '@/components/ui/Card';
import { useQuery } from '@tanstack/react-query';
import { getActivityFeed, ActivityFeedItem } from '@/lib/api/dashboard';
import {
  User,
  Utensils,
  Weight,
  Calendar,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

function getActivityIcon(type: ActivityFeedItem['type']) {
  switch (type) {
    case 'login':
      return User;
    case 'meal_logged':
      return Utensils;
    case 'weight_update':
      return Weight;
    case 'plan_assigned':
      return Calendar;
    case 'compliance':
      return CheckCircle2;
    default:
      return Clock;
  }
}

function getActivityColor(type: ActivityFeedItem['type']) {
  switch (type) {
    case 'login':
      return 'bg-primary/10 text-primary';
    case 'meal_logged':
      return 'bg-accent/10 text-accent';
    case 'weight_update':
      return 'bg-action/10 text-action';
    case 'plan_assigned':
      return 'bg-primary/10 text-primary';
    case 'compliance':
      return 'bg-action/10 text-action';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getActivityDescription(activity: ActivityFeedItem): string {
  switch (activity.type) {
    case 'login':
      return 'logged in to the app';
    case 'meal_logged':
      return `logged meal: ${activity.metadata?.mealName || 'Unknown'}`;
    case 'weight_update':
      return `updated weight to ${activity.metadata?.weight || 0} kg`;
    case 'plan_assigned':
      return `was assigned plan: ${activity.metadata?.planName || 'Unknown'}`;
    case 'compliance':
      return `compliance rate: ${activity.metadata?.complianceRate || 0}%`;
    default:
      return 'performed an action';
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ActivityFeed() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () => getActivityFeed(15),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Live Activity Feed</h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-action animate-pulse" />
          <span className="text-sm text-muted-foreground">Live</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : !activities || activities.length === 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded">
              Sample Data
            </span>
            <p className="text-[10px] text-muted-foreground italic">Showing sample activity while feed is empty</p>
          </div>
          {[
            { id: 's1', clientName: 'Ali Yılmaz', type: 'meal_logged', timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), metadata: { mealName: 'Tavuklu Salata' } },
            { id: 's2', clientName: 'Ayşe Demir', type: 'weight_update', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), metadata: { weight: 64.2 } },
            { id: 's3', clientName: 'Mehmet Can', type: 'compliance', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), metadata: { complianceRate: 92 } },
            { id: 's4', clientName: 'Zeynep Kaya', type: 'plan_assigned', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), metadata: { planName: 'Kilo Verme Programı' } },
            { id: 's5', clientName: 'Fatma Şahin', type: 'meal_logged', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), metadata: { mealName: 'Yulaf Ezmesi' } }
          ].map((activity) => {
            const Icon = getActivityIcon(activity.type as any);
            const colorClass = getActivityColor(activity.type as any);

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors border border-transparent hover:border-border/50"
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', colorClass)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{activity.clientName}</span>{' '}
                    <span className="text-muted-foreground">
                      {getActivityDescription(activity as any)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {activities.map((activity) => {
            const Icon = getActivityIcon(activity.type);
            const colorClass = getActivityColor(activity.type);

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', colorClass)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{activity.clientName}</span>{' '}
                    <span className="text-muted-foreground">
                      {getActivityDescription(activity)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
