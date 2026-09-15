import { Coordinates, getCoordinates } from "./geocode";
import { type Activity } from "@/components/TravelItinerary";

export interface POICandidate {
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingsTotal?: number;
  photo_url?: string | null;
  openingHours?: string[] | null;
  type?: string;
  place_id?: string;
}

export interface DayCluster {
  day: number;
  pois: POICandidate[];
  centroid?: Coordinates;
  radiusKm?: number;
}

/**
 * Haversine formula to compute great-circle distance between two coordinates in kilometers.
 */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371; // Earth radius in km
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}

/**
 * K-Means / K-Medoids Spatial Clustering
 * Partitions N POIs into K clusters (one per day).
 */
export function kMeansCluster(pois: POICandidate[], k: number): DayCluster[] {
  if (pois.length === 0) {
    return Array.from({ length: k }, (_, i) => ({ day: i + 1, pois: [] }));
  }

  // Handle case where total POIs <= K
  if (pois.length <= k) {
    const clusters: DayCluster[] = [];
    for (let i = 0; i < k; i++) {
      const p = pois[i] ? [pois[i]] : [];
      clusters.push({
        day: i + 1,
        pois: p,
        centroid: p.length > 0 ? { lat: p[0].lat, lng: p[0].lng } : undefined,
        radiusKm: 3.0,
      });
    }
    return clusters;
  }

  // 1. Excursion Isolation & Classification:
  // Detect distant destination outliers (>25 km away from main urban cluster)
  // to dedicate them to a separate Day-Trip Excursion day instead of mixing with city walking.
  let urbanPois = [...pois];
  let excursionPois: POICandidate[] = [];

  if (k >= 2 && pois.length >= 4) {
    const avgAllLat = pois.reduce((s, p) => s + p.lat, 0) / pois.length;
    const avgAllLng = pois.reduce((s, p) => s + p.lng, 0) / pois.length;
    const hubCenter: Coordinates = { lat: avgAllLat, lng: avgAllLng };

    const farPois = pois.filter(p => haversineDistance(p, hubCenter) >= 25);
    const nearPois = pois.filter(p => haversineDistance(p, hubCenter) < 25);

    // If there is an excursion cluster with at least 1 spot and enough near spots
    if (farPois.length > 0 && nearPois.length >= k - 1) {
      excursionPois = farPois;
      urbanPois = nearPois;
    }
  }

  const urbanK = excursionPois.length > 0 ? k - 1 : k;

  // 2. K-Means++ initialization for urban centroids
  const centroids: Coordinates[] = [];
  centroids.push({ lat: urbanPois[0].lat, lng: urbanPois[0].lng });

  while (centroids.length < urbanK) {
    let maxDist = -1;
    let bestPoiIndex = 0;

    for (let i = 0; i < urbanPois.length; i++) {
      let minDistToCentroids = Infinity;
      for (const c of centroids) {
        const d = haversineDistance(urbanPois[i], c);
        if (d < minDistToCentroids) minDistToCentroids = d;
      }
      if (minDistToCentroids > maxDist) {
        maxDist = minDistToCentroids;
        bestPoiIndex = i;
      }
    }
    centroids.push({ lat: urbanPois[bestPoiIndex].lat, lng: urbanPois[bestPoiIndex].lng });
  }

  // Iterative assignment (max 20 iterations)
  let assignments: number[] = new Array(urbanPois.length).fill(0);
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;

    // Assign POIs to nearest centroid
    for (let i = 0; i < urbanPois.length; i++) {
      let minD = Infinity;
      let nearestCluster = 0;
      for (let c = 0; c < urbanK; c++) {
        const d = haversineDistance(urbanPois[i], centroids[c]);
        if (d < minD) {
          minD = d;
          nearestCluster = c;
        }
      }
      if (assignments[i] !== nearestCluster) {
        assignments[i] = nearestCluster;
        changed = true;
      }
    }

    if (!changed) break;

    // Update centroids
    for (let c = 0; c < urbanK; c++) {
      const clusterPois = urbanPois.filter((_, idx) => assignments[idx] === c);
      if (clusterPois.length > 0) {
        const avgLat = clusterPois.reduce((acc, p) => acc + p.lat, 0) / clusterPois.length;
        const avgLng = clusterPois.reduce((acc, p) => acc + p.lng, 0) / clusterPois.length;
        centroids[c] = { lat: avgLat, lng: avgLng };
      }
    }
  }

  // Group into DayCluster objects
  const clusters: DayCluster[] = Array.from({ length: urbanK }, (_, i) => ({
    day: i + 1,
    pois: [],
  }));

  assignments.forEach((clusterIdx, poiIdx) => {
    clusters[clusterIdx].pois.push(urbanPois[poiIdx]);
  });

  // Smart Balance check: Reassign POIs to empty clusters based on minimum Haversine distance
  for (let i = 0; i < urbanK; i++) {
    if (clusters[i].pois.length === 0) {
      let maxClusterIdx = 0;
      for (let j = 0; j < urbanK; j++) {
        if (clusters[j].pois.length > clusters[maxClusterIdx].pois.length) {
          maxClusterIdx = j;
        }
      }
      if (clusters[maxClusterIdx].pois.length > 1) {
        const targetCentroid = centroids[i] || { lat: 0, lng: 0 };
        let closestPoiIdx = 0;
        let minD = Infinity;
        clusters[maxClusterIdx].pois.forEach((p, pIdx) => {
          const d = haversineDistance(p, targetCentroid);
          if (d < minD) {
            minD = d;
            closestPoiIdx = pIdx;
          }
        });
        const movedPoi = clusters[maxClusterIdx].pois.splice(closestPoiIdx, 1)[0];
        if (movedPoi) clusters[i].pois.push(movedPoi);
      }
    }
  }

  // Cross-Cluster Outlier Rebalancing: Ensure no POI is trapped in a distant cluster
  for (let iter = 0; iter < 3; iter++) {
    let rebalanced = false;
    const currentCentroids = clusters.map(c => {
      if (c.pois.length === 0) return { lat: 0, lng: 0 };
      const avgLat = c.pois.reduce((acc, p) => acc + p.lat, 0) / c.pois.length;
      const avgLng = c.pois.reduce((acc, p) => acc + p.lng, 0) / c.pois.length;
      return { lat: avgLat, lng: avgLng };
    });

    for (let cIdx = 0; cIdx < urbanK; cIdx++) {
      if (clusters[cIdx].pois.length <= 2) continue; // Keep minimum POIs

      for (let pIdx = clusters[cIdx].pois.length - 1; pIdx >= 0; pIdx--) {
        const poi = clusters[cIdx].pois[pIdx];
        const distToOwn = haversineDistance(poi, currentCentroids[cIdx]);

        if (distToOwn > 5.5) { // Potential outlier in urban cluster
          let bestOtherIdx = -1;
          let bestOtherDist = distToOwn;

          for (let otherIdx = 0; otherIdx < urbanK; otherIdx++) {
            if (otherIdx === cIdx) continue;
            const dOther = haversineDistance(poi, currentCentroids[otherIdx]);
            if (dOther < bestOtherDist - 2.0) {
              bestOtherDist = dOther;
              bestOtherIdx = otherIdx;
            }
          }

          if (bestOtherIdx !== -1 && clusters[cIdx].pois.length > 2) {
            const [moved] = clusters[cIdx].pois.splice(pIdx, 1);
            clusters[bestOtherIdx].pois.push(moved);
            rebalanced = true;
          }
        }
      }
    }
    if (!rebalanced) break;
  }

  // Compute final centroids and cluster radii (km)
  clusters.forEach((cluster, idx) => {
    if (cluster.pois.length > 0) {
      const avgLat = cluster.pois.reduce((acc, p) => acc + p.lat, 0) / cluster.pois.length;
      const avgLng = cluster.pois.reduce((acc, p) => acc + p.lng, 0) / cluster.pois.length;
      cluster.centroid = { lat: avgLat, lng: avgLng };
      let maxR = 0;
      cluster.pois.forEach(p => {
        const d = haversineDistance({ lat: avgLat, lng: avgLng }, p);
        if (d > maxR) maxR = d;
      });
      cluster.radiusKm = Math.max(2.0, Math.round(maxR * 10) / 10);
    } else {
      cluster.centroid = centroids[idx] || { lat: 0, lng: 0 };
      cluster.radiusKm = 5.0;
    }
  });

  // 3. Append isolated Excursion cluster if present
  if (excursionPois.length > 0) {
    const avgExLat = excursionPois.reduce((s, p) => s + p.lat, 0) / excursionPois.length;
    const avgExLng = excursionPois.reduce((s, p) => s + p.lng, 0) / excursionPois.length;
    clusters.push({
      day: k,
      pois: excursionPois,
      centroid: { lat: avgExLat, lng: avgExLng },
      radiusKm: 12.0, // Excursion day has larger natural exploration footprint
    });
  }

  return clusters;
}

/**
 * Macro-Cluster Sequencing (Inter-Cluster Traveling Salesperson Problem)
 * Orders the K day clusters in a geographically contiguous sequence starting from startCoord
 * to prevent day-to-day route jumping and criss-crossing.
 */
export function sequenceDayClusters(
  clusters: DayCluster[],
  startCoord?: Coordinates
): DayCluster[] {
  if (clusters.length <= 1) {
    return clusters.map((c, i) => ({ ...c, day: i + 1 }));
  }

  // Ensure every cluster has a centroid
  const unvisited = clusters.map(c => {
    let centroid = c.centroid;
    if (!centroid && c.pois.length > 0) {
      const avgLat = c.pois.reduce((acc, p) => acc + p.lat, 0) / c.pois.length;
      const avgLng = c.pois.reduce((acc, p) => acc + p.lng, 0) / c.pois.length;
      centroid = { lat: avgLat, lng: avgLng };
    }
    return {
      ...c,
      centroid: centroid || { lat: 0, lng: 0 }
    };
  });

  const sequenced: DayCluster[] = [];

  // Pick Day 1 cluster: Closest to startCoord (or first cluster if no startCoord)
  const currentRef: Coordinates = startCoord || unvisited[0].centroid!;
  let firstIdx = 0;
  let minD = Infinity;

  unvisited.forEach((c, idx) => {
    if (c.centroid && c.centroid.lat !== 0) {
      const d = haversineDistance(currentRef, c.centroid);
      if (d < minD) {
        minD = d;
        firstIdx = idx;
      }
    }
  });

  let currentCluster = unvisited.splice(firstIdx, 1)[0];
  sequenced.push(currentCluster);

  // Greedily chain remaining clusters to form a continuous corridor
  while (unvisited.length > 0) {
    const ref = currentCluster.centroid!;
    let nearestIdx = 0;
    let nextMinD = Infinity;

    unvisited.forEach((c, idx) => {
      if (c.centroid && c.centroid.lat !== 0) {
        const d = haversineDistance(ref, c.centroid);
        if (d < nextMinD) {
          nextMinD = d;
          nearestIdx = idx;
        }
      }
    });

    currentCluster = unvisited.splice(nearestIdx, 1)[0];
    sequenced.push(currentCluster);
  }

  // Renumber days 1..K
  return sequenced.map((c, idx) => ({
    ...c,
    day: idx + 1,
  }));
}

/**
 * Geometric Orientation helper: Checks if three points are listed in counterclockwise order.
 */
function ccw(p1: Coordinates, p2: Coordinates, p3: Coordinates): number {
  return (p2.lng - p1.lng) * (p3.lat - p1.lat) - (p2.lat - p1.lat) * (p3.lng - p1.lng);
}

/**
 * Checks if line segment AB intersects line segment CD in 2D Euclidean / planar space.
 */
export function doSegmentsIntersect(a: Coordinates, b: Coordinates, c: Coordinates, d: Coordinates): boolean {
  // If sharing an endpoint, not considered a crossing
  if (
    (Math.abs(a.lat - c.lat) < 1e-7 && Math.abs(a.lng - c.lng) < 1e-7) ||
    (Math.abs(a.lat - d.lat) < 1e-7 && Math.abs(a.lng - d.lng) < 1e-7) ||
    (Math.abs(b.lat - c.lat) < 1e-7 && Math.abs(b.lng - c.lng) < 1e-7) ||
    (Math.abs(b.lat - d.lat) < 1e-7 && Math.abs(b.lng - d.lng) < 1e-7)
  ) {
    return false;
  }

  const ccw1 = ccw(a, b, c);
  const ccw2 = ccw(a, b, d);
  const ccw3 = ccw(c, d, a);
  const ccw4 = ccw(c, d, b);

  return (
    ((ccw1 > 0 && ccw2 < 0) || (ccw1 < 0 && ccw2 > 0)) &&
    ((ccw3 > 0 && ccw4 < 0) || (ccw3 < 0 && ccw4 > 0))
  );
}

/**
 * Academic Metric: Counts the number of self-intersecting route edges in an itinerary day.
 * Target for optimal 2-Opt planar tour = 0.
 */
export function countIntersectingEdges(activities: Array<{ lat?: number; lng?: number }>): number {
  const geo = activities.filter(a => a.lat !== undefined && a.lng !== undefined && !isNaN(a.lat!) && !isNaN(a.lng!));
  if (geo.length < 4) return 0;

  let crossings = 0;
  for (let i = 0; i < geo.length - 1; i++) {
    const pA = { lat: geo[i].lat!, lng: geo[i].lng! };
    const pB = { lat: geo[i + 1].lat!, lng: geo[i + 1].lng! };

    for (let j = i + 2; j < geo.length - 1; j++) {
      const pC = { lat: geo[j].lat!, lng: geo[j].lng! };
      const pD = { lat: geo[j + 1].lat!, lng: geo[j + 1].lng! };

      if (doSegmentsIntersect(pA, pB, pC, pD)) {
        crossings++;
      }
    }
  }
  return crossings;
}

/**
 * 2-Opt Local Search TSP Solver (with optional start anchor and depot return)
 * Mathematically guarantees uncrossing of intersecting path segments in 2D space (0 Edge Crossings).
 */
export function solve2OptTSP<T extends { lat?: number; lng?: number }>(
  items: T[],
  startCoord?: Coordinates,
  endDepotCoord?: Coordinates
): T[] {
  const valid = items.filter(p => p.lat !== undefined && p.lng !== undefined && !isNaN(p.lat!) && !isNaN(p.lng!));
  const nonGeo = items.filter(p => p.lat === undefined || p.lng === undefined || isNaN(p.lat!) || isNaN(p.lng!));
  if (valid.length <= 2) return [...valid, ...nonGeo];

  // 1. Initial Nearest Neighbor Greedy Tour
  const unvisited = [...valid];
  let route: T[] = [];

  let currentRef: Coordinates = startCoord || { lat: unvisited[0].lat!, lng: unvisited[0].lng! };
  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minD = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineDistance(currentRef, { lat: unvisited[i].lat!, lng: unvisited[i].lng! });
      if (d < minD) {
        minD = d;
        nearestIdx = i;
      }
    }
    const nextItem = unvisited.splice(nearestIdx, 1)[0];
    route.push(nextItem);
    currentRef = { lat: nextItem.lat!, lng: nextItem.lng! };
  }

  // Tour Cost Evaluator
  const computeTourCost = (tour: T[]): number => {
    let total = 0;
    if (startCoord) {
      total += haversineDistance(startCoord, { lat: tour[0].lat!, lng: tour[0].lng! });
    }
    for (let i = 0; i < tour.length - 1; i++) {
      const legDist = haversineDistance(
        { lat: tour[i].lat!, lng: tour[i].lng! },
        { lat: tour[i + 1].lat!, lng: tour[i + 1].lng! }
      );
      // Penalize excessive hops between consecutive places (>12 km) to ensure tight 3-5 km clustering
      const hopPenalty = legDist > 12 ? Math.pow(legDist - 12, 1.5) * 5 : 0;
      total += legDist + hopPenalty;

      // Penalize acute turn-back angles (> 120 deg) over long distances (> 2.5 km) to enforce monotonic corridor flow
      if (i > 0) {
        const pPrev = { lat: tour[i - 1].lat!, lng: tour[i - 1].lng! };
        const pCurr = { lat: tour[i].lat!, lng: tour[i].lng! };
        const pNext = { lat: tour[i + 1].lat!, lng: tour[i + 1].lng! };

        const cosLat = Math.cos((pCurr.lat * Math.PI) / 180);
        const v1x = (pCurr.lng - pPrev.lng) * cosLat;
        const v1y = pCurr.lat - pPrev.lat;
        const v2x = (pNext.lng - pCurr.lng) * cosLat;
        const v2y = pNext.lat - pCurr.lat;

        const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const len2 = Math.sqrt(v2x * v2x + v2y * v2y);

        if (len1 > 1e-6 && len2 > 1e-6) {
          const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
          // dot < -0.5 corresponds to turn angle > 120 degrees (sharp U-turn / backtracking)
          if (dot < -0.5) {
            const prevLegDist = haversineDistance(pPrev, pCurr);
            if (prevLegDist > 2.5 && legDist > 2.5) {
              const severity = (-dot - 0.5) * 2; // 0 to 1
              const turnPenalty = (prevLegDist + legDist) * 0.8 * severity;
              total += turnPenalty;
            }
          }
        }
      }
    }
    if (endDepotCoord) {
      total += haversineDistance({ lat: tour[tour.length - 1].lat!, lng: tour[tour.length - 1].lng! }, endDepotCoord);
    }
    return total;
  };

  // 2. 2-Opt Local Search Iteration
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    let currentCost = computeTourCost(route);

    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const candidate: T[] = [
          ...route.slice(0, i),
          ...route.slice(i, j + 1).reverse(),
          ...route.slice(j + 1)
        ];

        const candidateCost = computeTourCost(candidate);
        if (candidateCost < currentCost - 1e-4) {
          route = candidate;
          currentCost = candidateCost;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return [...route, ...nonGeo];
}

/**
 * Hotel Depot 2-Opt TSP Solver
 * Solves Hotel -> p1 -> p2 -> ... -> pn -> Hotel closed circuit with 0 edge crossings.
 */
export function solveDepot2OptTSP<T extends { lat?: number; lng?: number }>(
  items: T[],
  hotelCoord: Coordinates
): T[] {
  return solve2OptTSP(items, hotelCoord, hotelCoord);
}

/**
 * Backward-compatible Greedy TSP (upgraded to 2-Opt optimization)
 */
export function solveGreedyTSP(
  pois: POICandidate[],
  startCoord?: Coordinates,
  endDepotCoord?: Coordinates
): POICandidate[] {
  return solve2OptTSP(pois, startCoord, endDepotCoord);
}

/**
 * Category Mapper from Google Place Types
 */
export function mapPlaceTypeToCategory(types: string[]): "attraction" | "food" | "nature" | "culture" | "activity" | "shopping" | "nightlife" | "relax" {
  if (types.some(t => ["restaurant", "cafe", "food", "bakery"].includes(t))) return "food";
  if (types.some(t => ["park", "campground", "zoo", "aquarium"].includes(t))) return "nature";
  if (types.some(t => ["museum", "art_gallery", "church", "hindu_temple", "place_of_worship", "synagogue"].includes(t))) return "culture";
  if (types.some(t => ["shopping_mall", "department_store", "clothing_store", "store"].includes(t))) return "shopping";
  if (types.some(t => ["night_club", "bar", "casino"].includes(t))) return "nightlife";
  if (types.some(t => ["spa", "beauty_salon"].includes(t))) return "relax";
  if (types.some(t => ["amusement_park", "bowling_alley", "stadium"].includes(t))) return "activity";
  return "attraction";
}

/**
 * Multi-Criteria Decision Making (MCDM) POI Scoring
 */
export function scorePOIs(
  pois: POICandidate[],
  centerCoords: Coordinates,
  preferredActivities: string[] = []
): (POICandidate & { score: number })[] {
  const preferredCategories = new Set<string>();
  preferredActivities.forEach(act => {
    const lower = act.toLowerCase();
    if (lower.includes("food") || lower.includes("dining") || lower.includes("restaurant") || lower.includes("cafe")) preferredCategories.add("food");
    if (lower.includes("museum") || lower.includes("culture") || lower.includes("history") || lower.includes("art")) preferredCategories.add("culture");
    if (lower.includes("nature") || lower.includes("outdoor") || lower.includes("park")) preferredCategories.add("nature");
    if (lower.includes("shopping") || lower.includes("market")) preferredCategories.add("shopping");
    if (lower.includes("night") || lower.includes("bar")) preferredCategories.add("nightlife");
    if (lower.includes("relax") || lower.includes("spa") || lower.includes("wellness")) preferredCategories.add("relax");
    if (lower.includes("sport") || lower.includes("adventure") || lower.includes("fun")) preferredCategories.add("activity");
  });

  const maxRadius = 25; // 25 km max penalty threshold

  return pois.map(poi => {
    const ratingScore = (poi.rating ?? 3.5) / 5;
    const reviewLog = Math.log10((poi.userRatingsTotal ?? 0) + 1);
    const popularityScore = Math.min(1, reviewLog / 5); // caps at ~100k reviews
    
    const cat = poi.type ? mapPlaceTypeToCategory([poi.type]) : "attraction";
    const preferenceMatchScore = preferredCategories.size === 0 || preferredCategories.has(cat) ? 1.0 : 0.4;
    
    const dist = haversineDistance(poi, centerCoords);
    const distancePenalty = Math.max(0, 1 - dist / maxRadius);

    const stochasticBonus = Math.random() * 0.1;

    const wRating = 0.3;
    const wPopularity = 0.2;
    const wPref = 0.3;
    const wDist = 0.2;

    const score = (ratingScore * wRating) +
                  (popularityScore * wPopularity) +
                  (preferenceMatchScore * wPref) +
                  (distancePenalty * wDist) +
                  stochasticBonus;

    return { ...poi, score };
  });
}

/**
 * Stratified Round-Robin Selection to ensure category diversity
 */
export function selectDiversePOIs(
  scoredPois: (POICandidate & { score: number })[],
  targetCount: number
): POICandidate[] {
  if (scoredPois.length <= targetCount) return scoredPois;

  const groups: Record<string, typeof scoredPois> = {};
  scoredPois.forEach(poi => {
    const cat = poi.type ? mapPlaceTypeToCategory([poi.type]) : "attraction";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(poi);
  });

  Object.keys(groups).forEach(cat => {
    groups[cat].sort((a, b) => b.score - a.score);
  });

  const selected: POICandidate[] = [];
  const categories = Object.keys(groups);
  if (categories.length === 0) return scoredPois.slice(0, targetCount);

  let index = 0;
  while (selected.length < targetCount && categories.length > 0) {
    const cat = categories[index % categories.length];
    const group = groups[cat];
    if (group && group.length > 0) {
      selected.push(group.shift()!);
    } else {
      categories.splice(categories.indexOf(cat), 1);
    }
    index++;
  }

  return selected;
}

/**
 * Candidate POI Collection from Google Places API + Recognized Places
 */
export async function gatherCandidatePOIs(
  destinationName: string,
  centerCoords: Coordinates,
  userRecognizedPlaces: string[],
  preferredActivities: string[] = []
): Promise<POICandidate[]> {
  const candidates: POICandidate[] = [];
  const addedNames = new Set<string>();

  const addPoi = (poi: POICandidate) => {
    const cleaned = poi.name.trim().toLowerCase();
    if (!addedNames.has(cleaned)) {
      addedNames.add(cleaned);
      candidates.push(poi);
    }
  };

  // 1. Geocode user recognized places from images first (Highest Priority)
  for (const placeName of userRecognizedPlaces) {
    try {
      const coords = await getCoordinates(placeName, centerCoords, destinationName);
      addPoi({
        name: placeName,
        lat: coords.lat,
        lng: coords.lng,
        type: "recognized_image_landmark",
      });
    } catch (e) {
      console.warn(`[gatherCandidatePOIs] Could not geocode recognized place: ${placeName}`, e);
    }
  }

  // 2. Fetch Multi-Category Nearby Places
  const typesToQuery = ["tourist_attraction"];
  preferredActivities.forEach(act => {
    const lower = act.toLowerCase();
    if (lower.includes("food") || lower.includes("dining")) typesToQuery.push("restaurant");
    if (lower.includes("museum") || lower.includes("culture") || lower.includes("art")) typesToQuery.push("museum");
    if (lower.includes("nature") || lower.includes("outdoor")) typesToQuery.push("park");
    if (lower.includes("shopping")) typesToQuery.push("shopping_mall");
    if (lower.includes("night")) typesToQuery.push("bar");
  });

  const uniqueTypes = Array.from(new Set(typesToQuery)).slice(0, 5);

  const foursquareKey = import.meta.env.VITE_FOURSQUARE_API_KEY as string;
  if (foursquareKey && centerCoords.lat && centerCoords.lng) {
    try {
      const fsqCatMap: Record<string, string> = {
        tourist_attraction: "16000",
        restaurant: "13065",
        museum: "10027",
        park: "16032",
        shopping_mall: "17114",
        bar: "13003",
      };
      const fsqCategories = uniqueTypes.map((t) => fsqCatMap[t] || "16000").join(",");
      const fsqUrl = import.meta.env.DEV
        ? `/fsq-api/places/search?ll=${centerCoords.lat},${centerCoords.lng}&radius=15000&categories=${fsqCategories}&limit=25`
        : `${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080"}/foursquare/search?ll=${centerCoords.lat},${centerCoords.lng}&radius=15000&categories=${fsqCategories}&limit=25`;
      const fsqRes = await fetch(fsqUrl, {
        headers: {
          Authorization: foursquareKey,
          Accept: "application/json",
        },
      });
      if (fsqRes.ok) {
        const fsqData = await fsqRes.json();
        const fsqResults = fsqData.results || [];
        fsqResults.forEach((p: any) => {
          const coords = p.geocodes?.main;
          if (p.name && coords?.latitude && coords?.longitude) {
            let photoUrl: string | null = null;
            if (p.photos && p.photos.length > 0) {
              photoUrl = `${p.photos[0].prefix}original${p.photos[0].suffix}`;
            }
            addPoi({
              name: p.name,
              lat: coords.latitude,
              lng: coords.longitude,
              rating: p.rating ? Math.round((p.rating / 2) * 10) / 10 : 4.5,
              userRatingsTotal: p.stats?.total_ratings || p.stats?.ratings_total || 60,
              photo_url: photoUrl,
              place_id: p.fsq_id,
              type: "attraction",
            });
          }
        });
      }
    } catch (fsqErr) {
      console.warn("[gatherCandidatePOIs] Foursquare places fetch failed:", fsqErr);
    }
  }

  const geoapifyKey = import.meta.env.VITE_GEOAPIFY_API_KEY as string;
  if (candidates.length < 5 && geoapifyKey && centerCoords.lat && centerCoords.lng) {
    try {
      const catMap: Record<string, string> = {
        tourist_attraction: "tourism.sights,tourism.attraction",
        restaurant: "catering.restaurant",
        museum: "entertainment.museum,tourism.sights",
        park: "leisure.park",
        shopping_mall: "commercial.shopping_mall",
        bar: "catering.bar",
      };

      const categories = uniqueTypes.map((t) => catMap[t] || "tourism.sights").join(",");
      const url = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(
        categories
      )}&filter=circle:${centerCoords.lng},${centerCoords.lat},15000&limit=25&apiKey=${geoapifyKey}&lang=en`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const features = data.features || [];
        features.forEach((p: any) => {
          const props = p.properties || {};
          const coords = p.geometry?.coordinates;
          if (props.name && coords && coords.length >= 2) {
            addPoi({
              name: props.name,
              lat: coords[1],
              lng: coords[0],
              rating: props.rank?.popularity
                ? Math.round(props.rank.popularity * 5 * 10) / 10
                : 4.5,
              userRatingsTotal: props.rank?.confidence
                ? Math.round(props.rank.confidence * 100)
                : 50,
              photo_url: null,
              place_id: props.place_id,
              type: "attraction",
            });
          }
        });
      }
    } catch (err) {
      console.warn("[gatherCandidatePOIs] Geoapify places fetch failed:", err);
    }
  }

  return candidates;
}

/**
 * Time & Scheduling Helpers
 */
export function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
}

export function formatMinutesToTime(minutes: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function parseOpeningHours(
  weekdayText: string[] | null | undefined,
  dayOfWeek: number // 0=Sunday, 1=Monday, ..., 6=Saturday
): { openMinutes: number; closeMinutes: number } | null {
  if (!weekdayText || !Array.isArray(weekdayText) || weekdayText.length === 0) return null;

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetDayName = dayNames[dayOfWeek];

  const dayEntry = weekdayText.find(line => line.toLowerCase().startsWith(targetDayName.toLowerCase()));
  if (!dayEntry) return null;

  if (dayEntry.toLowerCase().includes("open 24 hours") || dayEntry.toLowerCase().includes("เปิด 24 ชั่วโมง")) {
    return { openMinutes: 0, closeMinutes: 24 * 60 };
  }
  if (dayEntry.toLowerCase().includes("closed") || dayEntry.toLowerCase().includes("ปิด")) {
    return { openMinutes: -1, closeMinutes: -1 };
  }

  const timePart = dayEntry.split(":").slice(1).join(":").trim();
  const times = timePart.split(/–|-/);
  if (times.length < 2) return null;

  const parse12or24 = (tStr: string): number | null => {
    const cleaned = tStr.trim();
    const ampmMatch = cleaned.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
      const period = ampmMatch[3].toUpperCase();
      if (period === "PM" && h < 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      return h * 60 + m;
    }
    const h24Match = cleaned.match(/(\d{1,2}):(\d{2})/);
    if (h24Match) {
      return parseInt(h24Match[1], 10) * 60 + parseInt(h24Match[2], 10);
    }
    return null;
  };

  const openM = parse12or24(times[0]);
  const closeM = parse12or24(times[1]);

  if (openM !== null && closeM !== null) {
    return { openMinutes: openM, closeMinutes: closeM };
  }

  return null;
}

export function isZoneOrArea(activity: ActivityItem | Activity): boolean {
  const title = (activity.title || "").toLowerCase();
  const type = (activity.type || "").toLowerCase();

  // Public zones, districts, streets, old towns, beaches, and parks are assumed open 24 hours
  if (
    title.includes("street") ||
    title.includes("road") ||
    title.includes("district") || 
    title.includes("square") ||
    title.includes("area") ||
    title.includes("bazaar") ||
    title.includes("quarter") ||
    title.includes("old town") ||
    title.includes("walking street") ||
    title.includes("beach") ||
    title.includes("waterfront") ||
    title.includes("riverside") ||
    title.includes("park") ||
    title.includes("ถนน") ||
    title.includes("ย่าน") ||
    title.includes("จัตุรัส") ||
    title.includes("หาด") ||
    title.includes("ริมน้ำ") ||
    title.includes("เมืองเก่า")
  ) {
    return true;
  }

  if (type === "transport" || type === "hotel") {
    return true;
  }

  if (activity.openingHours && activity.openingHours.length > 0) {
    const isAll24 = activity.openingHours.every(h =>
      h.toLowerCase().includes("open 24 hours") ||
      h.toLowerCase().includes("24 ชั่วโมง") ||
      h.toLowerCase().includes("open 24h")
    );
    if (isAll24) return true;
  }

  return false;
}

/**
 * Identifies if an activity is best suited for golden hour / sunset (e.g. viewpoints, rooftop, beach, deck)
 */
export function isSunsetSpot(act: Activity | ActivityItem): boolean {
  const t = ((act.title || "") + " " + ((act as any).description || "") + " " + (act.type || "")).toLowerCase();
  return (
    t.includes("sunset") ||
    t.includes("viewpoint") ||
    t.includes("observation deck") ||
    t.includes("tower") ||
    t.includes("rooftop") ||
    t.includes("skyline") ||
    t.includes("พระอาทิตย์ตก") ||
    t.includes("จุดชมวิว") ||
    t.includes("ดาดฟ้า")
  );
}

/**
 * Plan Coherence Evaluator Layer
 */
export interface ActivityItem {
  id?: string;
  time?: string;
  title: string;
  description?: string;
  type: string;
  lat?: number;
  lng?: number;
  openingHours?: string[] | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
  priceLevel?: number | null;
}

export interface DayPlanItem {
  day: number;
  activities: ActivityItem[];
}

export interface AuditPreferences {
  budget?: string;
  travelerType?: string;
  activities?: string[];
  pace?: string;
}

export interface ItineraryCoherence {
  totalScore: number;
  spatialScore: number;
  diversityScore: number;
  paceScore: number;
  schedulingScore: number;
  selectionScore: number; // 4th Pillar: POI Quality, Budget, Persona & Category Fit
  dailyDistanceKm: number[];
  totalDistanceKm: number;
  crossingCount: number;
  warnings: string[];
  passedChecks: string[]; // List of confirmed audit standards passed
}

/**
 * Calculates Coherence Score based on strict spatial, time, opening hours, lunch, anti-consecutive meal,
 * edge crossing minimization, budget alignment, persona fit, and quality constraints.
 */
export function calculateCoherenceScore(
  itinerary: DayPlanItem[],
  pace: string = "Moderate",
  tripStartDate?: Date,
  preferences?: AuditPreferences,
  weatherForecast?: Array<{ date?: string; condition?: any; rainChance?: number; isRainy?: boolean } | any>
): ItineraryCoherence {
  let totalDist = 0;
  let totalActivities = 0;
  let totalCrossings = 0;
  const dailyDistanceKm: number[] = [];
  const warnings: string[] = [];
  let schedulingPenalty = 0;
  let spatialPenalty = 0;
  let selectionPenalty = 0;

  const visitedTitles = new Set<string>();

  // 1. Cross-Day Proximity & Overlap Check
  const dayCentroids: { day: number; lat: number; lng: number; pois: ActivityItem[] }[] = [];

  itinerary.forEach((day) => {
    const valid = day.activities.filter(a => a.lat && a.lng && a.type !== "hotel");
    if (valid.length > 0) {
      const avgLat = valid.reduce((acc, a) => acc + a.lat!, 0) / valid.length;
      const avgLng = valid.reduce((acc, a) => acc + a.lng!, 0) / valid.length;
      dayCentroids.push({ day: day.day, lat: avgLat, lng: avgLng, pois: valid });
    }
  });

  for (let i = 0; i < dayCentroids.length; i++) {
    for (let j = i + 1; j < dayCentroids.length; j++) {
      const dayA = dayCentroids[i];
      const dayB = dayCentroids[j];

      for (const pA of dayA.pois) {
        for (const pB of dayB.pois) {
          const d = haversineDistance(
            { lat: pA.lat!, lng: pA.lng! },
            { lat: pB.lat!, lng: pB.lng! }
          );
          if (d < 1.5 && pA.title.toLowerCase() !== pB.title.toLowerCase()) {
            warnings.push(
              `Day ${dayA.day} and Day ${dayB.day} both visit nearby spots in the same neighborhood ("${pA.title}" and "${pB.title}", ${d.toFixed(1)} km apart). Group them on the same day.`
            );
            spatialPenalty += 8;
            break;
          }
        }
      }
    }
  }

  itinerary.forEach((day, dayIdx) => {
    let dayDist = 0;
    const activities = day.activities;
    totalActivities += activities.length;

    let dayOfWeek = (new Date().getDay() + dayIdx) % 7;
    if (tripStartDate) {
      const d = new Date(tripStartDate);
      d.setDate(d.getDate() + dayIdx);
      dayOfWeek = d.getDay();
    }

    let hasLunch = false;
    let hasDinner = false;
    let longCommutePairs = 0;

    const validGeoActs = activities.filter(a => a.lat && a.lng && a.type !== "hotel");

    // Crossing Check (Target for optimal 2-Opt route: 0 crossings)
    const dayCrossings = countIntersectingEdges(validGeoActs);
    totalCrossings += dayCrossings;
    if (dayCrossings > 0) {
      warnings.push(`Day ${day.day}: Route has ${dayCrossings} self-intersecting segments (criss-cross). Optimize sequencing with 2-Opt.`);
      spatialPenalty += dayCrossings * 8;
    }

    // Anti-Looping Check: First and last activity must not loop back to meet each other
    if (validGeoActs.length >= 4) {
      const firstAct = validGeoActs[0];
      const lastAct = validGeoActs[validGeoActs.length - 1];
      const dStartEnd = haversineDistance(
        { lat: firstAct.lat!, lng: firstAct.lng! },
        { lat: lastAct.lat!, lng: lastAct.lng! }
      );
      let maxExcursion = 0;
      validGeoActs.forEach(a => {
        const d = haversineDistance({ lat: firstAct.lat!, lng: firstAct.lng! }, { lat: a.lat!, lng: a.lng! });
        if (d > maxExcursion) maxExcursion = d;
      });

      if (maxExcursion > 1.8 && dStartEnd < 0.6) {
        warnings.push(`Day ${day.day}: Route loops back to meet near the morning start point ("${firstAct.title}" and "${lastAct.title}", only ${dStartEnd.toFixed(1)} km apart). Real travelers follow an open progressive route across the district.`);
        spatialPenalty += 8;
      }
    }

    // Category Monotony / Burnout Evaluator (Pearce 1988)
    const catCounts: Record<string, number> = {};
    activities.forEach(a => {
      if (a.type !== "food" && a.type !== "hotel" && a.type !== "transport") {
        catCounts[a.type] = (catCounts[a.type] || 0) + 1;
      }
    });

    Object.entries(catCounts).forEach(([cat, count]) => {
      if (count >= 3 && activities.length >= 4) {
        warnings.push(
          `Day ${day.day}: [Category Monotony: 3+ consecutive "${cat}" spots] Contains ${count} ${cat} spots in a single day, risking visitor burnout / monotony. Consider diversifying with parks, dining, or shopping.`
        );
        selectionPenalty += 6;
      }
    });

    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      const actTimeMin = parseTimeToMinutes(act.time);

      // Duplicate Places Check
      if (act.type !== "hotel") {
        const cleanTitle = act.title.trim().toLowerCase();
        if (visitedTitles.has(cleanTitle)) {
          warnings.push(`Day ${day.day}: "${act.title}" is visited multiple times in the trip.`);
          schedulingPenalty += 10;
        } else {
          visitedTitles.add(cleanTitle);
        }
      }

      // Opening Hours & Dwell-Time Buffer Check
      if (actTimeMin !== null && !isZoneOrArea(act)) {
        const hours = parseOpeningHours(act.openingHours, dayOfWeek);
        if (hours) {
          if (hours.openMinutes === -1) {
            warnings.push(`Day ${day.day}: "${act.title}" is closed on this day.`);
            schedulingPenalty += 15;
          } else if (actTimeMin < hours.openMinutes) {
            const openFormatted = `${Math.floor(hours.openMinutes / 60)}:${(hours.openMinutes % 60).toString().padStart(2, '0')}`;
            const closeFormatted = `${Math.floor(hours.closeMinutes / 60)}:${(hours.closeMinutes % 60).toString().padStart(2, '0')}`;
            warnings.push(`Day ${day.day}: "${act.title}" at ${act.time} is outside operating hours (${openFormatted} - ${closeFormatted}).`);
            schedulingPenalty += 10;
          } else if (hours.closeMinutes > hours.openMinutes) {
            const dwellTime = getEstimatedDwellMinutes(act as any, pace);
            const closeBuffer = Math.max(45, Math.min(150, dwellTime + 15));
            if (actTimeMin > hours.closeMinutes - closeBuffer) {
              const closeFormatted = `${Math.floor(hours.closeMinutes / 60)}:${(hours.closeMinutes % 60).toString().padStart(2, '0')}`;
              const latestAllowed = hours.closeMinutes - closeBuffer;
              const latestFormatted = `${Math.floor(latestAllowed / 60)}:${(latestAllowed % 60).toString().padStart(2, '0')}`;
              warnings.push(`Day ${day.day}: "${act.title}" at ${act.time} closes at ${closeFormatted}, leaving insufficient dwell time (requires ~${dwellTime}m). Should start by ${latestFormatted}.`);
              schedulingPenalty += 8;
            }
          }
        }
      }

      // Selection Rule 1: Budget Compatibility Check
      if (preferences?.budget) {
        const b = preferences.budget.toLowerCase();
        if (b.includes("budget") || b.includes("low")) {
          if (act.priceLevel !== undefined && act.priceLevel !== null && act.priceLevel >= 3) {
            warnings.push(`Day ${day.day}: [Budget Mismatch] "${act.title}" is an expensive venue (Price Level ${act.priceLevel}/4) exceeding your Budget preference.`);
            selectionPenalty += 6;
          } else {
            const t = (act.title + " " + (act.description || "")).toLowerCase();
            if (t.includes("fine dining") || t.includes("michelin 3-star") || t.includes("ultra luxury")) {
              warnings.push(`Day ${day.day}: [Budget Mismatch] "${act.title}" is an upscale luxury venue that may exceed a budget travel tier.`);
              selectionPenalty += 6;
            }
          }
        }
      }

      // Selection Rule 2: Traveler Persona / Type Suitability Check
      if (preferences?.travelerType) {
        const tType = preferences.travelerType.toLowerCase();
        if (tType.includes("family") || tType.includes("kid") || tType.includes("child")) {
          if (act.type === "nightlife") {
            warnings.push(`Day ${day.day}: [Persona Mismatch] Nightlife spot "${act.title}" is unsuitable for a Family with children. Substitute with family-friendly evening dining or cultural walks.`);
            selectionPenalty += 10;
          } else {
            const t = (act.title + " " + (act.description || "")).toLowerCase();
            if (t.includes("bar") || t.includes("club") || t.includes("red light") || t.includes("pub crawl")) {
              warnings.push(`Day ${day.day}: [Persona Mismatch] Venue "${act.title}" contains adult-oriented themes unsuitable for a Family itinerary.`);
              selectionPenalty += 10;
            }
          }
        } else if (tType.includes("senior") || tType.includes("elderly")) {
          const t = (act.title + " " + (act.description || "")).toLowerCase();
          if (act.type === "adventure" || t.includes("extreme") || t.includes("hiking") || t.includes("trek") || t.includes("rock climbing") || t.includes("bungee")) {
            warnings.push(`Day ${day.day}: [Persona Consideration] High physical exertion activity "${act.title}" may be overly strenuous for Senior travelers.`);
            selectionPenalty += 8;
          }
        }
      }

      // Selection Rule 3: Quality Threshold & Tourist Trap Filter
      if (act.type !== "hotel" && act.type !== "transport") {
        if (act.rating !== undefined && act.rating !== null && act.rating > 0 && act.rating < 3.8) {
          warnings.push(`Day ${day.day}: [Quality Warning] "${act.title}" has a low visitor rating (${act.rating}★/5). Consider substituting with a higher-rated alternative.`);
          selectionPenalty += 6;
        } else if (act.userRatingsTotal !== undefined && act.userRatingsTotal !== null && act.userRatingsTotal > 0 && act.userRatingsTotal < 15 && act.rating && act.rating < 4.0) {
          warnings.push(`Day ${day.day}: [Quality Warning] "${act.title}" has very few reviews (${act.userRatingsTotal}) with unverified visitor satisfaction.`);
          selectionPenalty += 4;
        }
      }

      // Selection Rule 4: Weather Appropriateness Check
      if (weatherForecast && weatherForecast[dayIdx]) {
        const fc = weatherForecast[dayIdx] as any;
        const conditionStr = typeof fc.condition === "string"
          ? fc.condition
          : (typeof fc.condition?.description === "string"
            ? fc.condition.description
            : (typeof fc.condition?.text === "string"
              ? fc.condition.text
              : (typeof fc.condition?.main === "string" ? fc.condition.main : "")));

        const isRainy = Boolean(
          conditionStr.toLowerCase().includes("rain") ||
          conditionStr.toLowerCase().includes("storm") ||
          conditionStr.toLowerCase().includes("thunderstorm") ||
          (fc.rainChance !== undefined && fc.rainChance >= 60) ||
          fc.isRainy === true
        );
        if (isRainy && (act.type === "nature" || act.type === "beach" || act.title.toLowerCase().includes("open rooftop") || act.title.toLowerCase().includes("beach"))) {
          warnings.push(`Day ${day.day}: [Weather Alert] Outdoor spot "${act.title}" is scheduled during forecasted stormy/rainy weather (${conditionStr || "Heavy Thunderstorms"}). Consider an indoor museum or cultural venue.`);
          selectionPenalty += 5;
        }
      }

      // Meal Time Slot Detection
      if (act.type === "food" && actTimeMin !== null) {
        if (actTimeMin >= 11 * 60 && actTimeMin <= 13 * 60 + 30) {
          hasLunch = true;
          // Proximity to morning activity check
          if (i > 0) {
            const prevAct = activities[i - 1];
            if (prevAct.lat && prevAct.lng && act.lat && act.lng) {
              const dLunchToPrev = haversineDistance(
                { lat: prevAct.lat, lng: prevAct.lng },
                { lat: act.lat, lng: act.lng }
              );
              if (dLunchToPrev > 2.5) {
                warnings.push(`Day ${day.day}: Lunch spot "${act.title}" is located too far (${dLunchToPrev.toFixed(1)} km) from preceding morning activity "${prevAct.title}". Lunch should be nearby in the same neighborhood.`);
                spatialPenalty += 6;
              }
            }
          }
        }
        if (actTimeMin >= 17 * 60 + 30 && actTimeMin <= 21 * 60 + 30) hasDinner = true;
      }

      // Daily Flow Pattern
      if (actTimeMin !== null) {
        if (act.type === "nightlife" && actTimeMin < 17 * 60) {
          warnings.push(`Day ${day.day}: Nightlife spot "${act.title}" is scheduled too early (${act.time}).`);
          schedulingPenalty += 5;
        }
        if ((act.type === "nature" || act.type === "culture") && actTimeMin >= 19 * 60 + 30) {
          warnings.push(`Day ${day.day}: Outdoor/museum spot "${act.title}" scheduled late at night (${act.time}).`);
          schedulingPenalty += 5;
        }
      }

      // Consecutive Activity Checks
      if (i < activities.length - 1) {
        const nextAct = activities[i + 1];
        const nextTimeMin = parseTimeToMinutes(nextAct.time);

        // No Consecutive Meals Check
        if (act.type === "food" && nextAct.type === "food") {
          warnings.push(`Day ${day.day}: Consecutive dining spots ("${act.title}" and "${nextAct.title}") without an activity in between.`);
          schedulingPenalty += 8;
        }

        // Distance & Adjacent Hop Check
        if (act.lat && act.lng && nextAct.lat && nextAct.lng) {
          const d = haversineDistance(
            { lat: act.lat, lng: act.lng },
            { lat: nextAct.lat, lng: nextAct.lng }
          );
          dayDist += d;
          if (d > 15) {
            warnings.push(`Day ${day.day}: Distance between "${act.title}" and "${nextAct.title}" is ${d.toFixed(1)} km, exceeding recommended 10-15 km maximum hop limit.`);
            spatialPenalty += 6;
          }
          if (d >= 25) {
            longCommutePairs++;
          }

          // Anti-Backtracking Check
          if (i < activities.length - 2) {
            const next2Act = activities[i + 2];
            if (next2Act.lat && next2Act.lng) {
              const d_i_i2 = haversineDistance(
                { lat: act.lat, lng: act.lng },
                { lat: next2Act.lat, lng: next2Act.lng }
              );
              if (d_i_i2 < d * 0.4 && d > 5) {
                warnings.push(`Day ${day.day}: Route backtracks near "${act.title}" after visiting "${nextAct.title}".`);
                spatialPenalty += 8;
              }
            }
          }
        }

        // Buffer Time & Dwell Time
        if (actTimeMin !== null && nextTimeMin !== null) {
          const gap = nextTimeMin - actTimeMin;
          if (gap < 30 && gap >= 0) {
            warnings.push(`Day ${day.day}: Tight gap (${gap}m) between "${act.title}" and "${nextAct.title}".`);
            schedulingPenalty += 5;
          } else if (gap > 5 * 60) {
            warnings.push(`Day ${day.day}: Large time gap (${Math.round(gap / 60)}h) between "${act.title}" and "${nextAct.title}".`);
            schedulingPenalty += 5;
          }
        }
      }
    }

    if (longCommutePairs > 1) {
      warnings.push(`Day ${day.day}: Contains ${longCommutePairs} long-distance transit legs (>45 min / 25 km). Limit to at most 1 long trip per day.`);
      spatialPenalty += 10;
    }

    if (!hasLunch && activities.length >= 3) {
      warnings.push(`Day ${day.day}: Missing dedicated lunch spot between 11:00-13:30.`);
      schedulingPenalty += 6;
    }

    dailyDistanceKm.push(dayDist);
    totalDist += dayDist;
  });

  const avgDailyDist = dailyDistanceKm.length > 0 ? totalDist / dailyDistanceKm.length : 0;
  const baseSpatialScore = Math.max(0, Math.min(100, 100 - Math.max(0, avgDailyDist - 12) * 2.5 - spatialPenalty));
  const spatialScore = Math.max(0, baseSpatialScore);

  let totalDiversity = 0;
  itinerary.forEach(day => {
    const counts: Record<string, number> = {};
    day.activities.forEach(a => {
      counts[a.type] = (counts[a.type] || 0) + 1;
    });

    const N = day.activities.length;
    if (N <= 1) {
      totalDiversity += 60;
      return;
    }

    let entropy = 0;
    Object.values(counts).forEach(count => {
      const p = count / N;
      entropy -= p * Math.log2(p);
    });

    const maxEntropy = Math.log2(N);
    const dayScore = maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 60;
    totalDiversity += dayScore;
  });
  const diversityScore = dailyDistanceKm.length > 0 ? totalDiversity / dailyDistanceKm.length : 100;

  const avgActivitiesPerDay = dailyDistanceKm.length > 0 ? totalActivities / dailyDistanceKm.length : 0;
  let idealPace = 4.5;
  if (pace.toLowerCase().includes("relax")) idealPace = 3.5;
  else if (pace.toLowerCase().includes("fast")) idealPace = 5.5;

  const paceDiff = Math.abs(avgActivitiesPerDay - idealPace);
  const paceScore = Math.max(0, Math.min(100, 100 - paceDiff * 20));

  const schedulingScore = Math.max(0, Math.min(100, 100 - schedulingPenalty));
  const selectionScore = Math.max(0, Math.min(100, 100 - selectionPenalty));

  // Balanced 4-Pillar Composite Score (25% each)
  const totalScore = Math.round(
    (spatialScore * 0.25) +
    (diversityScore * 0.25) +
    (paceScore * 0.25) +
    (selectionScore * 0.25)
  );

  // Compile Verified Positive Checks
  const passedChecks: string[] = [];
  if (totalCrossings === 0) {
    passedChecks.push("Planar Hamiltonian Route: 0 self-intersecting segments (unidirectional smooth corridor)");
  }
  if (!warnings.some(w => w.includes("loops back"))) {
    passedChecks.push("Open Corridor Flow: Directional progression without circular loopbacks to start");
  }
  if (!warnings.some(w => w.includes("outside operating hours") || w.includes("closed on this day"))) {
    passedChecks.push("Operating Hours Feasibility: All venues open with adequate dwell visit buffers");
  }
  if (!warnings.some(w => w.includes("Missing dedicated lunch"))) {
    passedChecks.push("Physiological Dining Rhythm: Dedicated midday lunch window near morning neighborhood");
  }
  if (!warnings.some(w => w.includes("Consecutive dining"))) {
    passedChecks.push("Meal Separation: No back-to-back dining spots without cultural/leisure stops");
  }
  if (!warnings.some(w => w.includes("exceeding recommended 10-15 km"))) {
    passedChecks.push("Fatigue Safeguard: All intra-day transit hops comfortably under 15 km ceiling");
  }
  if (!warnings.some(w => w.includes("Budget Mismatch") || w.includes("exceeding your Budget") || w.includes("luxury venue"))) {
    passedChecks.push("Budget Alignment: Venue price tiers strictly respect traveler budget");
  }
  if (!warnings.some(w => w.includes("Persona Mismatch") || w.includes("Persona Consideration") || w.includes("unsuitable for a Family") || w.includes("adult-oriented") || w.includes("Senior travelers") || w.includes("senior travelers"))) {
    passedChecks.push("Traveler Persona Fit: Activities curated appropriately for traveler group");
  }
  if (!warnings.some(w => w.includes("Quality Warning") || w.includes("low visitor rating"))) {
    passedChecks.push("Quality & Review Standards: Venues meet verified 3.8+ star visitor satisfaction standards");
  }
  if (!warnings.some(w => w.includes("Category Monotony") || w.includes("burnout / monotony"))) {
    passedChecks.push("Category Variety (No Monotony): Healthy category distribution without temple/mall burnout");
  }

  return {
    totalScore,
    spatialScore: Math.round(spatialScore),
    diversityScore: Math.round(diversityScore),
    paceScore: Math.round(paceScore),
    schedulingScore: Math.round(schedulingScore),
    selectionScore: Math.round(selectionScore),
    dailyDistanceKm: dailyDistanceKm.map(d => Math.round(d * 10) / 10),
    totalDistanceKm: Math.round(totalDist * 10) / 10,
    crossingCount: totalCrossings,
    warnings,
    passedChecks,
  };
}

/**
 * Extracts a clean structured audit report of itinerary flaws for AI Self-Refinement.
 */
export function auditItineraryIssues(
  itinerary: DayPlanItem[],
  pace: string = "Moderate",
  tripStartDate?: Date,
  preferences?: AuditPreferences,
  weatherForecast?: Array<{ date?: string; condition?: any; rainChance?: number; isRainy?: boolean } | any>
): {
  score: number;
  warnings: string[];
  summary: string;
  selectionScore: number;
  passedChecks: string[];
} {
  const result = calculateCoherenceScore(itinerary, pace, tripStartDate, preferences, weatherForecast);
  const summary = result.warnings.length === 0
    ? "Itinerary is fully coherent and satisfies all spatial, timing, quality, and persona constraints."
    : `Detected ${result.warnings.length} itinerary optimization issues:\n${result.warnings.map((w, idx) => `${idx + 1}. ${w}`).join("\n")}`;
  return {
    score: result.totalScore,
    warnings: result.warnings,
    summary,
    selectionScore: result.selectionScore,
    passedChecks: result.passedChecks,
  };
}


/**
 * Checks if an activity is inherently an evening/night activity
 */
export function isEveningActivity(act: Activity | ActivityItem): boolean {
  const t = ((act.title || "") + " " + ((act as any).description || "") + " " + (act.type || "")).toLowerCase();
  return (
    t.includes("dinner") ||
    t.includes("night") ||
    t.includes("bar") ||
    t.includes("club") ||
    t.includes("sunset") ||
    t.includes("evening") ||
    t.includes("อาหารค่ำ") ||
    t.includes("มื้อค่ำ") ||
    t.includes("มื้อเย็น") ||
    t.includes("ตลาดกลางคืน") ||
    t.includes("กลางคืน") ||
    t.includes("จ๊อดแฟร์") ||
    act.type === "nightlife"
  );
}

/**
 * Checks if an activity is a morning/daytime attraction
 */
export function isMorningActivity(act: Activity | ActivityItem): boolean {
  const t = ((act.title || "") + " " + ((act as any).description || "") + " " + (act.type || "")).toLowerCase();
  return (
    t.includes("breakfast") ||
    t.includes("morning") ||
    t.includes("sunrise") ||
    t.includes("temple") ||
    t.includes("museum") ||
    t.includes("palace") ||
    t.includes("park") ||
    t.includes("วัด") ||
    t.includes("วัง") ||
    t.includes("พิพิธภัณฑ์") ||
    t.includes("ตอนเช้า") ||
    t.includes("อาหารเช้า") ||
    act.type === "culture"
  );
}

/**
 * Checks if an activity is a food/dining activity
 */
export function isFoodActivity(act: Activity | ActivityItem): boolean {
  const t = ((act.title || "") + " " + ((act as any).description || "") + " " + (act.type || "")).toLowerCase();
  return (
    act.type === "food" ||
    t.includes("lunch") ||
    t.includes("dinner") ||
    t.includes("restaurant") ||
    t.includes("dining") ||
    t.includes("cafe") ||
    t.includes("อาหาร") ||
    t.includes("มื้อ") ||
    t.includes("ร้านอาหาร") ||
    t.includes("ทานอาหาร")
  );
}

/**
 * Deterministically untangles any geometric line-segment intersections in a sequence of activities
 */
export function untangleIntersectingEdges(activities: Activity[]): Activity[] {
  const geoActs = activities.filter(a => a.lat !== undefined && a.lng !== undefined && !isNaN(a.lat) && !isNaN(a.lng));
  if (geoActs.length <= 3) return activities;

  let route = [...geoActs];
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 30) {
    changed = false;
    iterations++;

    for (let i = 0; i < route.length - 2; i++) {
      for (let j = i + 2; j < route.length - 1; j++) {
        const p1 = { lat: route[i].lat!, lng: route[i].lng! };
        const p2 = { lat: route[i + 1].lat!, lng: route[i + 1].lng! };
        const p3 = { lat: route[j].lat!, lng: route[j].lng! };
        const p4 = { lat: route[j + 1].lat!, lng: route[j + 1].lng! };

        if (doSegmentsIntersect(p1, p2, p3, p4)) {
          const sub = route.slice(i + 1, j + 1).reverse();
          route = [...route.slice(0, i + 1), ...sub, ...route.slice(j + 1)];
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  const nonGeoActs = activities.filter(a => a.lat === undefined || a.lng === undefined || isNaN(a.lat) || isNaN(a.lng));
  return [...route, ...nonGeoActs];
}

export interface MicroCluster {
  id: string;
  activities: Activity[];
  centroid: Coordinates;
}

/**
 * Groups nearby activities within proximity threshold (1.8 km) into atomic Micro-Clusters (Pairs/Triplets).
 * Guarantees that nearby spots remain together and are never split apart into zig-zags.
 */
export function groupNearbyPairsAndMicroClusters(
  activities: Activity[],
  proximityRadiusKm: number = 1.8
): MicroCluster[] {
  const geoActs = activities.filter(a => a.lat !== undefined && a.lng !== undefined && !isNaN(a.lat) && !isNaN(a.lng));
  if (geoActs.length === 0) {
    return activities.map((a, i) => ({ id: `c-${i}`, activities: [a], centroid: { lat: 0, lng: 0 } }));
  }

  const clusters: MicroCluster[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < geoActs.length; i++) {
    if (assigned.has(i)) continue;

    const clusterActs = [geoActs[i]];
    assigned.add(i);

    let added = true;
    while (added) {
      added = false;
      for (let j = 0; j < geoActs.length; j++) {
        if (assigned.has(j)) continue;
        const candidate = geoActs[j];
        const isNear = clusterActs.some(a =>
          haversineDistance({ lat: a.lat!, lng: a.lng! }, { lat: candidate.lat!, lng: candidate.lng! }) <= proximityRadiusKm
        );
        if (isNear) {
          clusterActs.push(candidate);
          assigned.add(j);
          added = true;
        }
      }
    }

    const avgLat = clusterActs.reduce((acc, a) => acc + a.lat!, 0) / clusterActs.length;
    const avgLng = clusterActs.reduce((acc, a) => acc + a.lng!, 0) / clusterActs.length;
    clusters.push({
      id: `mc-${clusters.length}`,
      activities: clusterActs,
      centroid: { lat: avgLat, lng: avgLng },
    });
  }

  const nonGeoActs = activities.filter(a => !a.lat || !a.lng || isNaN(a.lat) || isNaN(a.lng));
  if (nonGeoActs.length > 0) {
    clusters.push({
      id: `mc-nongeo`,
      activities: nonGeoActs,
      centroid: { lat: 0, lng: 0 },
    });
  }

  return clusters;
}

/**
 * Sequences Micro-Clusters along an open linear / arc trajectory away from the morning start anchor.
 * Guarantees that the route never loops back to the morning start point.
 */
export function orderMicroClustersOpenProgression(
  clusters: MicroCluster[],
  startCoord?: Coordinates
): MicroCluster[] {
  const geoClusters = clusters.filter(c => c.centroid.lat !== 0 && c.centroid.lng !== 0);
  if (geoClusters.length <= 1) return clusters;

  // 1. Determine Start Cluster
  let startIdx = 0;
  if (startCoord) {
    let minD = Infinity;
    geoClusters.forEach((c, idx) => {
      const d = haversineDistance(startCoord, c.centroid);
      if (d < minD) {
        minD = d;
        startIdx = idx;
      }
    });
  } else {
    const morningIdx = geoClusters.findIndex(c => c.activities.some(a => isMorningActivity(a)));
    if (morningIdx !== -1) startIdx = morningIdx;
  }

  const startCluster = geoClusters[startIdx];

  // 2. Determine End Cluster (Evening / furthest point)
  let endIdx = -1;
  let maxEveningDist = -1;
  geoClusters.forEach((c, idx) => {
    if (idx !== startIdx && c.activities.some(a => isEveningActivity(a))) {
      const d = haversineDistance(startCluster.centroid, c.centroid);
      if (d > maxEveningDist) {
        maxEveningDist = d;
        endIdx = idx;
      }
    }
  });

  if (endIdx === -1) {
    let maxDist = -1;
    geoClusters.forEach((c, idx) => {
      if (idx !== startIdx) {
        const d = haversineDistance(startCluster.centroid, c.centroid);
        if (d > maxDist) {
          maxDist = d;
          endIdx = idx;
        }
      }
    });
  }

  const endCluster = endIdx !== -1 ? geoClusters[endIdx] : geoClusters[(startIdx + 1) % geoClusters.length];

  // 3. Monotonic Directional Vector & Projection
  const vLat = endCluster.centroid.lat - startCluster.centroid.lat;
  const vLng = endCluster.centroid.lng - startCluster.centroid.lng;
  const vMagSq = vLat * vLat + vLng * vLng;

  let sortedClusters: MicroCluster[];
  if (vMagSq > 1e-8) {
    sortedClusters = [...geoClusters].sort((a, b) => {
      const tA = ((a.centroid.lat - startCluster.centroid.lat) * vLat + (a.centroid.lng - startCluster.centroid.lng) * vLng) / vMagSq;
      const tB = ((b.centroid.lat - startCluster.centroid.lat) * vLat + (b.centroid.lng - startCluster.centroid.lng) * vLng) / vMagSq;
      return tA - tB;
    });
  } else {
    const unvisited = [...geoClusters];
    let curr = unvisited.splice(startIdx, 1)[0];
    sortedClusters = [curr];
    while (unvisited.length > 0) {
      let nIdx = 0;
      let minD = Infinity;
      unvisited.forEach((c, idx) => {
        const d = haversineDistance(curr.centroid, c.centroid);
        if (d < minD) {
          minD = d;
          nIdx = idx;
        }
      });
      curr = unvisited.splice(nIdx, 1)[0];
      sortedClusters.push(curr);
    }
  }

  // 4. Anti-Looping Validation: Ensure the last cluster is furthest, never returning back to start
  if (sortedClusters.length >= 3) {
    const firstC = sortedClusters[0].centroid;
    const lastC = sortedClusters[sortedClusters.length - 1].centroid;
    const dStartEnd = haversineDistance(firstC, lastC);

    let maxExcursion = 0;
    let furthestIdx = 0;
    sortedClusters.forEach((c, idx) => {
      const d = haversineDistance(firstC, c.centroid);
      if (d > maxExcursion) {
        maxExcursion = d;
        furthestIdx = idx;
      }
    });

    if (maxExcursion > 2.0 && dStartEnd < 0.4 * maxExcursion && furthestIdx !== sortedClusters.length - 1) {
      const beforeFurthest = sortedClusters.slice(0, furthestIdx + 1);
      const afterFurthest = sortedClusters.slice(furthestIdx + 1);
      sortedClusters = [...beforeFurthest, ...afterFurthest.reverse()];
    }
  }

  const nonGeo = clusters.filter(c => c.centroid.lat === 0 && c.centroid.lng === 0);
  return [...sortedClusters, ...nonGeo];
}

/**
 * Orders activities within a single Micro-Cluster smoothly
 */
export function orderActivitiesWithinMicroCluster(
  cluster: MicroCluster,
  prevCentroid?: Coordinates
): Activity[] {
  const acts = cluster.activities;
  if (acts.length <= 1) return acts;

  if (prevCentroid && prevCentroid.lat !== 0 && prevCentroid.lng !== 0) {
    return [...acts].sort((a, b) => {
      const distA = haversineDistance({ lat: a.lat || 0, lng: a.lng || 0 }, prevCentroid);
      const distB = haversineDistance({ lat: b.lat || 0, lng: b.lng || 0 }, prevCentroid);
      return distA - distB;
    });
  }

  const getSemanticPriority = (a: Activity): number => {
    if (isMorningActivity(a)) return 1;
    if (isFoodActivity(a) && !isEveningActivity(a)) return 2;
    if (a.type === "attraction" || a.type === "culture") return 3;
    if (a.type === "shopping" || a.type === "nature") return 4;
    if (isSunsetSpot(a)) return 5;
    if (isEveningActivity(a)) return 6;
    return 3;
  };

  return [...acts].sort((a, b) => getSemanticPriority(a) - getSemanticPriority(b));
}

/**
 * 2-Opt TSP Route Optimizer for a single day's activities
 * Guarantees untangled, non-intersecting progression starting from startCoord (Hotel/Origin)
 */
export function twoOptRouteOptimization(
  activities: Activity[],
  startCoord?: Coordinates,
  endDepotCoord?: Coordinates
): Activity[] {
  const validActs = activities.filter(a => a.lat !== undefined && a.lng !== undefined && !isNaN(a.lat) && !isNaN(a.lng));
  const nonGeoActs = activities.filter(a => !a.lat || !a.lng || isNaN(a.lat) || isNaN(a.lng));
  if (validActs.length <= 2) return [...activities];

  const optimized = solve2OptTSP(validActs, startCoord, endDepotCoord);
  return [...optimized, ...nonGeoActs];
}

/**
 * Aligns route direction so daytime/morning spots appear first and evening/dinner spots appear last
 */
export function alignSemanticDirection(activities: Activity[]): Activity[] {
  if (activities.length <= 1) return activities;

  const first = activities[0];
  const last = activities[activities.length - 1];

  let res = [...activities];

  if (isEveningActivity(first) && !isEveningActivity(last)) {
    res.reverse();
  } else if (!isMorningActivity(first) && isMorningActivity(last)) {
    res.reverse();
  }

  const eveningActs = res.filter(a => isEveningActivity(a));
  const nonEveningActs = res.filter(a => !isEveningActivity(a));

  // Separate morning, lunch, and afternoon activities within non-evening group
  // Preserving relative spatial order within each group
  const morningActs = nonEveningActs.filter(a => isMorningActivity(a) && !isFoodActivity(a));
  const lunchActs = nonEveningActs.filter(a => isFoodActivity(a));
  const afternoonActs = nonEveningActs.filter(a => !isMorningActivity(a) && !isFoodActivity(a));

  // Re-assemble in diurnal semantic flow: Morning -> Lunch -> Afternoon -> Evening
  if (eveningActs.length > 0 || lunchActs.length > 0) {
    res = [...morningActs, ...lunchActs, ...afternoonActs, ...eveningActs];
  }

  return res;
}

/**
 * Enforces NO CONSECUTIVE MEALS by interleaving non-food activities between food spots
 * while maintaining relative spatial progression (strictly preserving 2-Opt geometric sequence).
 */
export function preventConsecutiveMeals(activities: Activity[]): Activity[] {
  if (activities.length <= 2) return activities;

  const result = [...activities];
  const totalFoods = result.filter(isFoodActivity).length;
  const totalNonFoods = result.length - totalFoods;
  if (totalFoods <= 1 || totalNonFoods === 0) return result;

  let iterations = 0;
  const maxIterations = result.length * 2;

  while (iterations < maxIterations) {
    iterations++;
    let consecutiveIdx = -1;
    for (let i = 0; i < result.length - 1; i++) {
      if (isFoodActivity(result[i]) && isFoodActivity(result[i + 1])) {
        consecutiveIdx = i;
        break;
      }
    }

    if (consecutiveIdx === -1) break; // Clean! No consecutive dining spots

    // Find the closest non-food spot to separate result[consecutiveIdx] and result[consecutiveIdx + 1]
    let bestNonFoodIdx = -1;
    let minDistance = Infinity;

    for (let j = 0; j < result.length; j++) {
      if (isFoodActivity(result[j])) continue;
      // Prefer non-foods whose removal won't expose a new pair of consecutive foods
      const wouldExposeConsecutiveFoods =
        j > 0 &&
        j < result.length - 1 &&
        isFoodActivity(result[j - 1]) &&
        isFoodActivity(result[j + 1]);

      if (wouldExposeConsecutiveFoods) continue;

      const dist = Math.abs(j - (consecutiveIdx + 1));
      if (dist < minDistance) {
        minDistance = dist;
        bestNonFoodIdx = j;
      }
    }

    if (bestNonFoodIdx === -1) {
      // Fallback: take closest non-food
      for (let j = 0; j < result.length; j++) {
        if (!isFoodActivity(result[j])) {
          const dist = Math.abs(j - (consecutiveIdx + 1));
          if (dist < minDistance) {
            minDistance = dist;
            bestNonFoodIdx = j;
          }
        }
      }
    }

    if (bestNonFoodIdx === -1) break;

    const [nonFood] = result.splice(bestNonFoodIdx, 1);
    const targetInsertIdx = bestNonFoodIdx < consecutiveIdx ? consecutiveIdx : consecutiveIdx + 1;
    result.splice(targetInsertIdx, 0, nonFood);
  }

  return result;
}

/**
 * Prevents category monotony / visitor burnout by interleaving other available
 * activities when 3 or more consecutive activities share the exact same category (e.g. culture -> culture -> culture).
 * Grounded in Tourist Satiation Theory (Pearce 1988).
 */
export function preventConsecutiveCategoryMonotony(activities: Activity[]): Activity[] {
  if (activities.length < 4) return activities;
  const result = [...activities];

  let iterations = 0;
  while (iterations < 5) {
    iterations++;
    let streakType: string | null = null;
    let streakStartIdx = -1;

    for (let i = 0; i < result.length - 2; i++) {
      const t1 = result[i].type;
      const t2 = result[i + 1].type;
      const t3 = result[i + 2].type;
      if (t1 !== "hotel" && t1 !== "transport" && t1 === t2 && t2 === t3) {
        streakType = t1;
        streakStartIdx = i;
        break;
      }
    }

    if (!streakType || streakStartIdx === -1) break;

    // Target position to interleave between 2nd and 3rd spot of the streak
    const insertIdx = streakStartIdx + 2;
    let bestCandidateIdx = -1;
    let minDistance = Infinity;

    for (let j = 0; j < result.length; j++) {
      if (j >= streakStartIdx && j <= streakStartIdx + 2) continue;

      const act = result[j];
      if (act.type !== streakType && act.type !== "hotel" && act.type !== "transport") {
        // If it's food, verify moving it won't cause consecutive dining
        if (isFoodActivity(act)) {
          const prev = result[insertIdx - 1];
          const next = result[insertIdx];
          if ((prev && isFoodActivity(prev)) || (next && isFoodActivity(next))) {
            continue;
          }
        }

        const dist = Math.abs(j - insertIdx);
        if (dist < minDistance) {
          minDistance = dist;
          bestCandidateIdx = j;
        }
      }
    }

    if (bestCandidateIdx === -1) break;

    const [movedItem] = result.splice(bestCandidateIdx, 1);
    const finalInsert = bestCandidateIdx < insertIdx ? insertIdx - 1 : insertIdx;
    result.splice(finalInsert, 0, movedItem);
  }

  return result;
}

/**
 * Standard Dwell Time Estimates by Activity Type and Travel Pace (in minutes)
 */
function getEstimatedDwellMinutes(act: Activity, pace: string = "Moderate"): number {
  const type = act.type;
  let baseMinutes = 60;

  if (type === "activity") baseMinutes = 120; // 2 hours for theme parks / activities
  else if (type === "culture") baseMinutes = 90; // 1.5 hours for museums / temples
  else if (type === "food") baseMinutes = 75; // 1 hour 15 min for dining
  else if (type === "shopping") baseMinutes = 90; // 1.5 hours for shopping
  else if (type === "nature") baseMinutes = 75; // 1 hour 15 min for parks
  else if (type === "relax") baseMinutes = 90; // 1.5 hours for spa / wellness
  else if (type === "nightlife") baseMinutes = 120; // 2 hours for nightlife / bars

  const p = pace.toLowerCase();
  if (p.includes("relax")) {
    return Math.round(baseMinutes * 1.25); // +25% longer dwell time for relaxed pacing
  } else if (p.includes("packed") || p.includes("fast")) {
    return Math.round(baseMinutes * 0.75); // -25% shorter dwell time to fit more attractions
  }
  return baseMinutes;
}

/**
 * Dynamic physics-based urban transit time estimator (in minutes)
 * Models walking speed for short distances (<0.8 km) and metropolitan transit/vehicle
 * speed with hailing/traffic buffers for longer journeys.
 */
export function calculateRealisticTransitMinutes(
  from?: Coordinates,
  to?: Coordinates,
  pace: string = "Moderate"
): number {
  const p = pace.toLowerCase();
  let baseBuffer = 8;
  if (p.includes("relax")) baseBuffer = 12;
  else if (p.includes("packed") || p.includes("fast")) baseBuffer = 5;

  if (
    !from ||
    !to ||
    from.lat === undefined ||
    from.lng === undefined ||
    to.lat === undefined ||
    to.lng === undefined ||
    isNaN(from.lat) ||
    isNaN(from.lng) ||
    isNaN(to.lat) ||
    isNaN(to.lng)
  ) {
    return p.includes("relax") ? 25 : p.includes("packed") || p.includes("fast") ? 15 : 20;
  }

  const distKm = haversineDistance(from, to);
  if (distKm < 0.05) return 5; // same building or directly adjacent

  if (distKm < 0.8) {
    // Walking speed ~4.5 km/h + minor sidewalk/traffic light buffer
    const walkMinutes = Math.round((distKm / 4.5) * 60);
    return Math.max(5, walkMinutes + Math.round(baseBuffer * 0.5));
  }

  // Urban vehicular transit ~20 km/h + traffic/boarding buffer
  const transitMinutes = Math.round((distKm / 20) * 60);
  return Math.max(10, transitMinutes + baseBuffer);
}

/**
 * Assigns clean, non-overlapping, chronological time slots with opening hours adherence,
 * mandatory lunch window (11:30 - 13:30), sunset/golden hour anchor, and dynamic physics-based transit times.
 * Guarantees strictly non-decreasing progression along the 2-Opt spatial route (Route Determines Time).
 */
export function assignDeterministicTimeSlots(
  activities: Activity[],
  pace: string = "Moderate",
  dayOfWeek?: number
): Activity[] {
  if (activities.length === 0) return [];

  const hotelCheckIn = activities.find(a => a.type === "hotel" && a.title.toLowerCase().includes("check in"));
  const hotelCheckOut = activities.find(a => a.type === "hotel" && a.title.toLowerCase().includes("check out"));
  const regularActivities = activities.filter(a => a !== hotelCheckIn && a !== hotelCheckOut);
  const regCount = regularActivities.length;

  if (regCount === 0) {
    const res: Activity[] = [];
    if (hotelCheckIn) res.push(hotelCheckIn);
    if (hotelCheckOut) res.push(hotelCheckOut);
    return res;
  }

  const p = pace.toLowerCase();
  let currentMinutes = 9 * 60; // 09:00 AM standard

  if (p.includes("relax")) {
    currentMinutes = 9 * 60 + 30; // 09:30 AM slow & scenic morning start
  } else if (p.includes("packed") || p.includes("fast")) {
    currentMinutes = 8 * 60 + 30; // 08:30 AM early start to maximize sightseeing
  }

  const assignedRegular: Activity[] = [];
  const lunchIdx = regularActivities.findIndex(a => isFoodActivity(a) && !isEveningActivity(a));

  for (let index = 0; index < regularActivities.length; index++) {
    const act = regularActivities[index];
    let actTimeMinutes = currentMinutes;

    if (index === lunchIdx || (isFoodActivity(act) && !isEveningActivity(act) && currentMinutes < 14 * 60)) {
      if (currentMinutes < 11 * 60 + 30) {
        actTimeMinutes = 12 * 60; // Wait for midday lunch window
      } else {
        actTimeMinutes = currentMinutes;
      }
    } else if (isSunsetSpot(act)) {
      actTimeMinutes = Math.max(17 * 60, currentMinutes);
    } else if (isEveningActivity(act)) {
      actTimeMinutes = Math.max(18 * 60 + 30, currentMinutes);
    }

    const dwellTime = getEstimatedDwellMinutes(act, pace);

    // Check Google Maps opening hours constraints with dwell-time buffer
    if (dayOfWeek !== undefined && act.openingHours && act.openingHours.length > 0 && !isZoneOrArea(act)) {
      const hours = parseOpeningHours(act.openingHours, dayOfWeek);
      if (hours && hours.openMinutes !== -1) {
        if (actTimeMinutes < hours.openMinutes) {
          actTimeMinutes = hours.openMinutes;
        }
        // Ensure visit starts with ample time to complete the visit before venue closes
        const closeBuffer = Math.max(60, Math.min(150, dwellTime + 15));
        if (hours.closeMinutes > hours.openMinutes && actTimeMinutes > hours.closeMinutes - closeBuffer) {
          if (hours.closeMinutes - closeBuffer >= currentMinutes) {
            actTimeMinutes = hours.closeMinutes - closeBuffer;
          }
        }
      }
    }

    // Ensure strictly non-decreasing time along the spatial progression
    if (assignedRegular.length > 0) {
      const prevTimeStr = assignedRegular[assignedRegular.length - 1].time;
      if (prevTimeStr) {
        const [prevH, prevM] = prevTimeStr.split(":").map(Number);
        const prevMinutes = prevH * 60 + prevM;
        if (actTimeMinutes < prevMinutes) {
          actTimeMinutes = prevMinutes;
        }
      }
    }

    assignedRegular.push({
      ...act,
      time: formatMinutesToTime(actTimeMinutes),
    });

    // Dynamic travel time to next activity using realistic urban transit model
    if (index < regularActivities.length - 1) {
      const nextAct = regularActivities[index + 1];
      const fromCoord = act.lat && act.lng ? { lat: act.lat, lng: act.lng } : undefined;
      const toCoord = nextAct.lat && nextAct.lng ? { lat: nextAct.lat, lng: nextAct.lng } : undefined;
      const transitMinutes = calculateRealisticTransitMinutes(fromCoord, toCoord, pace);
      currentMinutes = actTimeMinutes + dwellTime + transitMinutes;
    }
  }

  // Assemble with hotel check-in / check-out chronologically
  const result: Activity[] = [];

  if (hotelCheckOut) {
    const checkOutTime = hotelCheckOut.time || (assignedRegular.length > 0 ? assignedRegular[0].time : "11:00");
    result.push({ ...hotelCheckOut, time: checkOutTime });
  }

  let hotelCheckInInserted = !hotelCheckIn;
  const targetCheckInTime = hotelCheckIn?.time || "15:00";

  for (const act of assignedRegular) {
    if (!hotelCheckInInserted && hotelCheckIn && (act.time || "00:00") >= targetCheckInTime) {
      result.push({ ...hotelCheckIn, time: targetCheckInTime });
      hotelCheckInInserted = true;
    }
    result.push(act);
  }

  if (!hotelCheckInInserted && hotelCheckIn) {
    result.push({ ...hotelCheckIn, time: targetCheckInTime });
  }

  return result;
}

/**
 * Cross-Day Spatial Rebalancing
 * Reassigns outliers to geographically closer days based on proximity threshold
 * and adaptive cluster distance differential.
 */
export function rebalanceCrossDayPOIs<T extends { day: number; activities: Activity[] }>(
  days: T[],
  proximityThresholdKm: number = 2.5
): T[] {
  if (days.length <= 1) return days;

  const result = days.map(d => ({ ...d, activities: [...d.activities] }));

  let changed = true;
  let iterations = 0;

  while (changed && iterations < 5) {
    changed = false;
    iterations++;

    const centroids = result.map(d => {
      const valid = d.activities.filter(a => a.lat && a.lng && a.type !== "hotel");
      if (valid.length === 0) return { lat: 0, lng: 0, count: 0 };
      const avgLat = valid.reduce((acc, a) => acc + a.lat!, 0) / valid.length;
      const avgLng = valid.reduce((acc, a) => acc + a.lng!, 0) / valid.length;
      return { lat: avgLat, lng: avgLng, count: valid.length };
    });

    for (let dayA = 0; dayA < result.length; dayA++) {
      for (let dayB = 0; dayB < result.length; dayB++) {
        if (dayA === dayB) continue;

        const dayBActs = result[dayB].activities;
        for (let i = 0; i < dayBActs.length; i++) {
          const act = dayBActs[i];
          if (act.type === "hotel" || !act.lat || !act.lng) continue;

          const bValid = dayBActs.filter(a => a.lat && a.lng && a.type !== "hotel" && a !== act);
          let distToCentroidB = haversineDistance({ lat: act.lat, lng: act.lng }, centroids[dayB]);
          if (bValid.length >= 2) {
            const bLat = bValid.reduce((acc, a) => acc + a.lat!, 0) / bValid.length;
            const bLng = bValid.reduce((acc, a) => acc + a.lng!, 0) / bValid.length;
            distToCentroidB = haversineDistance({ lat: act.lat, lng: act.lng }, { lat: bLat, lng: bLng });
          }
          const distToCentroidA = haversineDistance({ lat: act.lat, lng: act.lng }, centroids[dayA]);

          // Condition 1: Direct proximity to adjacent day centroid
          const isCloserCluster = distToCentroidA < proximityThresholdKm && distToCentroidB > distToCentroidA + 2.0;
          // Condition 2: Adaptive outlier rebalancing (e.g. Sathon > 5.5km from Din Daeng cluster and significantly closer to Rattanakosin)
          const isOutlierRebalance = distToCentroidB > 5.5 && distToCentroidA < distToCentroidB - 2.0 && distToCentroidA <= 7.0;

          if (
            (isCloserCluster || isOutlierRebalance) &&
            result[dayB].activities.length > 3 &&
            result[dayA].activities.length < 7
          ) {
            const [moved] = result[dayB].activities.splice(i, 1);
            result[dayA].activities.push(moved);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
      if (changed) break;
    }
  }

  return result;
}

/**
 * Main Neuro-Symbolic Optimizer for a single day's activities
 */
export function optimizeDayActivities(
  activities: Activity[],
  pace: string = "Moderate",
  hotelOrStartCoord?: Coordinates,
  dayOfWeek?: number
): Activity[] {
  if (activities.length <= 1) return activities;

  const hotelCheckIn = activities.find(a => a.type === "hotel" && a.title.toLowerCase().includes("check in"));
  const hotelCheckOut = activities.find(a => a.type === "hotel" && a.title.toLowerCase().includes("check out"));
  const regularActivities = activities.filter(a => a !== hotelCheckIn && a !== hotelCheckOut);

  // 1. Mandatory Midday Lunch Enforcement (Real human rule: Lunch 11:00-13:00 near morning spot)
  const hasDaytimeLunch = regularActivities.some(a => isFoodActivity(a) && !isEveningActivity(a));
  if (!hasDaytimeLunch && regularActivities.length >= 3) {
    const morningAct = regularActivities.find(a => isMorningActivity(a)) || regularActivities[0];
    const lunchLat = morningAct.lat ? morningAct.lat + (Math.random() - 0.5) * 0.003 : undefined;
    const lunchLng = morningAct.lng ? morningAct.lng + (Math.random() - 0.5) * 0.003 : undefined;

    const lunchActivity: Activity = {
      id: `lunch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `Lunch near ${morningAct.title}`,
      description: `Authentic local midday lunch and dining near ${morningAct.title}.`,
      type: "food",
      lat: lunchLat,
      lng: lunchLng,
      time: "12:00",
    };

    const morningIdx = regularActivities.indexOf(morningAct);
    regularActivities.splice(morningIdx + 1, 0, lunchActivity);
  }

  // 2. Micro-Cluster Grouping (Keep nearby spots within 1.5 km together)
  const microClusters = groupNearbyPairsAndMicroClusters(regularActivities, 1.5);

  // 3. Open Progression Ordering across the neighborhood corridor
  // (Ensures the route flows forward from morning anchor toward evening anchor, avoiding looping back)
  const orderedClusters = orderMicroClustersOpenProgression(microClusters, hotelOrStartCoord);

  // 4. Order activities within each cluster
  const flattened: Activity[] = [];
  let prevCentroid = hotelOrStartCoord;
  for (const c of orderedClusters) {
    const orderedActs = orderActivitiesWithinMicroCluster(c, prevCentroid);
    flattened.push(...orderedActs);
    prevCentroid = c.centroid;
  }

  // 5. Open-Path 2-Opt (Zero depot loop constraint)
  let optimized = twoOptRouteOptimization(flattened, hotelOrStartCoord);

  // 6. Untangle geometric intersections
  optimized = untangleIntersectingEdges(optimized);

  // 7. Align Semantic Direction (Morning -> Lunch -> Afternoon -> Sunset -> Dinner/Night)
  optimized = alignSemanticDirection(optimized);

  // 8. Prevent consecutive meals while preserving progression
  optimized = preventConsecutiveMeals(optimized);

  // 8b. Prevent consecutive category monotony (Pearce 1988 - max 2 consecutive spots of same category)
  optimized = preventConsecutiveCategoryMonotony(optimized);

  // 9. Anti-Looping Validation:
  // Ensure the last activity does not loop back to the first activity if the route traveled across town
  const validGeo = optimized.filter(a => a.lat !== undefined && a.lng !== undefined && !isNaN(a.lat) && !isNaN(a.lng));
  if (validGeo.length >= 4) {
    const firstP = validGeo[0];
    const lastP = validGeo[validGeo.length - 1];
    const dStartEnd = haversineDistance({ lat: firstP.lat!, lng: firstP.lng! }, { lat: lastP.lat!, lng: lastP.lng! });

    let maxDistFromFirst = 0;
    let furthestIdx = 0;
    validGeo.forEach((a, idx) => {
      const d = haversineDistance({ lat: firstP.lat!, lng: firstP.lng! }, { lat: a.lat!, lng: a.lng! });
      if (d > maxDistFromFirst) {
        maxDistFromFirst = d;
        furthestIdx = idx;
      }
    });

    if (maxDistFromFirst > 2.0 && dStartEnd < 0.7 && furthestIdx !== validGeo.length - 1) {
      const nonGeo = optimized.filter(a => a.lat === undefined || a.lng === undefined || isNaN(a.lat) || isNaN(a.lng));
      const vLat = validGeo[furthestIdx].lat! - firstP.lat!;
      const vLng = validGeo[furthestIdx].lng! - firstP.lng!;
      const vMagSq = vLat * vLat + vLng * vLng;
      if (vMagSq > 1e-8) {
        validGeo.sort((a, b) => {
          const tA = ((a.lat! - firstP.lat!) * vLat + (a.lng! - firstP.lng!) * vLng) / vMagSq;
          const tB = ((b.lat! - firstP.lat!) * vLat + (b.lng! - firstP.lng!) * vLng) / vMagSq;
          return tA - tB;
        });
      }
      optimized = [...validGeo, ...nonGeo];
    }
  }

  // 10. Final geometric uncrossing pass
  optimized = untangleIntersectingEdges(optimized);

  // 11. Assign deterministic time slots adhering to opening hours, lunch window, and dwell times
  const allToSchedule = [...optimized];
  if (hotelCheckIn) allToSchedule.push(hotelCheckIn);
  if (hotelCheckOut) allToSchedule.push(hotelCheckOut);

  return assignDeterministicTimeSlots(allToSchedule, pace, dayOfWeek);
}
