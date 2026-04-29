from __future__ import annotations

import csv
import json
import random
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


OUTPUT_PATH = Path(r"C:\Users\hy971\source\repos\MyDietitianMobileApp\NewRecieps.csv")
NAMESPACE = uuid.UUID("6ec4a4ce-e26f-4592-bbdb-65f5095e97f8")


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
class Item:
    noun: str
    adj: str
    protein: float = 0.0
    carbs: float = 0.0
    fat: float = 0.0
    tags: tuple[str, ...] = ()


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
    Item("tavuk", "tavuklu", 28, 0, 7, ("yüksek protein",)),
    Item("hindi", "hindili", 27, 0, 6, ("yüksek protein",)),
    Item("somon", "somonlu", 26, 0, 16, ("omega-3", "yüksek protein")),
    Item("levrek", "levrekli", 25, 0, 10, ("balık", "yüksek protein")),
    Item("ton balığı", "ton balıklı", 24, 0, 9, ("balık", "yüksek protein")),
    Item("yumurta", "yumurtalı", 18, 1, 13, ("kahvaltı", "yüksek protein")),
    Item("lor peyniri", "lor peynirli", 20, 4, 8, ("kahvaltı", "protein")),
    Item("süzme yoğurt", "yoğurtlu", 16, 7, 9, ("fermente", "protein")),
    Item("tofu", "tofulu", 16, 5, 9, ("bitkisel protein",)),
    Item("yeşil mercimek", "mercimekli", 15, 24, 2, ("baklagil", "lif")),
    Item("nohut", "nohutlu", 13, 27, 4, ("baklagil", "lif")),
    Item("kuru fasulye", "fasulyeli", 14, 25, 2, ("baklagil", "lif")),
]

GRAINS = [
    Item("kinoa", "kinoalı", 5, 28, 3, ("kompleks karbonhidrat",)),
    Item("karabuğday", "karabuğdaylı", 5, 30, 2, ("glutensiz", "kompleks karbonhidrat")),
    Item("bulgur", "bulgurlu", 4, 31, 1, ("lif",)),
    Item("esmer pirinç", "esmer pirinçli", 4, 34, 2, ("denge",)),
    Item("tam buğday makarna", "tam buğday makarnalı", 7, 36, 2, ("tam tahıl",)),
    Item("yulaf", "yulaflı", 5, 27, 4, ("kahvaltı", "lif")),
    Item("chia", "chialı", 4, 12, 8, ("omega-3", "lif")),
    Item("tam buğday lavaş", "lavaşlı", 6, 29, 4, ("pratik",)),
    Item("kabak spagetti", "kabak spagettili", 2, 8, 1, ("düşük karbonhidrat",)),
]

VEGETABLES = [
    Item("kabak", "kabaklı", 1, 4, 0.2, ("sebze",)),
    Item("ıspanak", "ıspanaklı", 2, 3, 0.4, ("demir kaynağı",)),
    Item("brokoli", "brokolili", 3, 6, 0.5, ("lif",)),
    Item("renkli biber", "biberli", 1, 5, 0.3, ("renkli sebze",)),
    Item("mantar", "mantarlı", 3, 4, 0.3, ("hafif",)),
    Item("patlıcan", "patlıcanlı", 1, 6, 0.3, ("fırın",)),
    Item("karnabahar", "karnabaharlı", 2, 5, 0.4, ("lif",)),
    Item("semizotu", "semizotlu", 2, 3, 0.4, ("omega-3",)),
    Item("havuç", "havuçlu", 1, 7, 0.2, ("renkli sebze",)),
    Item("pancar", "pancarlı", 2, 8, 0.2, ("lif",)),
    Item("kereviz", "kerevizli", 1, 5, 0.2, ("hafif",)),
    Item("bezelye", "bezelyeli", 5, 15, 0.4, ("lif",)),
]

FRUITS = [
    Item("çilek", "çilekli", 1, 8, 0.3, ("meyveli",)),
    Item("yaban mersini", "yaban mersinli", 1, 10, 0.4, ("antioksidan",)),
    Item("muz", "muzlu", 1, 23, 0.4, ("enerji",)),
    Item("elma", "elmalı", 0.3, 16, 0.2, ("lif",)),
    Item("armut", "armutlu", 0.4, 17, 0.2, ("lif",)),
    Item("şeftali", "şeftalili", 1, 13, 0.3, ("yaz meyvesi",)),
    Item("nar", "narlı", 1, 14, 0.5, ("antioksidan",)),
    Item("kivi", "kivili", 1, 11, 0.4, ("c vitamini",)),
    Item("böğürtlen", "böğürtlenli", 1, 10, 0.5, ("antioksidan",)),
    Item("mandalina", "mandalinalı", 1, 12, 0.3, ("c vitamini",)),
]

SPREADS = [
    Item("avokado ezmesi", "avokadolu", 2, 8, 11, ("sağlıklı yağ",)),
    Item("humus", "humuslu", 5, 11, 7, ("baklagil",)),
    Item("labne", "labneli", 4, 3, 7, ("pratik",)),
    Item("yoğurt sos", "yoğurt soslu", 4, 4, 3, ("hafif",)),
    Item("tahinli sos", "tahinli", 4, 5, 11, ("susam",)),
]

HERBS = [
    "limonlu",
    "fesleğenli",
    "kekikli",
    "zencefilli",
    "kimyonlu",
    "sumaklı",
    "biberiyeli",
    "naneli",
    "zerdeçallı",
    "hardallı",
]

VESSELS = [
    Item("kabak", "kabaklı"),
    Item("kapya biber", "kapya biberli"),
    Item("patlıcan", "patlıcanlı"),
    Item("mantar", "mantarlı"),
    Item("domates", "domatesli"),
]

BREADS = [
    Item("tam buğday ekmeği", "tam buğday ekmekli", 6, 24, 2, ("sandviç",)),
    Item("ekşi mayalı ekmek", "ekşi mayalı", 6, 22, 2, ("sandviç",)),
    Item("çavdar ekmeği", "çavdar ekmekli", 5, 21, 1, ("sandviç", "lif")),
]

PASTA_SAUCES = [
    "domates-fesleğen soslu",
    "yoğurtlu ıspanak soslu",
    "biberiyeli sebze soslu",
    "lor peynirli hafif soslu",
    "mantar ve kekik soslu",
]


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
    parts = []
    for char in normalized:
        if char.isalnum():
            parts.append(char)
        else:
            parts.append("-")
    slug = "".join(parts)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def cap_first(text: str) -> str:
    return text[:1].upper() + text[1:] if text else text


def protein_macro(item: Item) -> tuple[float, float, float]:
    return item.protein, item.carbs, item.fat


def total_macros(*items: Item, extra_protein: float = 0, extra_carbs: float = 0, extra_fat: float = 0) -> tuple[int, float, float, float]:
    protein = sum(item.protein for item in items) + extra_protein
    carbs = sum(item.carbs for item in items) + extra_carbs
    fat = sum(item.fat for item in items) + extra_fat
    calories = round(protein * 4 + carbs * 4 + fat * 9)
    return calories, round(carbs, 2), round(fat, 2), round(protein, 2)


def clamp_minutes(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def breakfast_bowl(rng: random.Random, profile: Profile) -> dict:
    dairy = rng.choice([item for item in PROTEINS if item.noun in {"süzme yoğurt", "lor peyniri"}])
    grain = rng.choice([item for item in GRAINS if item.noun in {"yulaf", "chia", "kinoa"}])
    fruit = rng.choice(FRUITS)
    topper = rng.choice(
        [
            Item("ceviz", "cevizli", 3, 2, 9, ("sağlıklı yağ",)),
            Item("badem", "bademli", 4, 3, 10, ("sağlıklı yağ",)),
            Item("kabak çekirdeği", "kabak çekirdekli", 5, 2, 8, ("çinko",)),
            Item("keten tohumu", "keten tohumlu", 2, 1, 5, ("lif",)),
        ]
    )
    herb = rng.choice(["tarçınlı", "vanilya aromalı", "naneli"])
    name = f"{cap_first(herb)} {fruit.adj} {grain.noun} ve {dairy.noun} kasesi"
    description = (
        f"{profile.descriptor.capitalize()} bu kahvaltı, {profile.focus} için tasarlandı. "
        f"{cap_first(fruit.noun)}, {grain.noun} ve {dairy.noun} birleşimiyle hafif ama dengeli bir başlangıç sunar."
    )
    steps = [
        f"{grain.noun.capitalize()} tabanını uygun bir kapta hazırlayın; gerekiyorsa birkaç dakika önceden sıvı ile yumuşatın.",
        f"{dairy.noun.capitalize()} ile {fruit.noun} parçalarını ayrı bir kapta nazikçe karıştırın.",
        f"Kaseye önce {grain.noun} tabanını, üzerine {dairy.noun} karışımını alın.",
        f"{topper.noun.capitalize()} ve seçtiğiniz baharat dokunuşunu üzerine serpin.",
        "Kıvamı oturduktan sonra soğuk servis edin.",
    ]
    tags = ["kahvaltı", "kase", profile.tag, *grain.tags[:1], *dairy.tags[:1], *fruit.tags[:1]]
    calories, carbs, fat, protein = total_macros(dairy, grain, fruit, topper, extra_carbs=3)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(7, 14), 5, 25),
        "Cook": rng.randint(0, 4),
        "Servings": 1,
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein,
    }


def omelet(rng: random.Random, profile: Profile) -> dict:
    veg = rng.choice([item for item in VEGETABLES if item.noun not in {"pancar", "kereviz"}])
    second_veg = rng.choice([item for item in VEGETABLES if item.noun != veg.noun])
    cheese = rng.choice([item for item in PROTEINS if item.noun in {"lor peyniri", "süzme yoğurt"}])
    herb = rng.choice(HERBS)
    name = f"{cap_first(herb)} {veg.adj} ve {second_veg.adj} omlet"
    description = (
        f"{profile.note.capitalize()} dokulu bu tarif, yumurta ve sebzeleri tek tavada bir araya getirir. "
        f"Günün ilk yarısında dengeli bir protein kaynağı arayanlar için uygundur."
    )
    egg = Item("yumurta", "yumurtalı", 19, 1, 14, ("kahvaltı", "yüksek protein"))
    steps = [
        f"{veg.noun.capitalize()} ve {second_veg.noun} küçük parçalar halinde doğrayın.",
        "Yapışmaz tavayı ısıtıp sebzeleri kısa süre soteleyin.",
        "Yumurtaları çırpıp lor veya yoğurt bazlı dokunuş ile pürüzsüz hale getirin.",
        "Karışımı tavaya dökün ve kısık ateşte kontrollü şekilde pişirin.",
        "Omleti ikiye katlayıp sıcak servis edin.",
    ]
    tags = ["kahvaltı", "omlet", profile.tag, "tava", *veg.tags[:1], "yüksek protein"]
    calories, carbs, fat, protein = total_macros(egg, veg, second_veg, cheese, extra_fat=4)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(8, 13), 5, 25),
        "Cook": clamp_minutes(rng.randint(8, 14), 6, 25),
        "Servings": 1,
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein,
    }


def smoothie(rng: random.Random, profile: Profile) -> dict:
    fruit = rng.choice(FRUITS)
    second = rng.choice([item for item in FRUITS if item.noun != fruit.noun])
    green = rng.choice([item for item in VEGETABLES if item.noun in {"ıspanak", "semizotu", "havuç"}])
    dairy = rng.choice([item for item in PROTEINS if item.noun in {"süzme yoğurt", "lor peyniri"}])
    name = f"{cap_first(fruit.adj)} {second.adj} ve {green.adj} smoothie"
    description = (
        f"{profile.descriptor.capitalize()} ara öğün alternatifi olan bu smoothie, {profile.focus} hedefini destekler. "
        f"Meyve ve yeşil sebzeyi dengeli şekilde bir araya getirir."
    )
    steps = [
        f"{fruit.noun.capitalize()} ve {second.noun} meyvelerini uygun boyutta hazırlayın.",
        f"Blender haznesine {dairy.noun}, {green.noun} ve meyveleri ekleyin.",
        "İsteğe göre birkaç buz küpü ve su ilavesi yapın.",
        "Karışım pürüzsüz olana kadar blenderdan geçirin.",
        "Bekletmeden servis edin.",
    ]
    tags = ["ara öğün", "smoothie", profile.tag, *fruit.tags[:1], *green.tags[:1], "pratik"]
    calories, carbs, fat, protein = total_macros(dairy, fruit, second, green, extra_carbs=4, extra_fat=2)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(6, 10), 4, 20),
        "Cook": 0,
        "Servings": 1,
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein,
    }


def soup(rng: random.Random, profile: Profile) -> dict:
    legume = rng.choice([item for item in PROTEINS if item.noun in {"yeşil mercimek", "nohut", "kuru fasulye"}])
    veg = rng.choice([item for item in VEGETABLES if item.noun not in {"semizotu"}])
    herb = rng.choice(HERBS)
    name = f"{cap_first(herb)} {legume.adj} {veg.adj} çorbası"
    description = (
        f"{profile.note.capitalize()} yapılı bu çorba, baklagil bazlı yapısıyla {profile.focus} sunar. "
        f"Öğle ya da akşam öğününde hafif ama doyurucu bir alternatif oluşturur."
    )
    steps = [
        f"{veg.noun.capitalize()} ve temel aromatik sebzeleri küçük küpler halinde doğrayın.",
        "Tencerede kısa süre kavurup baklagili ekleyin.",
        "Üzerini geçecek kadar sıcak su ilave edip kısık ateşte pişirin.",
        f"{herb.capitalize()} dokunuşunu ekleyip kıvamı oturana kadar kaynatın.",
        "İsterseniz kısmen blenderdan geçirip sıcak servis edin.",
    ]
    tags = ["çorba", "öğle yemeği", profile.tag, *legume.tags[:2], *veg.tags[:1]]
    calories, carbs, fat, protein = total_macros(legume, veg, extra_fat=6, extra_carbs=8)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(10, 18), 6, 25),
        "Cook": clamp_minutes(rng.randint(20, 34), 15, 45),
        "Servings": rng.randint(2, 3),
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein,
    }


def salad_bowl(rng: random.Random, profile: Profile) -> dict:
    protein = rng.choice([item for item in PROTEINS if item.noun not in {"yumurta", "lor peyniri", "süzme yoğurt"}])
    grain = rng.choice([item for item in GRAINS if item.noun not in {"chia", "yulaf"}])
    veg = rng.choice(VEGETABLES)
    herb = rng.choice(HERBS)
    name = f"{cap_first(herb)} {protein.adj} {grain.noun} salata kasesi"
    description = (
        f"{profile.descriptor.capitalize()} bu kase, {protein.noun} ve {grain.noun} ile uzun süreli tokluk sağlar. "
        f"Renkli sebzeler sayesinde tabağa canlı bir görünüm ve iyi bir lif dengesi ekler."
    )
    steps = [
        f"{grain.noun.capitalize()} tabanını ayrı bir kapta haşlayıp süzün.",
        f"{protein.noun.capitalize()} için tercih ettiğiniz pişirme yöntemini uygulayıp dilimleyin.",
        f"{veg.noun.capitalize()} ve eşlik edecek yeşillikleri hazırlayın.",
        "Sos malzemelerini karıştırıp kaseyi katmanlı şekilde birleştirin.",
        "Sosu servis öncesinde gezdirip hemen sunun.",
    ]
    tags = ["öğle yemeği", "salata kasesi", profile.tag, *protein.tags[:1], *grain.tags[:1], herb]
    calories, carbs, fat, protein_amount = total_macros(protein, grain, veg, extra_fat=7, extra_carbs=4)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(10, 16), 8, 25),
        "Cook": clamp_minutes(rng.randint(12, 24), 8, 35),
        "Servings": rng.randint(1, 2),
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein_amount,
    }


def wrap(rng: random.Random, profile: Profile) -> dict:
    filling = rng.choice([item for item in PROTEINS if item.noun not in {"somon", "levrek"}])
    veg = rng.choice(VEGETABLES)
    spread = rng.choice(SPREADS)
    bread = Item("tam buğday lavaş", "lavaşlı", 6, 29, 4, ("pratik",))
    name = f"{cap_first(spread.adj)} {filling.adj} {veg.adj} wrap"
    description = (
        f"{profile.focus.capitalize()} hedefleyen bu wrap, taşınabilir yapısıyla yoğun günlerde iyi çalışır. "
        f"İç dolgu dengeli karbonhidrat, protein ve sebzeyi aynı lokmada toplar."
    )
    steps = [
        f"{filling.noun.capitalize()} harcını önceden pişirip ılıtın.",
        f"{veg.noun.capitalize()} ve diğer eşlikçileri ince jülyen halinde hazırlayın.",
        f"{bread.noun.capitalize()} yüzeyine {spread.noun} sürün.",
        "Dolgu malzemelerini merkezde toplayıp sıkı şekilde sarın.",
        "İkiye bölüp ılık ya da soğuk servis edin.",
    ]
    tags = ["öğle yemeği", "wrap", profile.tag, *filling.tags[:1], *spread.tags[:1], "taşınabilir"]
    calories, carbs, fat, protein_amount = total_macros(filling, veg, spread, bread, extra_carbs=2)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(9, 14), 6, 20),
        "Cook": clamp_minutes(rng.randint(8, 16), 6, 25),
        "Servings": 1,
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein_amount,
    }


def oven_tray(rng: random.Random, profile: Profile) -> dict:
    protein = rng.choice([item for item in PROTEINS if item.noun in {"tavuk", "hindi", "somon", "levrek", "tofu"}])
    veg = rng.choice(VEGETABLES)
    second = rng.choice([item for item in VEGETABLES if item.noun != veg.noun])
    herb = rng.choice(HERBS)
    name = f"{cap_first(herb)} {protein.adj} {veg.adj} fırın tepsisi"
    description = (
        f"{profile.note.capitalize()} ve dengeli bu ana öğün, tek tepside pratik hazırlık sunar. "
        f"{protein.noun.capitalize()} ile {veg.noun} uyumu hafif akşam yemekleri için güçlü bir seçenektir."
    )
    steps = [
        "Fırını önceden 190 dereceye ısıtın.",
        f"{protein.noun.capitalize()} ve sebzeleri eşit pişecek boyutta hazırlayın.",
        "Malzemeleri tepsiye yayıp zeytinyağı ve baharatlarla harmanlayın.",
        f"{herb.capitalize()} dokunuşuyla lezzeti tamamlayın.",
        "Kızarana kadar pişirip sıcak servis edin.",
    ]
    tags = ["akşam yemeği", "fırın", profile.tag, *protein.tags[:1], *veg.tags[:1], herb]
    calories, carbs, fat, protein_amount = total_macros(protein, veg, second, extra_fat=8, extra_carbs=6)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(12, 18), 8, 25),
        "Cook": clamp_minutes(rng.randint(18, 30), 15, 40),
        "Servings": rng.randint(2, 3),
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein_amount,
    }


def stuffed_vegetable(rng: random.Random, profile: Profile) -> dict:
    vessel = rng.choice(VESSELS)
    filling = rng.choice([item for item in PROTEINS if item.noun not in {"somon", "levrek", "ton balığı"}])
    grain = rng.choice([item for item in GRAINS if item.noun in {"kinoa", "karabuğday", "bulgur", "esmer pirinç"}])
    herb = rng.choice(HERBS)
    name = f"{cap_first(filling.adj)} {grain.adj} dolgulu {vessel.noun}"
    description = (
        f"{profile.descriptor.capitalize()} bu fırın yemeği, porsiyon kontrolünü kolaylaştıran düzenli bir ana öğündür. "
        f"{vessel.noun.capitalize()} içinde hazırlanan iç harç, {profile.focus} desteği sunar."
    )
    steps = [
        f"{vessel.noun.capitalize()} içini hazırlayıp dolguluk hale getirin.",
        f"{filling.noun.capitalize()} ve {grain.noun} bazlı iç harcı tavada kısa süre çevirin.",
        f"{herb.capitalize()} baharatlarını ekleyip iç harcı dengeleyin.",
        "Sebzelerin içine paylaştırıp fırın kabına dizin.",
        "Yumuşayana kadar pişirip sıcak servis edin.",
    ]
    tags = ["akşam yemeği", "dolma", profile.tag, *filling.tags[:1], *grain.tags[:1], "fırın"]
    calories, carbs, fat, protein_amount = total_macros(vessel, filling, grain, extra_fat=5)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(14, 22), 10, 30),
        "Cook": clamp_minutes(rng.randint(24, 36), 18, 45),
        "Servings": rng.randint(2, 3),
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein_amount,
    }


def patties(rng: random.Random, profile: Profile) -> dict:
    base = rng.choice([item for item in PROTEINS if item.noun in {"yeşil mercimek", "nohut", "tavuk", "hindi"}])
    veg = rng.choice([item for item in VEGETABLES if item.noun in {"kabak", "ıspanak", "havuç", "mantar"}])
    dip = rng.choice([item for item in SPREADS if item.noun in {"yoğurt sos", "humus", "avokado ezmesi"}])
    name = f"{cap_first(veg.adj)} {base.adj} mini köfte"
    description = (
        f"{profile.note.capitalize()} bu tarif, kontrollü porsiyonda hazırlanabilen çok yönlü bir tabak sunar. "
        f"Yanına eklenen sos ile ara öğün ya da ana öğün olarak değerlendirilebilir."
    )
    steps = [
        f"{base.noun.capitalize()} bazını robotta çekip {veg.noun} ile karıştırın.",
        "Baharatları ekleyip şekil alacak kıvama getirin.",
        "Karışımdan küçük parçalar alıp köfte formu verin.",
        "Tavada ya da fırında kontrollü şekilde pişirin.",
        f"{dip.noun.capitalize()} ile birlikte servis edin.",
    ]
    tags = ["pratik", "köfte", profile.tag, *base.tags[:1], *veg.tags[:1], "yüksek tokluk"]
    calories, carbs, fat, protein_amount = total_macros(base, veg, dip, extra_carbs=8, extra_fat=3)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(10, 16), 8, 25),
        "Cook": clamp_minutes(rng.randint(12, 22), 10, 30),
        "Servings": rng.randint(2, 3),
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein_amount,
    }


def skillet(rng: random.Random, profile: Profile) -> dict:
    protein = rng.choice([item for item in PROTEINS if item.noun in {"tavuk", "hindi", "tofu", "somon", "nohut"}])
    veg = rng.choice(VEGETABLES)
    second = rng.choice([item for item in VEGETABLES if item.noun != veg.noun])
    herb = rng.choice(HERBS)
    name = f"{cap_first(herb)} {protein.adj} sebze sote"
    description = (
        f"{profile.descriptor.capitalize()} bu tava yemeği, tek kapta pişen düzenli bir öğün sunar. "
        f"{protein.noun.capitalize()} ve sebzelerin diri dokusu sayesinde hafif ama tatmin edicidir."
    )
    steps = [
        f"{protein.noun.capitalize()} uygun boyutta hazırlayın.",
        f"{veg.noun.capitalize()} ve {second.noun} sebzelerini benzer büyüklükte doğrayın.",
        "Wok ya da geniş tavayı iyice ısıtıp malzemeleri sırasıyla ekleyin.",
        f"{herb.capitalize()} aroması ile son dokunuşu yapın.",
        "Sebzeler hafif diri kalacak şekilde servis edin.",
    ]
    tags = ["ana öğün", "sote", profile.tag, *protein.tags[:1], *veg.tags[:1], "tek tava"]
    calories, carbs, fat, protein_amount = total_macros(protein, veg, second, extra_fat=6, extra_carbs=10)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(10, 15), 7, 20),
        "Cook": clamp_minutes(rng.randint(10, 18), 8, 25),
        "Servings": rng.randint(1, 2),
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein_amount,
    }


def pilaf_bowl(rng: random.Random, profile: Profile) -> dict:
    grain = rng.choice([item for item in GRAINS if item.noun in {"bulgur", "kinoa", "karabuğday", "esmer pirinç"}])
    protein = rng.choice([item for item in PROTEINS if item.noun not in {"somon", "levrek", "süzme yoğurt", "lor peyniri"}])
    veg = rng.choice(VEGETABLES)
    herb = rng.choice(HERBS)
    name = f"{cap_first(herb)} {protein.adj} {grain.noun} pilavı"
    description = (
        f"{profile.note.capitalize()} yapılı bu pilav tabağı, gün içi enerji ihtiyacını kontrollü karşılamak için tasarlandı. "
        f"Tane tane doku ve dengeli protein miktarıyla günlük planlara kolayca uyum sağlar."
    )
    steps = [
        f"{grain.noun.capitalize()} tabanını yıkayıp uygun kıvamda pişirin.",
        f"{protein.noun.capitalize()} ve {veg.noun} ile ayrı bir iç harç hazırlayın.",
        "Pişen tahılı harçla birleştirip birkaç dakika dinlendirin.",
        f"{herb.capitalize()} ile aromayı canlandırın.",
        "Ana öğün olarak sıcak servis edin.",
    ]
    tags = ["öğle yemeği", "pilav", profile.tag, *grain.tags[:1], *protein.tags[:1], herb]
    calories, carbs, fat, protein_amount = total_macros(grain, protein, veg, extra_fat=5)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(10, 18), 8, 25),
        "Cook": clamp_minutes(rng.randint(16, 28), 12, 35),
        "Servings": rng.randint(2, 3),
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein_amount,
    }


def pasta(rng: random.Random, profile: Profile) -> dict:
    pasta_base = rng.choice([item for item in GRAINS if item.noun in {"tam buğday makarna", "kabak spagetti"}])
    protein = rng.choice([item for item in PROTEINS if item.noun in {"tavuk", "hindi", "ton balığı", "tofu", "lor peyniri"}])
    veg = rng.choice(VEGETABLES)
    sauce = rng.choice(PASTA_SAUCES)
    name = f"{cap_first(protein.adj)} {veg.adj} {pasta_base.noun}"
    description = (
        f"{profile.descriptor.capitalize()} bu tabak, klasik makarna hissini daha kontrollü bir içerikle sunar. "
        f"Sos ve sebze dengesi sayesinde hafif ama tatmin edici bir alternatif oluşturur."
    )
    steps = [
        f"{pasta_base.noun.capitalize()} tabanını uygun süre boyunca pişirin.",
        f"{protein.noun.capitalize()} ve {veg.noun} ile sos temelini hazırlayın.",
        f"{sauce.capitalize()} karışımını tavada kısa süre çevirin.",
        "Haşlanan tabanı sos ile buluşturup birkaç dakika dinlendirin.",
        "Sıcak servis edip taze otlarla tamamlayın.",
    ]
    tags = ["akşam yemeği", "makarna", profile.tag, *protein.tags[:1], *pasta_base.tags[:1], sauce.split()[0]]
    calories, carbs, fat, protein_amount = total_macros(pasta_base, protein, veg, extra_fat=6, extra_carbs=4)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(9, 15), 7, 20),
        "Cook": clamp_minutes(rng.randint(12, 22), 10, 30),
        "Servings": rng.randint(1, 2),
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein_amount,
    }


def pudding(rng: random.Random, profile: Profile) -> dict:
    base = rng.choice([item for item in GRAINS if item.noun in {"chia", "yulaf"}])
    fruit = rng.choice(FRUITS)
    dairy = rng.choice([item for item in PROTEINS if item.noun in {"süzme yoğurt", "lor peyniri"}])
    topping = rng.choice(
        [
            Item("fındık", "fındıklı", 3, 2, 8, ("sağlıklı yağ",)),
            Item("ceviz", "cevizli", 3, 2, 9, ("sağlıklı yağ",)),
            Item("hindistan cevizi", "hindistan cevizli", 1, 4, 6, ("aroma",)),
        ]
    )
    name = f"{cap_first(fruit.adj)} {base.noun} puding"
    description = (
        f"{profile.note.capitalize()} ara öğün olarak hazırlanan bu puding, kontrollü tatlı isteği için iyi bir alternatiftir. "
        f"Protein ve lif desteğiyle gereksiz atıştırmayı azaltmaya yardımcı olur."
    )
    steps = [
        f"{base.noun.capitalize()} tabanını sıvı bileşenle karıştırıp dinlenmeye bırakın.",
        f"{dairy.noun.capitalize()} ile yumuşak bir kıvam hazırlayın.",
        f"{fruit.noun.capitalize()} dilimleri ve tabanı katmanlı şekilde birleştirin.",
        f"{topping.noun.capitalize()} ile dokusal kontrast ekleyin.",
        "Soğutup servis edin.",
    ]
    tags = ["ara öğün", "puding", profile.tag, *base.tags[:1], *fruit.tags[:1], "tatlı ihtiyacına çözüm"]
    calories, carbs, fat, protein_amount = total_macros(base, fruit, dairy, topping, extra_carbs=2)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(8, 14), 5, 20),
        "Cook": 0,
        "Servings": 1,
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein_amount,
    }


def sandwich(rng: random.Random, profile: Profile) -> dict:
    bread = rng.choice(BREADS)
    filling = rng.choice([item for item in PROTEINS if item.noun not in {"somon", "levrek", "kuru fasulye"}])
    veg = rng.choice(VEGETABLES)
    spread = rng.choice(SPREADS)
    name = f"{cap_first(spread.adj)} {filling.adj} sandviç"
    description = (
        f"{profile.descriptor.capitalize()} bu sandviç, dışarıda yemek gereken günlerde planı korumayı kolaylaştırır. "
        f"{bread.noun.capitalize()} tabanı ve dengeli iç harcı sayesinde hızlı ama doyurucu bir seçenek sunar."
    )
    steps = [
        f"{bread.noun.capitalize()} dilimlerini hafifçe ısıtın.",
        f"Yüzeye önce {spread.noun}, ardından {filling.noun} katmanını ekleyin.",
        f"{veg.noun.capitalize()} ile taze bir katman oluşturun.",
        "Sandviçi sıkı şekilde kapatıp ikiye bölün.",
        "İsteğe göre yanında ayran veya salata ile servis edin.",
    ]
    tags = ["öğle yemeği", "sandviç", profile.tag, *bread.tags[:1], *filling.tags[:1], "taşınabilir"]
    calories, carbs, fat, protein_amount = total_macros(bread, filling, veg, spread, extra_carbs=4)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(7, 12), 5, 18),
        "Cook": clamp_minutes(rng.randint(4, 8), 0, 12),
        "Servings": 1,
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein_amount,
    }


def main_plate(rng: random.Random, profile: Profile) -> dict:
    protein = rng.choice([item for item in PROTEINS if item.noun in {"somon", "levrek", "tavuk", "hindi", "tofu"}])
    grain = rng.choice([item for item in GRAINS if item.noun in {"kinoa", "karabuğday", "bulgur", "esmer pirinç"}])
    veg = rng.choice(VEGETABLES)
    herb = rng.choice(HERBS)
    name = f"{cap_first(herb)} {protein.adj} ana tabak"
    description = (
        f"{profile.note.capitalize()} bu tarif, akşam öğününde daha düzenli bir tabak kurmak isteyenler için hazırlandı. "
        f"{protein.noun.capitalize()} ile {grain.noun} eşleşmesi dengeli makro dağılımı sunar."
    )
    steps = [
        f"{protein.noun.capitalize()} ana malzemesini tercih ettiğiniz yöntemle pişirin.",
        f"{grain.noun.capitalize()} garnitürünü ayrı kapta hazırlayın.",
        f"{veg.noun.capitalize()} eşlikçisini diri kalacak şekilde pişirin.",
        "Tüm parçaları tabakta dengeli porsiyonla birleştirin.",
        "Servis öncesi son baharat dokunuşunu ekleyin.",
    ]
    tags = ["akşam yemeği", "ana tabak", profile.tag, *protein.tags[:1], *grain.tags[:1], herb]
    calories, carbs, fat, protein_amount = total_macros(protein, grain, veg, extra_fat=7)
    return {
        "Name": name,
        "Description": description,
        "Steps": steps,
        "Tags": unique_tags(tags),
        "Prep": clamp_minutes(rng.randint(12, 18), 8, 25),
        "Cook": clamp_minutes(rng.randint(16, 28), 12, 35),
        "Servings": rng.randint(1, 2),
        "Calories": calories,
        "Carbs": carbs,
        "Fat": fat,
        "Protein": protein_amount,
    }


CATEGORY_BUILDERS: list[Callable[[random.Random, Profile], dict]] = [
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


def unique_tags(tags: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        normalized = tag.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(tag.strip())
    return result[:6]


def make_recipe_row(dietitian: Dietitian, dietitian_index: int, recipe_index: int, used_names: set[str]) -> dict[str, str]:
    profile = PROFILES[(dietitian_index + recipe_index) % len(PROFILES)]
    attempt = 0
    while True:
        seed = f"{dietitian.id}:{recipe_index}:{attempt}"
        rng = random.Random(seed)
        builder = CATEGORY_BUILDERS[(recipe_index + dietitian_index * 2 + attempt) % len(CATEGORY_BUILDERS)]
        data = builder(rng, profile)

        if data["Name"] in used_names:
            attempt += 1
            continue

        recipe_id = uuid.uuid5(NAMESPACE, f"{dietitian.id}:{recipe_index}:{data['Name']}")
        slug = f"{normalize_ascii(data['Name'])}-{str(recipe_id)[:6]}"
        used_names.add(data["Name"])
        return {
            "Id": str(recipe_id),
            "DietitianId": dietitian.id,
            "Name": data["Name"],
            "Description": data["Description"],
            "IsPublic": "False",
            "IsDemo": "False",
            "IsDraft": "False",
            "IsHiddenFromProduction": "False",
            "StepsJson": json.dumps(data["Steps"], ensure_ascii=False),
            "ArchivedAtUtc": "NULL",
            "CookTimeMinutes": str(int(data["Cook"])),
            "IsArchived": "False",
            "PrepTimeMinutes": str(int(data["Prep"])),
            "Servings": str(int(data["Servings"])),
            "TagsJson": json.dumps(data["Tags"], ensure_ascii=False),
            "Slug": slug[:260],
            "CaloriesKcal": str(int(data["Calories"])),
            "CarbsGrams": f"{data['Carbs']:.2f}",
            "FatGrams": f"{data['Fat']:.2f}",
            "ProteinGrams": f"{data['Protein']:.2f}",
        }


def validate(rows: list[dict[str, str]]) -> None:
    expected_columns = [
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
    assert len(rows) == 1150, f"Expected 1150 rows, got {len(rows)}"
    assert all(list(row.keys()) == expected_columns for row in rows), "Column order mismatch"
    for row in rows:
        for key, value in row.items():
            if value is None or str(value).strip() == "":
                raise AssertionError(f"Blank value detected for {key} in recipe {row['Name']}")


def main() -> None:
    rows: list[dict[str, str]] = []
    used_names: set[str] = set()

    for dietitian_index, dietitian in enumerate(DIETITIANS):
        for recipe_index in range(50):
            rows.append(make_recipe_row(dietitian, dietitian_index, recipe_index, used_names))

    validate(rows)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=[
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
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} recipes to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
