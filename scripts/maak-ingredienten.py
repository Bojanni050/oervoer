#!/usr/bin/env python3
"""Maakt data/ingredient-nutrition.csv uit de USDA SR Legacy bulk-CSV.

Alleen bedoeld als eenmalige/periodieke hulp: het resultaat (de CSV met
Nederlandse namen en de gekozen USDA-regel per ingrediënt) wordt gecommit, zodat
de app en de import geen 36 MB aan ruwe data nodig hebben. Draai dit opnieuw als
je een ingrediënt wilt toevoegen of de USDA-data wilt verversen.

Gebruik:
  python3 scripts/maak-ingredienten.py /pad/naar/FoodData_Central_sr_legacy_food_csv_2018-04.zip
"""
import csv
import io
import sys
import zipfile

BASE = "FoodData_Central_sr_legacy_food_csv_2018-04/"
NUTRIENTS = {
    "1008": "energie",   # Energy (kcal)
    "1003": "eiwit",     # Protein
    "1004": "vet",       # Total lipid (fat)
    "1087": "calcium",   # Calcium, Ca (mg)
    "1091": "fosfor",    # Phosphorus, P (mg)
}

# Nederlandse naam, aliassen, en de USDA-beschrijvingen in volgorde van voorkeur.
# De eerste die bestaat wint; zo blijft de keuze expliciet en herleidbaar.
INGREDIENTEN = [
    ("Kipfilet", "kipfilet, kip borst, kippenborst", [
        "Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw",
        "Chicken, broilers or fryers, breast, meat only, skinless, boneless, raw",
    ]),
    ("Kipdij", "kipdij, kippendij, kippenbout", [
        "Chicken, thigh, meat only, raw",
        "Chicken, broilers or fryers, dark meat, meat only, raw",
    ]),
    ("Kip met vel en bot", "kip met bot, kippenpoot, kippenvleugel", [
        "Chicken, broilers or fryers, meat and skin, raw",
    ]),
    ("Kippenlever", "kip lever, kippenlever", [
        "Chicken, liver, all classes, raw",
    ]),
    ("Kippenhart", "kip hart, kippenhart", [
        "Chicken, heart, all classes, raw",
    ]),
    ("Kippenmaag", "kip maag, kippenmaag, gizzard", [
        "Chicken, gizzard, all classes, raw",
    ]),
    ("Kippennek", "kip nek, kippennek", [
        "Chicken, broilers or fryers, neck, meat only, raw",
        "Chicken, broilers or fryers, neck, meat and skin, raw",
    ]),
    ("Kalkoenfilet", "kalkoen, kalkoenfilet, kalkoenborst", [
        "Turkey, whole, breast, meat only, raw",
        "Turkey, all classes, breast, meat and skin, raw",
    ]),
    ("Rundergehakt", "gehakt, rundergehakt", [
        "Beef, ground, 85% lean meat / 15% fat, raw",
        "Beef, ground, 80% lean meat / 20% fat, raw",
    ]),
    ("Rundvlees", "rundvlees, biefstuk, runderlappen", [
        "Beef, composite of trimmed retail cuts, separable lean and fat, trimmed to 0\" fat, all grades, raw",
        "Beef, loin, top loin steak, boneless, lip off, separable lean and fat, trimmed to 0\" fat, all grades, raw",
    ]),
    ("Runderlever", "rund lever, runderlever", [
        "Beef, variety meats and by-products, liver, raw",
    ]),
    ("Runderhart", "rund hart, runderhart", [
        "Beef, variety meats and by-products, heart, raw",
    ]),
    ("Rundernier", "rund nier, rundernier", [
        "Beef, variety meats and by-products, kidneys, raw",
    ]),
    ("Runderlong", "rund long, runderlong", [
        "Beef, variety meats and by-products, lungs, raw",
    ]),
    ("Runderpens", "pens, runderpens, tripes", [
        "Beef, variety meats and by-products, tripe, raw",
    ]),
    ("Runderschenkel", "schenkel, runderschenkel, shank", [
        "Beef, shank crosscuts, separable lean only, trimmed to 1/4\" fat, choice, raw",
    ]),
    ("Lamsvlees", "lam, lamsvlees, lamsbout", [
        "Lamb, composite of trimmed retail cuts, separable lean and fat, trimmed to 1/4\" fat, choice, raw",
        "Lamb, leg, whole (shank and sirloin), separable lean and fat, trimmed to 1/4\" fat, choice, raw",
    ]),
    ("Lamslever", "lam lever, lamslever", [
        "Lamb, variety meats and by-products, liver, raw",
    ]),
    ("Lamshart", "lam hart, lamshart", [
        "Lamb, variety meats and by-products, heart, raw",
    ]),
    ("Lamsnier", "lam nier, lamsnier", [
        "Lamb, variety meats and by-products, kidneys, raw",
    ]),
    ("Varkensvlees", "varken, varkensvlees, varkensschouder", [
        "Pork, fresh, composite of trimmed retail cuts (leg, loin, shoulder), separable lean and fat, raw",
        "Pork, fresh, shoulder, whole, separable lean and fat, raw",
    ]),
    ("Varkenslever", "varken lever, varkenslever", [
        "Pork, fresh, variety meats and by-products, liver, raw",
    ]),
    ("Konijn", "konijn, konijnenvlees", [
        "Rabbit, domesticated, composite of cuts, raw",
        "Rabbit, domesticated, meat only, raw",
    ]),
    ("Eend", "eend, eendenvlees", [
        "Duck, domesticated, meat only, raw",
        "Duck, domesticated, meat and skin, raw",
    ]),
    ("Gans", "gans, ganzenvlees", [
        "Goose, domesticated, meat only, raw",
        "Goose, domesticated, meat and skin, raw",
    ]),
    ("Zalm", "zalm, zalmfilet", [
        "Fish, salmon, Atlantic, farmed, raw",
        "Fish, salmon, Atlantic, wild, raw",
    ]),
    ("Haring", "haring", [
        "Fish, herring, Atlantic, raw",
    ]),
    ("Makreel", "makreel", [
        "Fish, mackerel, Atlantic, raw",
    ]),
    ("Sardine", "sardine, sardines", [
        "Fish, sardine, Atlantic, canned in oil, drained solids with bone",
    ]),
    ("Kabeljauw", "kabeljauw", [
        "Fish, cod, Atlantic, raw",
    ]),
    ("Forel", "forel, forelfilet", [
        "Fish, trout, rainbow, farmed, raw",
        "Fish, trout, mixed species, raw",
    ]),
    ("Ei", "ei, eieren, kippenei", [
        "Egg, whole, raw, fresh",
    ]),
    ("Yoghurt", "yoghurt, volle yoghurt", [
        "Yogurt, plain, whole milk",
    ]),
    ("Wortel", "wortel, wortelen, peen", [
        "Carrots, raw",
    ]),
    ("Broccoli", "broccoli", [
        "Broccoli, raw",
    ]),
    ("Courgette", "courgette, zucchini", [
        "Squash, summer, zucchini, includes skin, raw",
    ]),
    ("Appel", "appel, appels", [
        "Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)",
        "Apples, raw, golden delicious, with skin",
    ]),
    ("Rijst (gekookt)", "rijst, gekookte rijst", [
        "Rice, white, long-grain, regular, enriched, cooked",
        "Rice, white, long-grain, regular, cooked, unenriched, with salt",
    ]),
    ("Havermout", "havermout, oats", [
        "Cereals, oats, regular and quick, not fortified, dry",
    ]),
    ("Zonnebloemolie", "zonnebloemolie, olie", [
        "Oil, sunflower, linoleic (less than 60%)",
        "Oil, sunflower, linoleic, (approx. 65%)",
    ]),
    ("Lijnzaadolie", "lijnzaadolie, lijnolie", [
        "Oil, flaxseed, cold pressed",
        "Oil, flaxseed, contains added sliced flaxseed",
    ]),
]


def main(zip_path):
    z = zipfile.ZipFile(zip_path)
    with z.open(BASE + "food.csv") as handle:
        foods = list(csv.DictReader(io.TextIOWrapper(handle, "utf-8")))
    by_description = {row["description"]: row["fdc_id"] for row in foods}
    descriptions = list(by_description)

    wanted = {}
    for nl, aliassen, kandidaten in INGREDIENTEN:
        fdc_id = None
        gekozen = None
        for kandidaat in kandidaten:
            if kandidaat in by_description:
                fdc_id = by_description[kandidaat]
                gekozen = kandidaat
                break
        if not fdc_id:
            # Terugval: zoek de eerste beschrijving die alle woorden bevat.
            woorden = kandidaten[0].lower().split(", ")[0].split(" ")
            for description in descriptions:
                if description.lower().startswith(" ".join(woorden[:2])) and all(word in description.lower() for word in woorden):
                    fdc_id = by_description[description]
                    gekozen = description
                    break
        if not fdc_id:
            print(f"  OVERGESLAGEN (niet gevonden): {nl}", file=sys.stderr)
            continue
        wanted[fdc_id] = (nl, aliassen, gekozen)

    waarden = {}
    with z.open(BASE + "food_nutrient.csv") as handle:
        for row in csv.DictReader(io.TextIOWrapper(handle, "utf-8")):
            if row["nutrient_id"] not in NUTRIENTS:
                continue
            if row["fdc_id"] not in wanted:
                continue
            key = NUTRIENTS[row["nutrient_id"]]
            try:
                amount = float(row["amount"])
            except (TypeError, ValueError):
                continue
            waarden.setdefault(row["fdc_id"], {})[key] = amount

    lines = []
    for fdc_id, (nl, aliassen, gekozen) in wanted.items():
        values = waarden.get(fdc_id, {})
        if not values:
            print(f"  OVERGESLAGEN (geen analyse): {nl}", file=sys.stderr)
            continue
        # USDA geeft calcium en fosfor in mg per 100 g; wij rekenen in g per 100 g.
        lines.append({
            "naam": nl,
            "aliassen": aliassen,
            "bron": "usda",
            "bron_detail": "USDA SR Legacy 2018",
            "fdc_id": fdc_id,
            "usda_naam": gekozen,
            "calcium": f"{values.get('calcium', 0) / 1000:.4f}",
            "fosfor": f"{values.get('fosfor', 0) / 1000:.4f}",
            "energie": f"{values.get('energie', 0):.0f}",
            "eiwit": f"{values.get('eiwit', 0):.1f}",
            "vet": f"{values.get('vet', 0):.1f}",
        })

    lines.sort(key=lambda row: row["naam"])
    out = "data/ingredient-nutrition.csv"
    with open(out, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(lines[0].keys()))
        writer.writeheader()
        writer.writerows(lines)
    print(f"{len(lines)} ingrediënten -> {out}")
    for row in lines:
        print(f"  {row['naam']:22} Ca {float(row['calcium']):.3f} · P {float(row['fosfor']):.3f} · "
              f"{row['energie']} kcal · {row['usda_naam'][:52]}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sr.zip")
