'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const AVAILABLE_TAGS = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Low-Carb',
  'High-Protein',
  'Keto',
  'Paleo',
  'Mediterranean',
  'Quick',
  'Easy',
];

interface RecipeTagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function RecipeTagsInput({ value, onChange }: RecipeTagsInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = AVAILABLE_TAGS.filter(
    (tag) =>
      !value.includes(tag) &&
      tag.toLowerCase().includes(inputValue.toLowerCase())
  );

  const addTag = (tag: string) => {
    if (!value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Recipe Tags</label>

      {/* Selected Tags */}
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:bg-primary/20 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Input with Suggestions */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Type to add tags..."
          className="w-full p-2 border border-border rounded-lg bg-background text-foreground"
        />

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredSuggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Add Buttons */}
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_TAGS.filter((tag) => !value.includes(tag))
          .slice(0, 5)
          .map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="px-2 py-1 text-xs border border-border rounded-md hover:bg-muted transition-colors"
            >
              + {tag}
            </button>
          ))}
      </div>
    </div>
  );
}
