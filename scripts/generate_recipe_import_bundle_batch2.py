from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Callable, Iterable, TypeVar

import generate_recipe_import_bundle as base


T = TypeVar("T")

ROOT = base.ROOT
BATCH_LABEL = "Batch2"
RECIPE_INDEX_START = 50
RECIPES_PER_DIETITIAN = 50

NEW_RECIPES_PATH = ROOT / f"NewRecieps_{BATCH_LABEL}.csv"
NEW_INGREDIENTS_PATH = ROOT / f"NewIngredients_{BATCH_LABEL}.csv"
MISSING_INGREDIENTS_PATH = ROOT / f"NewIngredients_MissingOnly_{BATCH_LABEL}.csv"
NEW_RECIPE_INGREDIENTS_PATH = ROOT / f"NewRecipeIngredients_{BATCH_LABEL}.csv"


def append_unique(items: list[T], additions: Iterable[T], key: Callable[[T], str]) -> None:
    known = {key(item) for item in items}
    for addition in additions:
        marker = key(addition)
        if marker in known:
            continue
        items.append(addition)
        known.add(marker)


def extend_catalog() -> None:
    append_unique(
        base.PROFILES,
        [
            base.Profile("Türk Sofrası Hafifliği", "Türk mutfağı ilhamlı", "ev tipi denge ve sürdürülebilir porsiyon kontrolü", "türk mutfağı", "tanıdık ama hafif"),
            base.Profile("İtalyan Esintisi", "İtalyan dokunuşlu", "dengeli karbonhidrat ve ölçülü protein uyumu", "italyan esintisi", "aromatik ve dengeli"),
            base.Profile("Asya Denge Kasesi", "Asya esintili", "sebze yoğunluğu ve hafif sos dengesi", "asya esintisi", "ferah ve canlı"),
            base.Profile("Orta Doğu Mezze", "Orta Doğu ilhamlı", "baklagil, tahin ve taze ot dengesi", "mezze", "baharatlı ve paylaşılabilir"),
            base.Profile("Latin Enerji Tabağı", "Latin esintili", "yüksek enerji günlerinde kontrollü tokluk", "latin esintisi", "renkli ve güçlü"),
            base.Profile("İskandinav Ferahlığı", "İskandinav ilhamlı", "temiz içerik ve hafif yağ dengesi", "iskandinav", "sade ve taze"),
        ],
        lambda item: item.title,
    )

    append_unique(
        base.PROTEINS,
        [
            base.IngredientDef("Karides", "karidesli", 23, 1, 2, ("deniz ürünü", "yüksek protein"), ("shrimp", "prawn", "prawns")),
            base.IngredientDef("Hellim Peyniri", "hellimli", 21, 2, 18, ("peynir", "yüksek protein"), ("halloumi", "halloumi cheese")),
            base.IngredientDef("Falafel", "falafelli", 14, 22, 8, ("baklagil", "orta doğu"), ("falafel",)),
        ],
        lambda item: item.name,
    )

    append_unique(
        base.GRAINS,
        [
            base.IngredientDef("Kuskus", "kuskuslu", 4, 31, 1, ("akdeniz", "kompleks karbonhidrat"), ("couscous",)),
            base.IngredientDef("Basmati Pirinç", "basmati pirinçli", 4, 33, 1, ("pirinç", "ölçülü karbonhidrat"), ("basmati rice",)),
            base.IngredientDef("Pirinç Eriştesi", "pirinç erişteli", 3, 30, 1, ("asya esintisi",), ("rice noodles", "rice noodle")),
        ],
        lambda item: item.name,
    )

    append_unique(
        base.VEGETABLES,
        [
            base.IngredientDef("Kırmızı Lahana", "kırmızı lahanalı", 2, 6, 0.2, ("renkli sebze", "lif"), ("red cabbage",)),
            base.IngredientDef("Roka", "rokalı", 2, 3, 0.4, ("yeşillik", "ferah"), ("arugula", "rocket")),
            base.IngredientDef("Edamame", "edamameli", 11, 10, 5, ("bitkisel protein",), ("edamame",)),
            base.IngredientDef("Baby Mısır", "baby mısırlı", 2, 8, 0.4, ("asya esintisi",), ("baby corn",)),
            base.IngredientDef("Pak Choi", "pak choili", 2, 3, 0.2, ("asya esintisi",), ("bok choy", "pak choi")),
        ],
        lambda item: item.name,
    )

    append_unique(
        base.FRUITS,
        [
            base.IngredientDef("Mango", "mangolu", 1, 15, 0.4, ("tropik",), ("mango",)),
            base.IngredientDef("Ananas", "ananaslı", 1, 13, 0.2, ("tropik",), ("pineapple",)),
        ],
        lambda item: item.name,
    )

    append_unique(
        base.SPREADS,
        [
            base.IngredientDef("Muhammara", "muhammaralı", 4, 10, 9, ("orta doğu", "ezme"), ("muhammara",)),
            base.IngredientDef("Pesto Sos", "pestolu", 3, 4, 11, ("italyan", "sos"), ("pesto", "pesto sauce"), True),
            base.IngredientDef("Salsa Fresca", "salsalı", 1, 5, 1, ("latin esintisi", "sos"), ("salsa fresca", "salsa"), True),
            base.IngredientDef("Cacık Sosu", "cacık soslu", 4, 4, 3, ("türk mutfağı", "ferah"), ("tzatziki", "cacik sauce"), True),
        ],
        lambda item: item.name,
    )

    append_unique(
        base.TOPPERS,
        [
            base.IngredientDef("Susam", "susamlı", 3, 2, 7, ("aroma",), ("sesame", "sesame seeds")),
            base.IngredientDef("Antep Fıstığı", "antep fıstıklı", 4, 5, 9, ("aroma", "sağlıklı yağ"), ("pistachio", "pistachios")),
        ],
        lambda item: item.name,
    )

    append_unique(
        base.BREADS,
        [
            base.IngredientDef("Tam Tahıllı Tortilla", "tortillalı", 6, 28, 4, ("taşınabilir", "dünya mutfağı"), ("whole grain tortilla", "whole wheat tortilla")),
        ],
        lambda item: item.name,
    )

    append_unique(
        base.FLAVORINGS,
        [
            base.IngredientDef("Köri", "köri dokunuşlu", 0, 1, 0, ("aroma", "dünya mutfağı"), ("curry",), True),
            base.IngredientDef("Teriyaki Sosu", "teriyaki soslu", 1, 4, 0, ("asya esintisi", "sos"), ("teriyaki", "teriyaki sauce"), True),
            base.IngredientDef("Soya Sosu", "soya soslu", 1, 1, 0, ("asya esintisi", "sos"), ("soy sauce",), True),
            base.IngredientDef("Harissa", "harissalı", 0, 2, 1, ("baharatlı",), ("harissa",), True),
            base.IngredientDef("Nar Ekşisi", "nar ekşili", 0, 3, 0, ("türk mutfağı", "ekşi"), ("pomegranate molasses",), True),
            base.IngredientDef("Acuka", "acukalı", 1, 3, 2, ("türk mutfağı", "ezme"), ("acuka",), True),
        ],
        lambda item: item.name,
    )


def merge_ingredient_catalog(
    path: Path,
    rows: list[dict[str, str]],
    lookup: dict[str, dict[str, str]],
    existing_ids: set[str],
) -> None:
    if not path.exists():
        return

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for raw_row in reader:
            ingredient_id = (raw_row.get("Id") or "").strip()
            if not ingredient_id or ingredient_id in existing_ids:
                continue

            canonical = (raw_row.get("CanonicalName") or raw_row.get("Name") or "").strip()
            aliases_text = (raw_row.get("Aliases") or "").strip()
            try:
                aliases = json.loads(aliases_text) if aliases_text and aliases_text != "NULL" else []
            except json.JSONDecodeError:
                aliases = []

            enriched_aliases = base.build_aliases(canonical, [*aliases])
            row = {
                "Id": ingredient_id,
                "Name": (raw_row.get("Name") or canonical).strip(),
                "IsMandatory": (raw_row.get("IsMandatory") or "False").strip() or "False",
                "IsProhibited": (raw_row.get("IsProhibited") or "False").strip() or "False",
                "CanonicalName": canonical,
                "Aliases": enriched_aliases,
                "IsActive": (raw_row.get("IsActive") or "True").strip() or "True",
                "IsCondiment": (raw_row.get("IsCondiment") or "False").strip() or "False",
            }
            rows.append(row)
            existing_ids.add(ingredient_id)
            for alias in json.loads(enriched_aliases):
                lookup[base.normalize_ascii(alias)] = row


def load_existing_ingredients() -> tuple[list[dict[str, str]], dict[str, dict[str, str]], set[str]]:
    rows, lookup, existing_ids = base.load_existing_ingredients()
    for path in [ROOT / "NewIngredients.csv", ROOT / "NewIngredients_Batch2.csv", ROOT / "NewIngredients_MissingOnly.csv"]:
        merge_ingredient_catalog(path, rows, lookup, existing_ids)
    return rows, lookup, existing_ids


def load_existing_recipe_names() -> set[str]:
    names: set[str] = set()
    for path in [ROOT / "NewRecieps.csv", NEW_RECIPES_PATH]:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                name = (row.get("Name") or "").strip()
                if name:
                    names.add(name)
    return names


def main() -> None:
    extend_catalog()

    existing_rows, existing_lookup, _ = load_existing_ingredients()
    all_ingredient_rows = list(existing_rows)
    added_ingredient_rows: list[dict[str, str]] = []
    created_names: set[str] = set()

    recipes: list[dict[str, str]] = []
    recipe_ingredients: list[dict[str, str]] = []
    used_recipe_names = load_existing_recipe_names()
    base_timestamp = base.datetime(2026, 4, 20, 8, 0, 0, tzinfo=base.timezone.utc)

    for dietitian_index, dietitian in enumerate(base.DIETITIANS):
        for recipe_index in range(RECIPE_INDEX_START, RECIPE_INDEX_START + RECIPES_PER_DIETITIAN):
            recipe = base.make_recipe(recipe_index, dietitian_index, dietitian, used_recipe_names)
            uses: list[base.IngredientUse] = recipe.pop("_uses")
            recipes.append(recipe)

            for use_index, usage in enumerate(uses):
                ingredient_row = base.resolve_ingredient_row(
                    usage.ingredient,
                    existing_lookup,
                    all_ingredient_rows,
                    added_ingredient_rows,
                    created_names,
                )
                created_at = base_timestamp + base.timedelta(minutes=len(recipe_ingredients) * 3 + use_index)
                recipe_ingredient_id = base.uuid.uuid5(
                    base.RECIPE_INGREDIENT_NAMESPACE,
                    f"{recipe['Id']}:{ingredient_row['Id']}:{usage.role}:{use_index}",
                )
                recipe_ingredients.append(
                    {
                        "Id": str(recipe_ingredient_id),
                        "RecipeId": recipe["Id"],
                        "IngredientId": ingredient_row["Id"],
                        "Role": usage.role,
                        "Quantity": usage.quantity,
                        "Unit": usage.unit,
                        "CreatedAtUtc": base.format_timestamp(created_at),
                    }
                )

    base.validate(recipes, all_ingredient_rows, recipe_ingredients)

    recipe_fields = [
        "Id",
        "DietitianId",
        "Name",
        "Description",
        "IsPublic",
        "IsDemo",
        "IsDraft",
        "IsHiddenFromProduction",
        "StepsJson",
        "ArchivedAtUtc",
        "CookTimeMinutes",
        "IsArchived",
        "PrepTimeMinutes",
        "Servings",
        "TagsJson",
        "Slug",
        "CaloriesKcal",
        "CarbsGrams",
        "FatGrams",
        "ProteinGrams",
    ]
    ingredient_fields = ["Id", "Name", "IsMandatory", "IsProhibited", "CanonicalName", "Aliases", "IsActive", "IsCondiment"]
    recipe_ingredient_fields = ["Id", "RecipeId", "IngredientId", "Role", "Quantity", "Unit", "CreatedAtUtc"]

    base.write_csv(NEW_RECIPES_PATH, recipe_fields, [{key: row[key] for key in recipe_fields} for row in recipes])
    base.write_csv(NEW_INGREDIENTS_PATH, ingredient_fields, [{key: row[key] for key in ingredient_fields} for row in all_ingredient_rows])
    base.write_csv(
        MISSING_INGREDIENTS_PATH,
        ingredient_fields,
        [{key: row[key] for key in ingredient_fields} for row in added_ingredient_rows],
    )
    base.write_csv(NEW_RECIPE_INGREDIENTS_PATH, recipe_ingredient_fields, recipe_ingredients)

    print(
        json.dumps(
            {
                "batch": BATCH_LABEL,
                "recipes": len(recipes),
                "ingredients_total": len(all_ingredient_rows),
                "ingredients_added": len(added_ingredient_rows),
                "recipe_ingredients": len(recipe_ingredients),
                "outputs": {
                    "recipes": str(NEW_RECIPES_PATH),
                    "ingredients": str(NEW_INGREDIENTS_PATH),
                    "ingredients_missing_only": str(MISSING_INGREDIENTS_PATH),
                    "recipe_ingredients": str(NEW_RECIPE_INGREDIENTS_PATH),
                },
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
