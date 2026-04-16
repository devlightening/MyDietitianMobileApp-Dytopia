using System;
using System.Collections.Generic;
using System.Linq;

namespace MyDietitianMobileApp.Domain.Entities
{
    public class Ingredient
    {
        public Guid Id { get; private set; }
        public string CanonicalName { get; private set; }
        public IReadOnlyCollection<string> Aliases => _aliases.AsReadOnly();
        public bool IsActive { get; private set; }

        /// <summary>
        /// True for pantry helpers (oils, salt, spices, sauces, vinegar, etc.).
        /// These ingredients contribute to a recipe score but cannot be the sole
        /// proof of a meaningful "full match" in the recommendation engine.
        /// </summary>
        public bool IsCondiment { get; private set; }

        public void SetIsCondiment(bool isCondiment) => IsCondiment = isCondiment;
        
        // Legacy fields - kept for backward compatibility, but should not be used in new code
        // These are recipe-specific, not ingredient-specific
        [Obsolete("Use Recipe-Ingredient relationship instead")]
        public string Name { get; private set; }
        
        [Obsolete("Use Recipe-Ingredient relationship instead")]
        public bool IsMandatory { get; private set; }
        
        [Obsolete("Use Recipe-Ingredient relationship instead")]
        public bool IsProhibited { get; private set; }

        private readonly List<string> _aliases = new();

        // New constructor for canonical ingredients
        public Ingredient(Guid id, string canonicalName, bool isActive = true)
        {
            Id = id;
            CanonicalName = canonicalName;
            IsActive = isActive;
            
            // Initialize legacy fields with defaults for backward compatibility
            Name = canonicalName;
            IsMandatory = false;
            IsProhibited = false;
        }

        // Legacy constructor - kept for backward compatibility
        [Obsolete("Use Ingredient(id, canonicalName, isActive) instead")]
        public Ingredient(Guid id, string name, bool isMandatory, bool isProhibited)
        {
            if (isMandatory && isProhibited)
                throw new ArgumentException("Ingredient cannot be both mandatory and prohibited.");
            Id = id;
            Name = name;
            CanonicalName = name; // Map to canonical name for backward compatibility
            IsMandatory = isMandatory;
            IsProhibited = isProhibited;
            IsActive = true;
        }

        public void AddAlias(string alias)
        {
            if (string.IsNullOrWhiteSpace(alias))
                return;
            
            var normalizedAlias = alias.Trim();
            if (normalizedAlias.Equals(CanonicalName, StringComparison.OrdinalIgnoreCase))
                return; // Don't add canonical name as alias
            
            if (!_aliases.Contains(normalizedAlias, StringComparer.OrdinalIgnoreCase))
                _aliases.Add(normalizedAlias);
        }

        public void ClearAliases()
        {
            _aliases.Clear();
        }

        public void UpdateCanonicalName(string canonicalName)
        {
            if (string.IsNullOrWhiteSpace(canonicalName))
                throw new ArgumentException("Canonical name cannot be null or empty.", nameof(canonicalName));
            
            CanonicalName = canonicalName.Trim();
        }

        public void SetIsActive(bool isActive)
        {
            IsActive = isActive;
        }

        public bool Matches(string searchTerm)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
                return false;

            var normalized = searchTerm.Trim();
            var comparison = StringComparison.OrdinalIgnoreCase;

            return CanonicalName.Contains(normalized, comparison) ||
                   _aliases.Any(alias => alias.Contains(normalized, comparison));
        }

        public override bool Equals(object obj)
        {
            if (obj is not Ingredient other) return false;
            return Id == other.Id;
        }
        
        public override int GetHashCode() => Id.GetHashCode();
    }
}
