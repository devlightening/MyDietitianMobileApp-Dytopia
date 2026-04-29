from __future__ import annotations

import csv
import json
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp")
SCRIPTS = ROOT / "scripts"

OUTPUT_RECIPES = ROOT / "SelinAydin_250_NewRecieps.csv"
OUTPUT_INGREDIENTS = ROOT / "SelinAydin_250_NewIngredients.csv"
OUTPUT_INGREDIENTS_MISSING = ROOT / "SelinAydin_250_NewIngredients_MissingOnly.csv"
OUTPUT_RECIPE_INGREDIENTS = ROOT / "SelinAydin_250_NewRecipeIngredients.csv"
OUTPUT_RECIPE_MANDATORY = ROOT / "SelinAydin_250_RecipeMandatoryIngredients.csv"
OUTPUT_RECIPE_OPTIONAL = ROOT / "SelinAydin_250_RecipeOptionalIngredients.csv"

RECIPE_NAMESPACE = uuid.UUID("51c3f5df-7e53-4c96-9f7e-bf1f3e2e4a17")
INGREDIENT_NAMESPACE = uuid.UUID("cf0ca57f-a094-4940-8f60-557b0f1db8d2")
RECIPE_INGREDIENT_NAMESPACE = uuid.UUID("fe16f40f-29fa-4255-b9ca-2cb1ed66b23b")

DIETITIAN_ID = "8f1866ab-b4ad-4b81-80c0-6525ec84c538"
DIETITIAN_NAME = "Selin Aydın"
TARGET_COUNT = 250

EXISTING_RECIPE_FILES = [
    ROOT / "NewRecieps.csv",
    ROOT / "NewRecieps_Batch2.csv",
]

EXISTING_INGREDIENT_FILES = [
    SCRIPTS / "Ingredients.csv",
    ROOT / "NewIngredients.csv",
    ROOT / "NewIngredients_Batch2.csv",
    ROOT / "NewIngredients_MissingOnly.csv",
    ROOT / "NewIngredients_MissingOnly_Batch2.csv",
]


@dataclass(frozen=True)
class IngredientDef:
    name: str
    adjective: str
    protein: float = 0.0
    carbs: float = 0.0
    fat: float = 0.0
    aliases: tuple[str, ...] = ()
    condiment: bool = False
    unit_weight: float = 100.0


@dataclass(frozen=True)
class IngredientUse:
    ingredient_name: str
    role: str
    quantity: float
    unit: str


@dataclass
class RecipeCandidate:
    name: str
    description: str
    prep_minutes: int
    cook_minutes: int
    servings: int
    tags: list[str]
    steps: list[str]
    uses: list[IngredientUse]


INGREDIENTS: dict[str, IngredientDef] = {}


def register(
    name: str,
    adjective: str,
    protein: float = 0.0,
    carbs: float = 0.0,
    fat: float = 0.0,
    *,
    aliases: tuple[str, ...] = (),
    condiment: bool = False,
    unit_weight: float = 100.0,
) -> None:
    INGREDIENTS[name] = IngredientDef(
        name=name,
        adjective=adjective,
        protein=protein,
        carbs=carbs,
        fat=fat,
        aliases=aliases,
        condiment=condiment,
        unit_weight=unit_weight,
    )


def seed_ingredients() -> None:
    # Proteins, dairy, legumes
    register("Tavuk Göğsü", "tavuklu", 31, 0, 3.6, aliases=("chicken breast",), unit_weight=100)
    register("Tavuk But", "tavuklu", 24, 0, 9, aliases=("chicken thigh",), unit_weight=100)
    register("Hindi Göğsü", "hindili", 29, 0, 2, aliases=("turkey breast",), unit_weight=100)
    register("Dana Kıyma", "kıymalı", 17, 0, 20, aliases=("ground beef",), unit_weight=100)
    register("Dana Kuşbaşı", "etli", 22, 0, 12, aliases=("beef cubes",), unit_weight=100)
    register("Kuzu Kuşbaşı", "etli", 20, 0, 18, aliases=("lamb cubes",), unit_weight=100)
    register("Köftelik Dana Kıyma", "köfteli", 18, 0, 19, aliases=("meatball mince",), unit_weight=100)
    register("Somon Fileto", "somonlu", 22, 0, 13, aliases=("salmon fillet",), unit_weight=100)
    register("Levrek Fileto", "levrekli", 20, 0, 8, aliases=("sea bass fillet",), unit_weight=100)
    register("Hamsi", "hamsili", 20, 0, 8, aliases=("anchovy", "anchovies"), unit_weight=100)
    register("Palamut", "palamutlu", 21, 0, 9, aliases=("bonito",), unit_weight=100)
    register("Karides", "karidesli", 20, 1, 1, aliases=("shrimp",), unit_weight=100)
    register("Ton Balığı", "ton balıklı", 24, 0, 5, aliases=("tuna", "tuna fish"), unit_weight=100)
    register("Yumurta", "yumurtalı", 13, 1.1, 11, aliases=("egg", "eggs"), unit_weight=50)
    register("Yoğurt", "yoğurtlu", 4, 4.7, 3.3, aliases=("yogurt",), unit_weight=100)
    register("Süzme Yoğurt", "süzme yoğurtlu", 8, 4, 5, aliases=("strained yogurt", "greek yogurt"), unit_weight=100)
    register("Lor Peyniri", "lor peynirli", 18, 3, 8, aliases=("curd cheese", "lor cheese"), unit_weight=100)
    register("Beyaz Peynir", "beyaz peynirli", 14, 3, 21, aliases=("white cheese", "feta"), unit_weight=100)
    register("Kaşar Peyniri", "kaşarlı", 25, 2, 29, aliases=("kasar cheese", "yellow cheese"), unit_weight=100)
    register("Hellim", "hellimli", 22, 2, 18, aliases=("halloumi",), unit_weight=100)
    register("Kırmızı Mercimek", "kırmızı mercimekli", 25, 60, 1.2, aliases=("red lentils",), unit_weight=100)
    register("Yeşil Mercimek", "yeşil mercimekli", 24, 60, 1.0, aliases=("green lentils",), unit_weight=100)
    register("Nohut", "nohutlu", 19, 61, 6, aliases=("chickpeas",), unit_weight=100)
    register("Kuru Fasulye", "kuru fasulyeli", 22, 60, 1.5, aliases=("white beans", "dry beans"), unit_weight=100)
    register("Barbunya", "barbunyalı", 21, 60, 1.0, aliases=("cranberry beans", "borlotti beans"), unit_weight=100)
    register("Börülce", "börülceli", 24, 60, 1.0, aliases=("black-eyed peas",), unit_weight=100)
    register("Bakla", "baklalı", 26, 58, 1.5, aliases=("broad beans", "fava beans"), unit_weight=100)

    # Grains, dough, starches
    register("Pirinç", "pirinçli", 7, 78, 0.6, aliases=("rice",), unit_weight=100)
    register("Baldo Pirinç", "pirinçli", 7, 79, 0.7, aliases=("baldo rice",), unit_weight=100)
    register("Esmer Pirinç", "esmer pirinçli", 7.5, 76, 2.5, aliases=("brown rice",), unit_weight=100)
    register("Bulgur", "bulgurlu", 12, 76, 1.3, aliases=("bulgur",), unit_weight=100)
    register("İnce Bulgur", "ince bulgurlu", 12, 76, 1.3, aliases=("fine bulgur",), unit_weight=100)
    register("Arpa Şehriye", "şehriyeli", 12, 75, 1.2, aliases=("orzo", "barley vermicelli"), unit_weight=100)
    register("Tel Şehriye", "şehriyeli", 12, 75, 1.2, aliases=("vermicelli",), unit_weight=100)
    register("Erişte", "erişteli", 13, 72, 1.5, aliases=("egg noodles", "noodles"), unit_weight=100)
    register("Tam Buğday Makarna", "tam buğday makarnalı", 13, 70, 2.0, aliases=("whole wheat pasta",), unit_weight=100)
    register("Yufka", "yufkalı", 8, 53, 2.0, aliases=("phyllo pastry", "yufka pastry"), unit_weight=100)
    register("Tam Buğday Unu", "unlu", 13, 72, 2.0, aliases=("whole wheat flour",), unit_weight=100)
    register("Mısır Unu", "mısır unlu", 7, 78, 1.5, aliases=("corn flour", "cornmeal"), unit_weight=100)
    register("Galeta Unu", "galeta unlu", 13, 72, 5.0, aliases=("breadcrumbs", "bread crumbs"), unit_weight=100)
    register("Patates", "patatesli", 2, 17, 0.1, aliases=("potato", "potatoes"), unit_weight=100)

    # Vegetables and greens
    register("Soğan", "soğanlı", 1, 9, 0.1, aliases=("onion", "onions"), unit_weight=100)
    register("Sarımsak", "sarımsaklı", 6, 33, 0.5, aliases=("garlic",), unit_weight=100)
    register("Taze Soğan", "taze soğanlı", 1.8, 7, 0.2, aliases=("spring onion", "scallion"), unit_weight=100)
    register("Domates", "domatesli", 1, 4, 0.2, aliases=("tomato", "tomatoes"), unit_weight=100)
    register("Salatalık", "salatalıklı", 0.7, 3.6, 0.1, aliases=("cucumber",), unit_weight=100)
    register("Kapya Biber", "kapya biberli", 1, 6, 0.3, aliases=("capia pepper", "red pepper"), unit_weight=100)
    register("Çarliston Biber", "biberli", 1, 6, 0.2, aliases=("green pepper", "long green pepper"), unit_weight=100)
    register("Kabak", "kabaklı", 1.2, 3.5, 0.2, aliases=("zucchini", "courgette"), unit_weight=100)
    register("Patlıcan", "patlıcanlı", 1, 6, 0.2, aliases=("eggplant", "aubergine"), unit_weight=100)
    register("Havuç", "havuçlu", 0.9, 9.6, 0.2, aliases=("carrot", "carrots"), unit_weight=100)
    register("Kereviz", "kerevizli", 1.5, 9, 0.2, aliases=("celery root", "celeriac"), unit_weight=100)
    register("Pırasa", "pırasalı", 1.5, 14, 0.3, aliases=("leek", "leeks"), unit_weight=100)
    register("Ispanak", "ıspanaklı", 2.9, 3.6, 0.4, aliases=("spinach",), unit_weight=100)
    register("Semizotu", "semizotlu", 2, 3.4, 0.4, aliases=("purslane",), unit_weight=100)
    register("Pazı", "pazılı", 1.8, 3.7, 0.2, aliases=("chard", "swiss chard"), unit_weight=100)
    register("Lahana", "lahanalı", 1.3, 6, 0.1, aliases=("cabbage",), unit_weight=100)
    register("Asma Yaprağı", "yapraklı", 5, 17, 2, aliases=("vine leaves", "grape leaves"), unit_weight=100)
    register("Bamya", "bamyalı", 2, 7, 0.2, aliases=("okra",), unit_weight=100)
    register("Enginar", "enginarlı", 3.3, 11, 0.2, aliases=("artichoke hearts", "artichoke"), unit_weight=100)
    register("Taze Fasulye", "taze fasulyeli", 1.8, 7, 0.2, aliases=("green beans", "string beans"), unit_weight=100)
    register("Bezelye", "bezelyeli", 5.4, 15, 0.4, aliases=("peas", "green peas"), unit_weight=100)
    register("Mantar", "mantarlı", 3.1, 3.3, 0.3, aliases=("mushroom", "mushrooms"), unit_weight=100)
    register("Karnabahar", "karnabaharlı", 2, 5, 0.3, aliases=("cauliflower",), unit_weight=100)
    register("Brokoli", "brokolili", 2.8, 7, 0.4, aliases=("broccoli",), unit_weight=100)
    register("Pancar", "pancarlı", 1.6, 10, 0.2, aliases=("beetroot", "beet"), unit_weight=100)
    register("Roka", "rokalı", 2.6, 3.7, 0.7, aliases=("arugula", "rocket"), unit_weight=100)
    register("Marul", "marullu", 1.4, 2.9, 0.2, aliases=("lettuce",), unit_weight=100)
    register("Turp", "turplu", 0.7, 3.4, 0.1, aliases=("radish",), unit_weight=100)

    # Herbs, nuts, condiments
    register("Maydanoz", "maydanozlu", 3, 6, 0.8, aliases=("parsley",), condiment=True, unit_weight=100)
    register("Dereotu", "dereotlu", 3.5, 7, 1.1, aliases=("dill",), condiment=True, unit_weight=100)
    register("Nane", "naneli", 3.8, 8, 0.9, aliases=("mint",), condiment=True, unit_weight=100)
    register("Kekik", "kekikli", 9, 69, 4, aliases=("oregano", "thyme"), condiment=True, unit_weight=100)
    register("Fesleğen", "fesleğenli", 3, 3, 0.6, aliases=("basil",), condiment=True, unit_weight=100)
    register("Kimyon", "kimyonlu", 18, 44, 22, aliases=("cumin",), condiment=True, unit_weight=100)
    register("Pul Biber", "pul biberli", 13, 57, 14, aliases=("red pepper flakes",), condiment=True, unit_weight=100)
    register("Karabiber", "karabiberli", 10, 64, 3, aliases=("black pepper",), condiment=True, unit_weight=100)
    register("Sumak", "sumaklı", 2.4, 71, 1.6, aliases=("sumac",), condiment=True, unit_weight=100)
    register("Tarçın", "tarçınlı", 4, 81, 1.2, aliases=("cinnamon",), condiment=True, unit_weight=100)
    register("Defne Yaprağı", "defne yapraklı", 7, 75, 8, aliases=("bay leaf",), condiment=True, unit_weight=100)
    register("Zerdeçal", "zerdeçallı", 8, 65, 10, aliases=("turmeric",), condiment=True, unit_weight=100)
    register("Zeytinyağı", "zeytinyağlı", 0, 0, 100, aliases=("olive oil",), condiment=True, unit_weight=1)
    register("Tereyağı", "tereyağlı", 0.8, 0.1, 81, aliases=("butter",), condiment=True, unit_weight=1)
    register("Limon Suyu", "limonlu", 0.4, 6.9, 0.2, aliases=("lemon juice",), condiment=True, unit_weight=1)
    register("Portakal Suyu", "portakallı", 0.7, 10.4, 0.2, aliases=("orange juice",), condiment=True, unit_weight=1)
    register("Nar Ekşisi", "nar ekşili", 0, 63, 0, aliases=("pomegranate molasses",), condiment=True, unit_weight=1)
    register("Sirke", "sirkeli", 0, 0.1, 0, aliases=("vinegar",), condiment=True, unit_weight=1)
    register("Domates Salçası", "salçalı", 4.3, 19, 0.5, aliases=("tomato paste",), condiment=True, unit_weight=100)
    register("Biber Salçası", "biber salçalı", 3.4, 24, 1.2, aliases=("pepper paste",), condiment=True, unit_weight=100)
    register("Süt", "sütlü", 3.3, 5, 3.4, aliases=("milk",), condiment=False, unit_weight=1)
    register("Tarhana", "tarhanalı", 12, 68, 4, aliases=("tarhana",), condiment=False, unit_weight=100)
    register("Tahin", "tahinli", 17, 21, 54, aliases=("tahini",), condiment=True, unit_weight=100)
    register("Ceviz", "cevizli", 15, 14, 65, aliases=("walnut", "walnuts"), condiment=False, unit_weight=100)
    register("Badem", "bademli", 21, 22, 50, aliases=("almond", "almonds"), condiment=False, unit_weight=100)
    register("Dolmalık Fıstık", "fıstıklı", 14, 13, 68, aliases=("pine nuts",), condiment=False, unit_weight=100)
    register("Kuş Üzümü", "üzümlü", 3, 79, 0.5, aliases=("currants", "black currants"), condiment=False, unit_weight=100)


def mandatory(name: str, quantity: float, unit: str = "gram") -> IngredientUse:
    return IngredientUse(name, "Mandatory", quantity, unit)


def optional(name: str, quantity: float, unit: str = "gram") -> IngredientUse:
    return IngredientUse(name, "Optional", quantity, unit)


def flavor(name: str, quantity: float, unit: str = "gram") -> IngredientUse:
    return IngredientUse(name, "Flavoring", quantity, unit)


def turkish_ascii(text: str) -> str:
    return (
        text.replace("ç", "c").replace("Ç", "c")
        .replace("ğ", "g").replace("Ğ", "g")
        .replace("ı", "i").replace("İ", "i")
        .replace("ö", "o").replace("Ö", "o")
        .replace("ş", "s").replace("Ş", "s")
        .replace("ü", "u").replace("Ü", "u")
    )


def normalize_key(text: str) -> str:
    lowered = turkish_ascii(text).lower()
    lowered = re.sub(r"[^a-z0-9]+", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", turkish_ascii(text).lower())
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug


def unique(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        clean = value.strip()
        if not clean:
            continue
        marker = normalize_key(clean)
        if marker in seen:
            continue
        seen.add(marker)
        result.append(clean)
    return result


def ingredient_aliases(ingredient: IngredientDef) -> list[str]:
    name = ingredient.name
    tr_lower = name.lower()
    tr_hyphen = re.sub(r"\s+", "-", tr_lower)
    tr_join = re.sub(r"\s+", "", tr_lower)
    ascii_name = turkish_ascii(name)
    ascii_lower = ascii_name.lower()
    ascii_hyphen = re.sub(r"\s+", "-", ascii_lower)
    ascii_join = re.sub(r"\s+", "", ascii_lower)
    return unique(
        [
            name,
            tr_hyphen,
            tr_join,
            ascii_hyphen,
            ascii_lower,
            ascii_join,
            *ingredient.aliases,
        ]
    )


def grams_for_use(use: IngredientUse, ingredient: IngredientDef) -> float:
    if use.unit == "gram":
        return use.quantity
    if use.unit == "ml":
        return use.quantity
    if use.unit == "adet":
        return use.quantity * ingredient.unit_weight
    return use.quantity


def compute_recipe_macros(uses: list[IngredientUse], servings: int) -> tuple[int, str, str, str]:
    protein = 0.0
    carbs = 0.0
    fat = 0.0
    for use in uses:
        ingredient = INGREDIENTS[use.ingredient_name]
        grams = grams_for_use(use, ingredient)
        factor = grams / 100.0
        protein += ingredient.protein * factor
        carbs += ingredient.carbs * factor
        fat += ingredient.fat * factor
    servings = max(servings, 1)
    protein /= servings
    carbs /= servings
    fat /= servings
    calories = round(protein * 4 + carbs * 4 + fat * 9)
    return calories, f"{carbs:.2f}", f"{fat:.2f}", f"{protein:.2f}"


def recipe_uuid(name: str) -> str:
    return str(uuid.uuid5(RECIPE_NAMESPACE, f"{DIETITIAN_ID}|{normalize_key(name)}"))


def recipe_ingredient_uuid(recipe_id: str, ingredient_id: str, role: str, order_index: int) -> str:
    return str(uuid.uuid5(RECIPE_INGREDIENT_NAMESPACE, f"{recipe_id}|{ingredient_id}|{role}|{order_index}"))


def ingredient_uuid(name: str) -> str:
    return str(uuid.uuid5(INGREDIENT_NAMESPACE, normalize_key(name)))


def add_recipe(
    collection: list[RecipeCandidate],
    name: str,
    description: str,
    prep_minutes: int,
    cook_minutes: int,
    servings: int,
    tags: list[str],
    steps: list[str],
    uses: list[IngredientUse],
) -> None:
    collection.append(
        RecipeCandidate(
            name=name,
            description=description,
            prep_minutes=prep_minutes,
            cook_minutes=cook_minutes,
            servings=servings,
            tags=unique(tags),
            steps=steps,
            uses=uses,
        )
    )


def soup_description(name: str) -> str:
    return f"Türk ev mutfağında sık yapılan {name.lower()}, dengeli içeriği ve sıcak servis yapısıyla öğünleri tamamlayan klasik bir seçenektir."


def make_soup(
    collection: list[RecipeCandidate],
    name: str,
    mains: list[IngredientUse],
    optional_veg: list[IngredientUse],
    seasonings: list[IngredientUse],
    *,
    tags: list[str],
    prep: int = 15,
    cook: int = 30,
    servings: int = 4,
    blended: bool = False,
) -> None:
    main_names = ", ".join(use.ingredient_name.lower() for use in mains[:2])
    steps = [
        "Soğanı ve aromatik malzemeleri ince doğrayıp tencerenin tabanını hazırlayın.",
        f"{main_names.capitalize()} ile sebzeleri tencereye alıp kısa süre kavurun.",
        "Sıcak suyu ekleyip malzemeler yumuşayana kadar orta ateşte pişirin.",
        "Baharatlarını son aşamada ekleyip kıvamı kontrol edin.",
        "Bir iki dakika dinlendirip sıcak servis edin.",
    ]
    if blended:
        steps.insert(3, "İstenen pürüzsüz kıvam için blenderdan geçirip tekrar bir taşım kaynatın.")
    add_recipe(
        collection,
        name=name,
        description=soup_description(name),
        prep_minutes=prep,
        cook_minutes=cook,
        servings=servings,
        tags=["çorba", "Türk mutfağı", *tags],
        steps=steps,
        uses=[*mains, *optional_veg, *seasonings],
    )


def make_omelet(
    collection: list[RecipeCandidate],
    name: str,
    vegetables: list[str],
    cheese: str | None,
    herbs: list[str],
    *,
    style: str = "omlet",
    tags: list[str] | None = None,
) -> None:
    uses = [mandatory("Yumurta", 3, "adet")]
    uses.extend(mandatory(vegetable, 70, "gram") for vegetable in vegetables)
    if cheese:
        uses.append(optional(cheese, 50, "gram"))
    uses.append(flavor("Zeytinyağı", 8, "ml"))
    uses.extend(flavor(herb, 2, "gram") for herb in herbs)
    uses.append(flavor("Karabiber", 1, "gram"))
    steps = [
        "Sebzeleri ince doğrayıp tavada kısa süre yumuşatın.",
        "Yumurtaları çırpıp peynir ve baharatlarla homojen hale getirin.",
        "Yumurta karışımını sebzelerin üzerine döküp kısık ateşte pişirin.",
        "Alt yüzeyi toparlanınca kontrollü şekilde katlayın veya çevirin.",
        "Sıcak servis ederken üzerine taze ot serpiştirin.",
    ]
    add_recipe(
        collection,
        name=name,
        description=f"{name}, kahvaltı ve hafif ana öğünlerde Türk mutfağının pratik tava tariflerinden biridir.",
        prep_minutes=12,
        cook_minutes=12,
        servings=2,
        tags=["kahvaltı", "tava", "Türk mutfağı", *(tags or ["yüksek protein"])],
        steps=steps,
        uses=uses,
    )


def make_menemen(collection: list[RecipeCandidate], name: str, extras: list[str], cheese: str | None = None) -> None:
    uses = [
        mandatory("Yumurta", 3, "adet"),
        mandatory("Domates", 220, "gram"),
        mandatory("Çarliston Biber", 120, "gram"),
        mandatory("Soğan", 70, "gram"),
        flavor("Zeytinyağı", 8, "ml"),
        flavor("Pul Biber", 1, "gram"),
    ]
    uses.extend(optional(extra, 60, "gram") for extra in extras)
    if cheese:
        uses.append(optional(cheese, 45, "gram"))
    add_recipe(
        collection,
        name=name,
        description=f"{name}, domatesli yumurta tabanı ve tavada kısa sürede toparlanan yapısıyla sevilen bir Türk kahvaltısıdır.",
        prep_minutes=10,
        cook_minutes=14,
        servings=2,
        tags=["kahvaltı", "menemen", "Türk mutfağı", "tava"],
        steps=[
            "Soğanı ve biberleri zeytinyağında yumuşatın.",
            "Domatesleri ekleyip suyunu hafifçe çektirerek sos kıvamı oluşturun.",
            "Ek malzemeleri ekleyip kısa süre birlikte pişirin.",
            "Yumurtaları üzerine kırıp karıştırın veya bütün halde bırakın.",
            "İstenirse peynir ilave edip sıcak servis edin.",
        ],
        uses=uses,
    )


def make_mucver(collection: list[RecipeCandidate], name: str, base_veg: str, extras: list[str], cheese: str | None = None) -> None:
    uses = [
        mandatory(base_veg, 260, "gram"),
        mandatory("Yumurta", 2, "adet"),
        mandatory("Tam Buğday Unu", 45, "gram"),
        flavor("Dereotu", 6, "gram"),
        flavor("Nane", 3, "gram"),
        flavor("Zeytinyağı", 10, "ml"),
    ]
    uses.extend(optional(extra, 70, "gram") for extra in extras)
    if cheese:
        uses.append(optional(cheese, 45, "gram"))
    add_recipe(
        collection,
        name=name,
        description=f"{name}, rendelenen sebzelerin yumurta ve unla toparlandığı, fırında ya da tavada yapılabilen hafif bir ev yemeğidir.",
        prep_minutes=18,
        cook_minutes=20,
        servings=3,
        tags=["kahvaltı", "fırın", "Türk mutfağı", "sebze"],
        steps=[
            "Sebzeleri rendeleyip fazla suyunu dikkatlice sıkın.",
            "Yumurta, un, peynir ve taze otları ayrı bir kapta karıştırın.",
            "Sebzeleri karışıma ekleyip homojen hale getirin.",
            "Karışımı yağlı kâğıt serili tepsiye paylaştırın.",
            "Üzeri kızarana kadar pişirip yoğurt eşliğinde servis edin.",
        ],
        uses=uses,
    )


def make_gozleme_or_borek(
    collection: list[RecipeCandidate],
    name: str,
    filling: list[str],
    *,
    dish_type: str,
) -> None:
    uses = [mandatory("Yufka", 140, "gram")]
    uses.extend(mandatory(item, 70 if item != "Beyaz Peynir" else 60, "gram") for item in filling)
    uses.append(flavor("Zeytinyağı", 8, "ml"))
    uses.append(flavor("Karabiber", 1, "gram"))
    if any(item in {"Beyaz Peynir", "Lor Peyniri", "Kaşar Peyniri"} for item in filling):
        uses.append(flavor("Maydanoz", 8, "gram"))
    steps = [
        "İç harcı hazırlamak için malzemeleri doğrayıp geniş kapta karıştırın.",
        "Yufkayı serip iç harcı dengeli şekilde yerleştirin.",
        "Kenarlardan kapatıp pişirme öncesi hafifçe yağlayın.",
        "Tavada ya da fırında yüzeyi kızarana kadar pişirin.",
        "Dilimleyip ılık servis edin.",
    ]
    tags = ["Türk mutfağı", "hamur işi", "pratik", "öğle yemeği"]
    if dish_type == "börek":
        tags.append("fırın")
    else:
        tags.append("tava")
    add_recipe(
        collection,
        name=name,
        description=f"{name}, ince yufka ve dengeli iç harcıyla ev usulü hazırlanabilen klasik bir Türk atıştırmalık/ana öğün alternatifidir.",
        prep_minutes=16,
        cook_minutes=18,
        servings=3,
        tags=tags,
        steps=steps,
        uses=uses,
    )


def make_salad(
    collection: list[RecipeCandidate],
    name: str,
    mains: list[IngredientUse],
    additions: list[IngredientUse],
    dressings: list[IngredientUse],
    *,
    tags: list[str],
) -> None:
    add_recipe(
        collection,
        name=name,
        description=f"{name}, taze sebze ve bakliyat dengesini bir araya getiren, Türk sofralarında sık karşılaşılan ferah bir eşlikçidir.",
        prep_minutes=18,
        cook_minutes=0,
        servings=4,
        tags=["salata", "Türk mutfağı", *tags],
        steps=[
            "Sebzeleri uygun boyutta doğrayıp servis kabına alın.",
            "Bakliyat veya protein tabanını hazır hale getirip sebzelerle birleştirin.",
            "Sos malzemelerini ayrı kapta karıştırıp salatanın üzerine gezdirin.",
            "Nazikçe harmanlayıp birkaç dakika dinlendirin.",
            "Taze otlarla tamamlayıp servis edin.",
        ],
        uses=[*mains, *additions, *dressings],
    )


def make_meze(
    collection: list[RecipeCandidate],
    name: str,
    mains: list[IngredientUse],
    additions: list[IngredientUse],
    dressings: list[IngredientUse],
    *,
    tags: list[str],
    cook_minutes: int = 10,
) -> None:
    add_recipe(
        collection,
        name=name,
        description=f"{name}, meze kültürünün dengeli ve paylaşılabilir örneklerinden biri olarak sofrada hem başlangıç hem eşlikçi rolü üstlenir.",
        prep_minutes=16,
        cook_minutes=cook_minutes,
        servings=4,
        tags=["meze", "Türk mutfağı", *tags],
        steps=[
            "Ana malzemeyi tarifine uygun şekilde haşlayın, közleyin ya da soteleyin.",
            "Soğuması gereken malzemeleri dinlendirip kıvamını koruyun.",
            "Yoğurtlu ya da zeytinyağlı sos tabanını ayrı kapta hazırlayın.",
            "Tüm malzemeleri birleştirip tuz ve baharat ayarını yapın.",
            "Servis öncesi üzerine son dokunuşları ekleyin.",
        ],
        uses=[*mains, *additions, *dressings],
    )


def make_zeytinyagli(
    collection: list[RecipeCandidate],
    name: str,
    vegetables: list[IngredientUse],
    extras: list[IngredientUse],
    *,
    servings: int = 4,
    tags: list[str],
) -> None:
    uses = [*vegetables, *extras, flavor("Zeytinyağı", 18, "ml"), flavor("Limon Suyu", 10, "ml")]
    add_recipe(
        collection,
        name=name,
        description=f"{name}, zeytinyağı ve sebze merkezli yapısıyla Türk ev mutfağının hafif, soğuk ya da ılık servis edilen klasiklerinden biridir.",
        prep_minutes=18,
        cook_minutes=28,
        servings=servings,
        tags=["zeytinyağlı", "Türk mutfağı", *tags],
        steps=[
            "Sebzeleri ayıklayıp eşit boyutlarda doğrayın.",
            "Soğan ve yardımcı malzemeleri zeytinyağında birkaç dakika çevirin.",
            "Ana sebzeleri tencereye alıp kısa süre birlikte kavurun.",
            "Az su ve limonla birlikte kısık ateşte yumuşayana kadar pişirin.",
            "Dinlendirip ılık ya da soğuk servis edin.",
        ],
        uses=uses,
    )


def make_dolma_or_sarma(
    collection: list[RecipeCandidate],
    name: str,
    vessel: str,
    *,
    style: str,
    protein_name: str | None = None,
) -> None:
    stuffing = [
        mandatory("Pirinç", 140, "gram"),
        mandatory("Soğan", 120, "gram"),
        optional("Domates", 120, "gram"),
        flavor("Domates Salçası", 18, "gram"),
        flavor("Nane", 3, "gram"),
        flavor("Dolmalık Fıstık", 18, "gram"),
        flavor("Kuş Üzümü", 16, "gram"),
        flavor("Zeytinyağı", 15, "ml"),
    ]
    if style == "etli" and protein_name:
        stuffing.insert(1, mandatory(protein_name, 160, "gram"))
        stuffing = [mandatory(vessel, 320, "gram"), *stuffing]
    else:
        stuffing = [mandatory(vessel, 320, "gram"), *stuffing]
    tags = ["dolma", "Türk mutfağı", "ev yemeği"] if "Dolma" in name else ["sarma", "Türk mutfağı", "ev yemeği"]
    add_recipe(
        collection,
        name=name,
        description=f"{name}, iç harcın özenle sarılıp doldurulduğu geleneksel Türk tariflerinden biridir ve sofrada ana öğün kadar güçlü bir yere sahiptir.",
        prep_minutes=28,
        cook_minutes=40,
        servings=5,
        tags=tags,
        steps=[
            "İç harç için soğanı kavurup pirinç ve diğer iç malzemeleri ekleyin.",
            "Harç yarı çiğ kıvamdayken ocaktan alıp ılıtın.",
            f"{vessel} tabanını hazırlayıp iç harcı dikkatlice yerleştirin.",
            "Tencereye sıkı şekilde dizip üzerine ölçülü su ve yağ gezdirin.",
            "Kısık ateşte iç harç yumuşayana kadar pişirip dinlendirin.",
        ],
        uses=stuffing,
    )


def make_legume_main(
    collection: list[RecipeCandidate],
    name: str,
    base_legume: str,
    vegetables: list[str],
    *,
    protein_name: str | None = None,
    tags: list[str],
) -> None:
    uses = [mandatory(base_legume, 220, "gram"), mandatory("Soğan", 100, "gram")]
    uses.extend(optional(vegetable, 110, "gram") for vegetable in vegetables)
    if protein_name:
        uses.insert(0, mandatory(protein_name, 180, "gram"))
    uses.extend(
        [
            flavor("Domates Salçası", 20, "gram"),
            flavor("Zeytinyağı", 14, "ml"),
            flavor("Karabiber", 1, "gram"),
        ]
    )
    add_recipe(
        collection,
        name=name,
        description=f"{name}, bakliyat temelli sulu yemek geleneğini sürdüren ve doyuruculuğu yüksek bir Türk ana öğünüdür.",
        prep_minutes=18,
        cook_minutes=42,
        servings=4,
        tags=["bakliyat", "ev yemeği", "Türk mutfağı", *tags],
        steps=[
            "Soğanı yağ ile birlikte tencerede yumuşatın.",
            "Bakliyatı ve varsa et tabanını ekleyip birkaç dakika çevirin.",
            "Sebzeleri ve salçayı ilave ederek aromaları bütünleştirin.",
            "Sıcak su ekleyip kısık ateşte malzemeler yumuşayana kadar pişirin.",
            "Kıvamı oturunca dinlendirip yanında yoğurt ya da salata ile servis edin.",
        ],
        uses=uses,
    )


def make_main_protein(
    collection: list[RecipeCandidate],
    name: str,
    protein_name: str,
    vegetables: list[str],
    *,
    tags: list[str],
    method: str,
) -> None:
    uses = [mandatory(protein_name, 260, "gram"), mandatory("Soğan", 100, "gram")]
    uses.extend(optional(vegetable, 120, "gram") for vegetable in vegetables)
    uses.extend(
        [
            flavor("Domates", 160, "gram"),
            flavor("Zeytinyağı", 14, "ml"),
            flavor("Karabiber", 1, "gram"),
            flavor("Kekik", 2, "gram"),
        ]
    )
    cook = 28 if method == "sote" else 38 if method == "güveç" else 35
    steps = [
        "Protein malzemesini kurulayarak pişirmeye uygun hale getirin.",
        "Soğan ve sebzeleri hazırlayıp tencere ya da tavada renk aldırın.",
        "Ana proteini ekleyip mühürleme aşamasını tamamlayın.",
        "Domates, yağ ve baharatlarla birlikte kısık ateşte pişmeye bırakın.",
        "Yemeği birkaç dakika dinlendirip sıcak servis edin.",
    ]
    if method == "fırın":
        steps[3] = "Tepsiye domates, yağ ve baharatları ekleyip fırında kontrollü şekilde pişirin."
    add_recipe(
        collection,
        name=name,
        description=f"{name}, protein ve sebze dengesini koruyan, lokanta ve ev mutfağında sık karşılaşılan doyurucu bir Türk ana yemeğidir.",
        prep_minutes=18,
        cook_minutes=cook,
        servings=4,
        tags=["ana yemek", "Türk mutfağı", *tags],
        steps=steps,
        uses=uses,
    )


def make_kofte(
    collection: list[RecipeCandidate],
    name: str,
    additions: list[str],
    *,
    saucey: bool,
    tags: list[str],
) -> None:
    uses = [
        mandatory("Köftelik Dana Kıyma", 280, "gram"),
        mandatory("Soğan", 90, "gram"),
        mandatory("Galeta Unu", 35, "gram"),
        mandatory("Yumurta", 1, "adet"),
    ]
    uses.extend(optional(addition, 120, "gram") for addition in additions)
    uses.extend(
        [
            flavor("Kimyon", 2, "gram"),
            flavor("Karabiber", 1, "gram"),
            flavor("Zeytinyağı", 10, "ml"),
        ]
    )
    if saucey:
        uses.append(flavor("Domates Salçası", 18, "gram"))
    add_recipe(
        collection,
        name=name,
        description=f"{name}, baharatlı köfte harcı ve tamamlayıcı sebzelerle hazırlanan, sofrada çok sevilen bir Türk klasiğidir.",
        prep_minutes=22,
        cook_minutes=30,
        servings=4,
        tags=["köfte", "Türk mutfağı", *tags],
        steps=[
            "Köfte harcını yoğurup kısa süre dinlendirin.",
            "Köftelere şekil verip tavada ya da fırında ilk rengini aldırın.",
            "Sebze veya sos tabanını ayrı kapta hazırlayın.",
            "Köfteleri sebzelerle birleştirip pişirmeyi tamamlayın.",
            "Dinlendirip sıcak servis edin.",
        ],
        uses=uses,
    )


def make_fish(
    collection: list[RecipeCandidate],
    name: str,
    fish_name: str,
    vegetables: list[str],
    *,
    tags: list[str],
    method: str,
) -> None:
    uses = [mandatory(fish_name, 320, "gram")]
    uses.extend(optional(vegetable, 110, "gram") for vegetable in vegetables)
    uses.extend(
        [
            flavor("Zeytinyağı", 12, "ml"),
            flavor("Limon Suyu", 10, "ml"),
            flavor("Karabiber", 1, "gram"),
            flavor("Kekik", 2, "gram"),
        ]
    )
    steps = [
        "Balığı temizleyip kâğıt havlu ile kurulayın.",
        "Sebzeleri doğrayıp pişirme kabına taban hazırlayın.",
        "Balığı baharatlayıp sebzelerin üzerine yerleştirin.",
        "Seçilen pişirme yöntemine göre kontrollü şekilde pişirin.",
        "Limonla tazeleyip sıcak servis edin.",
    ]
    add_recipe(
        collection,
        name=name,
        description=f"{name}, balığın doğal lezzetini sebze ve narenciye dokunuşuyla öne çıkaran dengeli bir Türk usulü ana yemektir.",
        prep_minutes=16,
        cook_minutes=25 if method == "ızgara" else 32,
        servings=4,
        tags=["balık", "Türk mutfağı", *tags],
        steps=steps,
        uses=uses,
    )


def make_pilaf_or_pasta(
    collection: list[RecipeCandidate],
    name: str,
    base_name: str,
    additions: list[str],
    *,
    tags: list[str],
) -> None:
    uses = [mandatory(base_name, 220, "gram"), mandatory("Soğan", 70, "gram")]
    uses.extend(optional(addition, 110, "gram") for addition in additions)
    uses.extend(
        [
            flavor("Zeytinyağı", 12, "ml"),
            flavor("Karabiber", 1, "gram"),
        ]
    )
    if "Pilav" in name or "pilav" in name:
        uses.append(flavor("Tereyağı", 8, "gram"))
    add_recipe(
        collection,
        name=name,
        description=f"{name}, tahıl tabanını sebze veya protein eşlikçileriyle bir araya getiren, Türk mutfağında ana veya yardımcı öğün olarak kullanılan bir seçenektir.",
        prep_minutes=14,
        cook_minutes=22,
        servings=4,
        tags=["pilav", "Türk mutfağı", *tags],
        steps=[
            "Tahıl veya makarna tabanını tarifine uygun şekilde hazırlayın.",
            "Soğan ve ek malzemeleri yağ ile birlikte lezzetlendirin.",
            "Ana tabanı tencereye alıp kısa süre kavurun ya da karıştırın.",
            "Sıvı dengesini ayarlayıp pişirmeyi tamamlayın.",
            "Demlendirdikten sonra servis edin.",
        ],
        uses=uses,
    )


def build_candidates() -> list[RecipeCandidate]:
    recipes: list[RecipeCandidate] = []

    # Soups
    soup_specs = [
        ("Klasik Mercimek Çorbası", [mandatory("Kırmızı Mercimek", 180)], [optional("Havuç", 80), optional("Patates", 110)], [flavor("Kimyon", 2), flavor("Domates Salçası", 15), flavor("Zeytinyağı", 10, "ml")], True, ["bakliyat", "öğle yemeği"]),
        ("Ezogelin Çorbası", [mandatory("Kırmızı Mercimek", 140), mandatory("Bulgur", 40), mandatory("Pirinç", 35)], [optional("Soğan", 90), optional("Domates", 120)], [flavor("Domates Salçası", 18), flavor("Nane", 2), flavor("Pul Biber", 1), flavor("Zeytinyağı", 10, "ml")], False, ["bakliyat", "öğle yemeği"]),
        ("Tarhana Çorbası", [mandatory("Tarhana", 120)], [optional("Sarımsak", 12)], [flavor("Tereyağı", 8, "gram"), flavor("Pul Biber", 1)], False, ["geleneksel", "kış yemeği"]),
        ("Yayla Çorbası", [mandatory("Yoğurt", 220), mandatory("Pirinç", 50)], [optional("Yumurta", 1, "adet")], [flavor("Nane", 2), flavor("Tereyağı", 7, "gram")], False, ["yoğurtlu", "geleneksel"]),
        ("Domates Çorbası", [mandatory("Domates", 320)], [optional("Soğan", 70), optional("Sarımsak", 10)], [flavor("Tereyağı", 8, "gram"), flavor("Karabiber", 1)], True, ["sebze", "geleneksel"]),
        ("Sebzeli Tavuk Çorbası", [mandatory("Tavuk Göğsü", 220)], [optional("Havuç", 80), optional("Kereviz", 80), optional("Pırasa", 90)], [flavor("Zeytinyağı", 10, "ml"), flavor("Karabiber", 1)], False, ["tavuk", "yüksek protein"]),
        ("Brokoli Çorbası", [mandatory("Brokoli", 280)], [optional("Soğan", 70), optional("Patates", 80)], [flavor("Zeytinyağı", 10, "ml"), flavor("Karabiber", 1)], True, ["sebze", "hafif"]),
        ("Karnabahar Çorbası", [mandatory("Karnabahar", 300)], [optional("Soğan", 70), optional("Patates", 80)], [flavor("Zeytinyağı", 10, "ml"), flavor("Karabiber", 1)], True, ["sebze", "hafif"]),
        ("Kabak Çorbası", [mandatory("Kabak", 300)], [optional("Soğan", 70), optional("Havuç", 70)], [flavor("Zeytinyağı", 10, "ml"), flavor("Dereotu", 4)], True, ["sebze", "hafif"]),
        ("Yoğurtlu Buğday Çorbası", [mandatory("Yoğurt", 200), mandatory("Pirinç", 60)], [optional("Nohut", 80)], [flavor("Nane", 2), flavor("Zeytinyağı", 8, "ml")], False, ["yoğurtlu", "geleneksel"]),
        ("Yeşil Mercimekli Erişte Çorbası", [mandatory("Yeşil Mercimek", 140), mandatory("Erişte", 70)], [optional("Soğan", 70), optional("Havuç", 60)], [flavor("Domates Salçası", 12), flavor("Zeytinyağı", 8, "ml")], False, ["bakliyat", "erişteli"]),
        ("Şehriyeli Tavuk Çorbası", [mandatory("Tavuk Göğsü", 180), mandatory("Tel Şehriye", 60)], [optional("Soğan", 60), optional("Havuç", 70)], [flavor("Karabiber", 1), flavor("Zeytinyağı", 8, "ml")], False, ["tavuk", "erişteli"]),
        ("Köz Biberli Domates Çorbası", [mandatory("Domates", 260), mandatory("Kapya Biber", 160)], [optional("Soğan", 70)], [flavor("Zeytinyağı", 10, "ml"), flavor("Karabiber", 1)], True, ["sebze", "köz aroması"]),
        ("Pırasalı Patates Çorbası", [mandatory("Pırasa", 220), mandatory("Patates", 180)], [optional("Soğan", 60)], [flavor("Zeytinyağı", 8, "ml"), flavor("Karabiber", 1)], True, ["sebze", "kış yemeği"]),
        ("Kereviz Çorbası", [mandatory("Kereviz", 260)], [optional("Havuç", 80), optional("Soğan", 70)], [flavor("Zeytinyağı", 8, "ml"), flavor("Limon Suyu", 8, "ml")], True, ["sebze", "kış yemeği"]),
        ("Ispanak Çorbası", [mandatory("Ispanak", 240)], [optional("Soğan", 70), optional("Patates", 90)], [flavor("Zeytinyağı", 8, "ml"), flavor("Karabiber", 1)], True, ["sebze", "hafif"]),
        ("Mantar Çorbası", [mandatory("Mantar", 260)], [optional("Soğan", 70), optional("Süt", 120, "ml")], [flavor("Tereyağı", 8, "gram"), flavor("Karabiber", 1)], True, ["mantar", "hafif"]),
        ("Bulgurlu Yoğurt Çorbası", [mandatory("Yoğurt", 220), mandatory("Bulgur", 60)], [optional("Nohut", 70)], [flavor("Nane", 2), flavor("Tereyağı", 7, "gram")], False, ["yoğurtlu", "geleneksel"]),
        ("Nohutlu Sebze Çorbası", [mandatory("Nohut", 150)], [optional("Havuç", 70), optional("Kabak", 90), optional("Pırasa", 90)], [flavor("Domates Salçası", 14), flavor("Zeytinyağı", 8, "ml")], False, ["bakliyat", "sebze"]),
        ("Kırmızı Mercimekli Havuç Çorbası", [mandatory("Kırmızı Mercimek", 150)], [optional("Havuç", 120), optional("Soğan", 70)], [flavor("Kimyon", 2), flavor("Zeytinyağı", 8, "ml")], True, ["bakliyat", "sebze"]),
        ("Semizotu Çorbası", [mandatory("Semizotu", 240)], [optional("Yoğurt", 160), optional("Pirinç", 40)], [flavor("Nane", 2), flavor("Zeytinyağı", 8, "ml")], False, ["sebze", "yoğurtlu"]),
        ("Bamya Çorbası", [mandatory("Bamya", 220)], [optional("Domates", 140), optional("Soğan", 70)], [flavor("Limon Suyu", 8, "ml"), flavor("Zeytinyağı", 8, "ml")], False, ["sebze", "geleneksel"]),
        ("Pazı Çorbası", [mandatory("Pazı", 240)], [optional("Pirinç", 50), optional("Yoğurt", 140)], [flavor("Nane", 2), flavor("Zeytinyağı", 8, "ml")], False, ["sebze", "yoğurtlu"]),
        ("Erişteli Mercimek Çorbası", [mandatory("Yeşil Mercimek", 130), mandatory("Erişte", 60)], [optional("Soğan", 70), optional("Domates", 100)], [flavor("Domates Salçası", 15), flavor("Zeytinyağı", 8, "ml")], False, ["bakliyat", "erişteli"]),
        ("Arpa Şehriyeli Sebze Çorbası", [mandatory("Arpa Şehriye", 70)], [optional("Havuç", 80), optional("Kabak", 80), optional("Soğan", 70)], [flavor("Zeytinyağı", 8, "ml"), flavor("Karabiber", 1)], False, ["sebze", "şehriyeli"]),
        ("Tavuklu Düğün Çorbası", [mandatory("Tavuk Göğsü", 220), mandatory("Yoğurt", 180)], [optional("Yumurta", 1, "adet"), optional("Pirinç", 45)], [flavor("Tereyağı", 8, "gram"), flavor("Karabiber", 1)], False, ["tavuk", "yoğurtlu"]),
    ]
    for name, mains, veggies, seasonings, blended, tags in soup_specs:
        make_soup(recipes, name, mains, veggies, seasonings, tags=tags, blended=blended)

    # Menemen and omelets
    menemen_specs = [
        ("Klasik Menemen", [], None),
        ("Kaşarlı Menemen", [], "Kaşar Peyniri"),
        ("Mantarlı Menemen", ["Mantar"], None),
        ("Pazılı Menemen", ["Pazı"], "Beyaz Peynir"),
        ("Kabaklı Menemen", ["Kabak"], None),
        ("Kapya Biberli Menemen", ["Kapya Biber"], "Lor Peyniri"),
    ]
    for name, extras, cheese in menemen_specs:
        make_menemen(recipes, name, extras, cheese)

    omelet_specs = [
        ("Ispanaklı Beyaz Peynirli Omlet", ["Ispanak"], "Beyaz Peynir", ["Maydanoz"]),
        ("Mantarlı Kaşarlı Omlet", ["Mantar"], "Kaşar Peyniri", ["Maydanoz"]),
        ("Kabaklı Lor Peynirli Omlet", ["Kabak"], "Lor Peyniri", ["Dereotu"]),
        ("Pazılı Kaşarlı Omlet", ["Pazı"], "Kaşar Peyniri", ["Nane"]),
        ("Patatesli Soğanlı Omlet", ["Patates", "Soğan"], None, ["Maydanoz"]),
        ("Kapya Biberli Lorlu Omlet", ["Kapya Biber"], "Lor Peyniri", ["Maydanoz"]),
        ("Brokolili Peynirli Omlet", ["Brokoli"], "Beyaz Peynir", ["Dereotu"]),
        ("Karnabaharlı Lorlu Omlet", ["Karnabahar"], "Lor Peyniri", ["Nane"]),
        ("Semizotlu Beyaz Peynirli Omlet", ["Semizotu"], "Beyaz Peynir", ["Dereotu"]),
        ("Pırasalı Kaşarlı Omlet", ["Pırasa"], "Kaşar Peyniri", ["Maydanoz"]),
        ("Taze Soğanlı Beyaz Peynirli Omlet", ["Taze Soğan"], "Beyaz Peynir", ["Maydanoz"]),
        ("Patlıcanlı Kaşarlı Omlet", ["Patlıcan"], "Kaşar Peyniri", ["Maydanoz"]),
    ]
    for name, vegs, cheese, herbs in omelet_specs:
        make_omelet(recipes, name, vegs, cheese, herbs)

    # Mücver, gözleme, börek
    mucver_specs = [
        ("Kabak Mücveri", "Kabak", ["Havuç"], "Beyaz Peynir"),
        ("Havuçlu Kabak Mücveri", "Kabak", ["Havuç"], "Lor Peyniri"),
        ("Pazı Mücveri", "Pazı", ["Soğan"], "Beyaz Peynir"),
        ("Karnabahar Mücveri", "Karnabahar", ["Dereotu"], "Lor Peyniri"),
        ("Brokoli Mücveri", "Brokoli", ["Soğan"], "Kaşar Peyniri"),
        ("Patates Mücveri", "Patates", ["Taze Soğan"], "Beyaz Peynir"),
        ("Pırasalı Mücver", "Pırasa", ["Havuç"], "Kaşar Peyniri"),
        ("Ispanaklı Mücver", "Ispanak", ["Taze Soğan"], "Lor Peyniri"),
    ]
    for name, base_veg, extras, cheese in mucver_specs:
        make_mucver(recipes, name, base_veg, extras, cheese)

    gozleme_specs = [
        ("Ispanaklı Gözleme", ["Ispanak", "Beyaz Peynir"]),
        ("Patatesli Gözleme", ["Patates", "Beyaz Peynir"]),
        ("Peynirli Maydanozlu Gözleme", ["Beyaz Peynir", "Maydanoz"]),
        ("Pazılı Lorlu Gözleme", ["Pazı", "Lor Peyniri"]),
        ("Mantar Kaşarlı Gözleme", ["Mantar", "Kaşar Peyniri"]),
        ("Kabaklı Peynirli Gözleme", ["Kabak", "Beyaz Peynir"]),
        ("Pırasalı Peynirli Gözleme", ["Pırasa", "Beyaz Peynir"]),
        ("Kapya Biberli Kaşarlı Gözleme", ["Kapya Biber", "Kaşar Peyniri"]),
    ]
    for name, filling in gozleme_specs:
        make_gozleme_or_borek(recipes, name, filling, dish_type="gözleme")

    borek_specs = [
        ("Ispanaklı Börek", ["Ispanak", "Beyaz Peynir"]),
        ("Pazılı Börek", ["Pazı", "Lor Peyniri"]),
        ("Pırasalı Börek", ["Pırasa", "Beyaz Peynir"]),
        ("Kabaklı Börek", ["Kabak", "Lor Peyniri"]),
        ("Patatesli Börek", ["Patates", "Beyaz Peynir"]),
        ("Mantar Kaşarlı Börek", ["Mantar", "Kaşar Peyniri"]),
        ("Kapya Biberli Peynirli Börek", ["Kapya Biber", "Beyaz Peynir"]),
        ("Semizotlu Lorlu Börek", ["Semizotu", "Lor Peyniri"]),
    ]
    for name, filling in borek_specs:
        make_gozleme_or_borek(recipes, name, filling, dish_type="börek")

    # Salads
    salad_specs = [
        ("Çoban Salatası", [mandatory("Domates", 220), mandatory("Salatalık", 160)], [optional("Soğan", 60), optional("Maydanoz", 10)], [flavor("Zeytinyağı", 12, "ml"), flavor("Limon Suyu", 10, "ml")], ["sebze", "ferah"]),
        ("Gavurdağı Salatası", [mandatory("Domates", 220), mandatory("Salatalık", 140)], [optional("Soğan", 50), optional("Ceviz", 30), optional("Maydanoz", 10)], [flavor("Zeytinyağı", 12, "ml"), flavor("Nar Ekşisi", 8, "ml"), flavor("Sumak", 2)], ["sebze", "cevizli"]),
        ("Nohutlu Piyaz", [mandatory("Nohut", 200)], [optional("Soğan", 70), optional("Maydanoz", 12)], [flavor("Zeytinyağı", 12, "ml"), flavor("Limon Suyu", 10, "ml"), flavor("Sumak", 2)], ["bakliyat", "geleneksel"]),
        ("Kuru Fasulye Piyazı", [mandatory("Kuru Fasulye", 200)], [optional("Soğan", 70), optional("Maydanoz", 12)], [flavor("Zeytinyağı", 12, "ml"), flavor("Sirke", 8, "ml")], ["bakliyat", "geleneksel"]),
        ("Börülce Salatası", [mandatory("Börülce", 200)], [optional("Domates", 140), optional("Maydanoz", 12)], [flavor("Zeytinyağı", 12, "ml"), flavor("Limon Suyu", 8, "ml")], ["bakliyat", "yaz"]),
        ("Yoğurtlu Semizotu Salatası", [mandatory("Semizotu", 180), mandatory("Yoğurt", 180)], [optional("Sarımsak", 8)], [flavor("Zeytinyağı", 8, "ml")], ["yoğurtlu", "ferah"]),
        ("Patates Salatası", [mandatory("Patates", 260)], [optional("Taze Soğan", 60), optional("Maydanoz", 12)], [flavor("Zeytinyağı", 10, "ml"), flavor("Limon Suyu", 8, "ml"), flavor("Sumak", 2)], ["patates", "ferah"]),
        ("Roka Salatası", [mandatory("Roka", 120), mandatory("Domates", 150)], [optional("Beyaz Peynir", 60)], [flavor("Zeytinyağı", 10, "ml"), flavor("Limon Suyu", 8, "ml")], ["yeşillik", "ferah"]),
        ("Pancar Salatası", [mandatory("Pancar", 220)], [optional("Yoğurt", 120), optional("Ceviz", 25)], [flavor("Zeytinyağı", 8, "ml")], ["sebze", "yoğurtlu"]),
        ("Yoğurtlu Brokoli Salatası", [mandatory("Brokoli", 240), mandatory("Yoğurt", 160)], [optional("Sarımsak", 8)], [flavor("Zeytinyağı", 8, "ml")], ["sebze", "yoğurtlu"]),
        ("Barbunya Salatası", [mandatory("Barbunya", 200)], [optional("Kapya Biber", 110), optional("Maydanoz", 12)], [flavor("Zeytinyağı", 12, "ml"), flavor("Limon Suyu", 10, "ml")], ["bakliyat", "yaz"]),
        ("Kısır", [mandatory("İnce Bulgur", 170)], [optional("Domates", 130), optional("Salatalık", 120), optional("Maydanoz", 15)], [flavor("Domates Salçası", 18), flavor("Nar Ekşisi", 10, "ml"), flavor("Zeytinyağı", 12, "ml")], ["bulgur", "geleneksel"]),
        ("Mercimek Kısırı", [mandatory("Yeşil Mercimek", 170)], [optional("Domates", 120), optional("Maydanoz", 15), optional("Taze Soğan", 50)], [flavor("Nar Ekşisi", 10, "ml"), flavor("Zeytinyağı", 12, "ml")], ["bakliyat", "geleneksel"]),
        ("Ton Balıklı Nohut Salatası", [mandatory("Ton Balığı", 160), mandatory("Nohut", 160)], [optional("Domates", 120), optional("Roka", 70)], [flavor("Zeytinyağı", 10, "ml"), flavor("Limon Suyu", 8, "ml")], ["balık", "bakliyat"]),
        ("Tavuklu Akdeniz Salatası", [mandatory("Tavuk Göğsü", 180), mandatory("Marul", 100)], [optional("Domates", 120), optional("Salatalık", 120), optional("Beyaz Peynir", 60)], [flavor("Zeytinyağı", 10, "ml"), flavor("Limon Suyu", 8, "ml")], ["tavuk", "yeşillik"]),
        ("Taze Fasulye Salatası", [mandatory("Taze Fasulye", 220)], [optional("Domates", 120), optional("Soğan", 60)], [flavor("Zeytinyağı", 10, "ml"), flavor("Limon Suyu", 8, "ml")], ["sebze", "ferah"]),
    ]
    for name, mains, additions, dressings, tags in salad_specs:
        make_salad(recipes, name, mains, additions, dressings, tags=tags)

    # Meze
    meze_specs = [
        ("Cacık", [mandatory("Yoğurt", 260), mandatory("Salatalık", 180)], [optional("Sarımsak", 8)], [flavor("Nane", 2), flavor("Zeytinyağı", 6, "ml")], ["yoğurtlu", "ferah"], 0),
        ("Haydari", [mandatory("Süzme Yoğurt", 220), mandatory("Beyaz Peynir", 70)], [optional("Sarımsak", 8)], [flavor("Nane", 2), flavor("Zeytinyağı", 6, "ml")], ["yoğurtlu", "meze"], 0),
        ("Acılı Ezme", [mandatory("Domates", 220), mandatory("Kapya Biber", 120)], [optional("Soğan", 70), optional("Maydanoz", 10)], [flavor("Zeytinyağı", 10, "ml"), flavor("Pul Biber", 2), flavor("Nar Ekşisi", 8, "ml")], ["acı", "sebze"], 0),
        ("Köz Patlıcan Salatası", [mandatory("Patlıcan", 280)], [optional("Sarımsak", 8), optional("Maydanoz", 10)], [flavor("Zeytinyağı", 10, "ml"), flavor("Limon Suyu", 8, "ml")], ["köz", "sebze"], 18),
        ("Şakşuka", [mandatory("Patlıcan", 220), mandatory("Kabak", 180)], [optional("Kapya Biber", 120), optional("Domates", 160)], [flavor("Zeytinyağı", 12, "ml"), flavor("Sarımsak", 8)], ["sebze", "zeytinyağlı"], 20),
        ("Yoğurtlu Havuç Tarator", [mandatory("Havuç", 220), mandatory("Yoğurt", 180)], [optional("Sarımsak", 8), optional("Ceviz", 20)], [flavor("Zeytinyağı", 8, "ml")], ["yoğurtlu", "sebze"], 12),
        ("Cevizli Kereviz Mezesi", [mandatory("Kereviz", 220), mandatory("Yoğurt", 160)], [optional("Ceviz", 25)], [flavor("Limon Suyu", 8, "ml")], ["yoğurtlu", "cevizli"], 12),
        ("Yoğurtlu Kabak Mezesi", [mandatory("Kabak", 220), mandatory("Yoğurt", 170)], [optional("Sarımsak", 8)], [flavor("Dereotu", 4), flavor("Zeytinyağı", 8, "ml")], ["yoğurtlu", "sebze"], 10),
        ("Fava", [mandatory("Bakla", 180)], [optional("Soğan", 60), optional("Dereotu", 10)], [flavor("Zeytinyağı", 14, "ml"), flavor("Limon Suyu", 8, "ml")], ["baklagil", "meze"], 28),
        ("Tahinli Patlıcan Ezmesi", [mandatory("Patlıcan", 260), mandatory("Tahin", 35)], [optional("Sarımsak", 8)], [flavor("Limon Suyu", 8, "ml"), flavor("Zeytinyağı", 8, "ml")], ["köz", "meze"], 18),
        ("Pazı Borani", [mandatory("Pazı", 220), mandatory("Yoğurt", 170)], [optional("Sarımsak", 8)], [flavor("Nane", 2), flavor("Zeytinyağı", 8, "ml")], ["yoğurtlu", "sebze"], 10),
        ("Biberli Yoğurtlu Meze", [mandatory("Kapya Biber", 220), mandatory("Yoğurt", 180)], [optional("Sarımsak", 8)], [flavor("Zeytinyağı", 8, "ml")], ["yoğurtlu", "sebze"], 18),
    ]
    for name, mains, additions, dressings, tags, cook_minutes in meze_specs:
        make_meze(recipes, name, mains, additions, dressings, tags=tags, cook_minutes=cook_minutes)

    # Zeytinyağlılar
    zeytinyagli_specs = [
        ("Zeytinyağlı Taze Fasulye", [mandatory("Taze Fasulye", 420)], [optional("Soğan", 100), optional("Domates", 140)], ["sebze", "yaz"]),
        ("Zeytinyağlı Enginar", [mandatory("Enginar", 360)], [optional("Havuç", 90), optional("Bezelye", 80)], ["sebze", "hafif"]),
        ("Zeytinyağlı Pırasa", [mandatory("Pırasa", 420)], [optional("Havuç", 90), optional("Pirinç", 30)], ["sebze", "kış"]),
        ("Zeytinyağlı Kereviz", [mandatory("Kereviz", 380)], [optional("Havuç", 90), optional("Portakal Suyu", 60, "ml")], ["sebze", "kış"]),
        ("Zeytinyağlı Bamya", [mandatory("Bamya", 360)], [optional("Domates", 140), optional("Soğan", 90)], ["sebze", "yaz"]),
        ("Zeytinyağlı Barbunya", [mandatory("Barbunya", 240)], [optional("Havuç", 90), optional("Domates", 120)], ["bakliyat", "soğuk servis"]),
        ("Zeytinyağlı Kabak", [mandatory("Kabak", 420)], [optional("Domates", 140), optional("Dereotu", 10)], ["sebze", "yaz"]),
        ("Zeytinyağlı Pazı", [mandatory("Pazı", 380)], [optional("Pirinç", 40), optional("Soğan", 90)], ["sebze", "hafif"]),
        ("Zeytinyağlı Ispanak", [mandatory("Ispanak", 360)], [optional("Soğan", 90), optional("Pirinç", 35)], ["sebze", "hafif"]),
        ("Zeytinyağlı Karnabahar", [mandatory("Karnabahar", 420)], [optional("Havuç", 90), optional("Soğan", 90)], ["sebze", "kış"]),
        ("Zeytinyağlı Bakla", [mandatory("Bakla", 260)], [optional("Dereotu", 10), optional("Soğan", 90)], ["baklagil", "ilkbahar"]),
        ("İmam Bayıldı", [mandatory("Patlıcan", 420)], [optional("Domates", 180), optional("Soğan", 120), optional("Sarımsak", 12)], ["sebze", "fırın"]),
        ("Portakallı Kereviz", [mandatory("Kereviz", 380)], [optional("Havuç", 100), optional("Portakal Suyu", 80, "ml")], ["sebze", "ferah"]),
        ("Zeytinyağlı Biber Yemeği", [mandatory("Kapya Biber", 360)], [optional("Domates", 160), optional("Soğan", 90)], ["sebze", "yaz"]),
    ]
    for name, vegetables, extras, tags in zeytinyagli_specs:
        make_zeytinyagli(recipes, name, vegetables, extras, tags=tags)

    # Dolma ve sarma
    dolma_specs = [
        ("Zeytinyağlı Yaprak Sarma", "Asma Yaprağı", "zeytinyağlı", None),
        ("Zeytinyağlı Lahana Sarması", "Lahana", "zeytinyağlı", None),
        ("Zeytinyağlı Biber Dolması", "Kapya Biber", "zeytinyağlı", None),
        ("Zeytinyağlı Kabak Dolması", "Kabak", "zeytinyağlı", None),
        ("Zeytinyağlı Patlıcan Dolması", "Patlıcan", "zeytinyağlı", None),
        ("Etli Yaprak Sarma", "Asma Yaprağı", "etli", "Dana Kıyma"),
        ("Etli Lahana Sarması", "Lahana", "etli", "Dana Kıyma"),
        ("Etli Biber Dolması", "Kapya Biber", "etli", "Dana Kıyma"),
        ("Etli Kabak Dolması", "Kabak", "etli", "Dana Kıyma"),
        ("Etli Patlıcan Dolması", "Patlıcan", "etli", "Dana Kıyma"),
    ]
    for name, vessel, style, protein_name in dolma_specs:
        make_dolma_or_sarma(recipes, name, vessel, style=style, protein_name=protein_name)

    # Legume mains
    legume_specs = [
        ("Klasik Kuru Fasulye", "Kuru Fasulye", ["Domates", "Kapya Biber"], None, ["bakliyat"]),
        ("Sebzeli Kuru Fasulye", "Kuru Fasulye", ["Havuç", "Kapya Biber"], None, ["bakliyat", "sebze"]),
        ("Etli Nohut Yemeği", "Nohut", ["Havuç", "Domates"], "Dana Kuşbaşı", ["bakliyat", "etli"]),
        ("Tavuklu Nohut Yemeği", "Nohut", ["Kapya Biber", "Domates"], "Tavuk Göğsü", ["bakliyat", "tavuk"]),
        ("Yeşil Mercimek Yemeği", "Yeşil Mercimek", ["Havuç", "Patates"], None, ["bakliyat"]),
        ("Erişteli Yeşil Mercimek", "Yeşil Mercimek", ["Havuç"], None, ["bakliyat", "erişteli"]),
        ("Nohutlu Ispanak Yemeği", "Nohut", ["Ispanak", "Soğan"], None, ["bakliyat", "sebze"]),
        ("Kıymalı Bezelye", "Bezelye", ["Havuç", "Patates"], "Dana Kıyma", ["sebze", "kıymalı"]),
        ("Etli Bezelye", "Bezelye", ["Havuç", "Patates"], "Dana Kuşbaşı", ["sebze", "etli"]),
        ("Kıymalı Taze Fasulye", "Taze Fasulye", ["Domates", "Soğan"], "Dana Kıyma", ["sebze", "kıymalı"]),
        ("Etli Bamya", "Bamya", ["Domates", "Soğan"], "Dana Kuşbaşı", ["sebze", "etli"]),
        ("Kıymalı Kabak Yemeği", "Kabak", ["Domates", "Soğan"], "Dana Kıyma", ["sebze", "kıymalı"]),
        ("Etli Kereviz", "Kereviz", ["Havuç", "Soğan"], "Dana Kuşbaşı", ["sebze", "etli"]),
        ("Nohutlu Pazı Yemeği", "Nohut", ["Pazı", "Soğan"], None, ["bakliyat", "sebze"]),
        ("Barbunya Pilaki", "Barbunya", ["Havuç", "Domates"], None, ["bakliyat", "zeytinyağlı"]),
        ("Börülce Yemeği", "Börülce", ["Domates", "Soğan"], None, ["bakliyat"]),
        ("Mercimekli Pazı Yemeği", "Yeşil Mercimek", ["Pazı", "Soğan"], None, ["bakliyat", "sebze"]),
        ("Tavuklu Barbunya Yemeği", "Barbunya", ["Domates", "Kapya Biber"], "Tavuk Göğsü", ["bakliyat", "tavuk"]),
    ]
    for name, base_legume, vegetables, protein_name, tags in legume_specs:
        make_legume_main(recipes, name, base_legume, vegetables, protein_name=protein_name, tags=tags)

    # Meat & chicken mains
    main_specs = [
        ("Sebzeli Tavuk Sote", "Tavuk Göğsü", ["Kapya Biber", "Mantar", "Kabak"], ["tavuk", "sote"], "sote"),
        ("Mantarlı Tavuk Sote", "Tavuk Göğsü", ["Mantar", "Soğan", "Kapya Biber"], ["tavuk", "sote"], "sote"),
        ("Fırında Sebzeli Tavuk", "Tavuk Göğsü", ["Patates", "Havuç", "Kapya Biber"], ["tavuk", "fırın"], "fırın"),
        ("Tavuk Güveç", "Tavuk But", ["Patlıcan", "Kabak", "Domates"], ["tavuk", "güveç"], "güveç"),
        ("Yoğurtlu Tavuklu Kabak", "Tavuk Göğsü", ["Kabak", "Soğan"], ["tavuk", "yoğurtlu"], "sote"),
        ("Tavuk Kapama", "Tavuk But", ["Pirinç", "Havuç", "Bezelye"], ["tavuk", "tek tencere"], "güveç"),
        ("Ispanaklı Tavuk Sarma", "Tavuk Göğsü", ["Ispanak", "Beyaz Peynir"], ["tavuk", "fırın"], "fırın"),
        ("Kabaklı Tavuk Güveci", "Tavuk Göğsü", ["Kabak", "Domates", "Soğan"], ["tavuk", "güveç"], "güveç"),
        ("Sebzeli Hindi Sote", "Hindi Göğsü", ["Kapya Biber", "Mantar", "Kabak"], ["hindi", "sote"], "sote"),
        ("Fırında Hindi Sebze", "Hindi Göğsü", ["Patates", "Havuç", "Kapya Biber"], ["hindi", "fırın"], "fırın"),
        ("Mantar Soslu Hindi", "Hindi Göğsü", ["Mantar", "Soğan"], ["hindi", "sote"], "sote"),
        ("Taze Fasulyeli Tavuk", "Tavuk Göğsü", ["Taze Fasulye", "Domates"], ["tavuk", "ev yemeği"], "güveç"),
        ("Tas Kebabı", "Dana Kuşbaşı", ["Patates", "Havuç", "Kapya Biber"], ["etli", "geleneksel"], "güveç"),
        ("Orman Kebabı", "Dana Kuşbaşı", ["Patates", "Bezelye", "Havuç"], ["etli", "geleneksel"], "güveç"),
        ("Sebzeli Dana Sote", "Dana Kuşbaşı", ["Kapya Biber", "Mantar", "Soğan"], ["etli", "sote"], "sote"),
        ("Etli Türlü", "Dana Kuşbaşı", ["Patlıcan", "Kabak", "Patates"], ["etli", "geleneksel"], "güveç"),
        ("Kabaklı Musakka", "Dana Kıyma", ["Kabak", "Domates", "Soğan"], ["kıymalı", "fırın"], "fırın"),
        ("Patlıcan Musakka", "Dana Kıyma", ["Patlıcan", "Domates", "Soğan"], ["kıymalı", "fırın"], "fırın"),
        ("Kıymalı Pırasa", "Dana Kıyma", ["Pırasa", "Havuç"], ["kıymalı", "ev yemeği"], "güveç"),
        ("Kıymalı Ispanak", "Dana Kıyma", ["Ispanak", "Soğan"], ["kıymalı", "ev yemeği"], "güveç"),
        ("Kıymalı Karnabahar", "Dana Kıyma", ["Karnabahar", "Domates"], ["kıymalı", "ev yemeği"], "güveç"),
        ("Beyti Usulü Fırın Tavuk", "Tavuk Göğsü", ["Yufka", "Yoğurt"], ["tavuk", "fırın"], "fırın"),
        ("Yoğurtlu Et Sote", "Dana Kuşbaşı", ["Mantar", "Yoğurt"], ["etli", "sote"], "sote"),
        ("Kuzu Etli Sebze Güveç", "Kuzu Kuşbaşı", ["Patlıcan", "Kabak", "Kapya Biber"], ["kuzu", "güveç"], "güveç"),
    ]
    for name, protein_name, vegetables, tags, method in main_specs:
        make_main_protein(recipes, name, protein_name, vegetables, tags=tags, method=method)

    # Köfte
    kofte_specs = [
        ("İzmir Köfte", ["Patates", "Domates", "Kapya Biber"], True, ["fırın", "geleneksel"]),
        ("Fırında Köfte Patates", ["Patates", "Kapya Biber"], True, ["fırın", "geleneksel"]),
        ("Sebzeli Köfte Güveç", ["Patlıcan", "Kabak", "Domates"], True, ["güveç", "geleneksel"]),
        ("Yoğurtlu Köfte", ["Yoğurt", "Nane"], False, ["yoğurtlu", "ev yemeği"]),
        ("Sulu Köfte", ["Patates", "Havuç"], True, ["sulu yemek", "geleneksel"]),
        ("Nohutlu Sulu Köfte", ["Nohut", "Havuç"], True, ["sulu yemek", "bakliyat"]),
        ("Fırında Kaşarlı Köfte", ["Kaşar Peyniri", "Domates"], True, ["fırın", "kaşarlı"]),
        ("Kabaklı Köfte Dizmesi", ["Kabak", "Domates"], True, ["fırın", "sebze"]),
        ("Patlıcanlı Köfte Dizmesi", ["Patlıcan", "Domates"], True, ["fırın", "sebze"]),
        ("Karnabaharlı Köfte Fırın", ["Karnabahar", "Domates"], True, ["fırın", "sebze"]),
    ]
    for name, additions, saucey, tags in kofte_specs:
        make_kofte(recipes, name, additions, saucey=saucey, tags=tags)

    # Fish
    fish_specs = [
        ("Fırında Levrek", "Levrek Fileto", ["Patates", "Kapya Biber"], ["fırın", "balık"], "fırın"),
        ("Fırında Sebzeli Levrek", "Levrek Fileto", ["Kabak", "Kapya Biber", "Soğan"], ["fırın", "sebze"], "fırın"),
        ("Hamsi Buğulama", "Hamsi", ["Soğan", "Domates"], ["geleneksel", "balık"], "fırın"),
        ("Fırında Hamsi", "Hamsi", ["Patates", "Soğan"], ["geleneksel", "balık"], "fırın"),
        ("Izgara Somon", "Somon Fileto", ["Brokoli", "Havuç"], ["ızgara", "omega-3"], "ızgara"),
        ("Fırında Somonlu Sebzeler", "Somon Fileto", ["Kabak", "Brokoli", "Kapya Biber"], ["fırın", "omega-3"], "fırın"),
        ("Palamut Izgara", "Palamut", ["Roka", "Soğan"], ["ızgara", "balık"], "ızgara"),
        ("Palamut Buğulama", "Palamut", ["Soğan", "Domates"], ["geleneksel", "balık"], "fırın"),
        ("Karides Güveç", "Karides", ["Mantar", "Kapya Biber", "Domates"], ["deniz ürünü", "güveç"], "güveç"),
        ("Karides Sote", "Karides", ["Mantar", "Kapya Biber"], ["deniz ürünü", "sote"], "sote"),
        ("Ton Balıklı Kapya Dolması", "Ton Balığı", ["Kapya Biber", "Pirinç"], ["balık", "dolma"], "fırın"),
        ("Limonlu Fırın Palamut", "Palamut", ["Patates", "Soğan"], ["balık", "fırın"], "fırın"),
        ("Sebzeli Somon Güveç", "Somon Fileto", ["Kabak", "Mantar", "Soğan"], ["omega-3", "güveç"], "güveç"),
        ("Hamsi Tava Fırın", "Hamsi", ["Kapya Biber", "Soğan"], ["balık", "fırın"], "fırın"),
        ("Rokalı Ton Balığı Tabağı", "Ton Balığı", ["Roka", "Domates"], ["balık", "soğuk servis"], "ızgara"),
        ("Levrekli Kağıt Kebabı", "Levrek Fileto", ["Kabak", "Domates", "Soğan"], ["balık", "fırın"], "fırın"),
    ]
    for name, fish_name, vegetables, tags, method in fish_specs:
        make_fish(recipes, name, fish_name, vegetables, tags=tags, method=method)

    # Pilav, makarna, erişte
    pilaf_specs = [
        ("Şehriyeli Pirinç Pilavı", "Pirinç", ["Arpa Şehriye"], ["geleneksel", "yardımcı"]),
        ("Domatesli Bulgur Pilavı", "Bulgur", ["Domates", "Kapya Biber"], ["geleneksel", "yardımcı"]),
        ("Sebzeli Bulgur Pilavı", "Bulgur", ["Kabak", "Havuç", "Kapya Biber"], ["sebze", "yardımcı"]),
        ("Nohutlu Pirinç Pilavı", "Pirinç", ["Nohut"], ["bakliyat", "yardımcı"]),
        ("İç Pilav", "Baldo Pirinç", ["Dolmalık Fıstık", "Kuş Üzümü"], ["geleneksel", "özel gün"]),
        ("Yeşil Mercimekli Bulgur Pilavı", "Bulgur", ["Yeşil Mercimek"], ["bakliyat", "tek tabak"]),
        ("Tavuklu Arpa Şehriye Pilavı", "Arpa Şehriye", ["Tavuk Göğsü", "Bezelye"], ["tavuk", "tek tabak"]),
        ("Sebzeli Erişte", "Erişte", ["Kapya Biber", "Kabak", "Mantar"], ["erişte", "sebze"]),
        ("Yoğurtlu Erişte", "Erişte", ["Yoğurt", "Nane"], ["erişte", "yoğurtlu"]),
        ("Kıymalı Erişte", "Erişte", ["Dana Kıyma", "Domates"], ["erişte", "kıymalı"]),
        ("Domatesli Tam Buğday Makarna", "Tam Buğday Makarna", ["Domates", "Kapya Biber"], ["makarna", "sebze"]),
        ("Ispanaklı Makarna", "Tam Buğday Makarna", ["Ispanak", "Yoğurt"], ["makarna", "sebze"]),
        ("Nohutlu Makarna", "Tam Buğday Makarna", ["Nohut", "Domates"], ["makarna", "bakliyat"]),
        ("Mantarlı Erişte Tavası", "Erişte", ["Mantar", "Soğan"], ["erişte", "tava"]),
        ("Bulgurlu Pazı Pilavı", "Bulgur", ["Pazı", "Soğan"], ["sebze", "tek tabak"]),
        ("Sebzeli Arpa Şehriye", "Arpa Şehriye", ["Kapya Biber", "Mantar"], ["şehriye", "sebze"]),
        ("Domatesli Erişte Aşı", "Erişte", ["Domates", "Yeşil Mercimek"], ["erişte", "bakliyat"]),
        ("Kabaklı Tam Buğday Makarna", "Tam Buğday Makarna", ["Kabak", "Yoğurt"], ["makarna", "sebze"]),
        ("Kıymalı Bulgur Pilavı", "Bulgur", ["Dana Kıyma", "Domates"], ["bulgur", "kıymalı"]),
        ("Naneli Yoğurtlu Pirinç Pilavı", "Pirinç", ["Yoğurt", "Nane"], ["pirinç", "yoğurtlu"]),
    ]
    for name, base_name, additions, tags in pilaf_specs:
        make_pilaf_or_pasta(recipes, name, base_name, additions, tags=tags)

    # Ek fırın / dolgu tarifleri
    stuffed_specs = [
        ("Kabak Sandal", "Kabak", ["Dana Kıyma", "Domates", "Soğan"]),
        ("Patlıcan Sandal", "Patlıcan", ["Dana Kıyma", "Domates", "Soğan"]),
        ("Mantarlı Sebze Güveci", "Mantar", ["Kabak", "Kapya Biber", "Domates"]),
        ("Fırında Karnabahar Graten", "Karnabahar", ["Yoğurt", "Kaşar Peyniri", "Yumurta"]),
        ("Fırında Brokoli Graten", "Brokoli", ["Yoğurt", "Kaşar Peyniri", "Yumurta"]),
        ("Patatesli Tavuk Dizme", "Patates", ["Tavuk Göğsü", "Domates", "Soğan"]),
        ("Kabukta Patlıcan Karnıyarık", "Patlıcan", ["Dana Kıyma", "Domates", "Soğan"]),
        ("Fırında Sebzeli Hindi Dizme", "Hindi Göğsü", ["Patates", "Kabak", "Kapya Biber"]),
        ("Kıymalı Karnabahar Tepsisi", "Karnabahar", ["Dana Kıyma", "Domates", "Soğan"]),
        ("Tavuklu Patates Oturtma", "Patates", ["Tavuk Göğsü", "Domates", "Soğan"]),
        ("Kaşarlı Sebze Tepsisi", "Kabak", ["Patlıcan", "Kapya Biber", "Kaşar Peyniri"]),
        ("Fırında Pırasalı Tavuk", "Pırasa", ["Tavuk Göğsü", "Havuç", "Yoğurt"]),
    ]
    for name, vessel, additions in stuffed_specs:
        main = additions[0]
        if main in {"Dana Kıyma", "Tavuk Göğsü", "Hindi Göğsü"}:
            uses = [mandatory(main, 220, "gram"), mandatory(vessel, 260, "gram")]
            uses.extend(optional(item, 110, "gram") for item in additions[1:])
            tags = ["fırın", "ana yemek", "Türk mutfağı"]
            if main == "Dana Kıyma":
                tags.append("kıymalı")
            elif main == "Tavuk Göğsü":
                tags.append("tavuk")
            else:
                tags.append("hindi")
        else:
            uses = [mandatory(vessel, 260, "gram")]
            uses.extend(optional(item, 100 if item != "Kaşar Peyniri" else 60, "gram") for item in additions)
            tags = ["fırın", "sebze", "Türk mutfağı"]
        uses.extend([flavor("Zeytinyağı", 12, "ml"), flavor("Karabiber", 1, "gram")])
        add_recipe(
            recipes,
            name=name,
            description=f"{name}, fırında kat kat ya da tek tepside pişen, sebze ve protein dengesini koruyan özenli bir Türk fırın yemeğidir.",
            prep_minutes=22,
            cook_minutes=34,
            servings=4,
            tags=tags,
            steps=[
                "Sebze tabanını hazırlayıp gerekirse içini oyup kullanıma hazır hale getirin.",
                "Ana harcı veya protein tabanını kısa süre ön pişirmeden geçirin.",
                "Malzemeleri tepsiye düzenli şekilde yerleştirip baharatlayın.",
                "Fırında üzeri kızarana ve içi yumuşayana kadar pişirin.",
                "Kısa bir dinlenmenin ardından servis edin.",
            ],
            uses=uses,
        )

    # Ek Türk mutfağı varyasyonları
    extra_soup_specs = [
        ("Terbiyeli Sebze Çorbası", [mandatory("Yoğurt", 180), mandatory("Yumurta", 1, "adet")], [optional("Havuç", 90), optional("Kabak", 100)], [flavor("Nane", 2), flavor("Tereyağı", 7, "gram")], False, ["sebze", "yoğurtlu"]),
        ("Nohutlu Tarhana Çorbası", [mandatory("Tarhana", 110), mandatory("Nohut", 90)], [optional("Soğan", 70)], [flavor("Tereyağı", 7, "gram"), flavor("Pul Biber", 1)], False, ["geleneksel", "bakliyat"]),
        ("Domatesli Şehriye Çorbası", [mandatory("Domates", 260), mandatory("Tel Şehriye", 65)], [optional("Soğan", 60)], [flavor("Tereyağı", 7, "gram"), flavor("Karabiber", 1)], False, ["geleneksel", "şehriyeli"]),
        ("Ispanaklı Yoğurt Çorbası", [mandatory("Yoğurt", 200), mandatory("Ispanak", 180)], [optional("Pirinç", 45)], [flavor("Nane", 2), flavor("Zeytinyağı", 8, "ml")], False, ["sebze", "yoğurtlu"]),
        ("Köz Patlıcan Çorbası", [mandatory("Patlıcan", 280)], [optional("Soğan", 70), optional("Süt", 100, "ml")], [flavor("Zeytinyağı", 8, "ml"), flavor("Karabiber", 1)], True, ["sebze", "köz aroması"]),
        ("Sebzeli Bulgur Çorbası", [mandatory("Bulgur", 75)], [optional("Havuç", 70), optional("Kabak", 80), optional("Soğan", 70)], [flavor("Domates Salçası", 14), flavor("Zeytinyağı", 8, "ml")], False, ["sebze", "geleneksel"]),
        ("Havuçlu Tarhana Çorbası", [mandatory("Tarhana", 115)], [optional("Havuç", 90), optional("Soğan", 60)], [flavor("Tereyağı", 7, "gram"), flavor("Pul Biber", 1)], False, ["geleneksel", "kış yemeği"]),
        ("Arpa Şehriyeli Yoğurt Çorbası", [mandatory("Yoğurt", 190), mandatory("Arpa Şehriye", 60)], [optional("Yumurta", 1, "adet")], [flavor("Nane", 2), flavor("Tereyağı", 7, "gram")], False, ["yoğurtlu", "şehriyeli"]),
    ]
    for name, mains, veggies, seasonings, blended, tags in extra_soup_specs:
        make_soup(recipes, name, mains, veggies, seasonings, tags=tags, blended=blended)

    extra_menemen_specs = [
        ("Kaşarlı Mantarlı Menemen", ["Mantar"], "Kaşar Peyniri"),
        ("Patatesli Menemen", ["Patates"], None),
        ("Taze Soğanlı Menemen", ["Taze Soğan"], "Beyaz Peynir"),
        ("Beyaz Peynirli Kabaklı Menemen", ["Kabak"], "Beyaz Peynir"),
    ]
    for name, extras, cheese in extra_menemen_specs:
        make_menemen(recipes, name, extras, cheese)

    extra_omelet_specs = [
        ("Hellimli Kapya Biberli Omlet", ["Kapya Biber"], "Hellim", ["Maydanoz"]),
        ("Soğanlı Kaşarlı Omlet", ["Soğan"], "Kaşar Peyniri", ["Maydanoz"]),
        ("Havuçlu Lorlu Omlet", ["Havuç"], "Lor Peyniri", ["Dereotu"]),
        ("Roka ve Beyaz Peynirli Omlet", ["Roka"], "Beyaz Peynir", ["Maydanoz"]),
        ("Semizotlu Hellimli Omlet", ["Semizotu"], "Hellim", ["Dereotu"]),
        ("Pazılı Hellimli Omlet", ["Pazı"], "Hellim", ["Nane"]),
    ]
    for name, vegs, cheese, herbs in extra_omelet_specs:
        make_omelet(recipes, name, vegs, cheese, herbs)

    extra_salad_specs = [
        ("Sumaklı Soğan Salatası", [mandatory("Soğan", 180)], [optional("Maydanoz", 15), optional("Domates", 120)], [flavor("Zeytinyağı", 10, "ml"), flavor("Sumak", 3), flavor("Limon Suyu", 8, "ml")], ["ferah", "sofra salatası"]),
        ("Mercimekli Roka Salatası", [mandatory("Yeşil Mercimek", 180), mandatory("Roka", 90)], [optional("Domates", 120), optional("Soğan", 50)], [flavor("Zeytinyağı", 10, "ml"), flavor("Limon Suyu", 8, "ml")], ["bakliyat", "yeşillik"]),
        ("Tahinli Nohut Salatası", [mandatory("Nohut", 190)], [optional("Salatalık", 120), optional("Domates", 120), optional("Maydanoz", 10)], [flavor("Tahin", 18, "gram"), flavor("Limon Suyu", 8, "ml"), flavor("Zeytinyağı", 8, "ml")], ["bakliyat", "tahinli"]),
        ("Cevizli Pazı Salatası", [mandatory("Pazı", 180)], [optional("Ceviz", 25), optional("Soğan", 50)], [flavor("Zeytinyağı", 10, "ml"), flavor("Limon Suyu", 8, "ml")], ["sebze", "cevizli"]),
    ]
    for name, mains, additions, dressings, tags in extra_salad_specs:
        make_salad(recipes, name, mains, additions, dressings, tags=tags)

    extra_meze_specs = [
        ("Yoğurtlu Karnabahar Salatası", [mandatory("Karnabahar", 240), mandatory("Yoğurt", 170)], [optional("Sarımsak", 8)], [flavor("Zeytinyağı", 8, "ml")], ["yoğurtlu", "sebze"], 12),
        ("Köz Biber Salatası", [mandatory("Kapya Biber", 260)], [optional("Sarımsak", 8), optional("Maydanoz", 10)], [flavor("Zeytinyağı", 10, "ml"), flavor("Limon Suyu", 8, "ml")], ["köz", "sebze"], 18),
        ("Cevizli Pancar Tarator", [mandatory("Pancar", 220), mandatory("Yoğurt", 170)], [optional("Ceviz", 25), optional("Sarımsak", 8)], [flavor("Zeytinyağı", 8, "ml")], ["yoğurtlu", "cevizli"], 12),
        ("Yoğurtlu Taze Fasulye Mezesi", [mandatory("Taze Fasulye", 220), mandatory("Yoğurt", 170)], [optional("Sarımsak", 8)], [flavor("Zeytinyağı", 8, "ml")], ["yoğurtlu", "sebze"], 16),
    ]
    for name, mains, additions, dressings, tags, cook_minutes in extra_meze_specs:
        make_meze(recipes, name, mains, additions, dressings, tags=tags, cook_minutes=cook_minutes)

    extra_zeytinyagli_specs = [
        ("Zeytinyağlı Bezelye", [mandatory("Bezelye", 360)], [optional("Havuç", 90), optional("Soğan", 90)], ["sebze", "bahar"]),
        ("Domatesli Zeytinyağlı Patlıcan", [mandatory("Patlıcan", 380)], [optional("Domates", 160), optional("Soğan", 90)], ["sebze", "yaz"]),
        ("Zeytinyağlı Kapuska", [mandatory("Lahana", 420)], [optional("Havuç", 90), optional("Soğan", 90)], ["sebze", "kış"]),
        ("Zeytinyağlı Brokoli", [mandatory("Brokoli", 360)], [optional("Havuç", 90), optional("Soğan", 80)], ["sebze", "hafif"]),
        ("Zeytinyağlı Semizotu", [mandatory("Semizotu", 320)], [optional("Soğan", 80), optional("Pirinç", 35)], ["sebze", "hafif"]),
        ("Zeytinyağlı Havuç", [mandatory("Havuç", 360)], [optional("Dereotu", 10), optional("Soğan", 70)], ["sebze", "soğuk servis"]),
    ]
    for name, vegetables, extras, tags in extra_zeytinyagli_specs:
        make_zeytinyagli(recipes, name, vegetables, extras, tags=tags)

    extra_legume_specs = [
        ("Tavuklu Yeşil Mercimek Yemeği", "Yeşil Mercimek", ["Havuç", "Domates"], "Tavuk Göğsü", ["bakliyat", "tavuk"]),
        ("Kıymalı Barbunya Yemeği", "Barbunya", ["Domates", "Soğan"], "Dana Kıyma", ["bakliyat", "kıymalı"]),
        ("Havuçlu Nohut Yemeği", "Nohut", ["Havuç", "Kapya Biber"], None, ["bakliyat", "sebze"]),
        ("Bulgurlu Kuru Fasulye", "Kuru Fasulye", ["Bulgur", "Domates"], None, ["bakliyat", "tek tabak"]),
    ]
    for name, base_legume, vegetables, protein_name, tags in extra_legume_specs:
        make_legume_main(recipes, name, base_legume, vegetables, protein_name=protein_name, tags=tags)

    extra_main_specs = [
        ("Brokolili Tavuk Sote", "Tavuk Göğsü", ["Brokoli", "Kapya Biber", "Soğan"], ["tavuk", "sote"], "sote"),
        ("Kapya Biberli Hindi Güveç", "Hindi Göğsü", ["Kapya Biber", "Domates", "Soğan"], ["hindi", "güveç"], "güveç"),
        ("Karidesli Sebze Güveç", "Karides", ["Kabak", "Domates", "Kapya Biber"], ["deniz ürünü", "güveç"], "güveç"),
        ("Kuzu Etli Bamya", "Kuzu Kuşbaşı", ["Bamya", "Domates", "Soğan"], ["kuzu", "geleneksel"], "güveç"),
        ("Patlıcanlı Hindi Sote", "Hindi Göğsü", ["Patlıcan", "Kapya Biber", "Soğan"], ["hindi", "sote"], "sote"),
        ("Kaşarlı Tavuk Güveç", "Tavuk Göğsü", ["Domates", "Kapya Biber", "Kaşar Peyniri"], ["tavuk", "güveç"], "güveç"),
    ]
    for name, protein_name, vegetables, tags, method in extra_main_specs:
        make_main_protein(recipes, name, protein_name, vegetables, tags=tags, method=method)

    extra_fish_specs = [
        ("Fırında Kabaklı Somon", "Somon Fileto", ["Kabak", "Kapya Biber"], ["balık", "fırın"], "fırın"),
        ("Kekikli Levrek Güveç", "Levrek Fileto", ["Domates", "Kapya Biber", "Soğan"], ["balık", "güveç"], "fırın"),
        ("Sebzeli Palamut Fırın", "Palamut", ["Patates", "Soğan", "Domates"], ["balık", "fırın"], "fırın"),
        ("Domatesli Karides Güveç", "Karides", ["Domates", "Kapya Biber", "Soğan"], ["deniz ürünü", "güveç"], "fırın"),
    ]
    for name, fish_name, vegetables, tags, method in extra_fish_specs:
        make_fish(recipes, name, fish_name, vegetables, tags=tags, method=method)

    extra_pilaf_specs = [
        ("Esmer Pirinçli Sebze Pilavı", "Esmer Pirinç", ["Kabak", "Havuç", "Kapya Biber"], ["pilav", "sebze"]),
        ("Bademli İç Pilav", "Baldo Pirinç", ["Badem", "Kuş Üzümü"], ["geleneksel", "özel gün"]),
        ("Ton Balıklı Arpa Şehriye", "Arpa Şehriye", ["Ton Balığı", "Domates"], ["şehriye", "balık"]),
        ("Brokolili Tam Buğday Makarna", "Tam Buğday Makarna", ["Brokoli", "Yoğurt"], ["makarna", "sebze"]),
        ("Kapya Biberli Bulgur Pilavı", "Bulgur", ["Kapya Biber", "Domates"], ["bulgur", "yardımcı"]),
        ("Karnabaharlı Arpa Şehriye", "Arpa Şehriye", ["Karnabahar", "Soğan"], ["şehriye", "sebze"]),
    ]
    for name, base_name, additions, tags in extra_pilaf_specs:
        make_pilaf_or_pasta(recipes, name, base_name, additions, tags=tags)

    return recipes


def load_existing_recipe_names() -> set[str]:
    names: set[str] = set()
    for path in EXISTING_RECIPE_FILES:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                if row.get("Name"):
                    names.add(normalize_key(row["Name"]))
    return names


def load_existing_ingredient_rows() -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    rows_by_id: dict[str, dict[str, str]] = {}
    rows_by_key: dict[str, dict[str, str]] = {}
    for path in EXISTING_INGREDIENT_FILES:
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                ingredient_id = row["Id"]
                rows_by_id.setdefault(ingredient_id, row)
                keys = {normalize_key(row.get("Name", "")), normalize_key(row.get("CanonicalName", ""))}
                aliases_raw = row.get("Aliases", "[]")
                try:
                    aliases = json.loads(aliases_raw)
                except json.JSONDecodeError:
                    aliases = []
                for alias in aliases:
                    keys.add(normalize_key(alias))
                for key in keys:
                    if key:
                        rows_by_key.setdefault(key, row)
    return rows_by_id, rows_by_key


def ingredient_row_from_def(ingredient: IngredientDef, existing_row: dict[str, str] | None) -> tuple[str, dict[str, str], bool]:
    if existing_row is not None:
        row = {
            "Id": existing_row["Id"],
            "Name": existing_row["Name"],
            "IsMandatory": existing_row["IsMandatory"],
            "IsProhibited": existing_row["IsProhibited"],
            "CanonicalName": existing_row["CanonicalName"],
            "Aliases": existing_row["Aliases"],
            "IsActive": existing_row["IsActive"],
            "IsCondiment": existing_row["IsCondiment"],
        }
        return existing_row["Id"], row, False

    row = {
        "Id": ingredient_uuid(ingredient.name),
        "Name": ingredient.name,
        "IsMandatory": "False",
        "IsProhibited": "False",
        "CanonicalName": ingredient.name,
        "Aliases": json.dumps(ingredient_aliases(ingredient), ensure_ascii=False),
        "IsActive": "True",
        "IsCondiment": "True" if ingredient.condiment else "False",
    }
    return row["Id"], row, True


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    seed_ingredients()

    existing_recipe_names = load_existing_recipe_names()
    _, existing_rows_by_key = load_existing_ingredient_rows()

    raw_candidates = build_candidates()
    selected: list[RecipeCandidate] = []
    seen_names: set[str] = set()
    for candidate in raw_candidates:
        key = normalize_key(candidate.name)
        if key in existing_recipe_names or key in seen_names:
            continue
        seen_names.add(key)
        selected.append(candidate)
        if len(selected) == TARGET_COUNT:
            break

    if len(selected) < TARGET_COUNT:
        raise RuntimeError(f"Only generated {len(selected)} unique recipes; expected {TARGET_COUNT}.")

    ingredient_rows: list[dict[str, str]] = []
    missing_ingredient_rows: list[dict[str, str]] = []
    ingredient_id_by_name: dict[str, str] = {}
    ingredient_row_by_id: dict[str, dict[str, str]] = {}

    used_ingredient_names = unique(
        use.ingredient_name
        for recipe in selected
        for use in recipe.uses
    )

    for ingredient_name in used_ingredient_names:
        ingredient = INGREDIENTS[ingredient_name]
        candidate_keys = {normalize_key(ingredient.name)}
        candidate_keys.update(normalize_key(alias) for alias in ingredient_aliases(ingredient))
        existing_row = None
        for key in candidate_keys:
            if key and key in existing_rows_by_key:
                existing_row = existing_rows_by_key[key]
                break
        ingredient_id, row, is_missing = ingredient_row_from_def(ingredient, existing_row)
        ingredient_id_by_name[ingredient_name] = ingredient_id
        ingredient_row_by_id[ingredient_id] = row
        ingredient_rows.append(row)
        if is_missing:
            missing_ingredient_rows.append(row)

    recipes_rows: list[dict[str, str]] = []
    recipe_ingredient_rows: list[dict[str, str]] = []
    recipe_mandatory_rows: list[dict[str, str]] = []
    recipe_optional_rows: list[dict[str, str]] = []
    created_base = datetime(2026, 4, 26, 8, 0, tzinfo=timezone.utc)

    for recipe_index, recipe in enumerate(selected):
        recipe_id = recipe_uuid(recipe.name)
        calories_kcal, carbs_grams, fat_grams, protein_grams = compute_recipe_macros(recipe.uses, recipe.servings)
        slug_suffix = recipe_id.split("-")[0][:6]
        recipes_rows.append(
            {
                "Id": recipe_id,
                "DietitianId": DIETITIAN_ID,
                "Name": recipe.name,
                "Description": recipe.description,
                "IsPublic": "True",
                "IsDemo": "False",
                "IsDraft": "False",
                "IsHiddenFromProduction": "False",
                "StepsJson": json.dumps(recipe.steps, ensure_ascii=False),
                "ArchivedAtUtc": "",
                "CookTimeMinutes": str(recipe.cook_minutes),
                "IsArchived": "False",
                "PrepTimeMinutes": str(recipe.prep_minutes),
                "Servings": str(recipe.servings),
                "TagsJson": json.dumps(unique([*recipe.tags, "Selin Aydın", "Aydın Sağlık Merkezi"]), ensure_ascii=False),
                "Slug": f"{slugify(recipe.name)}-{slug_suffix}",
                "CaloriesKcal": str(calories_kcal),
                "CarbsGrams": carbs_grams,
                "FatGrams": fat_grams,
                "ProteinGrams": protein_grams,
            }
        )

        recipe_created_at = created_base + timedelta(minutes=recipe_index * 7)
        for use_index, use in enumerate(recipe.uses):
            ingredient_id = ingredient_id_by_name[use.ingredient_name]
            created_at = recipe_created_at + timedelta(minutes=use_index * 2)
            recipe_ingredient_rows.append(
                {
                    "Id": recipe_ingredient_uuid(recipe_id, ingredient_id, use.role, use_index),
                    "RecipeId": recipe_id,
                    "IngredientId": ingredient_id,
                    "Role": use.role,
                    "Quantity": f"{use.quantity:.2f}",
                    "Unit": use.unit,
                    "CreatedAtUtc": created_at.strftime("%Y-%m-%d %H:%M:%S.000000+00"),
                }
            )
            if use.role == "Mandatory":
                recipe_mandatory_rows.append(
                    {
                        "RecipeId": recipe_id,
                        "IngredientId": ingredient_id,
                    }
                )
            elif use.role == "Optional":
                recipe_optional_rows.append(
                    {
                        "RecipeId": recipe_id,
                        "IngredientId": ingredient_id,
                    }
                )

    ingredient_rows.sort(key=lambda row: normalize_key(row["Name"]))
    missing_ingredient_rows.sort(key=lambda row: normalize_key(row["Name"]))
    recipes_rows.sort(key=lambda row: normalize_key(row["Name"]))
    recipe_ingredient_rows.sort(key=lambda row: (row["RecipeId"], row["Role"], row["IngredientId"]))
    recipe_mandatory_rows.sort(key=lambda row: (row["RecipeId"], row["IngredientId"]))
    recipe_optional_rows.sort(key=lambda row: (row["RecipeId"], row["IngredientId"]))

    write_csv(
        OUTPUT_RECIPES,
        [
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
        ],
        recipes_rows,
    )

    write_csv(
        OUTPUT_INGREDIENTS,
        [
            "Id",
            "Name",
            "IsMandatory",
            "IsProhibited",
            "CanonicalName",
            "Aliases",
            "IsActive",
            "IsCondiment",
        ],
        ingredient_rows,
    )

    write_csv(
        OUTPUT_INGREDIENTS_MISSING,
        [
            "Id",
            "Name",
            "IsMandatory",
            "IsProhibited",
            "CanonicalName",
            "Aliases",
            "IsActive",
            "IsCondiment",
        ],
        missing_ingredient_rows,
    )

    write_csv(
        OUTPUT_RECIPE_INGREDIENTS,
        ["Id", "RecipeId", "IngredientId", "Role", "Quantity", "Unit", "CreatedAtUtc"],
        recipe_ingredient_rows,
    )

    write_csv(
        OUTPUT_RECIPE_MANDATORY,
        ["RecipeId", "IngredientId"],
        recipe_mandatory_rows,
    )

    write_csv(
        OUTPUT_RECIPE_OPTIONAL,
        ["RecipeId", "IngredientId"],
        recipe_optional_rows,
    )

    print(json.dumps(
        {
            "dietitianId": DIETITIAN_ID,
            "dietitianName": DIETITIAN_NAME,
            "recipes": len(recipes_rows),
            "ingredients": len(ingredient_rows),
            "missingIngredients": len(missing_ingredient_rows),
            "recipeIngredients": len(recipe_ingredient_rows),
            "recipeMandatoryIngredients": len(recipe_mandatory_rows),
            "recipeOptionalIngredients": len(recipe_optional_rows),
            "sampleRecipes": [row["Name"] for row in recipes_rows[:10]],
        },
        ensure_ascii=False,
        indent=2,
    ))


if __name__ == "__main__":
    main()
