// 地球儀で日本にズームしたとき用の、日本周辺の細かい陸地ドット。
// ビルド時に 1:50m の地図データから計算し、静的 JSON として出力する。
import type { APIRoute } from "astro";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import land from "world-atlas/land-50m.json";

/** ドットを作る範囲と間隔（globe.ts の JAPAN_REGION と合わせる） */
const REGION = { latMin: 10, latMax: 55, lngMin: 105, lngMax: 165 };
const STEP = 0.3;

type Ring = { pts: Position[]; minLat: number; maxLat: number; minLng: number; maxLng: number };

function rings(): Ring[][] {
  const topo = land as unknown as Topology<{ land: GeometryCollection }>;
  const geo = feature(topo, topo.objects.land) as unknown as {
    features: Feature<Polygon | MultiPolygon>[];
  };
  const polys = geo.features.flatMap((f) =>
    f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates,
  );
  return polys
    .map((poly) =>
      poly.map((pts) => {
        const lats = pts.map((p) => p[1]);
        const lngs = pts.map((p) => p[0]);
        return {
          pts,
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats),
          minLng: Math.min(...lngs),
          maxLng: Math.max(...lngs),
        };
      }),
    )
    .filter(([outer]) =>
      outer.maxLat >= REGION.latMin &&
      outer.minLat <= REGION.latMax &&
      outer.maxLng >= REGION.lngMin &&
      outer.minLng <= REGION.lngMax,
    );
}

/** ray casting（穴あきポリゴンは偶奇判定） */
function inside(lat: number, lng: number, poly: Ring[]) {
  const outer = poly[0];
  if (lat < outer.minLat || lat > outer.maxLat || lng < outer.minLng || lng > outer.maxLng) return false;
  let hit = false;
  for (const { pts } of poly) {
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

export const GET: APIRoute = () => {
  const polys = rings();
  const out: number[] = [];
  for (let lat = REGION.latMin; lat <= REGION.latMax; lat += STEP) {
    for (let lng = REGION.lngMin; lng <= REGION.lngMax; lng += STEP) {
      if (polys.some((p) => inside(lat, lng, p))) out.push(+lat.toFixed(2), +lng.toFixed(2));
    }
  }
  // [lat, lng, lat, lng, ...] のフラット配列
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
};
