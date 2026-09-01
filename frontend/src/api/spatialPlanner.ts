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
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lng - a.lng) * Math.PI) / 180 *
      Math.sin(dLng / 2) ** 2;
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

  // Greedily chain remaining clusters
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
 * Score = w1*Rating + w2*Popularity + w3*PreferenceMatch + w4*DistancePenalty + StochasticBonus
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

    // Controlled stochastic variation for diversity (±10%)
    const stochasticBonus = Math.random() * 0.1;

    // MCDM weights
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

export function parseOpeningHours(
  weekdayText: string[] | null | undefined,
  dayOfWeek: number // 0=Sunday, 1=Monday, ..., 6=Saturday
): { openMinutes: number; closeMinutes: number } | null {
  if (!weekdayText || !Array.isArray(weekdayText) || weekdayText.length === 0) return null;

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetDayName = dayNames[dayOfWeek];

  const dayEntry = weekdayText.find(line => line.toLowerCase().startsWith(targetDayName.toLowerCase()));
  if (!dayEntry) return null;

  if (dayEntry.toLowerCase().includes("open 24 hours")) {
    return { openMinutes: 0, closeMinutes: 24 * 60 };
  }
  if (dayEntry.toLowerCase().includes("closed")) {
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
  if (activity.openingHours && activity.openingHours.length > 0) return false;
  const title = activity.title.toLowerCase();
  const type = activity.type.toLowerCase();

  if (title.includes("street") || title.includes("road") || title.includes("district") || 
      title.includes("square") || title.includes("area") || title.includes("bazaar") ||
      title.includes("market") || title.includes("quarter") || title.includes("old town")) {
    return true;
  }

  if (type === "nightlife" || type === "food" || type === "shopping" || type === "transport" || type === "hotel") {
    return true;
  }

  return false;
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

  const visitedTitles = new Set<string>();

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

    for (let i = 0; i < activities.length; i++) {
      const act = activities[i];
      const actTimeMin = parseTimeToMinutes(act.time);

      // Rule 6: Duplicate Places Check (excluding hotel)
      if (act.type !== "hotel") {
        const cleanTitle = act.title.trim().toLowerCase();
        if (visitedTitles.has(cleanTitle)) {
          warnings.push(`Day ${day.day}: "${act.title}" is visited multiple times in the trip.`);
          schedulingPenalty += 10;
        } else {
          visitedTitles.add(cleanTitle);
        }
      }

      // Rule 2: Opening Hours Check (excluding zones/areas)
      if (actTimeMin !== null && !isZoneOrArea(act)) {
        const hours = parseOpeningHours(act.openingHours, dayOfWeek);
        if (hours) {
          if (hours.openMinutes === -1) {
            warnings.push(`Day ${day.day}: "${act.title}" may be closed on this day.`);
            schedulingPenalty += 15;
          } else if (actTimeMin < hours.openMinutes || actTimeMin > hours.closeMinutes) {
            const openFormatted = `${Math.floor(hours.openMinutes / 60)}:${(hours.openMinutes % 60).toString().padStart(2, '0')}`;
            const closeFormatted = `${Math.floor(hours.closeMinutes / 60)}:${(hours.closeMinutes % 60).toString().padStart(2, '0')}`;
            warnings.push(`Day ${day.day}: "${act.title}" at ${act.time} is outside operating hours (${openFormatted} - ${closeFormatted}).`);
            schedulingPenalty += 10;
          }
        }
      }

      // Rule 3: Meal Time Slot Detection
      if (act.type === "food" && actTimeMin !== null) {
        if (actTimeMin >= 11 * 60 && actTimeMin <= 14 * 60 + 30) hasLunch = true;
        if (actTimeMin >= 17 * 60 && actTimeMin <= 21 * 60 + 30) hasDinner = true;
      }

      // Rule 4: Daily Flow Pattern
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

      // Rule 7: Daily Operating Window
      if (actTimeMin !== null && act.type !== "hotel") {
        if (actTimeMin < 7 * 60) {
          warnings.push(`Day ${day.day}: "${act.title}" is scheduled very early (${act.time}).`);
          schedulingPenalty += 5;
        } else if (actTimeMin > 23 * 60) {
          warnings.push(`Day ${day.day}: "${act.title}" is scheduled very late (${act.time}).`);
          schedulingPenalty += 5;
        }
      }

      // Consecutive Activity Checks (i and i+1)
      if (i < activities.length - 1) {
        const nextAct = activities[i + 1];
        const nextTimeMin = parseTimeToMinutes(nextAct.time);

        // Distance & Backtracking
        if (act.lat && act.lng && nextAct.lat && nextAct.lng) {
          const d = haversineDistance(
            { lat: act.lat, lng: act.lng },
            { lat: nextAct.lat, lng: nextAct.lng }
          );
          dayDist += d;
          if (d > 40) {
            warnings.push(`Day ${day.day}: Large travel distance (${d.toFixed(1)} km) between "${act.title}" and "${nextAct.title}".`);
          }

          // Rule 1: Anti-Backtracking Check (3 points: i, i+1, i+2)
          if (i < activities.length - 2) {
            const next2Act = activities[i + 2];
            if (next2Act.lat && next2Act.lng) {
              const d_i_i2 = haversineDistance(
                { lat: act.lat, lng: act.lng },
                { lat: next2Act.lat, lng: next2Act.lng }
              );
              if (d_i_i2 < d * 0.4 && d > 5) {
                warnings.push(`Day ${day.day}: Route backtracks near "${act.title}" after visiting "${nextAct.title}".`);
                schedulingPenalty += 8;
              }
            }
          }
        }

        // Rule 5 & 8: Buffer Time & Minimum Dwell Time
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

    // Meal Warnings for the day
    if (!hasLunch && activities.length >= 3) {
      warnings.push(`Day ${day.day}: No dedicated lunch spot between 11:00-14:30.`);
      schedulingPenalty += 5;
    }
    if (!hasDinner && activities.length >= 3) {
      warnings.push(`Day ${day.day}: No dedicated dinner spot between 17:00-21:30.`);
      schedulingPenalty += 5;
    }

    dailyDistanceKm.push(dayDist);
    totalDist += dayDist;
  });

  const avgDailyDist = dailyDistanceKm.length > 0 ? totalDist / dailyDistanceKm.length : 0;
  const spatialScore = Math.max(0, Math.min(100, 100 - Math.max(0, avgDailyDist - 12) * 2.5));

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

  if (avgActivitiesPerDay < idealPace - 1.5) {
    warnings.push(`Itinerary is lighter than your preferred ${pace} pace.`);
  } else if (avgActivitiesPerDay > idealPace + 1.5) {
    warnings.push(`Itinerary is quite packed for your preferred ${pace} pace.`);
  }

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
 * Checks if an activity is inherently an evening/night activity (dinner, night market, bar, evening stroll)
 */
export function isEveningActivity(act: Activity): boolean {
  const t = (act.title + " " + act.description + " " + (act.type || "")).toLowerCase();
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
 * Checks if an activity is a morning/daytime attraction (temple, museum, park, breakfast)
 */
export function isMorningActivity(act: Activity): boolean {
  const t = (act.title + " " + act.description + " " + (act.type || "")).toLowerCase();
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
          // Reverse subsegment between i+1 and j to uncross the segments
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

/**
 * 2-Opt TSP Algorithm with Monotonic Directional Sweeping
 * Guarantees a smooth linear or curved travel progression without zig-zagging or self-intersections.
 */
export function twoOptRouteOptimization(
  activities: Activity[],
  startCoord?: Coordinates
): Activity[] {
  const validActs = activities.filter(a => a.lat !== undefined && a.lng !== undefined && !isNaN(a.lat) && !isNaN(a.lng));
  if (validActs.length <= 2) return [...activities];

  // 1. Determine Start Anchor (S)
  let startIdx = 0;
  if (startCoord) {
    let minD = Infinity;
    validActs.forEach((act, idx) => {
      const d = haversineDistance(startCoord, { lat: act.lat!, lng: act.lng! });
      if (d < minD) {
        minD = d;
        startIdx = idx;
      }
    });
  } else {
    const morningIdx = validActs.findIndex(a => isMorningActivity(a));
    if (morningIdx !== -1) startIdx = morningIdx;
  }

  const startAnchor = validActs[startIdx];

  // 2. Determine End Anchor (E): prefer evening activity furthest from start, or POI with max distance
  let endIdx = -1;
  let maxEveningDist = -1;
  validActs.forEach((act, idx) => {
    if (idx !== startIdx && isEveningActivity(act)) {
      const d = haversineDistance({ lat: startAnchor.lat!, lng: startAnchor.lng! }, { lat: act.lat!, lng: act.lng! });
      if (d > maxEveningDist) {
        maxEveningDist = d;
        endIdx = idx;
      }
    }
  });

  if (endIdx === -1) {
    let maxD = -1;
    validActs.forEach((act, idx) => {
      if (idx !== startIdx) {
        const d = haversineDistance({ lat: startAnchor.lat!, lng: startAnchor.lng! }, { lat: act.lat!, lng: act.lng! });
        if (d > maxD) {
          maxD = d;
          endIdx = idx;
        }
      }
    });
  }

  const endAnchor = endIdx !== -1 ? validActs[endIdx] : validActs[(startIdx + 1) % validActs.length];

  // 3. Monotonic Directional Vector & Projection
  const vLat = endAnchor.lat! - startAnchor.lat!;
  const vLng = endAnchor.lng! - startAnchor.lng!;
  const vMagSq = vLat * vLat + vLng * vLng;

  let sortedRoute: Activity[];
  if (vMagSq > 1e-8) {
    // Project all points along the vector from startAnchor to endAnchor
    sortedRoute = [...validActs].sort((a, b) => {
      const tA = ((a.lat! - startAnchor.lat!) * vLat + (a.lng! - startAnchor.lng!) * vLng) / vMagSq;
      const tB = ((b.lat! - startAnchor.lat!) * vLat + (b.lng! - startAnchor.lng!) * vLng) / vMagSq;
      return tA - tB;
    });
  } else {
    // Fallback to Nearest Neighbor if points are closely co-located
    const unvisited = [...validActs];
    let curr = unvisited.splice(startIdx, 1)[0];
    sortedRoute = [curr];
    while (unvisited.length > 0) {
      let nIdx = 0;
      let minD = Infinity;
      unvisited.forEach((act, idx) => {
        const d = haversineDistance({ lat: curr.lat!, lng: curr.lng! }, { lat: act.lat!, lng: act.lng! });
        if (d < minD) {
          minD = d;
          nIdx = idx;
        }
      });
      curr = unvisited.splice(nIdx, 1)[0];
      sortedRoute.push(curr);
    }
  }

  let route = sortedRoute;

  // 4. 2-Opt Edge Swapping on Open Path
  const calculateRouteDistance = (r: Activity[]): number => {
    let d = 0;
    for (let k = 0; k < r.length - 1; k++) {
      d += haversineDistance({ lat: r[k].lat!, lng: r[k].lng! }, { lat: r[k + 1].lat!, lng: r[k + 1].lng! });
    }
    return d;
  };

  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    const bestDist = calculateRouteDistance(route);

    for (let i = 0; i < route.length - 2; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const candidate = [
          ...route.slice(0, i),
          ...route.slice(i, j + 1).reverse(),
          ...route.slice(j + 1),
        ];

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

  const nonGeoActs = activities.filter(a => !a.lat || !a.lng || a.lat === 0 || a.lng === 0);
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

  // If first spot is a night/dinner spot and last spot is a morning/day spot, reverse!
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
 * Assigns clean, non-overlapping, chronological time slots to the optimized sequence of activities
 */
export function assignDeterministicTimeSlots(activities: Activity[], pace: string = "Moderate"): Activity[] {
  if (activities.length === 0) return [];

  const hotelCheckIn = activities.find(a => a.type === "hotel" && a.title.toLowerCase().includes("check in"));
  const hotelCheckOut = activities.find(a => a.type === "hotel" && a.title.toLowerCase().includes("check out"));
  const regularActivities = activities.filter(a => a !== hotelCheckIn && a !== hotelCheckOut);
  const regCount = regularActivities.length;

  if (hotelCheckIn && !hotelCheckOut) {
    // Check-in Day: e.g. 15:00 check-in
    const checkInTime = hotelCheckIn.time || "15:00";
    const [cHour] = checkInTime.split(":").map(Number);
    const beforeCount = Math.min(2, Math.max(0, Math.floor(regCount / 2)));
    const afterCount = regCount - beforeCount;

    const beforeTimes = beforeCount === 1 ? ["10:30"] : beforeCount === 2 ? ["09:30", "12:30"] : [];
    const afterTimes = afterCount === 1 
      ? ["17:30"] 
      : afterCount === 2 
      ? ["17:00", "19:30"] 
      : afterCount === 3 
      ? ["16:30", "18:30", "20:30"] 
      : afterCount === 4
      ? ["16:15", "17:45", "19:15", "20:45"]
      : Array.from({ length: afterCount }, (_, i) => `${Math.min(22, (cHour || 15) + 1 + Math.floor(i * 1.5))}:00`);

    const assignedRegular = regularActivities.map((act, idx) => {
      if (idx < beforeCount) {
        return { ...act, time: beforeTimes[idx] || "10:00" };
      } else {
        const afterIdx = idx - beforeCount;
        return { ...act, time: afterTimes[afterIdx] || "17:30" };
      }
    });

    const all = [...assignedRegular, hotelCheckIn];
    return all.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
  }

  if (hotelCheckOut && !hotelCheckIn) {
    // Check-out Day: e.g. 11:00 check-out
    const checkOutTime = hotelCheckOut.time || "11:00";
    const [cHour] = checkOutTime.split(":").map(Number);
    const beforeCount = Math.min(1, Math.max(0, Math.floor(regCount / 3)));
    const afterCount = regCount - beforeCount;

    const beforeTimes = beforeCount === 1 ? ["09:00"] : [];
    const afterTimes = afterCount === 1
      ? ["13:00"]
      : afterCount === 2
      ? ["12:30", "16:00"]
      : afterCount === 3
      ? ["12:30", "15:30", "18:30"]
      : afterCount === 4
      ? ["12:00", "14:30", "17:00", "19:30"]
      : Array.from({ length: afterCount }, (_, i) => `${Math.min(22, (cHour || 11) + 1 + Math.floor(i * 1.5))}:00`);

    const assignedRegular = regularActivities.map((act, idx) => {
      if (idx < beforeCount) {
        return { ...act, time: beforeTimes[idx] || "09:00" };
      } else {
        const afterIdx = idx - beforeCount;
        return { ...act, time: afterTimes[afterIdx] || "13:00" };
      }
    });

    const all = [...assignedRegular, hotelCheckOut];
    return all.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
  }

  // Standard case (regular day or day with both / neither)
  const count = regularActivities.length;
  const TIME_TEMPLATES: Record<number, string[]> = {
    1: ["10:00"],
    2: ["10:00", "15:00"],
    3: ["09:30", "13:00", "18:00"],
    4: ["09:00", "12:00", "15:00", "18:30"],
    5: ["09:00", "11:00", "12:45", "15:30", "18:30"],
    6: ["08:30", "10:30", "12:30", "14:45", "17:15", "19:30"],
    7: ["08:30", "10:15", "12:00", "13:45", "15:30", "17:30", "19:30"],
    8: ["08:00", "09:30", "11:00", "12:30", "14:00", "15:45", "17:30", "19:30"],
  };

  const defaultTimes = TIME_TEMPLATES[count] || Array.from({ length: count }, (_, i) => {
    const startHour = 9;
    const interval = Math.max(1.5, 10 / (count - 1 || 1));
    const h = Math.floor(startHour + i * interval);
    const m = Math.round(((startHour + i * interval) % 1) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });

  const assignedRegular = regularActivities.map((act, index) => ({
    ...act,
    time: defaultTimes[index] || act.time || "10:00",
  }));

  const all = [...assignedRegular];
  if (hotelCheckIn) all.push(hotelCheckIn);
  if (hotelCheckOut) all.push(hotelCheckOut);

  return all.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
}

/**
 * Checks if an activity is a food/dining activity
 */
export function isFoodActivity(act: Activity): boolean {
  const t = (act.title + " " + act.description + " " + (act.type || "")).toLowerCase();
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
 * Enforces NO CONSECUTIVE MEALS by locally interleaving non-food activities between food spots
 */
export function preventConsecutiveMeals(activities: Activity[]): Activity[] {
  if (activities.length <= 2) return activities;

  const result = [...activities];

  for (let i = 0; i < result.length - 1; i++) {
    if (isFoodActivity(result[i]) && isFoodActivity(result[i + 1])) {
      // Find the closest non-food activity to preserve local spatial linearity
      let targetIdx = -1;
      if (i + 2 < result.length && !isFoodActivity(result[i + 2])) {
        targetIdx = i + 2;
      } else if (i - 1 >= 0 && !isFoodActivity(result[i - 1])) {
        targetIdx = i - 1;
      } else {
        let minOffset = Infinity;
        result.forEach((act, idx) => {
          if (!isFoodActivity(act)) {
            const offset = Math.abs(idx - i);
            if (offset < minOffset) {
              minOffset = offset;
              targetIdx = idx;
            }
          }
        });
      }

      if (targetIdx !== -1 && targetIdx !== i && targetIdx !== i + 1) {
        const temp = result[i + 1];
        result[i + 1] = result[targetIdx];
        result[targetIdx] = temp;
      }
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
  hotelOrStartCoord?: Coordinates
): Activity[] {
  if (activities.length <= 1) return activities;

  // Separate hotel activities (check-in / check-out) so they don't get scrambled
  const hotelCheckIn = activities.find(a => a.type === "hotel" && a.title.toLowerCase().includes("check in"));
  const hotelCheckOut = activities.find(a => a.type === "hotel" && a.title.toLowerCase().includes("check out"));
  const regularActivities = activities.filter(a => a !== hotelCheckIn && a !== hotelCheckOut);

  // 1. Run Monotonic Projection & Open-Path 2-Opt Route Optimization (No zigzags, no loops)
  let optimized = twoOptRouteOptimization(regularActivities, hotelOrStartCoord);

  // 2. Untangle any geometric line-segment intersections
  optimized = untangleIntersectingEdges(optimized);

  // 3. Align Semantic Direction (Morning landmarks -> Evening dining/night markets)
  optimized = alignSemanticDirection(optimized);

  // 4. Prevent consecutive meals with local adjacency preservation
  optimized = preventConsecutiveMeals(optimized);

  // 5. Final geometric uncrossing pass to guarantee ZERO self-intersections
  optimized = untangleIntersectingEdges(optimized);

  // 6. Pass all activities (including hotel check-in/out) to assign clean chronological time slots & auto-sort
  const allToSchedule = [...optimized];
  if (hotelCheckIn) allToSchedule.push(hotelCheckIn);
  if (hotelCheckOut) allToSchedule.push(hotelCheckOut);

  return assignDeterministicTimeSlots(allToSchedule, pace);
}
