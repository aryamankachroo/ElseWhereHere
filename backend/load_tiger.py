"""Load data/places.csv into the Tiger Cloud places table."""

from __future__ import annotations

import psycopg

from backend.scoring import _read_places, _service_url

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS places (
    id text PRIMARY KEY,
    name text NOT NULL,
    neighborhood text,
    borough text,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    tags text[] NOT NULL,
    free boolean NOT NULL,
    all_day boolean NOT NULL,
    clean double precision NOT NULL,
    shade double precision NOT NULL,
    localness double precision NOT NULL,
    blurb text NOT NULL
)
"""

INSERT = """
INSERT INTO places (
    id, name, neighborhood, borough, lat, lng, tags, free, all_day, clean, shade, localness, blurb
) VALUES (
    %(id)s, %(name)s, %(neighborhood)s, %(borough)s, %(lat)s, %(lng)s, %(tags)s,
    %(free)s, %(allDay)s, %(clean)s, %(shade)s, %(local)s, %(blurb)s
)
"""


def main() -> None:
    url = _service_url()
    if not url:
        raise SystemExit("TIMESCALE_SERVICE_URL is missing from backend/.env")
    seen = set()
    places = []
    for place in _read_places():
        if place["id"] in seen:
            continue
        seen.add(place["id"])
        places.append(place)
    with psycopg.connect(url) as conn:
        conn.execute(CREATE_TABLE)
        conn.execute("TRUNCATE places")
        with conn.cursor() as cur:
            cur.executemany(INSERT, places)
        conn.commit()
        count = conn.execute("SELECT count(*) FROM places").fetchone()[0]
    print(f"loaded {count} places")


if __name__ == "__main__":
    main()
