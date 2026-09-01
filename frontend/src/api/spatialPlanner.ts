import { Coordinates, getCoordinates } from "./geocode";
import { validateApiKey } from "@/utils/apiUtils";
import { type Activity } from "@/components/TravelItinerary";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

  // K-Means++ initialization for initial centroids
  const centroids: Coordinates[] = [];
  centroids.push({ lat: pois[0].lat, lng: pois[0].lng });

  while (centroids.length < k) {
    let maxDist = -1;
    let bestPoiIndex = 0;

    for (let i = 0; i < pois.length; i++) {
      let minDistToCentroids = Infinity;
      for (const c of centroids) {
        const d = haversineDistance(pois[i], c);
        if (d < minDistToCentroids) minDistToCentroids = d;
      }
      if (minDistToCentroids > maxDist) {
        maxDist = minDistToCentroids;
        bestPoiIndex = i;
      }
    }
    centroids.push({ lat: pois[bestPoiIndex].lat, lng: pois[bestPoiIndex].lng });
  }

  // Iterative assignment (max 20 iterations)
  let assignments: number[] = new Array(pois.length).fill(0);
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;

    // Assign POIs to nearest centroid
    for (let i = 0; i < pois.length; i++) {
      let minD = Infinity;
      let nearestCluster = 0;
      for (let c = 0; c < k; c++) {
        const d = haversineDistance(pois[i], centroids[c]);
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
    for (let c = 0; c < k; c++) {
      const clusterPois = pois.filter((_, idx) => assignments[idx] === c);
      if (clusterPois.length > 0) {
        const avgLat = clusterPois.reduce((acc, p) => acc + p.lat, 0) / clusterPois.length;
        const avgLng = clusterPois.reduce((acc, p) => acc + p.lng, 0) / clusterPois.length;
        centroids[c] = { lat: avgLat, lng: avgLng };
      }
    }
  }

  // Group into DayCluster objects
  const clusters: DayCluster[] = Array.from({ length: k }, (_, i) => ({
    day: i + 1,
    pois: [],
  }));

  assignments.forEach((clusterIdx, poiIdx) => {
    clusters[clusterIdx].pois.push(pois[poiIdx]);
  });

  // Smart Balance check: Reassign POIs to empty clusters based on minimum Haversine distance
  for (let i = 0; i < k; i++) {
    if (clusters[i].pois.length === 0) {
      let maxClusterIdx = 0;
      for (let j = 0; j < k; j++) {
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
 * Greedy TSP (Nearest Neighbor Algorithm)
 * Sequences POIs in a single cluster so the travel route flows logically from morning to evening.
 */
export function solveGreedyTSP(
  pois: POICandidate[],
  startCoord?: Coordinates
): POICandidate[] {
  if (pois.length <= 1) return [...pois];

  const unvisited = [...pois];
  const ordered: POICandidate[] = [];

  // Determine starting point (either closest to startCoord or the first POI)
  let current: POICandidate;
  if (startCoord) {
    let closestIndex = 0;
    let minD = Infinity;
    unvisited.forEach((p, idx) => {
      const d = haversineDistance(startCoord, p);
      if (d < minD) {
        minD = d;
        closestIndex = idx;
      }
    });
    current = unvisited.splice(closestIndex, 1)[0];
  } else {
    current = unvisited.shift()!;
  }

  ordered.push(current);

  // Repeatedly visit closest unvisited neighbor
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = haversineDistance(current, unvisited[i]);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    current = unvisited.splice(nearestIndex, 1)[0];
    ordered.push(current);
  }

  return ordered;
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
  validateApiKey(API_KEY, "Google Maps");

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

  // 2. Fetch Multi-Category Nearby Places via Google Places JS SDK
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

  if (typeof google !== "undefined" && google.maps && google.maps.places) {
    const service = new google.maps.places.PlacesService(document.createElement("div"));

    for (const placeType of uniqueTypes) {
      await new Promise<void>((resolve) => {
        service.nearbySearch(
          {
            location: new google.maps.LatLng(centerCoords.lat, centerCoords.lng),
            radius: 15000, // 15 km radius
            type: placeType,
          },
          (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              results.slice(0, 12).forEach((p) => {
                if (p.name && p.geometry?.location) {
                  addPoi({
                    name: p.name,
                    lat: p.geometry.location.lat(),
                    lng: p.geometry.location.lng(),
                    rating: p.rating,
                    userRatingsTotal: p.user_ratings_total,
                    photo_url: p.photos?.[0]?.getUrl({ maxWidth: 800 }) ?? null,
                    place_id: p.place_id,
                    type: placeType,
                  });
                }
              });
            }
            resolve();
          }
        );
      });
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

export function isZoneOrArea(activity: ActivityItem): boolean {
  if (activity.openingHours && activity.openingHours.length > 0) {
    const hasClosedOrSpecificHours = activity.openingHours.some(h => !h.toLowerCase().includes("open 24 hours"));
    if (hasClosedOrSpecificHours) return false;
  }
  const title = (activity.title || "").toLowerCase();
  const type = (activity.type || "").toLowerCase();

  if (title.includes("street") || title.includes("road") || title.includes("district") || 
      title.includes("square") || title.includes("area") || title.includes("bazaar") ||
      title.includes("quarter") || title.includes("old town") || title.includes("ถนน") ||
      title.includes("ย่าน") || title.includes("จัตุรัส")) {
    return true;
  }

  if (type === "transport" || type === "hotel") {
    return true;
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
  type: string;
  lat?: number;
  lng?: number;
  openingHours?: string[] | null;
}

export interface DayPlanItem {
  day: number;
  activities: ActivityItem[];
}

export interface ItineraryCoherence {
  totalScore: number;
  spatialScore: number;
  diversityScore: number;
  paceScore: number;
  schedulingScore: number;
  dailyDistanceKm: number[];
  warnings: string[];
}

/**
 * Calculates Coherence Score based on strict spatial, time, opening hours, lunch, anti-consecutive meal,
 * and long commute limitation constraints.
 */
export function calculateCoherenceScore(
  itinerary: DayPlanItem[],
  pace: string = "Moderate",
  tripStartDate?: Date
): ItineraryCoherence {
  let totalDist = 0;
  let totalActivities = 0;
  const dailyDistanceKm: number[] = [];
  const warnings: string[] = [];
  let schedulingPenalty = 0;
  let spatialPenalty = 0;

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

    // Circular Loop Check
    if (validGeoActs.length >= 3) {
      const firstAct = validGeoActs[0];
      const lastAct = validGeoActs[validGeoActs.length - 1];
      const startEndDist = haversineDistance(
        { lat: firstAct.lat!, lng: firstAct.lng! },
        { lat: lastAct.lat!, lng: lastAct.lng! }
      );

      let maxExcursion = 0;
      validGeoActs.forEach(a => {
        const d = haversineDistance({ lat: firstAct.lat!, lng: firstAct.lng! }, { lat: a.lat!, lng: a.lng! });
        if (d > maxExcursion) maxExcursion = d;
      });

      if (maxExcursion > 3.0 && startEndDist < 0.35 * maxExcursion) {
        warnings.push(`Day ${day.day}: Travel route forms a closed circular loop. Progress along a linear or open arc path instead.`);
        spatialPenalty += 8;
      }
    }

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

      // Opening Hours Check
      if (actTimeMin !== null && !isZoneOrArea(act)) {
        const hours = parseOpeningHours(act.openingHours, dayOfWeek);
        if (hours) {
          if (hours.openMinutes === -1) {
            warnings.push(`Day ${day.day}: "${act.title}" is closed on this day.`);
            schedulingPenalty += 15;
          } else if (actTimeMin < hours.openMinutes || actTimeMin > hours.closeMinutes - 20) {
            const openFormatted = `${Math.floor(hours.openMinutes / 60)}:${(hours.openMinutes % 60).toString().padStart(2, '0')}`;
            const closeFormatted = `${Math.floor(hours.closeMinutes / 60)}:${(hours.closeMinutes % 60).toString().padStart(2, '0')}`;
            warnings.push(`Day ${day.day}: "${act.title}" at ${act.time} is outside operating hours (${openFormatted} - ${closeFormatted}).`);
            schedulingPenalty += 10;
          }
        }
      }

      // Meal Time Slot Detection
      if (act.type === "food" && actTimeMin !== null) {
        if (actTimeMin >= 11 * 60 + 30 && actTimeMin <= 14 * 60) hasLunch = true;
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

        // Distance & Long Commute Check
        if (act.lat && act.lng && nextAct.lat && nextAct.lng) {
          const d = haversineDistance(
            { lat: act.lat, lng: act.lng },
            { lat: nextAct.lat, lng: nextAct.lng }
          );
          dayDist += d;
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
      warnings.push(`Day ${day.day}: Missing dedicated lunch spot between 11:30-14:00.`);
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

  const totalScore = Math.round(
    (spatialScore * 0.3) +
    (diversityScore * 0.25) +
    (paceScore * 0.25) +
    (schedulingScore * 0.2)
  );

  return {
    totalScore,
    spatialScore: Math.round(spatialScore),
    diversityScore: Math.round(diversityScore),
    paceScore: Math.round(paceScore),
    schedulingScore: Math.round(schedulingScore),
    dailyDistanceKm: dailyDistanceKm.map(d => Math.round(d * 10) / 10),
    warnings
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
 * 2D Orientation (Counter-Clockwise Test) for line segment intersection
 */
function ccw(p1: Coordinates, p2: Coordinates, p3: Coordinates): number {
  return (p2.lng - p1.lng) * (p3.lat - p1.lat) - (p2.lat - p1.lat) * (p3.lng - p1.lng);
}

/**
 * Checks if line segment (p1, p2) geometrically intersects with line segment (p3, p4)
 */
export function doSegmentsIntersect(
  p1: Coordinates,
  p2: Coordinates,
  p3: Coordinates,
  p4: Coordinates
): boolean {
  const cp1 = ccw(p3, p4, p1);
  const cp2 = ccw(p3, p4, p2);
  const cp3 = ccw(p1, p2, p3);
  const cp4 = ccw(p1, p2, p4);

  return (cp1 * cp2 < 0) && (cp3 * cp4 < 0);
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
 * 2-Opt TSP Algorithm with Pair-Preserving Micro-Clustering & Anti-Looping Open Progression
 */
export function twoOptRouteOptimization(
  activities: Activity[],
  startCoord?: Coordinates
): Activity[] {
  const validActs = activities.filter(a => a.lat !== undefined && a.lng !== undefined && !isNaN(a.lat) && !isNaN(a.lng));
  if (validActs.length <= 2) return [...activities];

  // 1. Group nearby places into Micro-Clusters (Pairs/Triplets) within 1.8 km
  const clusters = groupNearbyPairsAndMicroClusters(validActs, 1.8);

  // 2. Order Micro-Clusters along an open progression vector (Anti-Looping)
  const orderedClusters = orderMicroClustersOpenProgression(clusters, startCoord);

  // 3. Order activities inside each cluster and flatten
  const flattened: Activity[] = [];
  for (let i = 0; i < orderedClusters.length; i++) {
    const prevC = i > 0 ? orderedClusters[i - 1].centroid : startCoord;
    const orderedActs = orderActivitiesWithinMicroCluster(orderedClusters[i], prevC);
    flattened.push(...orderedActs);
  }

  // 4. Fine-grained 2-Opt Edge Swapping on Open Path (preserving start anchor at index 0)
  const calculateRouteDistance = (r: Activity[]): number => {
    let d = 0;
    for (let k = 0; k < r.length - 1; k++) {
      d += haversineDistance({ lat: r[k].lat!, lng: r[k].lng! }, { lat: r[k + 1].lat!, lng: r[k + 1].lng! });
    }
    return d;
  };

  let route = flattened;
  let improved = true;
  let iterations = 0;
  const maxIterations = 30;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    const bestDist = calculateRouteDistance(route);

    // Keep start anchor (index 0) fixed to morning starting location
    for (let i = 1; i < route.length - 2; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const candidate = [
          ...route.slice(0, i),
          ...route.slice(i, j + 1).reverse(),
          ...route.slice(j + 1),
        ];

        // Reject if candidate causes an anti-loop violation
        const pFirst = { lat: candidate[0].lat!, lng: candidate[0].lng! };
        const pLast = { lat: candidate[candidate.length - 1].lat!, lng: candidate[candidate.length - 1].lng! };
        const dCandidateStartEnd = haversineDistance(pFirst, pLast);

        let maxExcursion = 0;
        candidate.forEach(act => {
          const d = haversineDistance(pFirst, { lat: act.lat!, lng: act.lng! });
          if (d > maxExcursion) maxExcursion = d;
        });

        if (maxExcursion > 2.0 && dCandidateStartEnd < 0.35 * maxExcursion) {
          continue;
        }

        const candidateDist = calculateRouteDistance(candidate);
        if (candidateDist < bestDist - 0.0005) {
          route = candidate;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  const nonGeoActs = activities.filter(a => !a.lat || !a.lng || isNaN(a.lat) || isNaN(a.lng));
  return [...route, ...nonGeoActs];
}

/**
 * Aligns route direction so daytime/morning spots appear first and evening/dinner spots appear last
 */
export function alignSemanticDirection(activities: Activity[]): Activity[] {
  if (activities.length <= 1) return activities;

  const first = activities[0];
  const last = activities[activities.length - 1];

  let shouldReverse = false;

  if (isEveningActivity(first) && !isEveningActivity(last)) {
    shouldReverse = true;
  } else if (!isMorningActivity(first) && isMorningActivity(last)) {
    shouldReverse = true;
  }

  if (shouldReverse) {
    return [...activities].reverse();
  }

  return activities;
}

/**
 * Enforces NO CONSECUTIVE MEALS by interleaving non-food activities between food spots
 * while maintaining relative spatial progression.
 */
export function preventConsecutiveMeals(activities: Activity[]): Activity[] {
  if (activities.length <= 2) return activities;

  const foods: Activity[] = [];
  const nonFoods: Activity[] = [];

  activities.forEach(a => {
    if (isFoodActivity(a)) foods.push(a);
    else nonFoods.push(a);
  });

  if (foods.length <= 1 || nonFoods.length === 0) return [...activities];

  const result: Activity[] = [];
  let f = 0;
  let n = 0;

  // Decide if route should start with non-food (sightseeing) or food
  const startWithFood = foods.length > nonFoods.length;
  let nextShouldBeFood = startWithFood;

  while (f < foods.length || n < nonFoods.length) {
    if (nextShouldBeFood && f < foods.length) {
      result.push(foods[f++]);
      nextShouldBeFood = false;
    } else if (n < nonFoods.length) {
      result.push(nonFoods[n++]);
      nextShouldBeFood = f < foods.length;
    } else if (f < foods.length) {
      result.push(foods[f++]);
      nextShouldBeFood = false;
    }
  }

  return result;
}

/**
 * Standard Dwell Time Estimates by Activity Type (in minutes)
 */
function getEstimatedDwellMinutes(act: Activity): number {
  const type = act.type;
  if (type === "activity") return 120; // 2 hours for activities / theme parks
  if (type === "culture") return 90;   // 1.5 hours for museums / temples
  if (type === "food") return 75;      // 1 hour 15 min for meals
  if (type === "shopping") return 90;  // 1.5 hours for shopping
  if (type === "nature") return 75;    // 1 hour 15 min for parks
  if (type === "relax") return 90;     // 1.5 hours for spa
  if (type === "nightlife") return 120;// 2 hours for nightlife / bars
  return 60; // 1 hour default
}

/**
 * Assigns clean, non-overlapping, chronological time slots with opening hours adherence,
 * mandatory lunch window (11:30 - 13:30), sunset/golden hour anchor, and realistic dwell times.
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
    const res = [];
    if (hotelCheckIn) res.push(hotelCheckIn);
    if (hotelCheckOut) res.push(hotelCheckOut);
    return res;
  }

  let currentMinutes = 9 * 60; // Start at 09:00 AM by default
  const assignedRegular: Activity[] = [];

  let lunchIdx = regularActivities.findIndex(a => isFoodActivity(a) && !isEveningActivity(a));
  if (lunchIdx === -1 && regCount >= 3) {
    lunchIdx = Math.min(2, Math.floor(regCount / 2));
  }

  regularActivities.forEach((act, index) => {
    let actTimeMinutes: number;

    if (index === lunchIdx || (isFoodActivity(act) && !isEveningActivity(act) && currentMinutes < 14 * 60)) {
      actTimeMinutes = Math.max(11 * 60 + 30, Math.min(13 * 60, currentMinutes));
      if (actTimeMinutes < 11 * 60 + 30) actTimeMinutes = 12 * 60;
    } else if (isSunsetSpot(act)) {
      actTimeMinutes = Math.max(17 * 60, currentMinutes);
    } else if (isEveningActivity(act)) {
      actTimeMinutes = Math.max(18 * 60 + 30, currentMinutes);
    } else {
      actTimeMinutes = currentMinutes;
    }

    // Check Google Maps opening hours constraints
    if (dayOfWeek !== undefined && act.openingHours && act.openingHours.length > 0 && !isZoneOrArea(act)) {
      const hours = parseOpeningHours(act.openingHours, dayOfWeek);
      if (hours && hours.openMinutes !== -1) {
        if (actTimeMinutes < hours.openMinutes) {
          actTimeMinutes = hours.openMinutes;
        } else if (actTimeMinutes > hours.closeMinutes - 45 && hours.closeMinutes > hours.openMinutes) {
          actTimeMinutes = Math.max(hours.openMinutes, hours.closeMinutes - 60);
        }
      }
    }

    const dwellTime = getEstimatedDwellMinutes(act);
    const transitBuffer = 20;
    currentMinutes = actTimeMinutes + dwellTime + transitBuffer;

    assignedRegular.push({
      ...act,
      time: formatMinutesToTime(actTimeMinutes),
    });
  });

  const all = [...assignedRegular];
  if (hotelCheckIn) all.push({ ...hotelCheckIn, time: hotelCheckIn.time || "15:00" });
  if (hotelCheckOut) all.push({ ...hotelCheckOut, time: hotelCheckOut.time || "11:00" });

  return all.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
}

/**
 * Cross-Day Spatial Rebalancing
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

          const distToCentroidB = haversineDistance({ lat: act.lat, lng: act.lng }, centroids[dayB]);
          const distToCentroidA = haversineDistance({ lat: act.lat, lng: act.lng }, centroids[dayA]);

          if (
            distToCentroidA < proximityThresholdKm &&
            distToCentroidB > distToCentroidA + 2.5 &&
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

  // 1. Run Monotonic Projection & Open-Path 2-Opt Route Optimization
  let optimized = twoOptRouteOptimization(regularActivities, hotelOrStartCoord);

  // 2. Untangle any geometric line-segment intersections
  optimized = untangleIntersectingEdges(optimized);

  // 3. Align Semantic Direction
  optimized = alignSemanticDirection(optimized);

  // 4. Prevent consecutive meals
  optimized = preventConsecutiveMeals(optimized);

  // 5. Final geometric uncrossing pass
  optimized = untangleIntersectingEdges(optimized);

  // 6. Pass all activities to assign clean chronological time slots & auto-sort
  const allToSchedule = [...optimized];
  if (hotelCheckIn) allToSchedule.push(hotelCheckIn);
  if (hotelCheckOut) allToSchedule.push(hotelCheckOut);

  return assignDeterministicTimeSlots(allToSchedule, pace, dayOfWeek);
}
