"""Import the emergency stations the backend suggests to admins, from OpenStreetMap.

Run from the repository root (needs internet access, takes a minute or two):
    python -m backend.import_stations

It rewrites backend/data/stations.json; the backend reads that file when it starts, so it
never depends on an external service while running. Each service's stations come from an
Overpass API query over Ile-de-France:

- POLICE     commissariats, police posts, gendarmeries and traffic units (amenity=police)
- AMBULANCE  hospitals with an emergency department (amenity=hospital + emergency=yes)
- POMPIERS   fire and rescue stations (amenity=fire_station)
- DEPANNAGE  tow companies and impound lots. Few are mapped in OpenStreetMap, so this
             service has far fewer stations than the others.

Places that would not respond to a road accident are left out (EXCLUDED below), such as
investigation brigades, eye or psychiatric hospitals, and airport fire crews. Stations
without a town or an address get one from the French national address database
(IGN Geoplateforme reverse geocoding).

Data (c) OpenStreetMap contributors, available under the Open Database License (ODbL).
"""
from __future__ import annotations

import argparse
import csv
import http.client
import io
import json
import math
import re
import time
import unicodedata
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, TypedDict, cast

from . import config

# The public mirrors answer region-wide queries with errors or, worse, empty results.
OVERPASS = "https://overpass-api.de/api/interpreter"
GEOCODER = "https://data.geopf.fr/geocodage/reverse/csv"
USER_AGENT = "NexoraSafeRoad/0.1 (EFREI student project; station import)"
AREA = 'area["ISO3166-2"="FR-IDF"][admin_level=4]->.zone;'

# Each query is a separate request, so a slow one cannot make the others time out.
QUERIES = {
    "POLICE": ['nwr["amenity"="police"](area.zone);'],
    "AMBULANCE": ['nwr["amenity"="hospital"]["emergency"="yes"](area.zone);'],
    "POMPIERS": ['nwr["amenity"="fire_station"](area.zone);'],
    "DEPANNAGE": [
        'nwr["shop"="car_repair"]["name"~"d[ée]pann|remorqu",i](area.zone);',
        'nwr["service:vehicle:towing"="yes"](area.zone);',
        'nwr["amenity"="vehicle_impound"](area.zone);',
        'nwr["name"~"fourri[èe]re|remorquage",i][!"highway"](area.zone);',  # slow: reads every name
    ],
}

# Matched against the name without accents, in lower case.
EXCLUDED = {
    "POLICE": re.compile(
        # Investigation, intelligence and headquarters units: no patrols sent to accidents.
        r"brigade de repression|brigade criminelle|stupefiants|police judiciaire|delinquance juvenile"
        r"|investigation|^direction|laboratoire|office central|service de soutien|service de protection"
        r"|immigration|surete territoriale|police administrative|saip|^prefecture de police( de paris)?$"
        # Units with their own territory: sea, airports, railways, ceremonial cavalry.
        r"|gendarmerie maritime|transports? aerien|police des transports|garde republicaine"
        # Pounds are listed under DEPANNAGE.
        r"|fourriere"
    ),
    "AMBULANCE": re.compile(
        # Specialised hospitals that do not take road accident victims, and places that are not hospitals.
        r"ophtalmolog|psychiatr|fondation vallee|enfants malades|trousseau|robert debre|sos medecin|maison de sante"
    ),
    # Airport crews (SSLIA), private sites and a training school.
    "POMPIERS": re.compile(r"sslia|ecole|securite incendie|disneyland"),
    # Streets named after someone called Fourrier, and animal pounds (also "fourrières").
    "DEPANNAGE": re.compile(r"^rue |^sentier |^square |^impasse |animal"),
}

GENERIC_NAMES = {"POLICE": "Police", "AMBULANCE": "Urgences", "POMPIERS": "Centre de secours", "DEPANNAGE": "Dépannage"}

# Two entries this close with the same name are one station mapped twice (often a point
# and the building outline).
SAME_STATION_METERS = 150
# A geocoded address further than this from the station is too far to be its address.
MAX_ADDRESS_METERS = 150


class Element(TypedDict, total=False):
    type: str
    id: int
    lat: float
    lon: float
    center: dict[str, float]
    tags: dict[str, str]


@dataclass
class Found:
    id: str
    service: str
    name: str | None
    latitude: float
    longitude: float
    street: str | None  # "12 Rue X" from OpenStreetMap
    town: str | None  # "75007 Paris" from OpenStreetMap
    city: str | None = None  # from the geocoder: "Paris 7e", "Créteil"

    def as_json(self) -> dict[str, Any]:
        name = self.name or GENERIC_NAMES[self.service]
        # "Police nationale" alone is useless in a list of nearby stations: say where it is.
        if self.city and _normalize(self.city) not in _normalize(name):
            name = f"{name} ({self.city})"
        address = ", ".join(p for p in (self.street, self.town) if p) or None
        return {
            "id": self.id,
            "service": self.service,
            "name": name,
            "address": address,
            "latitude": self.latitude,
            "longitude": self.longitude,
        }


def overpass(query: str) -> list[Element]:
    """Run an Overpass query, retrying while the server is overloaded (it often is)."""
    body = urllib.parse.urlencode({"data": f"[out:json][timeout:300];{AREA}({query});out tags center;"}).encode()
    for attempt in range(1, 7):
        try:
            payload = cast("dict[str, Any]", json.loads(_post(OVERPASS, body, "application/x-www-form-urlencoded")))
            # A query that timed out still answers 200, with a remark and partial results.
            if payload.get("remark"):
                raise RuntimeError(payload["remark"])
            return cast("list[Element]", payload["elements"])
        except (OSError, http.client.HTTPException, json.JSONDecodeError, KeyError, RuntimeError) as exc:
            print(f"  attempt {attempt} failed: {exc}")
            time.sleep(20 * attempt)
    raise SystemExit("OpenStreetMap's Overpass server keeps failing: keeping the current file. Try again later.")


def to_found(service: str, element: Element) -> Found | None:
    tags = element.get("tags", {})
    if "lat" in element and "lon" in element:
        latitude, longitude = element["lat"], element["lon"]
    elif "center" in element:
        latitude, longitude = element["center"]["lat"], element["center"]["lon"]
    else:
        return None
    name = (tags.get("name") or tags.get("official_name") or "").split(";")[0].strip() or None
    if name and EXCLUDED[service].search(_normalize(name)):
        return None
    street = tags.get("addr:street")
    return Found(
        id=f"osm:{element.get('type', 'node')[0]}{element.get('id', 0)}",
        service=service,
        name=name,
        latitude=round(latitude, 6),
        longitude=round(longitude, 6),
        street=" ".join(p for p in (tags.get("addr:housenumber"), street) if p) if street else None,
        town=" ".join(p for p in (tags.get("addr:postcode"), tags.get("addr:city")) if p) or None,
    )


def deduplicate(stations: list[Found]) -> list[Found]:
    """Drop entries that are the same station mapped twice, keeping the one with an address."""
    kept: list[Found] = []
    for station in sorted(stations, key=lambda s: s.street is None):
        if not any(_same(station, other) for other in kept):
            kept.append(station)
    return kept


def add_places(stations: list[Found]) -> None:
    """Fill in each station's town, and its address when OpenStreetMap has none."""
    rows = io.StringIO()
    writer = csv.writer(rows)
    writer.writerow(["id", "lat", "lon"])
    writer.writerows([s.id, s.latitude, s.longitude] for s in stations)
    boundary = uuid.uuid4().hex
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="data"; filename="stations.csv"\r\n'
        f"Content-Type: text/csv\r\n\r\n{rows.getvalue()}\r\n"
        f'--{boundary}\r\nContent-Disposition: form-data; name="index"\r\n\r\naddress\r\n'
        f"--{boundary}--\r\n"
    ).encode()
    try:
        result = _post(GEOCODER, body, f"multipart/form-data; boundary={boundary}")
    except (OSError, http.client.HTTPException) as exc:
        print(f"Geocoding failed ({exc}); stations keep the OpenStreetMap address only.")
        return

    places = {row["id"]: row for row in csv.DictReader(io.StringIO(result.decode("utf-8")))}
    for station in stations:
        place = places.get(station.id)
        if place is None or place.get("result_status") != "ok":
            continue
        # Paris is one city of 20 arrondissements: "Paris 7e Arrondissement" -> "Paris 7e".
        district = place.get("result_district") or ""
        station.city = district.removesuffix(" Arrondissement") if district.endswith(" Arrondissement") else place["result_city"]
        town = f"{place['result_postcode']} {place['result_city']}"
        if station.street is None and float(place.get("result_distance") or "inf") <= MAX_ADDRESS_METERS:
            station.street = place["result_name"]
        if station.street is not None:
            station.town = town  # the national database's spelling, with the postcode
        else:
            station.town = station.town or town


def _post(url: str, body: bytes, content_type: str) -> bytes:
    request = urllib.request.Request(url, data=body, headers={"User-Agent": USER_AGENT, "Content-Type": content_type})
    with urllib.request.urlopen(request, timeout=360) as response:
        return cast("bytes", response.read())


def _same(a: Found, b: Found) -> bool:
    return _normalize(a.name or "") == _normalize(b.name or "") and _meters(a, b) <= SAME_STATION_METERS


def _normalize(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return " ".join(ascii_name.lower().replace("-", " ").replace("'", " ").split())


def _meters(a: Found, b: Found) -> float:
    # Equirectangular approximation: plenty for "less than 150 m apart".
    x = math.radians(b.longitude - a.longitude) * math.cos(math.radians((a.latitude + b.latitude) / 2))
    y = math.radians(b.latitude - a.latitude)
    return 6_371_000 * math.hypot(x, y)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--output", type=Path, default=config.STATIONS_FILE)
    args = parser.parse_args()

    stations: list[Found] = []
    for service, queries in QUERIES.items():
        print(f"{service}: querying OpenStreetMap...")
        found: dict[str, Found] = {}  # by id: an element can match several queries
        for query in queries:
            found |= {s.id: s for e in overpass(query) if (s := to_found(service, e)) is not None}
            time.sleep(5)  # be gentle with the shared Overpass servers
        unique = deduplicate(list(found.values()))
        print(f"{service}: {len(unique)} stations ({len(found) - len(unique)} duplicates dropped)")
        if not unique:
            raise SystemExit(f"No {service} station found: keeping the current file. Try again later.")
        stations += unique

    print("Adding towns and missing addresses...")
    add_places(stations)
    entries = sorted((s.as_json() for s in stations), key=lambda s: (s["service"], _normalize(s["name"])))

    output: Path = args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    # One station per line keeps the file readable and its git diffs small.
    lines = ",\n".join(f"    {json.dumps(s, ensure_ascii=False)}" for s in entries)
    output.write_text(
        "{\n"
        '  "source": "OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright)",\n'
        '  "area": "Ile-de-France",\n'
        f'  "importedOn": "{date.today().isoformat()}",\n'
        f'  "stations": [\n{lines}\n  ]\n'
        "}\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(entries)} stations to {output}")


if __name__ == "__main__":
    main()
