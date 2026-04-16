'use client';

import { X } from 'lucide-react';

const PROHIBITIONS = [
  'Dairy',
  'Eggs',
  'Fish',
  'Shellfish',
  'Tree Nuts',
  'Peanuts',
  'Wheat',
  'Soybeans',
  'Sesame',
  'Gluten',
  'Lactose',
  'Meat',
  'Pork',
  'Beef',
  'Chicken',
];

interface RecipeProhibitionsInputProps {
  value: string[];
  onChange: (prohibitions: string[]) => void;
}

export function RecipeProhibitionsInput({ value, onChange }: RecipeProhibitionsInputProps) {
  const toggleProhibition = (prohibition: string) => {
    if (value.includes(prohibition)) {
      onChange(value.filter((p) => p !== prohibition));
    } else {
      onChange([...value, prohibition]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Prohibitions & Allergens</label>
      <p className="text-xs text-muted-foreground">
        Select ingredients or allergens that this recipe contains
      </p>

      {/* Selected Prohibitions */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {value.map((prohibition) => (
            <span
              key={prohibition}
              className="inline-flex items-center gap-1 px-3 py-1 bg-destructive/10 text-destructive rounded-full text-sm font-medium"
            >
              {prohibition}
              <button
                type="button"
                onClick={() => toggleProhibition(prohibition)}
                className="hover:bg-destructive/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Prohibition Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {PROHIBITIONS.map((prohibition) => {
          const isSelected = value.includes(prohibition);
          return (
            <button
              key={prohibition}
              type="button"
              onClick={() => toggleProhibition(prohibition)}
              className={`px-3 py-2 text-sm rounded-lg border transition-all ${isSelected
                  ? 'bg-destructive/10 border-destructive text-destructive font-medium'
                  : 'border-border hover:bg-muted text-foreground'
                }`}
            >
              {prohibition}
            </button>
          );
        })}
      </div>
    </div>
  );
}
