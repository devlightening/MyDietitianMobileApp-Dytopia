#!/usr/bin/env python3
"""Generate the Dytopia freemium public recipe catalog seed SQL.

The source CSV contains clinic-owned recipes. This script remaps the first
production-safe 500 rows into deterministic system-public recipe IDs with
DietitianId = NULL, then remaps RecipeIngredients and shadow ingredient joins.
"""

from __future__ import annotations

import csv
import re
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RECIPES_CSV = ROOT / "datasets" / "NewRecieps.csv"
INGREDIENTS_CSV = ROOT / "datasets" / "NewRecipeIngredients.csv"
OUT_SQL = ROOT / "scripts" / "generated" / "20260508_public_recipe_catalog.sql"
CATALOG_SIZE = 500
NAMESPACE = uuid.uuid5(uuid.NAMESPACE_DNS, "dytopia-public-recipe-catalog")


def truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"true", "1", "yes", "y"}


def blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    if not text or text.upper() == "NULL":
        return None
    return text


def sql_string(value: str | None) -> str:
    value = blank_to_none(value)
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def sql_uuid(value: str | uuid.UUID | None) -> str:
    if value is None:
        return "NULL"
    return f"'{value}'::uuid"


def sql_bool(value: bool) -> str:
    return "TRUE" if value else "FALSE"


def sql_number(value: str | None) -> str:
    value = blank_to_none(value)
    return value if value is not None else "NULL"


def sql_timestamp(value: str | None) -> str:
    value = blank_to_none(value)
    return "NULL" if value is None else f"{sql_string(value)}::timestamptz"


def deterministic_uuid(kind: str, key: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"{kind}:{key}")


def slugify(name: str, recipe_id: uuid.UUID) -> str:
    translation = str.maketrans({
        "ç": "c",
        "ğ": "g",
        "ı": "i",
        "ö": "o",
        "ş": "s",
        "ü": "u",
        "Ç": "c",
        "Ğ": "g",
        "İ": "i",
        "I": "i",
        "Ö": "o",
        "Ş": "s",
        "Ü": "u",
    })
    base = name.translate(translation).lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    if not base:
        base = "tarif"
    return f"{base}-{str(recipe_id).replace('-', '')[:6]}"


def load_public_recipes() -> list[dict[str, str]]:
    with RECIPES_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    safe_rows = [
        row for row in rows
        if truthy(row.get("IsPublic"))
        and not truthy(row.get("IsDemo"))
        and not truthy(row.get("IsDraft"))
        and not truthy(row.get("IsHiddenFromProduction"))
        and not truthy(row.get("IsArchived"))
        and blank_to_none(row.get("ArchivedAtUtc")) is None
    ]

    if len(safe_rows) < CATALOG_SIZE:
        raise SystemExit(f"Need at least {CATALOG_SIZE} safe public rows, found {len(safe_rows)}")

    return safe_rows[:CATALOG_SIZE]


def load_recipe_ingredients(selected_old_ids: set[str]) -> list[dict[str, str]]:
    with INGREDIENTS_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    return [row for row in rows if row["RecipeId"] in selected_old_ids]


def chunked(values: list[str], size: int) -> list[list[str]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def insert_values(table: str, columns: list[str], rows: list[str], chunk_size: int = 250) -> list[str]:
    statements: list[str] = []
    for chunk in chunked(rows, chunk_size):
        statements.append(
            f'INSERT INTO {table} ({", ".join(columns)}) VALUES\n'
            + ",\n".join(chunk)
            + ";"
        )
    return statements


def main() -> None:
    recipes = load_public_recipes()
    id_map = {
        row["Id"]: deterministic_uuid("recipe", row["Id"])
        for row in recipes
    }
    selected_old_ids = set(id_map.keys())
    ingredients = load_recipe_ingredients(selected_old_ids)

    recipe_rows: list[str] = []
    for row in recipes:
        new_id = id_map[row["Id"]]
        recipe_rows.append(
            "("
            f"{sql_uuid(new_id)}, "
            "NULL, "
            f"{sql_string(row['Name'])}, "
            f"{sql_string(slugify(row['Name'], new_id))}, "
            f"{sql_string(row.get('Description'))}, "
            "TRUE, FALSE, FALSE, FALSE, FALSE, NULL, "
            f"{sql_string(blank_to_none(row.get('StepsJson')) or '[]')}, "
            f"{sql_string(blank_to_none(row.get('TagsJson')) or '[]')}, "
            f"{sql_number(row.get('PrepTimeMinutes'))}, "
            f"{sql_number(row.get('CookTimeMinutes'))}, "
            f"{sql_number(row.get('Servings'))}, "
            f"{sql_number(row.get('CaloriesKcal'))}, "
            f"{sql_number(row.get('ProteinGrams'))}, "
            f"{sql_number(row.get('CarbsGrams'))}, "
            f"{sql_number(row.get('FatGrams'))}"
            ")"
        )

    explicit_rows: list[str] = []
    mandatory_pairs: set[tuple[uuid.UUID, str]] = set()
    optional_pairs: set[tuple[uuid.UUID, str]] = set()
    prohibited_pairs: set[tuple[uuid.UUID, str]] = set()

    for row in ingredients:
        new_recipe_id = id_map[row["RecipeId"]]
        role = row["Role"].strip()
        ingredient_id = row["IngredientId"].strip()
        new_row_id = deterministic_uuid("recipe-ingredient", f"{row['Id']}:{new_recipe_id}")

        explicit_rows.append(
            "("
            f"{sql_uuid(new_row_id)}, "
            f"{sql_uuid(new_recipe_id)}, "
            f"{sql_uuid(ingredient_id)}, "
            f"{sql_string(role)}, "
            f"{sql_number(row.get('Quantity'))}, "
            f"{sql_string(row.get('Unit'))}, "
            f"{sql_timestamp(row.get('CreatedAtUtc'))}"
            ")"
        )

        pair = (new_recipe_id, ingredient_id)
        if role == "Mandatory":
            mandatory_pairs.add(pair)
        elif role in {"Optional", "Flavoring"}:
            optional_pairs.add(pair)
        elif role == "Prohibited":
            prohibited_pairs.add(pair)

    def pair_rows(pairs: set[tuple[uuid.UUID, str]]) -> list[str]:
        return [
            f"({sql_uuid(recipe_id)}, {sql_uuid(ingredient_id)})"
            for recipe_id, ingredient_id in sorted(pairs, key=lambda item: (str(item[0]), item[1]))
        ]

    recipe_id_rows = [f"({sql_uuid(id_map[row['Id']])})" for row in recipes]

    lines: list[str] = [
        "-- Dytopia freemium public recipe catalog seed",
        f"-- Generated from {RECIPES_CSV.name} and {INGREDIENTS_CSV.name}",
        f"-- Recipes: {len(recipes)}",
        f"-- RecipeIngredients: {len(explicit_rows)}",
        "-- Scope: system public catalog only (DietitianId = NULL, IsPublic = TRUE).",
        "",
        "BEGIN;",
        "",
        'CREATE TEMP TABLE _dytopia_public_catalog_recipe_ids ("Id" uuid NOT NULL) ON COMMIT DROP;',
    ]
    lines.extend(insert_values("_dytopia_public_catalog_recipe_ids", ['"Id"'], recipe_id_rows, 500))
    lines.extend([
        "",
        'DELETE FROM "RecipeIngredientSubstitutes" ris USING _dytopia_public_catalog_recipe_ids s WHERE ris."RecipeId" = s."Id";',
        'DELETE FROM "RecipeProhibitedIngredients" rpi USING _dytopia_public_catalog_recipe_ids s WHERE rpi."RecipeId" = s."Id";',
        'DELETE FROM "RecipeOptionalIngredients" roi USING _dytopia_public_catalog_recipe_ids s WHERE roi."RecipeId" = s."Id";',
        'DELETE FROM "RecipeMandatoryIngredients" rmi USING _dytopia_public_catalog_recipe_ids s WHERE rmi."RecipeId" = s."Id";',
        'DELETE FROM "RecipeIngredients" ri USING _dytopia_public_catalog_recipe_ids s WHERE ri."RecipeId" = s."Id";',
        "",
        "CREATE TEMP TABLE _dytopia_public_catalog_recipes (",
        '  "Id" uuid NOT NULL,',
        '  "DietitianId" uuid NULL,',
        '  "Name" text NOT NULL,',
        '  "Slug" text NOT NULL,',
        '  "Description" text NOT NULL,',
        '  "IsPublic" boolean NOT NULL,',
        '  "IsDemo" boolean NOT NULL,',
        '  "IsDraft" boolean NOT NULL,',
        '  "IsHiddenFromProduction" boolean NOT NULL,',
        '  "IsArchived" boolean NOT NULL,',
        '  "ArchivedAtUtc" timestamptz NULL,',
        '  "StepsJson" text NULL,',
        '  "TagsJson" text NULL,',
        '  "PrepTimeMinutes" integer NULL,',
        '  "CookTimeMinutes" integer NULL,',
        '  "Servings" integer NULL,',
        '  "CaloriesKcal" integer NULL,',
        '  "ProteinGrams" numeric NULL,',
        '  "CarbsGrams" numeric NULL,',
        '  "FatGrams" numeric NULL',
        ") ON COMMIT DROP;",
    ])
    lines.extend(insert_values(
        "_dytopia_public_catalog_recipes",
        [
            '"Id"', '"DietitianId"', '"Name"', '"Slug"', '"Description"',
            '"IsPublic"', '"IsDemo"', '"IsDraft"', '"IsHiddenFromProduction"',
            '"IsArchived"', '"ArchivedAtUtc"', '"StepsJson"', '"TagsJson"',
            '"PrepTimeMinutes"', '"CookTimeMinutes"', '"Servings"',
            '"CaloriesKcal"', '"ProteinGrams"', '"CarbsGrams"', '"FatGrams"',
        ],
        recipe_rows,
        120,
    ))
    lines.extend([
        "",
        'INSERT INTO "Recipes" (',
        '  "Id", "DietitianId", "Name", "Slug", "Description", "IsPublic",',
        '  "IsDemo", "IsDraft", "IsHiddenFromProduction", "IsArchived", "ArchivedAtUtc",',
        '  "StepsJson", "TagsJson", "PrepTimeMinutes", "CookTimeMinutes", "Servings",',
        '  "CaloriesKcal", "ProteinGrams", "CarbsGrams", "FatGrams"',
        ")",
        "SELECT",
        '  "Id", "DietitianId", "Name", "Slug", "Description", "IsPublic",',
        '  "IsDemo", "IsDraft", "IsHiddenFromProduction", "IsArchived", "ArchivedAtUtc",',
        '  "StepsJson"::jsonb, "TagsJson"::jsonb, "PrepTimeMinutes", "CookTimeMinutes", "Servings",',
        '  "CaloriesKcal", "ProteinGrams", "CarbsGrams", "FatGrams"',
        "FROM _dytopia_public_catalog_recipes",
        'ON CONFLICT ("Id") DO UPDATE SET',
        '  "DietitianId" = NULL,',
        '  "Name" = EXCLUDED."Name",',
        '  "Slug" = EXCLUDED."Slug",',
        '  "Description" = EXCLUDED."Description",',
        '  "IsPublic" = TRUE,',
        '  "IsDemo" = FALSE,',
        '  "IsDraft" = FALSE,',
        '  "IsHiddenFromProduction" = FALSE,',
        '  "IsArchived" = FALSE,',
        '  "ArchivedAtUtc" = NULL,',
        '  "StepsJson" = EXCLUDED."StepsJson",',
        '  "TagsJson" = EXCLUDED."TagsJson",',
        '  "PrepTimeMinutes" = EXCLUDED."PrepTimeMinutes",',
        '  "CookTimeMinutes" = EXCLUDED."CookTimeMinutes",',
        '  "Servings" = EXCLUDED."Servings",',
        '  "CaloriesKcal" = EXCLUDED."CaloriesKcal",',
        '  "ProteinGrams" = EXCLUDED."ProteinGrams",',
        '  "CarbsGrams" = EXCLUDED."CarbsGrams",',
        '  "FatGrams" = EXCLUDED."FatGrams";',
        "",
        'CREATE TEMP TABLE _dytopia_public_catalog_recipe_ingredients (',
        '  "Id" uuid NOT NULL,',
        '  "RecipeId" uuid NOT NULL,',
        '  "IngredientId" uuid NOT NULL,',
        '  "Role" text NOT NULL,',
        '  "Quantity" numeric NULL,',
        '  "Unit" text NULL,',
        '  "CreatedAtUtc" timestamptz NOT NULL',
        ") ON COMMIT DROP;",
    ])
    lines.extend(insert_values(
        "_dytopia_public_catalog_recipe_ingredients",
        ['"Id"', '"RecipeId"', '"IngredientId"', '"Role"', '"Quantity"', '"Unit"', '"CreatedAtUtc"'],
        explicit_rows,
        250,
    ))
    lines.extend([
        "",
        'INSERT INTO "RecipeIngredients" ("Id", "RecipeId", "IngredientId", "Role", "Quantity", "Unit", "CreatedAtUtc")',
        'SELECT "Id", "RecipeId", "IngredientId", "Role", "Quantity", "Unit", COALESCE("CreatedAtUtc", NOW())',
        "FROM _dytopia_public_catalog_recipe_ingredients;",
        "",
    ])

    shadow_specs = [
        ('"RecipeMandatoryIngredients"', pair_rows(mandatory_pairs)),
        ('"RecipeOptionalIngredients"', pair_rows(optional_pairs)),
        ('"RecipeProhibitedIngredients"', pair_rows(prohibited_pairs)),
    ]
    for table, rows in shadow_specs:
        if not rows:
            continue
        lines.extend(insert_values(table, ['"RecipeId"', '"IngredientId"'], rows, 350))
        lines.append("")

    lines.extend([
        "DO $$",
        "DECLARE seeded_count integer;",
        "BEGIN",
        '  SELECT COUNT(*) INTO seeded_count FROM "Recipes"',
        '  WHERE "IsPublic" = TRUE AND "DietitianId" IS NULL AND "Id" IN (SELECT "Id" FROM _dytopia_public_catalog_recipe_ids);',
        f"  IF seeded_count < {CATALOG_SIZE} THEN",
        "    RAISE EXCEPTION 'Public catalog seed incomplete: expected at least %, found %', "
        f"{CATALOG_SIZE}, seeded_count;",
        "  END IF;",
        "END $$;",
        "",
        "COMMIT;",
        "",
    ])

    OUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    OUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_SQL} ({len(recipes)} recipes, {len(explicit_rows)} ingredient rows)")


if __name__ == "__main__":
    main()
