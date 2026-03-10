"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  getClientById,
  getClientActivities,
  getClientMeasurements,
  getClientNotes,
  addClientNote,
} from '@/lib/api/clients';
import { ComplianceDonut } from '@/components/clients/ComplianceDonut';
import { ClientTabs } from '@/components/clients/ClientTabs';
import { MeasurementsChart } from '@/components/clients/MeasurementsChart';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import {
  ArrowLeft,
  User,
  Activity,
  Scale,
  Calendar,
  FileText,
  Utensils,
  Weight,
  LogIn,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const clientId = params.clientId as string;

  const [activeTab, setActiveTab] = useState('overview');
  const [noteContent, setNoteContent] = useState('');

  // Fetch client data
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client-detail', clientId],
    queryFn: () => getClientById(clientId),
  });

  const { data: activitiesData } = useQuery({
    queryKey: ['client-activities', clientId],
    queryFn: () => getClientActivities(clientId),
    enabled: activeTab === 'activities',
  });

  const { data: measurementsData } = useQuery({
    queryKey: ['client-measurements', clientId],
    queryFn: () => getClientMeasurements(clientId),
    enabled: activeTab === 'measurements',
    retry: 0, // Don't retry on error to avoid console spam
    refetchOnWindowFocus: false,
  });

  const { data: notesData } = useQuery({
    queryKey: ['client-notes', clientId],
    queryFn: () => getClientNotes(clientId),
    enabled: activeTab === 'notes',
    retry: 0, // Don't retry on error to avoid console spam
    refetchOnWindowFocus: false,
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => addClientNote(clientId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', clientId] });
      setNoteContent('');
    },
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <User className="w-4 h-4" /> },
    { id: 'activities', label: 'Activities', icon: <Activity className="w-4 h-4" /> },
    { id: 'measurements', label: 'Measurements', icon: <Scale className="w-4 h-4" /> },
    { id: 'plan', label: 'Plan', icon: <Calendar className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes', icon: <FileText className="w-4 h-4" /> },
  ];

  if (clientLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Card className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-4 w-32" />
        </Card>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Client not found</p>
      </div>
    );
  }

  const activities = activitiesData?.activities || [];
  const measurements = measurementsData?.measurements || [];
  const notes = notesData?.notes || [];

  // Mock compliance rate - in real app this would come from API
  const complianceRate = 75;

  function getActivityIcon(type: string) {
    switch (type) {
      case 'meal_logged':
        return <Utensils className="w-5 h-5" />;
      case 'weight_update':
        return <Weight className="w-5 h-5" />;
      case 'login':
        return <LogIn className="w-5 h-5" />;
      case 'plan_assigned':
        return <Calendar className="w-5 h-5" />;
      default:
        return <CheckCircle2 className="w-5 h-5" />;
    }
  }

  function getActivityDescription(activity: any): string {
    switch (activity.type) {
      case 'meal_logged':
        return `Logged meal: ${activity.metadata?.mealName || 'Unknown'}`;
      case 'weight_update':
        return `Updated weight to ${activity.metadata?.weight || 0} kg`;
      case 'login':
        return 'Logged in to the app';
      case 'plan_assigned':
        return `Assigned plan: ${activity.metadata?.planName || 'Unknown'}`;
      default:
        return 'Performed an action';
    }
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/clients')}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </Button>

      {/* Client Header */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{client.fullName}</h1>
            <p className="text-sm text-muted-foreground mt-1">ID: {client.publicUserId}</p>
            {client.email && (
              <p className="text-sm text-muted-foreground">{client.email}</p>
            )}
          </div>
          <div className={cn(
            'px-3 py-1 rounded-full text-sm font-medium',
            client.isPremium
              ? 'bg-action/10 text-action'
              : 'bg-muted text-muted-foreground'
          )}>
            {client.isPremium ? 'Premium' : 'Free'}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <ClientTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Compliance Donut */}
            <Card className="p-6 flex flex-col items-center justify-center">
              <ComplianceDonut percentage={complianceRate} />
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Last 7 days compliance rate
              </p>
            </Card>

            {/* Quick Stats */}
            <Card className="p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold text-foreground mb-4">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Weight</p>
                  <p className="text-2xl font-bold text-foreground">
                    {client.latestWeight?.toFixed(1) || '--'} kg
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">BMI</p>
                  <p className="text-2xl font-bold text-foreground">
                    {client.latestBmi?.toFixed(1) || '--'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Height</p>
                  <p className="text-2xl font-bold text-foreground">
                    {client.latestHeight?.toFixed(0) || '--'} cm
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">BMR</p>
                  <p className="text-2xl font-bold text-foreground">
                    {client.latestBmr?.toFixed(0) || '--'} kcal
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'activities' && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Activity Timeline</h3>
            {activities.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No activities yet</p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">
                        {getActivityDescription(activity)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'measurements' && (
          <MeasurementsChart measurements={measurements} />
        )}

        {activeTab === 'plan' && (
          <Card className="p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Active Plan</h3>
            <p className="text-sm text-muted-foreground mb-6">
              This client doesn't have an active meal plan yet
            </p>
            <Button variant="action">Assign Plan</Button>
          </Card>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-6">
            {/* Add Note Form */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Add Note</h3>
              <div className="flex gap-3">
                <Input
                  placeholder="Write a note about this client..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="action"
                  onClick={() => addNoteMutation.mutate(noteContent)}
                  disabled={!noteContent.trim() || addNoteMutation.isPending}
                >
                  Add Note
                </Button>
              </div>
            </Card>

            {/* Notes List */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Notes History</h3>
              {notes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No notes yet</p>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-4 rounded-lg bg-muted/30 border border-border"
                    >
                      <p className="text-sm text-foreground">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(note.createdAt).toLocaleString()} • {note.createdBy}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
