'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, X, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { useClients } from '@/hooks/useClients';
import { useCreateDietPlan } from '@/hooks/useDietPlans';
import { createDietPlanSchema, type CreateDietPlanFormData } from '@/lib/validations/diet-plan';
import { MealType } from '@/lib/types/diet-plan';
import api from '@/lib/api';

interface Recipe {
  id: string;
  name: string;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CreateDietPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');

  const [step, setStep] = useState(1);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const { clients, isLoading: loadingClients } = useClients();
  const createMutation = useCreateDietPlan();

  const form = useForm<CreateDietPlanFormData>({
    resolver: zodResolver(createDietPlanSchema),
    defaultValues: {
      clientId: preselectedClientId || '',
      name: '',
      startDate: '',
      endDate: '',
      days: [],
    },
  });

  const { fields: days, replace: replaceDays } = useFieldArray({
    control: form.control,
    name: 'days',
  });

  // Fetch recipes when component mounts
  useEffect(() => {
    const fetchRecipes = async () => {
      setLoadingRecipes(true);
      try {
        const response = await api.get<any>('/api/recipes');
        setRecipes(response.data?.map((r: any) => ({ id: r.id, name: r.name })) || []);
      } catch (error) {
        console.error('Failed to fetch recipes:', error);
        toast.error('Failed to load recipes');
      } finally {
        setLoadingRecipes(false);
      }
    };
    fetchRecipes();
  }, []);

  const handleNext = async () => {
    let fieldsToValidate: any[] = [];

    if (step === 1) {
      fieldsToValidate = ['clientId'];
    } else if (step === 2) {
      fieldsToValidate = ['name', 'startDate', 'endDate'];

      // Generate days when moving from step 2 to 3
      const startDate = form.getValues('startDate');
      const endDate = form.getValues('endDate');

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        const generatedDays = Array.from({ length: dayCount }, (_, i) => {
          const date = new Date(start);
          date.setDate(start.getDate() + i);

          return {
            date: toDateInputValue(date),
            dailyTargetCalories: undefined,
            meals: [
              { type: MealType.Breakfast, plannedRecipeId: '', customName: '', isMandatory: false },
              { type: MealType.Lunch, plannedRecipeId: '', customName: '', isMandatory: false },
              { type: MealType.Dinner, plannedRecipeId: '', customName: '', isMandatory: false },
            ],
          };
        });

        replaceDays(generatedDays);
      }
    }

    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      const result = await createMutation.mutateAsync(data as any);
      if (result.success) {
        router.push(`/dashboard/diet-plans/${data.clientId}`);
      }
    } catch (error) {
      // Error handling is in the hook
    }
  });

  if (loadingClients) {
    return <div className="p-8"><div className="max-w-4xl mx-auto">Loading...</div></div>;
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-3xl font-bold text-foreground">Create Diet Plan</h1>
          <p className="text-muted-foreground mt-2">Set up a new diet plan for your client</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${step >= s
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted bg-background text-muted-foreground'
                  }`}>
                  {s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 ${step > s ? 'bg-primary' : 'bg-muted'
                    }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-muted-foreground">Select Client</span>
            <span className="text-sm text-muted-foreground">Plan Duration</span>
            <span className="text-sm text-muted-foreground">Meal Builder</span>
          </div>
        </div>

        {/* Wizard Content */}
        <div className="bg-card border border-border rounded-lg p-8">
          {step === 1 && (
            <Step1ClientSelection
              form={form}
              clients={clients}
              onNext={handleNext}
            />
          )}
          {step === 2 && (
            <Step2PlanDuration
              form={form}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {step === 3 && (
            <Step3MealBuilder
              form={form}
              days={days}
              recipes={recipes}
              loadingRecipes={loadingRecipes}
              onBack={handleBack}
              onSubmit={handleSubmit}
              isSubmitting={createMutation.isLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Step 1: Client Selection
function Step1ClientSelection({ form, clients, onNext }: any) {
  const selectedClientId = form.watch('clientId');
  const selectedClient = clients.find((c: any) => c.clientId === selectedClientId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Select Client</h2>
        <p className="text-muted-foreground mt-1">Choose which client this diet plan is for</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Client *</label>
        <select
          {...form.register('clientId')}
          className="w-full px-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Select a client...</option>
          {clients.map((client: any) => (
            <option key={client.clientId} value={client.clientId}>
              {client.clientName}
            </option>
          ))}
        </select>
        {form.formState.errors.clientId && (
          <p className="text-sm text-destructive mt-1">{form.formState.errors.clientId.message}</p>
        )}
      </div>

      {selectedClient && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium">Creating plan for: {selectedClient.clientName}</p>
              <p className="mt-1 text-blue-700 dark:text-blue-300">
                This will create a new diet plan. If the client has an existing active plan, it will be expired.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!selectedClientId}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Step 2: Plan Duration
function Step2PlanDuration({ form, onNext, onBack }: any) {
  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');

  const dayCount = startDate && endDate
    ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Plan Duration</h2>
        <p className="text-muted-foreground mt-1">Set the start and end dates for this plan</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Plan Name *</label>
        <input
          {...form.register('name')}
          type="text"
          placeholder="e.g., Weekly Meal Plan"
          className="w-full px-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-2">Start Date *</label>
          <input
            {...form.register('startDate')}
            type="date"
            className="w-full px-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {form.formState.errors.startDate && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.startDate.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">End Date *</label>
          <input
            {...form.register('endDate')}
            type="date"
            className="w-full px-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {form.formState.errors.endDate && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.endDate.message}</p>
          )}
        </div>
      </div>

      {dayCount > 0 && (
        <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-green-900 dark:text-green-100">
            <CalendarIcon className="w-4 h-4" />
            <span>This plan will span <strong>{dayCount} days</strong></span>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-muted text-foreground rounded-md hover:bg-muted/80"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!startDate || !endDate || dayCount <= 0}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// Step 3: Meal Builder
function Step3MealBuilder({ form, days, recipes, loadingRecipes, onBack, onSubmit, isSubmitting }: any) {
  const getMealTypeLabel = (type: MealType) => {
    switch (type) {
      case MealType.Breakfast: return 'Breakfast';
      case MealType.Lunch: return 'Lunch';
      case MealType.Dinner: return 'Dinner';
      case MealType.Snack: return 'Snack';
      default: return 'Meal';
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Meal Builder</h2>
        <p className="text-muted-foreground mt-1">Assign meals for each day</p>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {days.map((day: any, dayIndex: number) => (
          <DayMealCard
            key={day.id}
            day={day}
            dayIndex={dayIndex}
            form={form}
            recipes={recipes}
            getMealTypeLabel={getMealTypeLabel}
          />
        ))}
      </div>

      {days.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No days configured. Please go back and set the date range.
        </div>
      )}

      <div className="flex justify-between pt-4 border-t">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 bg-muted text-foreground rounded-md hover:bg-muted/80"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isSubmitting || days.length === 0}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Plan'}
        </button>
      </div>
    </form>
  );
}

// Day Meal Card Component
function DayMealCard({ day, dayIndex, form, recipes, getMealTypeLabel }: any) {
  const date = new Date(day.date);
  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="p-4 border border-border rounded-lg">
      <h3 className="font-semibold mb-1">Day {dayIndex + 1}</h3>
      <p className="text-sm text-muted-foreground mb-3">{formattedDate}</p>

      <div className="space-y-3">
        {day.meals?.map((meal: any, mealIndex: number) => (
          <div key={mealIndex} className="p-3 bg-muted/30 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{getMealTypeLabel(meal.type)}</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...form.register(`days.${dayIndex}.meals.${mealIndex}.isMandatory`)}
                  className="rounded"
                />
                <span className="text-muted-foreground">Mandatory</span>
              </label>
            </div>

            <select
              {...form.register(`days.${dayIndex}.meals.${mealIndex}.plannedRecipeId`)}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
            >
              <option value="">Select recipe...</option>
              {recipes.map((recipe: Recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>

            <p className="text-xs text-muted-foreground italic">
              Client may receive automatic alternatives based on available ingredients.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
