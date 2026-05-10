export const extractPlaceName = (title: string): string => {
  let cleaned = title;

  const patterns = [
    /^Explore\s+/i,
    /^Visit\s+/i,
    /^Stroll\s+along\s+/i,
    /^Lunch\s+in\s+/i,
    /^Lunch\s+at\s+/i,
    /^Dinner\s+at\s+/i,
    /^Dinner\s+with\s+/i,
    /^Night\s+View\s+of\s+/i,
    /^Traditional\s+.*?\s+(Lunch|Dinner)\s+in\s+/i,
    /^Traditional\s+.*?\s+(Lunch|Dinner)\s+at\s+/i
  ];

  patterns.forEach(p => {
    cleaned = cleaned.replace(p, "");
  });

  if (cleaned.toLowerCase().includes(" and ")) {
    cleaned = cleaned.split(/\s+and\s+/i)[0];
  }

  return cleaned.trim();
};
