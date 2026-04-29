from __future__ import annotations

import csv
import json
import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp")
DESKTOP = Path(r"C:\Users\hy971\Desktop")
EXISTING_INGREDIENTS_PATH = DESKTOP / "Ingredients.csv"

NEW_RECIPES_PATH = ROOT / "NewRecieps.csv"
NEW_INGREDIENTS_PATH = ROOT / "NewIngredients.csv"
MISSING_INGREDIENTS_PATH = ROOT / "NewIngredients_MissingOnly.csv"
NEW_RECIPE_INGREDIENTS_PATH = ROOT / "NewRecipeIngredients.csv"

RECIPE_NAMESPACE = uuid.UUID("04d27813-06fa-44a1-b894-cfd8f2eed8e9")
INGREDIENT_NAMESPACE = uuid.UUID("2bde9668-c3ce-4b20-a419-eb28a6f05fe1")
RECIPE_INGREDIENT_NAMESPACE = uuid.UUID("67f20f29-a61e-4d9c-aef5-c01935c7747b")


@dataclass(frozen=True)
class Dietitian:
    id: str
    full_name: str
    clinic_name: str


@dataclass(frozen=True)
class Profile:
    title: str
    descriptor: str
    focus: str
    tag: str
    note: str


@dataclass(frozen=True)
class IngredientDef:
    name: str
    adjective: str
    protein: float = 0.0
    carbs: float = 0.0
    fat: float = 0.0
    tags: tuple[str, ...] = ()
    aliases: tuple[str, ...] = ()
    condiment: bool = False


@dataclass(frozen=True)
class IngredientUse:
    ingredient: IngredientDef
    role: str
    quantity: str
    unit: str


DIETITIANS = [
    Dietitian("13646f33-77b1-4657-a6cf-b9911e84bb84", "Ahmet Kaya", "Kaya Beslenme Kliniği"),
    Dietitian("2c840fc5-ba87-438b-b2c3-343de72873b3", "Mehmet Yılmaz", "Yılmaz Sağlıklı Yaşam"),
    Dietitian("448e6957-a8ef-4f95-b3ec-91f9e2a854fa", "Burak Yıldız", "Yıldız Klinik"),
    Dietitian("4735371b-3b76-4cc6-b914-0b66929ca69e", "Mustafa Koç", "Koç Diyet Stüdyo"),
    Dietitian("4a26f2eb-faed-4d15-a77e-190935fe82cf", "Fatma Şahin", "Şahin Diyet Kliniği"),
    Dietitian("583b8a61-ebee-4dec-8bf0-cf2ca1aa6095", "Ahmet Kaya", "Kaya Beslenme Kliniği"),
    Dietitian("7c83aa64-8d48-41a3-a26a-e3ff91f15b88", "Bilgehan Sarı", "Hayatın Sarısı"),
    Dietitian("87fa6a81-ef03-4727-870c-cd3c7c92e2a1", "Zeynep Çelik", "Çelik Beslenme Danışmanlığı"),
    Dietitian("8f1866ab-b4ad-4b81-80c0-6525ec84c538", "Selin Aydın", "Aydın Sağlık Merkezi"),
    Dietitian("9dc7a471-da26-4cb8-86e0-60baa0855b16", "Ayşe Arslan", "Arslan Beslenme Evi"),
    Dietitian("bc6ddd4e-587c-428d-b4a9-12c965b620ba", "Elif Demir", "Demir Diyet Merkezi"),
    Dietitian("dcdcbd23-7726-4f45-a0df-ddcd5a3b098c", "Mehmet Yılmaz", "Yılmaz Sağlıklı Yaşam"),
    Dietitian("dd000001-0000-0000-0000-000000000000", "Ahmet Kaya", "Kaya Beslenme Kliniği"),
    Dietitian("dd000002-0000-0000-0000-000000000000", "Elif Demir", "Demir Diyet Merkezi"),
    Dietitian("dd000003-0000-0000-0000-000000000000", "Mehmet Yılmaz", "Yılmaz Sağlıklı Yaşam"),
    Dietitian("dd000004-0000-0000-0000-000000000000", "Zeynep Çelik", "Çelik Beslenme Danışmanlığı"),
    Dietitian("dd000005-0000-0000-0000-000000000000", "Fatma Şahin", "Şahin Diyet Kliniği"),
    Dietitian("dd000006-0000-0000-0000-000000000000", "Ali Öztürk", "Öztürk Wellness"),
    Dietitian("dd000007-0000-0000-0000-000000000000", "Ayşe Arslan", "Arslan Beslenme"),
    Dietitian("dd000008-0000-0000-0000-000000000000", "Mustafa Koç", "Koç Diyet Stüdyo"),
    Dietitian("dd000009-0000-0000-0000-000000000000", "Selin Aydın", "Aydın Sağlık Merkezi"),
    Dietitian("dd00000a-0000-0000-0000-000000000000", "Burak Yıldız", "Yıldız Klinik"),
    Dietitian("f1605f4d-0267-497a-9deb-2a9242b17e4f", "Ali Öztürk", "Öztürk Wellness Studio"),
]

PROFILES = [
    Profile("Akdeniz Dengesi", "Akdeniz esintili", "lif ve sağlıklı yağ dengesi", "akdeniz", "ferah ve renkli"),
    Profile("Yüksek Protein Rutin", "yüksek protein odaklı", "kas korunumu ve uzun süreli tokluk", "yüksek protein", "tok tutan"),
    Profile("Pratik Günlük Plan", "pratik hazırlanabilen", "gün içinde sürdürülebilir enerji", "pratik", "hızlı hazırlanabilen"),
    Profile("Fonksiyonel Sebze Mutfak", "sebze ağırlıklı", "mikrobesin çeşitliliği ve sindirim konforu", "sebze ağırlıklı", "hafif"),
    Profile("Dengeleyici Klinik Menü", "dengeli porsiyonlu", "kan şekeri stabilitesi ve kontrollü doygunluk", "denge", "ölçülü"),
    Profile("Fit Ofis Menüsü", "ofis temposuna uygun", "kolay taşınabilir öğün düzeni", "ofis dostu", "taşınabilir"),
]

PROTEINS = [
    IngredientDef("Tavuk Göğsü", "tavuklu", 28, 0, 7, ("yüksek protein",), ("chicken breast", "skinless chicken breast")),
    IngredientDef("Hindi Göğsü", "hindili", 27, 0, 6, ("yüksek protein",), ("turkey breast",)),
    IngredientDef("Somon Fileto", "somonlu", 26, 0, 16, ("omega-3", "yüksek protein"), ("salmon fillet", "salmon")),
    IngredientDef("Levrek Fileto", "levrekli", 25, 0, 10, ("balık", "yüksek protein"), ("sea bass fillet", "sea bass")),
    IngredientDef("Ton Balığı", "ton balıklı", 24, 0, 9, ("balık", "yüksek protein"), ("tuna", "canned tuna")),
    IngredientDef("Yumurta", "yumurtalı", 18, 1, 13, ("kahvaltı", "yüksek protein"), ("egg", "eggs")),
    IngredientDef("Lor Peyniri", "lor peynirli", 20, 4, 8, ("protein",), ("curd cheese", "lor cheese")),
    IngredientDef("Süzme Yoğurt", "süzme yoğurtlu", 16, 7, 9, ("fermente", "protein"), ("strained yogurt", "greek yogurt")),
    IngredientDef("Tofu", "tofulu", 16, 5, 9, ("bitkisel protein",), ("tofu",)),
    IngredientDef("Yeşil Mercimek", "mercimekli", 15, 24, 2, ("baklagil", "lif"), ("green lentils", "lentils")),
    IngredientDef("Nohut", "nohutlu", 13, 27, 4, ("baklagil", "lif"), ("chickpeas", "chickpea")),
    IngredientDef("Kuru Fasulye", "fasulyeli", 14, 25, 2, ("baklagil", "lif"), ("white beans", "dry beans")),
]

GRAINS = [
    IngredientDef("Kinoa", "kinoalı", 5, 28, 3, ("kompleks karbonhidrat",), ("quinoa",)),
    IngredientDef("Karabuğday", "karabuğdaylı", 5, 30, 2, ("glutensiz", "kompleks karbonhidrat"), ("buckwheat",)),
    IngredientDef("Bulgur", "bulgurlu", 4, 31, 1, ("lif",), ("bulgur", "cracked wheat")),
    IngredientDef("Esmer Pirinç", "esmer pirinçli", 4, 34, 2, ("denge",), ("brown rice",)),
    IngredientDef("Tam Buğday Makarna", "tam buğday makarnalı", 7, 36, 2, ("tam tahıl",), ("whole wheat pasta",)),
    IngredientDef("Yulaf", "yulaflı", 5, 27, 4, ("kahvaltı", "lif"), ("oats", "rolled oats")),
    IngredientDef("Chia Tohumu", "chialı", 4, 12, 8, ("omega-3", "lif"), ("chia seeds", "chia")),
    IngredientDef("Tam Buğday Lavaş", "lavaşlı", 6, 29, 4, ("pratik",), ("whole wheat lavash", "lavash")),
    IngredientDef("Kabak Spagetti", "kabak spagettili", 2, 8, 1, ("düşük karbonhidrat",), ("zucchini noodles", "zucchini spaghetti")),
]

VEGETABLES = [
    IngredientDef("Kabak", "kabaklı", 1, 4, 0.2, ("sebze",), ("zucchini", "courgette")),
    IngredientDef("Ispanak", "ıspanaklı", 2, 3, 0.4, ("demir kaynağı",), ("spinach",)),
    IngredientDef("Brokoli", "brokolili", 3, 6, 0.5, ("lif",), ("broccoli",)),
    IngredientDef("Renkli Biber", "biberli", 1, 5, 0.3, ("renkli sebze",), ("bell pepper", "mixed peppers")),
    IngredientDef("Mantar", "mantarlı", 3, 4, 0.3, ("hafif",), ("mushroom", "mushrooms")),
    IngredientDef("Patlıcan", "patlıcanlı", 1, 6, 0.3, ("fırın",), ("eggplant", "aubergine")),
    IngredientDef("Karnabahar", "karnabaharlı", 2, 5, 0.4, ("lif",), ("cauliflower",)),
    IngredientDef("Semizotu", "semizotlu", 2, 3, 0.4, ("omega-3",), ("purslane",)),
    IngredientDef("Havuç", "havuçlu", 1, 7, 0.2, ("renkli sebze",), ("carrot", "carrots")),
    IngredientDef("Pancar", "pancarlı", 2, 8, 0.2, ("lif",), ("beetroot", "beet")),
    IngredientDef("Kereviz", "kerevizli", 1, 5, 0.2, ("hafif",), ("celery root", "celery")),
    IngredientDef("Bezelye", "bezelyeli", 5, 15, 0.4, ("lif",), ("peas", "green peas")),
    IngredientDef("Soğan", "soğanlı", 1, 8, 0.2, ("aromatik",), ("onion", "onions")),
    IngredientDef("Sarımsak", "sarımsaklı", 1, 3, 0.1, ("aromatik",), ("garlic",)),
]

FRUITS = [
    IngredientDef("Çilek", "çilekli", 1, 8, 0.3, ("meyveli",), ("strawberry", "strawberries")),
    IngredientDef("Yaban Mersini", "yaban mersinli", 1, 10, 0.4, ("antioksidan",), ("blueberry", "blueberries")),
    IngredientDef("Muz", "muzlu", 1, 23, 0.4, ("enerji",), ("banana", "bananas")),
    IngredientDef("Elma", "elmalı", 0.3, 16, 0.2, ("lif",), ("apple", "apples")),
    IngredientDef("Armut", "armutlu", 0.4, 17, 0.2, ("lif",), ("pear", "pears")),
    IngredientDef("Şeftali", "şeftalili", 1, 13, 0.3, ("yaz meyvesi",), ("peach", "peaches")),
    IngredientDef("Nar", "narlı", 1, 14, 0.5, ("antioksidan",), ("pomegranate",)),
    IngredientDef("Kivi", "kivili", 1, 11, 0.4, ("c vitamini",), ("kiwi", "kiwifruit")),
    IngredientDef("Böğürtlen", "böğürtlenli", 1, 10, 0.5, ("antioksidan",), ("blackberry", "blackberries")),
    IngredientDef("Mandalina", "mandalinalı", 1, 12, 0.3, ("c vitamini",), ("mandarin", "tangerine")),
]

SPREADS = [
    IngredientDef("Avokado Ezmesi", "avokadolu", 2, 8, 11, ("sağlıklı yağ",), ("avocado mash", "mashed avocado")),
    IngredientDef("Humus", "humuslu", 5, 11, 7, ("baklagil",), ("hummus",)),
    IngredientDef("Labne", "labneli", 4, 3, 7, ("pratik",), ("cream cheese", "labneh")),
    IngredientDef("Yoğurt Sos", "yoğurt soslu", 4, 4, 3, ("hafif",), ("yogurt sauce",), True),
    IngredientDef("Tahinli Sos", "tahinli", 4, 5, 11, ("susam",), ("tahini sauce",), True),
    IngredientDef("Domates Sosu", "domates soslu", 1, 7, 2, ("sos",), ("tomato sauce",), True),
]

TOPPERS = [
    IngredientDef("Badem", "bademli", 4, 3, 10, ("sağlıklı yağ",), ("almond", "almonds")),
    IngredientDef("Ceviz", "cevizli", 3, 2, 9, ("sağlıklı yağ",), ("walnut", "walnuts")),
    IngredientDef("Kabak Çekirdeği", "kabak çekirdekli", 5, 2, 8, ("çinko",), ("pumpkin seeds", "pumpkin seed")),
    IngredientDef("Keten Tohumu", "keten tohumlu", 2, 1, 5, ("lif",), ("flaxseed", "flax seed")),
    IngredientDef("Fındık", "fındıklı", 3, 2, 8, ("sağlıklı yağ",), ("hazelnut", "hazelnuts")),
    IngredientDef("Hindistan Cevizi", "hindistan cevizli", 1, 4, 6, ("aroma",), ("coconut",)),
]

BREADS = [
    IngredientDef("Tam Buğday Ekmeği", "tam buğday ekmekli", 6, 24, 2, ("sandviç",), ("whole wheat bread",)),
    IngredientDef("Ekşi Mayalı Ekmek", "ekşi mayalı", 6, 22, 2, ("sandviç",), ("sourdough bread", "sourdough")),
    IngredientDef("Çavdar Ekmeği", "çavdar ekmekli", 5, 21, 1, ("sandviç", "lif"), ("rye bread",)),
]

FLAVORINGS = [
    IngredientDef("Tarçın", "tarçınlı", 0, 1, 0, ("aroma",), ("cinnamon",), True),
    IngredientDef("Vanilya", "vanilyalı", 0, 1, 0, ("aroma",), ("vanilla",), True),
    IngredientDef("Nane", "naneli", 0, 1, 0, ("ferah",), ("mint",), True),
    IngredientDef("Hardal", "hardallı", 1, 2, 1, ("sos",), ("mustard",), True),
    IngredientDef("Zencefil", "zencefilli", 0, 1, 0, ("aroma",), ("ginger",), True),
    IngredientDef("Limon Suyu", "limonlu", 0, 1, 0, ("ferah",), ("lemon juice",), True),
    IngredientDef("Fesleğen", "fesleğenli", 0, 1, 0, ("aroma",), ("basil",), True),
    IngredientDef("Kekik", "kekikli", 0, 1, 0, ("aroma",), ("oregano", "thyme"), True),
    IngredientDef("Biberiye", "biberiyeli", 0, 1, 0, ("aroma",), ("rosemary",), True),
    IngredientDef("Sumak", "sumaklı", 0, 1, 0, ("aroma",), ("sumac",), True),
    IngredientDef("Zerdeçal", "zerdeçallı", 0, 1, 0, ("aroma",), ("turmeric",), True),
    IngredientDef("Zeytinyağı", "zeytinyağlı", 0, 0, 10, ("sağlıklı yağ",), ("olive oil", "extra virgin olive oil"), True),
    IngredientDef("Karabiber", "karabiberli", 0, 0, 0, ("aroma",), ("black pepper",), True),
    IngredientDef("Tuz", "tuzlu", 0, 0, 0, ("aroma",), ("salt",), True),
]

VESSELS = [item for item in VEGETABLES if item.name in {"Kabak", "Renkli Biber", "Patlıcan", "Mantar"}]


def normalize_ascii(text: str) -> str:
    table = str.maketrans(
        {
            "ç": "c",
            "Ç": "c",
            "ğ": "g",
            "Ğ": "g",
            "ı": "i",
            "İ": "i",
            "ö": "o",
            "Ö": "o",
            "ş": "s",
            "Ş": "s",
            "ü": "u",
            "Ü": "u",
        }
    )
    normalized = text.translate(table).lower()
    return "".join(char if char.isalnum() else " " for char in normalized).strip()


def slugify(text: str) -> str:
    slug = "-".join(normalize_ascii(text).split())
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def cap_first(text: str) -> str:
    return text[:1].upper() + text[1:] if text else text


def unique(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        value = item.strip()
        if not value:
            continue
        marker = value.casefold()
        if marker in seen:
            continue
        seen.add(marker)
        result.append(value)
    return result


def total_macros(*ingredients: IngredientDef, extra_protein: float = 0, extra_carbs: float = 0, extra_fat: float = 0) -> tuple[int, float, float, float]:
    protein = sum(item.protein for item in ingredients) + extra_protein
    carbs = sum(item.carbs for item in ingredients) + extra_carbs
    fat = sum(item.fat for item in ingredients) + extra_fat
    calories = round(protein * 4 + carbs * 4 + fat * 9)
    return calories, round(carbs, 2), round(fat, 2), round(protein, 2)


def ingredient_use(ingredient: IngredientDef, role: str, quantity: float, unit: str) -> IngredientUse:
    return IngredientUse(ingredient, role, f"{quantity:.2f}", unit)


def mandatory(ingredient: IngredientDef, quantity: float, unit: str) -> IngredientUse:
    return ingredient_use(ingredient, "Mandatory", quantity, unit)


def optional(ingredient: IngredientDef, quantity: float, unit: str) -> IngredientUse:
    return ingredient_use(ingredient, "Optional", quantity, unit)


def flavoring(ingredient: IngredientDef, quantity: float, unit: str) -> IngredientUse:
    return ingredient_use(ingredient, "Flavoring", quantity, unit)


def fruit_quantity(fruit: IngredientDef) -> tuple[float, str]:
    if fruit.name in {"Yaban Mersini", "Böğürtlen", "Nar"}:
        return 80.0, "gram"
    if fruit.name in {"Çilek"}:
        return 100.0, "gram"
    return 1.0, "adet"


def build_aliases(name: str, extras: Iterable[str] = ()) -> str:
    ascii_name = normalize_ascii(name)
    hyphen_name = slugify(name)
    compact_name = hyphen_name.replace("-", "")
    original_lower = name.lower()
    alias_candidates = [
        name,
        hyphen_name,
        compact_name,
        original_lower,
        original_lower.replace(" ", "-"),
        original_lower.replace(" ", ""),
        ascii_name,
        ascii_name.replace(" ", "-"),
        ascii_name.replace(" ", ""),
    ]
    for extra in extras:
        alias_candidates.extend([extra, extra.lower(), extra.lower().replace(" ", "-"), extra.lower().replace(" ", "")])
    return json.dumps(unique(alias_candidates), ensure_ascii=False)


def load_existing_ingredients() -> tuple[list[dict[str, str]], dict[str, dict[str, str]], set[str]]:
    rows: list[dict[str, str]] = []
    lookup: dict[str, dict[str, str]] = {}
    existing_ids: set[str] = set()
    with EXISTING_INGREDIENTS_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for raw_row in reader:
            canonical = (raw_row.get("CanonicalName") or raw_row.get("Name") or "").strip()
            aliases_text = (raw_row.get("Aliases") or "").strip()
            try:
                aliases = json.loads(aliases_text) if aliases_text and aliases_text != "NULL" else []
            except json.JSONDecodeError:
                aliases = []

            enriched_aliases = build_aliases(canonical, [*aliases])
            row = {
                "Id": (raw_row.get("Id") or "").strip(),
                "Name": (raw_row.get("Name") or canonical).strip(),
                "IsMandatory": (raw_row.get("IsMandatory") or "False").strip() or "False",
                "IsProhibited": (raw_row.get("IsProhibited") or "False").strip() or "False",
                "CanonicalName": canonical,
                "Aliases": enriched_aliases,
                "IsActive": (raw_row.get("IsActive") or "True").strip() or "True",
                "IsCondiment": (raw_row.get("IsCondiment") or "False").strip() or "False",
            }
            rows.append(row)
            existing_ids.add(row["Id"])
            for key in unique([canonical, *aliases, *json.loads(enriched_aliases)]):
                lookup[normalize_ascii(key)] = row
    return rows, lookup, existing_ids


def breakfast_bowl(rng: random.Random, profile: Profile) -> dict:
    dairy = rng.choice([item for item in PROTEINS if item.name in {"Süzme Yoğurt", "Lor Peyniri"}])
    grain = rng.choice([item for item in GRAINS if item.name in {"Yulaf", "Chia Tohumu", "Kinoa"}])
    fruit = rng.choice(FRUITS)
    topper = rng.choice([item for item in TOPPERS if item.name in {"Badem", "Ceviz", "Kabak Çekirdeği", "Keten Tohumu"}])
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Tarçın", "Vanilya", "Nane"}])
    fruit_qty, fruit_unit = fruit_quantity(fruit)

    uses = [
        mandatory(grain, 50, "gram"),
        mandatory(dairy, 180, "gram"),
        mandatory(fruit, fruit_qty, fruit_unit),
        optional(topper, 15, "gram"),
        flavoring(spice, 2, "gram"),
    ]
    name = f"{cap_first(spice.adjective)} {fruit.adjective} {grain.name.lower()} ve {dairy.name.lower()} kasesi"
    description = (
        f"{profile.descriptor.capitalize()} bu kahvaltı, {profile.focus} için tasarlandı. "
        f"{cap_first(fruit.name.lower())}, {grain.name.lower()} ve {dairy.name.lower()} birleşimiyle hafif ama dengeli bir başlangıç sunar."
    )
    steps = [
        f"{grain.name} tabanını uygun bir kapta hazırlayın; gerekiyorsa birkaç dakika önceden sıvı ile yumuşatın.",
        f"{dairy.name} ile {fruit.name.lower()} parçalarını ayrı bir kapta nazikçe karıştırın.",
        f"Kaseye önce {grain.name.lower()} tabanını, üzerine {dairy.name.lower()} karışımını alın.",
        f"{topper.name} ve seçtiğiniz baharat dokunuşunu üzerine serpin.",
        "Kıvamı oturduktan sonra soğuk servis edin.",
    ]
    tags = unique(["kahvaltı", "kase", profile.tag, *grain.tags[:1], *dairy.tags[:1], *fruit.tags[:1]])
    calories, carbs, fat, protein = total_macros(dairy, grain, fruit, topper, spice, extra_carbs=3)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(7, 14), rng.randint(0, 4), 1, calories, carbs, fat, protein)


def omelet(rng: random.Random, profile: Profile) -> dict:
    veg = rng.choice([item for item in VEGETABLES if item.name not in {"Pancar", "Kereviz"}])
    second_veg = rng.choice([item for item in VEGETABLES if item.name != veg.name and item.name not in {"Pancar"}])
    cheese = rng.choice([item for item in PROTEINS if item.name in {"Lor Peyniri", "Süzme Yoğurt"}])
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Hardal", "Kekik", "Nane"}])
    egg = next(item for item in PROTEINS if item.name == "Yumurta")

    uses = [
        mandatory(egg, 2, "adet"),
        mandatory(veg, 90, "gram"),
        mandatory(second_veg, 70, "gram"),
        optional(cheese, 40, "gram"),
        flavoring(spice, 2, "gram"),
    ]
    name = f"{cap_first(spice.adjective)} {veg.adjective} ve {second_veg.adjective} omlet"
    description = (
        f"{profile.note.capitalize()} dokulu bu tarif, yumurta ve sebzeleri tek tavada bir araya getirir. "
        "Günün ilk yarısında dengeli bir protein kaynağı arayanlar için uygundur."
    )
    steps = [
        f"{veg.name} ve {second_veg.name.lower()} küçük parçalar halinde doğrayın.",
        "Yapışmaz tavayı ısıtıp sebzeleri kısa süre soteleyin.",
        f"Yumurtaları çırpıp {cheese.name.lower()} ile pürüzsüz hale getirin.",
        "Karışımı tavaya dökün ve kısık ateşte kontrollü şekilde pişirin.",
        "Omleti ikiye katlayıp sıcak servis edin.",
    ]
    tags = unique(["kahvaltı", "omlet", profile.tag, "tava", *veg.tags[:1], "yüksek protein"])
    calories, carbs, fat, protein = total_macros(egg, veg, second_veg, cheese, spice, extra_fat=4)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(8, 13), rng.randint(8, 14), 1, calories, carbs, fat, protein)


def smoothie(rng: random.Random, profile: Profile) -> dict:
    fruit = rng.choice(FRUITS)
    second = rng.choice([item for item in FRUITS if item.name != fruit.name])
    green = rng.choice([item for item in VEGETABLES if item.name in {"Ispanak", "Semizotu", "Havuç"}])
    dairy = rng.choice([item for item in PROTEINS if item.name in {"Süzme Yoğurt", "Lor Peyniri"}])
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Tarçın", "Nane", "Zencefil"}])
    fruit_qty, fruit_unit = fruit_quantity(fruit)
    second_qty, second_unit = fruit_quantity(second)

    uses = [
        mandatory(dairy, 150, "gram"),
        mandatory(fruit, fruit_qty, fruit_unit),
        mandatory(second, second_qty, second_unit),
        optional(green, 40, "gram"),
        flavoring(spice, 1, "gram"),
    ]
    name = f"{cap_first(fruit.adjective)} {second.adjective} ve {green.adjective} smoothie"
    description = (
        f"{profile.descriptor.capitalize()} ara öğün alternatifi olan bu smoothie, {profile.focus} hedefini destekler. "
        "Meyve ve yeşil sebzeyi dengeli şekilde bir araya getirir."
    )
    steps = [
        f"{fruit.name} ve {second.name.lower()} meyvelerini uygun boyutta hazırlayın.",
        f"Blender haznesine {dairy.name.lower()}, {green.name.lower()} ve meyveleri ekleyin.",
        "İsteğe göre birkaç buz küpü ve su ilavesi yapın.",
        "Karışım pürüzsüz olana kadar blenderdan geçirin.",
        "Bekletmeden servis edin.",
    ]
    tags = unique(["ara öğün", "smoothie", profile.tag, *fruit.tags[:1], *green.tags[:1], "pratik"])
    calories, carbs, fat, protein = total_macros(dairy, fruit, second, green, spice, extra_carbs=4, extra_fat=2)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(6, 10), 0, 1, calories, carbs, fat, protein)


def soup(rng: random.Random, profile: Profile) -> dict:
    legume = rng.choice([item for item in PROTEINS if item.name in {"Yeşil Mercimek", "Nohut", "Kuru Fasulye"}])
    veg = rng.choice([item for item in VEGETABLES if item.name not in {"Semizotu"}])
    onion = next(item for item in VEGETABLES if item.name == "Soğan")
    oil = next(item for item in FLAVORINGS if item.name == "Zeytinyağı")
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Zencefil", "Kekik", "Zerdeçal"}])

    uses = [
        mandatory(legume, 90, "gram"),
        mandatory(veg, 140, "gram"),
        optional(onion, 60, "gram"),
        flavoring(oil, 10, "ml"),
        flavoring(spice, 2, "gram"),
    ]
    name = f"{cap_first(spice.adjective)} {legume.adjective} {veg.adjective} çorbası"
    description = (
        f"{profile.note.capitalize()} yapılı bu çorba, baklagil bazlı yapısıyla {profile.focus} sunar. "
        "Öğle ya da akşam öğününde hafif ama doyurucu bir alternatif oluşturur."
    )
    steps = [
        f"{veg.name} ve temel aromatik sebzeleri küçük küpler halinde doğrayın.",
        "Tencerede kısa süre kavurup baklagili ekleyin.",
        "Üzerini geçecek kadar sıcak su ilave edip kısık ateşte pişirin.",
        f"{spice.adjective.capitalize()} dokunuşunu ekleyip kıvamı oturana kadar kaynatın.",
        "İsterseniz kısmen blenderdan geçirip sıcak servis edin.",
    ]
    tags = unique(["çorba", "öğle yemeği", profile.tag, *legume.tags[:2], *veg.tags[:1], "hafif"])
    calories, carbs, fat, protein = total_macros(legume, veg, onion, oil, spice, extra_carbs=8)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(10, 18), rng.randint(20, 34), rng.randint(2, 3), calories, carbs, fat, protein)


def salad_bowl(rng: random.Random, profile: Profile) -> dict:
    protein = rng.choice([item for item in PROTEINS if item.name not in {"Yumurta", "Lor Peyniri", "Süzme Yoğurt"}])
    grain = rng.choice([item for item in GRAINS if item.name not in {"Chia Tohumu", "Yulaf"}])
    veg = rng.choice(VEGETABLES)
    oil = next(item for item in FLAVORINGS if item.name == "Zeytinyağı")
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Biberiye", "Fesleğen", "Limon Suyu"}])

    uses = [
        mandatory(protein, 140, "gram"),
        mandatory(grain, 60, "gram"),
        mandatory(veg, 100, "gram"),
        optional(oil, 8, "ml"),
        flavoring(spice, 2, "gram"),
    ]
    name = f"{cap_first(spice.adjective)} {protein.adjective} {grain.name.lower()} salata kasesi"
    description = (
        f"{profile.descriptor.capitalize()} bu kase, {protein.name.lower()} ve {grain.name.lower()} ile uzun süreli tokluk sağlar. "
        "Renkli sebzeler sayesinde tabağa canlı bir görünüm ve iyi bir lif dengesi ekler."
    )
    steps = [
        f"{grain.name} tabanını ayrı bir kapta haşlayıp süzün.",
        f"{protein.name} için tercih ettiğiniz pişirme yöntemini uygulayıp dilimleyin.",
        f"{veg.name} ve eşlik edecek yeşillikleri hazırlayın.",
        "Sos malzemelerini karıştırıp kaseyi katmanlı şekilde birleştirin.",
        "Sosu servis öncesinde gezdirip hemen sunun.",
    ]
    tags = unique(["öğle yemeği", "salata kasesi", profile.tag, *protein.tags[:1], *grain.tags[:1], spice.adjective])
    calories, carbs, fat, protein_value = total_macros(protein, grain, veg, oil, spice, extra_carbs=4)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(10, 16), rng.randint(12, 24), rng.randint(1, 2), calories, carbs, fat, protein_value)


def wrap(rng: random.Random, profile: Profile) -> dict:
    filling = rng.choice([item for item in PROTEINS if item.name not in {"Somon Fileto", "Levrek Fileto"}])
    veg = rng.choice(VEGETABLES)
    spread = rng.choice([item for item in SPREADS if item.name in {"Yoğurt Sos", "Humus", "Avokado Ezmesi", "Labne"}])
    bread = next(item for item in GRAINS if item.name == "Tam Buğday Lavaş")

    uses = [
        mandatory(bread, 1, "adet"),
        mandatory(filling, 120, "gram"),
        mandatory(veg, 80, "gram"),
        optional(spread, 30, "gram"),
        flavoring(next(item for item in FLAVORINGS if item.name == "Karabiber"), 1, "gram"),
    ]
    name = f"{cap_first(spread.adjective)} {filling.adjective} {veg.adjective} wrap"
    description = (
        f"{profile.focus.capitalize()} hedefleyen bu wrap, taşınabilir yapısıyla yoğun günlerde iyi çalışır. "
        "İç dolgu dengeli karbonhidrat, protein ve sebzeyi aynı lokmada toplar."
    )
    steps = [
        f"{filling.name} harcını önceden pişirip ılıtın.",
        f"{veg.name} ve diğer eşlikçileri ince jülyen halinde hazırlayın.",
        f"{bread.name} yüzeyine {spread.name.lower()} sürün.",
        "Dolgu malzemelerini merkezde toplayıp sıkı şekilde sarın.",
        "İkiye bölüp ılık ya da soğuk servis edin.",
    ]
    tags = unique(["öğle yemeği", "wrap", profile.tag, *filling.tags[:1], *spread.tags[:1], "taşınabilir"])
    calories, carbs, fat, protein_value = total_macros(filling, veg, spread, bread, extra_carbs=2)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(9, 14), rng.randint(8, 16), 1, calories, carbs, fat, protein_value)


def oven_tray(rng: random.Random, profile: Profile) -> dict:
    protein = rng.choice([item for item in PROTEINS if item.name in {"Tavuk Göğsü", "Hindi Göğsü", "Somon Fileto", "Levrek Fileto", "Tofu"}])
    veg = rng.choice(VEGETABLES)
    second = rng.choice([item for item in VEGETABLES if item.name != veg.name])
    oil = next(item for item in FLAVORINGS if item.name == "Zeytinyağı")
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Limon Suyu", "Kekik", "Biberiye"}])

    uses = [
        mandatory(protein, 140, "gram"),
        mandatory(veg, 120, "gram"),
        mandatory(second, 100, "gram"),
        flavoring(oil, 10, "ml"),
        flavoring(spice, 2, "gram"),
    ]
    name = f"{cap_first(spice.adjective)} {protein.adjective} {veg.adjective} fırın tepsisi"
    description = (
        f"{profile.note.capitalize()} ve dengeli bu ana öğün, tek tepside pratik hazırlık sunar. "
        f"{protein.name} ile {veg.name.lower()} uyumu hafif akşam yemekleri için güçlü bir seçenektir."
    )
    steps = [
        "Fırını önceden 190 dereceye ısıtın.",
        f"{protein.name} ve sebzeleri eşit pişecek boyutta hazırlayın.",
        "Malzemeleri tepsiye yayıp zeytinyağı ve baharatlarla harmanlayın.",
        f"{spice.adjective.capitalize()} dokunuşuyla lezzeti tamamlayın.",
        "Kızarana kadar pişirip sıcak servis edin.",
    ]
    tags = unique(["akşam yemeği", "fırın", profile.tag, *protein.tags[:1], *veg.tags[:1], spice.adjective])
    calories, carbs, fat, protein_value = total_macros(protein, veg, second, oil, spice, extra_carbs=6)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(12, 18), rng.randint(18, 30), rng.randint(2, 3), calories, carbs, fat, protein_value)


def stuffed_vegetable(rng: random.Random, profile: Profile) -> dict:
    vessel = rng.choice(VESSELS)
    filling = rng.choice([item for item in PROTEINS if item.name not in {"Somon Fileto", "Levrek Fileto", "Ton Balığı"}])
    grain = rng.choice([item for item in GRAINS if item.name in {"Kinoa", "Karabuğday", "Bulgur", "Esmer Pirinç"}])
    onion = next(item for item in VEGETABLES if item.name == "Soğan")
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Kekik", "Nane", "Fesleğen"}])

    uses = [
        mandatory(vessel, 2, "adet"),
        mandatory(filling, 100, "gram"),
        mandatory(grain, 55, "gram"),
        optional(onion, 50, "gram"),
        flavoring(spice, 2, "gram"),
    ]
    name = f"{cap_first(filling.adjective)} {grain.adjective} dolgulu {vessel.name.lower()}"
    description = (
        f"{profile.descriptor.capitalize()} bu fırın yemeği, porsiyon kontrolünü kolaylaştıran düzenli bir ana öğündür. "
        f"{vessel.name} içinde hazırlanan iç harç, {profile.focus} desteği sunar."
    )
    steps = [
        f"{vessel.name} içini hazırlayıp dolguluk hale getirin.",
        f"{filling.name} ve {grain.name.lower()} bazlı iç harcı tavada kısa süre çevirin.",
        f"{spice.adjective.capitalize()} baharatlarını ekleyip iç harcı dengeleyin.",
        "Sebzelerin içine paylaştırıp fırın kabına dizin.",
        "Yumuşayana kadar pişirip sıcak servis edin.",
    ]
    tags = unique(["akşam yemeği", "dolma", profile.tag, *filling.tags[:1], *grain.tags[:1], "fırın"])
    calories, carbs, fat, protein_value = total_macros(vessel, filling, grain, onion, spice, extra_fat=5)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(14, 22), rng.randint(24, 36), rng.randint(2, 3), calories, carbs, fat, protein_value)


def patties(rng: random.Random, profile: Profile) -> dict:
    base = rng.choice([item for item in PROTEINS if item.name in {"Yeşil Mercimek", "Nohut", "Tavuk Göğsü", "Hindi Göğsü"}])
    veg = rng.choice([item for item in VEGETABLES if item.name in {"Kabak", "Ispanak", "Havuç", "Mantar"}])
    dip = rng.choice([item for item in SPREADS if item.name in {"Yoğurt Sos", "Humus", "Avokado Ezmesi"}])
    egg = next(item for item in PROTEINS if item.name == "Yumurta")
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Kimyon"}]) if False else next(item for item in FLAVORINGS if item.name == "Karabiber")

    uses = [
        mandatory(base, 120, "gram"),
        mandatory(veg, 90, "gram"),
        optional(egg, 1, "adet"),
        optional(dip, 25, "gram"),
        flavoring(spice, 1, "gram"),
    ]
    name = f"{cap_first(veg.adjective)} {base.adjective} mini köfte"
    description = (
        f"{profile.note.capitalize()} bu tarif, kontrollü porsiyonda hazırlanabilen çok yönlü bir tabak sunar. "
        "Yanına eklenen sos ile ara öğün ya da ana öğün olarak değerlendirilebilir."
    )
    steps = [
        f"{base.name} bazını robotta çekip {veg.name.lower()} ile karıştırın.",
        "Baharatları ekleyip şekil alacak kıvama getirin.",
        "Karışımdan küçük parçalar alıp köfte formu verin.",
        "Tavada ya da fırında kontrollü şekilde pişirin.",
        f"{dip.name} ile birlikte servis edin.",
    ]
    tags = unique(["pratik", "köfte", profile.tag, *base.tags[:1], *veg.tags[:1], "yüksek tokluk"])
    calories, carbs, fat, protein_value = total_macros(base, veg, egg, dip, spice, extra_carbs=8, extra_fat=3)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(10, 16), rng.randint(12, 22), rng.randint(2, 3), calories, carbs, fat, protein_value)


def skillet(rng: random.Random, profile: Profile) -> dict:
    protein = rng.choice([item for item in PROTEINS if item.name in {"Tavuk Göğsü", "Hindi Göğsü", "Tofu", "Somon Fileto", "Nohut"}])
    veg = rng.choice(VEGETABLES)
    second = rng.choice([item for item in VEGETABLES if item.name != veg.name])
    oil = next(item for item in FLAVORINGS if item.name == "Zeytinyağı")
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Biberiye", "Kekik", "Fesleğen"}])

    uses = [
        mandatory(protein, 130, "gram"),
        mandatory(veg, 100, "gram"),
        mandatory(second, 80, "gram"),
        flavoring(oil, 8, "ml"),
        flavoring(spice, 2, "gram"),
    ]
    name = f"{cap_first(spice.adjective)} {protein.adjective} sebze sote"
    description = (
        f"{profile.descriptor.capitalize()} bu tava yemeği, tek kapta pişen düzenli bir öğün sunar. "
        f"{protein.name} ve sebzelerin diri dokusu sayesinde hafif ama tatmin edicidir."
    )
    steps = [
        f"{protein.name} uygun boyutta hazırlayın.",
        f"{veg.name} ve {second.name.lower()} sebzelerini benzer büyüklükte doğrayın.",
        "Wok ya da geniş tavayı iyice ısıtıp malzemeleri sırasıyla ekleyin.",
        f"{spice.adjective.capitalize()} aroması ile son dokunuşu yapın.",
        "Sebzeler hafif diri kalacak şekilde servis edin.",
    ]
    tags = unique(["ana öğün", "sote", profile.tag, *protein.tags[:1], *veg.tags[:1], "tek tava"])
    calories, carbs, fat, protein_value = total_macros(protein, veg, second, oil, spice, extra_carbs=10)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(10, 15), rng.randint(10, 18), rng.randint(1, 2), calories, carbs, fat, protein_value)


def pilaf_bowl(rng: random.Random, profile: Profile) -> dict:
    grain = rng.choice([item for item in GRAINS if item.name in {"Bulgur", "Kinoa", "Karabuğday", "Esmer Pirinç"}])
    protein = rng.choice([item for item in PROTEINS if item.name not in {"Somon Fileto", "Levrek Fileto", "Süzme Yoğurt", "Lor Peyniri"}])
    veg = rng.choice(VEGETABLES)
    oil = next(item for item in FLAVORINGS if item.name == "Zeytinyağı")
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Sumak", "Kekik", "Nane"}])

    uses = [
        mandatory(grain, 60, "gram"),
        mandatory(protein, 120, "gram"),
        mandatory(veg, 90, "gram"),
        flavoring(oil, 8, "ml"),
        flavoring(spice, 2, "gram"),
    ]
    name = f"{cap_first(spice.adjective)} {protein.adjective} {grain.name.lower()} pilavı"
    description = (
        f"{profile.note.capitalize()} yapılı bu pilav tabağı, gün içi enerji ihtiyacını kontrollü karşılamak için tasarlandı. "
        "Tane tane doku ve dengeli protein miktarıyla günlük planlara kolayca uyum sağlar."
    )
    steps = [
        f"{grain.name} tabanını yıkayıp uygun kıvamda pişirin.",
        f"{protein.name} ve {veg.name.lower()} ile ayrı bir iç harç hazırlayın.",
        "Pişen tahılı harçla birleştirip birkaç dakika dinlendirin.",
        f"{spice.adjective.capitalize()} ile aromayı canlandırın.",
        "Ana öğün olarak sıcak servis edin.",
    ]
    tags = unique(["öğle yemeği", "pilav", profile.tag, *grain.tags[:1], *protein.tags[:1], spice.adjective])
    calories, carbs, fat, protein_value = total_macros(grain, protein, veg, oil, spice, extra_fat=5)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(10, 18), rng.randint(16, 28), rng.randint(2, 3), calories, carbs, fat, protein_value)


def pasta(rng: random.Random, profile: Profile) -> dict:
    pasta_base = rng.choice([item for item in GRAINS if item.name in {"Tam Buğday Makarna", "Kabak Spagetti"}])
    protein = rng.choice([item for item in PROTEINS if item.name in {"Tavuk Göğsü", "Hindi Göğsü", "Ton Balığı", "Tofu", "Lor Peyniri"}])
    veg = rng.choice(VEGETABLES)
    sauce = rng.choice([item for item in SPREADS if item.name in {"Domates Sosu", "Yoğurt Sos", "Labne"}])
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Fesleğen", "Kekik", "Karabiber"}])

    uses = [
        mandatory(pasta_base, 70, "gram"),
        mandatory(protein, 110, "gram"),
        mandatory(veg, 80, "gram"),
        optional(sauce, 60, "gram"),
        flavoring(spice, 2, "gram"),
    ]
    name = f"{cap_first(protein.adjective)} {veg.adjective} {pasta_base.name.lower()}"
    description = (
        f"{profile.descriptor.capitalize()} bu tabak, klasik makarna hissini daha kontrollü bir içerikle sunar. "
        "Sos ve sebze dengesi sayesinde hafif ama tatmin edici bir alternatif oluşturur."
    )
    steps = [
        f"{pasta_base.name} tabanını uygun süre boyunca pişirin.",
        f"{protein.name} ve {veg.name.lower()} ile sos temelini hazırlayın.",
        f"{sauce.name} karışımını tavada kısa süre çevirin.",
        "Haşlanan tabanı sos ile buluşturup birkaç dakika dinlendirin.",
        "Sıcak servis edip taze otlarla tamamlayın.",
    ]
    tags = unique(["akşam yemeği", "makarna", profile.tag, *protein.tags[:1], *pasta_base.tags[:1], spice.adjective])
    calories, carbs, fat, protein_value = total_macros(pasta_base, protein, veg, sauce, spice, extra_carbs=4)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(9, 15), rng.randint(12, 22), rng.randint(1, 2), calories, carbs, fat, protein_value)


def pudding(rng: random.Random, profile: Profile) -> dict:
    base = rng.choice([item for item in GRAINS if item.name in {"Chia Tohumu", "Yulaf"}])
    fruit = rng.choice(FRUITS)
    dairy = rng.choice([item for item in PROTEINS if item.name in {"Süzme Yoğurt", "Lor Peyniri"}])
    topping = rng.choice([item for item in TOPPERS if item.name in {"Fındık", "Ceviz", "Hindistan Cevizi"}])
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Tarçın", "Vanilya"}])
    fruit_qty, fruit_unit = fruit_quantity(fruit)

    uses = [
        mandatory(base, 40, "gram"),
        mandatory(dairy, 160, "gram"),
        mandatory(fruit, fruit_qty, fruit_unit),
        optional(topping, 12, "gram"),
        flavoring(spice, 2, "gram"),
    ]
    name = f"{cap_first(fruit.adjective)} {base.name.lower()} puding"
    description = (
        f"{profile.note.capitalize()} ara öğün olarak hazırlanan bu puding, kontrollü tatlı isteği için iyi bir alternatiftir. "
        "Protein ve lif desteğiyle gereksiz atıştırmayı azaltmaya yardımcı olur."
    )
    steps = [
        f"{base.name} tabanını sıvı bileşenle karıştırıp dinlenmeye bırakın.",
        f"{dairy.name} ile yumuşak bir kıvam hazırlayın.",
        f"{fruit.name} dilimleri ve tabanı katmanlı şekilde birleştirin.",
        f"{topping.name} ile dokusal kontrast ekleyin.",
        "Soğutup servis edin.",
    ]
    tags = unique(["ara öğün", "puding", profile.tag, *base.tags[:1], *fruit.tags[:1], "tatlı ihtiyacına çözüm"])
    calories, carbs, fat, protein_value = total_macros(base, fruit, dairy, topping, spice, extra_carbs=2)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(8, 14), 0, 1, calories, carbs, fat, protein_value)


def sandwich(rng: random.Random, profile: Profile) -> dict:
    bread = rng.choice(BREADS)
    filling = rng.choice([item for item in PROTEINS if item.name not in {"Somon Fileto", "Levrek Fileto", "Kuru Fasulye"}])
    veg = rng.choice(VEGETABLES)
    spread = rng.choice([item for item in SPREADS if item.name in {"Avokado Ezmesi", "Humus", "Labne", "Yoğurt Sos"}])

    uses = [
        mandatory(bread, 2, "dilim"),
        mandatory(filling, 100, "gram"),
        mandatory(veg, 70, "gram"),
        optional(spread, 25, "gram"),
        flavoring(next(item for item in FLAVORINGS if item.name == "Karabiber"), 1, "gram"),
    ]
    name = f"{cap_first(spread.adjective)} {filling.adjective} sandviç"
    description = (
        f"{profile.descriptor.capitalize()} bu sandviç, dışarıda yemek gereken günlerde planı korumayı kolaylaştırır. "
        f"{bread.name} tabanı ve dengeli iç harcı sayesinde hızlı ama doyurucu bir seçenek sunar."
    )
    steps = [
        f"{bread.name} dilimlerini hafifçe ısıtın.",
        f"Yüzeye önce {spread.name.lower()}, ardından {filling.name.lower()} katmanını ekleyin.",
        f"{veg.name} ile taze bir katman oluşturun.",
        "Sandviçi sıkı şekilde kapatıp ikiye bölün.",
        "İsteğe göre yanında ayran veya salata ile servis edin.",
    ]
    tags = unique(["öğle yemeği", "sandviç", profile.tag, *bread.tags[:1], *filling.tags[:1], "taşınabilir"])
    calories, carbs, fat, protein_value = total_macros(bread, filling, veg, spread, extra_carbs=4)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(7, 12), rng.randint(4, 8), 1, calories, carbs, fat, protein_value)


def main_plate(rng: random.Random, profile: Profile) -> dict:
    protein = rng.choice([item for item in PROTEINS if item.name in {"Somon Fileto", "Levrek Fileto", "Tavuk Göğsü", "Hindi Göğsü", "Tofu"}])
    grain = rng.choice([item for item in GRAINS if item.name in {"Kinoa", "Karabuğday", "Bulgur", "Esmer Pirinç"}])
    veg = rng.choice(VEGETABLES)
    oil = next(item for item in FLAVORINGS if item.name == "Zeytinyağı")
    spice = rng.choice([item for item in FLAVORINGS if item.name in {"Hardal", "Limon Suyu", "Sumak"}])

    uses = [
        mandatory(protein, 140, "gram"),
        mandatory(grain, 60, "gram"),
        mandatory(veg, 90, "gram"),
        flavoring(oil, 8, "ml"),
        flavoring(spice, 2, "gram"),
    ]
    name = f"{cap_first(spice.adjective)} {protein.adjective} ana tabak"
    description = (
        f"{profile.note.capitalize()} bu tarif, akşam öğününde daha düzenli bir tabak kurmak isteyenler için hazırlandı. "
        f"{protein.name} ile {grain.name.lower()} eşleşmesi dengeli makro dağılımı sunar."
    )
    steps = [
        f"{protein.name} ana malzemesini tercih ettiğiniz yöntemle pişirin.",
        f"{grain.name} garnitürünü ayrı kapta hazırlayın.",
        f"{veg.name} eşlikçisini diri kalacak şekilde pişirin.",
        "Tüm parçaları tabakta dengeli porsiyonla birleştirin.",
        "Servis öncesi son baharat dokunuşunu ekleyin.",
    ]
    tags = unique(["akşam yemeği", "ana tabak", profile.tag, *protein.tags[:1], *grain.tags[:1], spice.adjective])
    calories, carbs, fat, protein_value = total_macros(protein, grain, veg, oil, spice, extra_fat=7)
    return recipe_payload(name, description, steps, tags, uses, rng.randint(12, 18), rng.randint(16, 28), rng.randint(1, 2), calories, carbs, fat, protein_value)


def recipe_payload(
    name: str,
    description: str,
    steps: list[str],
    tags: list[str],
    uses: list[IngredientUse],
    prep: int,
    cook: int,
    servings: int,
    calories: int,
    carbs: float,
    fat: float,
    protein: float,
) -> dict:
    return {
        "name": name,
        "description": description,
        "steps": steps,
        "tags": tags,
        "uses": uses,
        "prep": prep,
        "cook": cook,
        "servings": servings,
        "calories": calories,
        "carbs": carbs,
        "fat": fat,
        "protein": protein,
    }


CATEGORY_BUILDERS = [
    breakfast_bowl,
    omelet,
    smoothie,
    soup,
    salad_bowl,
    wrap,
    oven_tray,
    stuffed_vegetable,
    patties,
    skillet,
    pilaf_bowl,
    pasta,
    pudding,
    sandwich,
    main_plate,
]


def make_recipe(recipe_index: int, dietitian_index: int, dietitian: Dietitian, used_names: set[str]) -> dict:
    attempt = 0
    profile = PROFILES[(dietitian_index + recipe_index) % len(PROFILES)]
    while True:
        rng = random.Random(f"{dietitian.id}:{recipe_index}:{attempt}")
        builder = CATEGORY_BUILDERS[(recipe_index + dietitian_index * 2 + attempt) % len(CATEGORY_BUILDERS)]
        data = builder(rng, profile)
        if data["name"] in used_names:
            attempt += 1
            continue
        used_names.add(data["name"])
        recipe_id = uuid.uuid5(RECIPE_NAMESPACE, f"{dietitian.id}:{data['name']}")
        slug = f"{slugify(data['name'])}-{str(recipe_id)[:6]}"[:260]
        return {
            "Id": str(recipe_id),
            "DietitianId": dietitian.id,
            "Name": data["name"],
            "Description": data["description"],
            "IsPublic": "False",
            "IsDemo": "False",
            "IsDraft": "False",
            "IsHiddenFromProduction": "False",
            "StepsJson": json.dumps(data["steps"], ensure_ascii=False),
            "ArchivedAtUtc": "NULL",
            "CookTimeMinutes": str(data["cook"]),
            "IsArchived": "False",
            "PrepTimeMinutes": str(data["prep"]),
            "Servings": str(data["servings"]),
            "TagsJson": json.dumps(data["tags"], ensure_ascii=False),
            "Slug": slug,
            "CaloriesKcal": str(data["calories"]),
            "CarbsGrams": f"{data['carbs']:.2f}",
            "FatGrams": f"{data['fat']:.2f}",
            "ProteinGrams": f"{data['protein']:.2f}",
            "_uses": data["uses"],
        }


def resolve_ingredient_row(
    ingredient: IngredientDef,
    existing_lookup: dict[str, dict[str, str]],
    all_rows: list[dict[str, str]],
    added_rows: list[dict[str, str]],
    created_names: set[str],
) -> dict[str, str]:
    search_keys = [ingredient.name, *ingredient.aliases, slugify(ingredient.name)]
    for key in search_keys:
        row = existing_lookup.get(normalize_ascii(key))
        if row:
            return row

    if ingredient.name in created_names:
        for row in added_rows:
            if row["CanonicalName"] == ingredient.name:
                return row

    new_row = {
        "Id": str(uuid.uuid5(INGREDIENT_NAMESPACE, ingredient.name)),
        "Name": ingredient.name,
        "IsMandatory": "False",
        "IsProhibited": "False",
        "CanonicalName": ingredient.name,
        "Aliases": build_aliases(ingredient.name, ingredient.aliases),
        "IsActive": "True",
        "IsCondiment": "True" if ingredient.condiment else "False",
    }
    all_rows.append(new_row)
    added_rows.append(new_row)
    created_names.add(ingredient.name)
    for key in json.loads(new_row["Aliases"]):
        existing_lookup[normalize_ascii(key)] = new_row
    return new_row


def validate(recipes: list[dict[str, str]], ingredients: list[dict[str, str]], recipe_ingredients: list[dict[str, str]]) -> None:
    assert len(recipes) == 1150, f"Expected 1150 recipes, got {len(recipes)}"
    assert len({row['Name'] for row in recipes}) == 1150, "Recipe names must be unique"
    ingredient_ids = {row["Id"] for row in ingredients}
    recipe_ids = {row["Id"] for row in recipes}
    for row in recipes:
        for key, value in row.items():
            if key.startswith("_"):
                continue
            if value is None or str(value).strip() == "":
                raise AssertionError(f"Blank recipe field {key} for {row['Name']}")
    for row in ingredients:
        for key, value in row.items():
            if value is None or str(value).strip() == "":
                raise AssertionError(f"Blank ingredient field {key} for {row['CanonicalName']}")
    for row in recipe_ingredients:
        for key, value in row.items():
            if value is None or str(value).strip() == "":
                raise AssertionError(f"Blank recipe ingredient field {key}")
        if row["RecipeId"] not in recipe_ids:
            raise AssertionError(f"Unknown RecipeId {row['RecipeId']}")
        if row["IngredientId"] not in ingredient_ids:
            raise AssertionError(f"Unknown IngredientId {row['IngredientId']}")
        if row["Role"] not in {"Mandatory", "Optional", "Flavoring"}:
            raise AssertionError(f"Invalid role {row['Role']}")


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def format_timestamp(value: datetime) -> str:
    return value.strftime("%Y-%m-%d %H:%M:%S.%f+00")


def main() -> None:
    existing_rows, existing_lookup, _ = load_existing_ingredients()
    all_ingredient_rows = list(existing_rows)
    added_ingredient_rows: list[dict[str, str]] = []
    created_names: set[str] = set()

    recipes: list[dict[str, str]] = []
    recipe_ingredients: list[dict[str, str]] = []
    used_recipe_names: set[str] = set()
    base_timestamp = datetime(2026, 4, 19, 8, 0, 0, tzinfo=timezone.utc)

    for dietitian_index, dietitian in enumerate(DIETITIANS):
        for recipe_index in range(50):
            recipe = make_recipe(recipe_index, dietitian_index, dietitian, used_recipe_names)
            uses: list[IngredientUse] = recipe.pop("_uses")
            recipes.append(recipe)

            for use_index, usage in enumerate(uses):
                ingredient_row = resolve_ingredient_row(
                    usage.ingredient,
                    existing_lookup,
                    all_ingredient_rows,
                    added_ingredient_rows,
                    created_names,
                )
                created_at = base_timestamp + timedelta(minutes=len(recipe_ingredients) * 3 + use_index)
                recipe_ingredient_id = uuid.uuid5(
                    RECIPE_INGREDIENT_NAMESPACE,
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
                        "CreatedAtUtc": format_timestamp(created_at),
                    }
                )

    validate(recipes, all_ingredient_rows, recipe_ingredients)

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

    write_csv(NEW_RECIPES_PATH, recipe_fields, [{key: row[key] for key in recipe_fields} for row in recipes])
    write_csv(NEW_INGREDIENTS_PATH, ingredient_fields, [{key: row[key] for key in ingredient_fields} for row in all_ingredient_rows])
    write_csv(MISSING_INGREDIENTS_PATH, ingredient_fields, [{key: row[key] for key in ingredient_fields} for row in added_ingredient_rows])
    write_csv(NEW_RECIPE_INGREDIENTS_PATH, recipe_ingredient_fields, recipe_ingredients)

    print(
        json.dumps(
            {
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
