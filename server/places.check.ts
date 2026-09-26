import { restaurantPoint, dedupeInspectionsByCamis, restaurantHasDuplicateCamis } from "./restaurants.js";
import { isLicenseCurrent, shopPoint } from "./shops.js";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function testRestaurantDedupeAndCoords() {
  const rows: Record<string, unknown>[] = [
    {
      camis: "1",
      dba: "OLD NAME",
      boro: "Queens",
      building: "1",
      street: "MAIN ST",
      zipcode: "11372",
      cuisine_description: "",
      inspection_date: "2024-01-01T00:00:00.000",
      latitude: "40.75",
      longitude: "-73.88",
      location: { type: "Point", coordinates: [-73.88, 40.75] },
    },
    {
      camis: "1",
      dba: "NEW NAME",
      boro: "Queens",
      building: "1",
      street: "MAIN ST",
      zipcode: "11372",
      cuisine_description: "Mexican",
      inspection_date: "2026-02-01T00:00:00.000",
      latitude: "40.75",
      longitude: "-73.88",
      location: { type: "Point", coordinates: [-73.88, 40.75] },
    },
    {
      camis: "2",
      dba: "NO COORDS",
      boro: "Queens",
      inspection_date: "2026-02-01T00:00:00.000",
      latitude: "0",
      longitude: "0",
    },
    {
      camis: "3",
      dba: "PRE-PERMIT",
      boro: "Queens",
      inspection_date: "1900-01-01T00:00:00.000",
      latitude: "40.75",
      longitude: "-73.88",
    },
  ];

  assert(restaurantPoint(rows[2]) === null, "zero coordinates must be rejected");
  const seeds = dedupeInspectionsByCamis(rows);
  assert(seeds.length === 1, `expected 1 restaurant after coord/date filters, got ${seeds.length}`);
  assert(seeds[0].camis === "1", "expected camis 1");
  assert(seeds[0].title === "NEW NAME", "latest inspection should win");
  assert(seeds[0].cuisine === "Mexican", "cuisine should merge from latest row");
  assert(!restaurantHasDuplicateCamis(seeds), "duplicate camis after dedupe");
}

function testExpiredLicenses() {
  const now = new Date("2026-09-26T12:00:00Z");
  const expired = {
    license_status: "Expired",
    license_type: "Premises",
    lic_expir_dd: "2023-07-31T00:00:00.000",
    latitude: "40.76",
    longitude: "-73.97",
  };
  const pastDateActive = {
    license_status: "Active",
    license_type: "Premises",
    lic_expir_dd: "2025-01-01T00:00:00.000",
    latitude: "40.76",
    longitude: "-73.97",
  };
  const current = {
    license_status: "Active",
    license_type: "Premises",
    lic_expir_dd: "2027-07-31T00:00:00.000",
    latitude: "40.76",
    longitude: "-73.97",
  };
  const individual = {
    license_status: "Active",
    license_type: "Individual",
    lic_expir_dd: "2027-07-31T00:00:00.000",
    latitude: "40.76",
    longitude: "-73.97",
  };
  assert(!isLicenseCurrent(expired, now), "Expired status must be dropped");
  assert(!isLicenseCurrent(pastDateActive, now), "past expiration must be dropped");
  assert(isLicenseCurrent(current, now), "active unexpired premises should pass");
  assert(!isLicenseCurrent(individual, now), "individual licenses are not storefronts");
  assert(shopPoint({ latitude: "0", longitude: "0" }) === null, "shop zero coords rejected");
}

testRestaurantDedupeAndCoords();
testExpiredLicenses();
console.log("places.check: duplicate restaurants, missing coordinates, and expired licenses OK");
