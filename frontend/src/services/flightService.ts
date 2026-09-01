const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlightEndpointInfo {
  airport: string;
  iata: string;
  scheduled: string | null;
  actual: string | null;
  estimated: string | null;
  terminal: string | null;
  gate: string | null;
  delay: number | null;
  baggage?: string | null;
}

export interface FlightStatus {
  flight_iata: string;
  airline: string;
  /** AviationStack status: "scheduled" | "active" | "landed" | "cancelled" | "diverted" | "unknown" */
  status: string;
  departure: FlightEndpointInfo;
  arrival: FlightEndpointInfo;
}

export interface FlightOffer {
  offer_id: string;
  airline: string;
  airline_logo?: string;
  flight_number?: string;
  departure_iata: string;
  arrival_iata: string;
  departure_time: string;
  arrival_time: string;
  duration: string;
  stops: number;
  currency: string;
  total_amount: string;
  deep_link: string;
}

export interface FlightTrend {
  date: string;   // "YYYY-MM-DD"
  price: number;
}

export interface FlightTrendsResult {
  trends: FlightTrend[];
  currency: string;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Look up the real-time status of a flight by its IATA code.
 * Powered by AviationStack (backend proxy).
 */
export async function getFlightStatus(flightIata: string): Promise<FlightStatus> {
  const res = await fetch(`${API_URL}/flight/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flight_iata: flightIata.trim().toUpperCase() }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err?.error ?? `Flight status error: ${res.status}`);
  }

  return res.json() as Promise<FlightStatus>;
}

/**
 * Search for the cheapest one-way flight offers between two airports.
 * Powered by Google Flights via RapidAPI (backend proxy).
 */
export async function getFlightOffers(
  origin: string,
  destination: string,
  date: string,          // "YYYY-MM-DD"
  passengers: number = 1,
  currency: string = "THB"
): Promise<FlightOffer[]> {
  const res = await fetch(`${API_URL}/flight/offers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: origin.trim().toUpperCase(),
      destination: destination.trim().toUpperCase(),
      date,
      passengers,
      currency,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const msg = err?.error || err?.message || res.statusText;
    if (msg.includes("quota") || msg.includes("quota for Requests")) {
      throw new Error("RapidAPI monthly quota limit reached. Use Google Flights search link below.");
    }
    throw new Error(msg);
  }

  const json = await res.json();
  return (json.offers ?? []) as FlightOffer[];
}

/**
 * Fetch a ~30-day price calendar showing the cheapest fare for each day.
 * Powered by Google Flights getCalendarPicker via RapidAPI (backend proxy).
 */
export async function getFlightTrends(
  origin: string,
  destination: string,
  date: string,         // "YYYY-MM-DD" – the reference date (API returns ~30 days around it)
  currency: string = "THB"
): Promise<FlightTrendsResult> {
  try {
    const res = await fetch(`${API_URL}/flight/trends`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: origin.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        date,
        currency,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      console.warn("Flight trends API notice:", err?.error || err?.message || res.statusText);
      return { trends: [] };
    }

    return (await res.json()) as FlightTrendsResult;
  } catch (err) {
    console.warn("Flight trends unavailable:", err);
    return { trends: [] };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format an ISO datetime string to local time (HH:MM). */
export function formatFlightTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

/** Parse ISO 8601 duration string (e.g. "PT10H30M") to human-readable "10h 30m". */
export function parseDuration(dur: string): string {
  if (!dur) return "—";
  const match = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return dur;
  const h = match[1] ? `${match[1]}h` : "";
  const m = match[2] ? `${match[2]}m` : "";
  return [h, m].filter(Boolean).join(" ") || dur;
}

/** Map AviationStack status string to a UI-friendly label + color. */
export function getStatusMeta(status: string): { label: string; color: string; dot: string } {
  switch (status.toLowerCase()) {
    case "active":
    case "en-route":
      return { label: "IN-FLIGHT", color: "text-emerald-400", dot: "bg-emerald-400" };
    case "scheduled":
      return { label: "SCHEDULED", color: "text-sky-400", dot: "bg-sky-400" };
    case "landed":
      return { label: "LANDED", color: "text-violet-400", dot: "bg-violet-400" };
    case "cancelled":
      return { label: "CANCELLED", color: "text-red-400", dot: "bg-red-400" };
    case "diverted":
      return { label: "DIVERTED", color: "text-amber-400", dot: "bg-amber-400" };
    default:
      return { label: status.toUpperCase(), color: "text-muted-foreground", dot: "bg-muted-foreground" };
  }
}
