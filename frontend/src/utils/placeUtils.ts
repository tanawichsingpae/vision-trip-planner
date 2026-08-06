/**
 * extractPlaceName
 *
 * Strips common AI-generated prefixes/verbs from an activity title so the
 * remainder is closer to a real searchable place name.
 *
 * This is a lightweight pre-processor — the robust multi-strategy geocoding
 * in geocode.ts handles the heavy lifting for cases this function misses.
 */
export const extractPlaceName = (title: string): string => {
  const prefixPatterns = [
    // Action verbs
    /^(Explore|Visit|See|Tour|Check out|Discover|Experience|Enjoy|Attend|Watch|Ride|Take a|Catch a|Walk|Stroll|Hike|Climb|Swim at|Snorkel at|Dive at)\s+/i,
    // Meal verbs + prepositions
    /^(Breakfast|Lunch|Dinner|Brunch|Supper|Snack)\s+(at|in|near|by|around|along|by the)\s+/i,
    /^(Grab|Have|Try|Eat|Taste|Sample)\s+(breakfast|lunch|dinner|brunch|coffee|tea|a meal|food|snacks?)\s+(at|in|near|by|around)?\s*/i,
    // Time-of-day qualifiers
    /^(Night|Morning|Evening|Afternoon|Sunset|Sunrise)\s+(view|visit|walk|cruise|tour|market|show|performance|activity)\s+(of|at|in|near|along)?\s*/i,
    // "Traditional / Local + dish + meal + preposition"
    /^(Traditional|Local|Authentic|Classic|Famous|Typical)\s+[\w\s]*(Lunch|Dinner|Breakfast|Brunch)\s+(at|in|near)?\s*/i,
    // Leftover prepositions after verb stripping
    /^(at|in|near|by|around|along|the)\s+/i,
  ];

  let cleaned = title.trim();
  let prev = "";

  // Apply repeatedly until the string stabilises (handles stacked prefixes)
  while (prev !== cleaned) {
    prev = cleaned;
    for (const p of prefixPatterns) {
      cleaned = cleaned.replace(p, "").trim();
    }
  }

  // "Temple A and Museum B" → "Temple A"
  const andIdx = cleaned.search(/\s+and\s+/i);
  if (andIdx > 0) {
    cleaned = cleaned.slice(0, andIdx).trim();
  }

  return cleaned.length > 0 ? cleaned : title.trim();
};
