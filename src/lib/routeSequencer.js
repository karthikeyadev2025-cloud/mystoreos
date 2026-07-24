// ═══════════════════════════════════════════════════════════════════
// ROUTE SEQUENCING
//
// Turns an unordered set of outlets into an efficient driving order.
//
// This is NOT the same as sorting shops by distance from the depot,
// which is what the old Route Planner did. "5km from the depot"
// describes a circle, not a path — a rep following that order
// crisscrosses the same neighbourhood repeatedly. At 40 stops a day
// that's hours and fuel.
//
// Approach: nearest-neighbour to build an initial tour, then 2-opt to
// remove the crossings nearest-neighbour always leaves behind. Full
// TSP is NP-hard and overkill here; this gets within a few percent of
// optimal in milliseconds for 40 stops, which is the actual problem.
// ═══════════════════════════════════════════════════════════════════

// Straight-line distance in km. Road distance would be better but
// needs a routing API per pair — at 40 stops that's 1,600 lookups per
// route per day. Straight-line ordering is close enough to produce a
// sane sequence, and the rep adjusts for one-ways in practice anyway.
export function haversineKm(a, b) {
  if (a?.latitude == null || a?.longitude == null || b?.latitude == null || b?.longitude == null) return Infinity;
  const R = 6371;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function tourLength(points, start = null) {
  if (points.length === 0) return 0;
  let total = start ? haversineKm(start, points[0]) : 0;
  for (let i = 0; i < points.length - 1; i++) total += haversineKm(points[i], points[i + 1]);
  return total;
}

// Greedy: always hop to the closest unvisited outlet. Fast and gives a
// reasonable starting tour, but characteristically leaves long
// "cleanup" legs at the end — which is exactly what 2-opt fixes.
function nearestNeighbour(points, start) {
  const remaining = [...points];
  const tour = [];
  let current = start;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    current = remaining[bestIdx];
    tour.push(current);
    remaining.splice(bestIdx, 1);
  }
  return tour;
}

// Repeatedly reverse any segment that shortens the tour. This is what
// removes the self-crossings nearest-neighbour produces. Capped
// iterations so a pathological input can't hang the UI thread.
function twoOpt(tour, start, maxPasses = 40) {
  if (tour.length < 4) return tour;
  let best = [...tour];
  let bestLen = tourLength(best, start);
  let improved = true;
  let passes = 0;

  while (improved && passes < maxPasses) {
    improved = false;
    passes++;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        const len = tourLength(candidate, start);
        if (len < bestLen - 1e-9) {
          best = candidate;
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * Sequence outlets into a driving order.
 *
 * Outlets missing coordinates can't be sequenced meaningfully, so
 * they're appended at the end rather than silently dropped — losing a
 * shop from a rep's day because someone forgot to capture its GPS
 * would be a much worse failure than an imperfect ordering.
 *
 * @param {Array} stops   - [{ id, name, latitude, longitude, ... }]
 * @param {Object} origin - the depot the rep starts from
 * @returns {{ sequenced: Array, unlocated: Array, distanceKm: number, improvementKm: number }}
 */
export function sequenceRoute(stops, origin) {
  const located = stops.filter(s => s.latitude != null && s.longitude != null);
  const unlocated = stops.filter(s => s.latitude == null || s.longitude == null);

  if (located.length === 0) {
    return { sequenced: [...unlocated], unlocated, distanceKm: 0, improvementKm: 0 };
  }

  const start = (origin?.latitude != null && origin?.longitude != null) ? origin : located[0];

  const greedy = nearestNeighbour(located, start);
  const greedyLen = tourLength(greedy, start);

  const optimised = twoOpt(greedy, start);
  const optimisedLen = tourLength(optimised, start);

  return {
    sequenced: [...optimised, ...unlocated],
    unlocated,
    distanceKm: Math.round(optimisedLen * 10) / 10,
    improvementKm: Math.round((greedyLen - optimisedLen) * 10) / 10,
  };
}

export default sequenceRoute;
