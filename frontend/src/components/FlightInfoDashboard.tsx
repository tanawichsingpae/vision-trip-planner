import { useEffect, useState } from "react";
import {
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Clock,
  MapPin,
  Luggage,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AirportSelectCombobox } from "@/components/AirportSelectCombobox";
import {
  getFlightStatus,
  getFlightOffers,
  getFlightTrends,
  formatFlightTime,
  parseDuration,
  getStatusMeta,
  type FlightStatus,
  type FlightOffer,
  type FlightTrend,
  type FlightTrendsResult,
} from "@/services/flightService";
import { type TripPreferences } from "@/services/aiService";
import { GoogleFlightsCalendarWidget } from "@/components/GoogleFlightsCalendarWidget";
import { getBookingUrl, buildGoogleFlightsUrl } from "@/lib/flightUrl";

// ─── Props ────────────────────────────────────────────────────────────────────

interface FlightInfoDashboardProps {
  preferences: TripPreferences;
  /** Closest IATA airport code to the AI-detected destination, e.g. "HND" */
  destinationIata: string;
  /** Human-readable destination name from AI, e.g. "Tokyo, Japan" */
  destinationName: string;
  /** Callback to sync preferences when user adds or removes a flight */
  onUpdatePreferences?: (updated: Partial<TripPreferences>) => void;
}

// ─── Status Panel (AviationStack) ─────────────────────────────────────────────

const FlightStatusPanel = ({
  flightCode,
  onArrivalTimeResolved,
}: {
  flightCode: string;
  onArrivalTimeResolved?: (iso: string) => void;
}) => {
  const [status, setStatus] = useState<FlightStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFlightStatus(flightCode);
      setStatus(data);
      const arrivalIso = data.arrival.actual ?? data.arrival.estimated ?? data.arrival.scheduled;
      if (arrivalIso && onArrivalTimeResolved) onArrivalTimeResolved(arrivalIso);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to fetch flight status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [flightCode]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-6 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Fetching live flight status…</span>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex flex-col gap-3 py-4">
        <div className="flex items-start gap-2 text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm">{error ?? "Flight not found"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} className="w-fit">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  const meta = getStatusMeta(status.status);
  const arrivalIso = status.arrival.actual ?? status.arrival.estimated ?? status.arrival.scheduled;
  const depIso = status.departure.actual ?? status.departure.estimated ?? status.departure.scheduled;
  const hasDelay = (status.arrival.delay ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Status badge row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-2.5 h-2.5 rounded-full animate-pulse ${meta.dot}`} />
          <span className={`font-bold text-sm tracking-wide ${meta.color}`}>{meta.label}</span>
        </div>
        <Badge variant="outline" className="text-xs font-medium">
          {status.flight_iata}
        </Badge>
        <span className="text-muted-foreground text-xs">{status.airline}</span>
        {hasDelay && (
          <Badge variant="destructive" className="text-[10px]">
            +{status.arrival.delay} min delay
          </Badge>
        )}
      </div>

      {/* Route row */}
      <div className="flex items-center gap-3">
        {/* Departure */}
        <div className="text-center min-w-[80px]">
          <p className="text-2xl font-extrabold tabular-nums leading-none">{formatFlightTime(depIso)}</p>
          <p className="text-xs text-muted-foreground mt-1 font-semibold tracking-wide">{status.departure.iata}</p>
          <p className="text-[10px] text-muted-foreground line-clamp-1">{status.departure.airport}</p>
        </div>

        {/* Arrow */}
        <div className="flex-1 flex flex-col items-center gap-1 px-2">
          <div className="flex items-center gap-1 w-full">
            <div className="h-px flex-1 bg-border" />
            <Plane className="w-4 h-4 text-primary shrink-0" />
            <div className="h-px flex-1 bg-border" />
          </div>
          <span className="text-[10px] text-muted-foreground">Direct</span>
        </div>

        {/* Arrival */}
        <div className="text-center min-w-[80px]">
          <p className={`text-2xl font-extrabold tabular-nums leading-none ${hasDelay ? "text-amber-400" : ""}`}>
            {formatFlightTime(arrivalIso)}
          </p>
          <p className="text-xs text-muted-foreground mt-1 font-semibold tracking-wide">{status.arrival.iata}</p>
          <p className="text-[10px] text-muted-foreground line-clamp-1">{status.arrival.airport}</p>
        </div>
      </div>

      {/* Details chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        {status.arrival.terminal && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            <MapPin className="w-3 h-3" /> Terminal {status.arrival.terminal}
          </div>
        )}
        {status.arrival.gate && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            Gate {status.arrival.gate}
          </div>
        )}
        {status.arrival.baggage && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            <Luggage className="w-3 h-3" /> Belt {status.arrival.baggage}
          </div>
        )}
        {status.departure.terminal && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground">
            <PlaneTakeoff className="w-3 h-3" /> Dep. Terminal {status.departure.terminal}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={fetchStatus}
        className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
      >
        <RefreshCw className="w-3 h-3 mr-1" /> Refresh status
      </Button>
    </div>
  );
};

// ─── Offers Panel (Google Flights via RapidAPI) ────────────────────────────────

const FlightOffersPanel = ({
  origin,
  destination,
  date,
}: {
  origin: string;
  destination: string;
  date: string;
}) => {
  const [offers, setOffers] = useState<FlightOffer[]>([]);
  const [trends, setTrends] = useState<FlightTrend[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOffer, setSelectedOffer] = useState<FlightOffer | null>(() => {
    try {
      const stored = localStorage.getItem(`selected_flight_${destination}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const handleSelectOffer = (offer: FlightOffer) => {
    setSelectedOffer(offer);
    try {
      localStorage.setItem(`selected_flight_${destination}`, JSON.stringify(offer));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearSelection = () => {
    setSelectedOffer(null);
    try {
      localStorage.removeItem(`selected_flight_${destination}`);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // Don't call APIs if either IATA code is missing
    if (!origin || !destination) {
      setLoading(false);
      setTrendsLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getFlightOffers(origin, destination, date);
        setOffers(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to fetch flight offers");
      } finally {
        setLoading(false);
      }
    })();

    (async () => {
      setTrendsLoading(true);
      try {
        const res = await getFlightTrends(origin, destination, date);
        setTrends(res.trends ?? []);
      } catch {
        setTrends([]);
      } finally {
        setTrendsLoading(false);
      }
    })();
  }, [origin, destination, date]);

  // When no IATA codes, show Google Flights search banner directly
  if (!origin || !destination) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-5 flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Plane className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Find the best flight deals</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Search live flight prices on Google Flights for your trip on <strong>{date}</strong>
          </p>
        </div>
        <a
          href={buildGoogleFlightsUrl(origin || "BKK", destination || "", date)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Search on Google Flights
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-6 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Searching best flight deals…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 text-amber-400 py-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-xs">Couldn't load flight offers automatically. Search directly on Google Flights:</p>
        </div>
        <a
          href={buildGoogleFlightsUrl(origin, destination, date)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Search on Google Flights
        </a>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* ── Highlighted Selected Flight ── */}
      {selectedOffer && (
        <div className="p-4 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm space-y-3 animate-slide-up relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
              <CheckCircle2 className="w-4 h-4" /> Selected Flight for your itinerary
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="text-[10px] text-muted-foreground hover:text-red-400 h-6 px-2 hover:bg-red-500/10"
            >
              Change Flight
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {selectedOffer.airline_logo ? (
              <img
                src={selectedOffer.airline_logo}
                alt={selectedOffer.airline}
                className="w-8 h-8 rounded object-contain bg-white p-0.5"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                <Plane className="w-4 h-4 text-primary" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <span>{selectedOffer.departure_iata}</span>
                <Plane className="w-3 h-3 text-primary shrink-0" />
                <span>{selectedOffer.arrival_iata}</span>
                {selectedOffer.flight_number && (
                  <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                    {selectedOffer.flight_number}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedOffer.airline} · {parseDuration(selectedOffer.duration)} · {formatFlightTime(selectedOffer.departure_time)} → {formatFlightTime(selectedOffer.arrival_time)}
              </p>
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-extrabold text-foreground">
                {parseFloat(selectedOffer.total_amount).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{selectedOffer.currency}</span>
              </p>
              <a
                href={getBookingUrl(selectedOffer.deep_link, origin, destination, date)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline font-semibold mt-0.5"
              >
                Book on Google Flights <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Price Calendar Trends Widget ── */}
      <GoogleFlightsCalendarWidget
        trends={trends}
        loading={trendsLoading}
        origin={origin}
        destination={destination}
        selectedDate={date}
        onRefresh={async () => {
          setTrendsLoading(true);
          try {
            const res = await getFlightTrends(origin, destination, date);
            setTrends(res.trends ?? []);
          } catch {
            setTrends([]);
          } finally {
            setTrendsLoading(false);
          }
        }}
      />

      {!offers.length ? (
        <div className="rounded-2xl border border-dashed border-border p-5 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Plane className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No direct flight offers loaded</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Search live results on Google Flights for {origin} → {destination}
            </p>
          </div>
          <a
            href={buildGoogleFlightsUrl(origin, destination, date)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Search on Google Flights
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">✈️ Compare & Select Flight</p>
          {offers.map((offer, i) => {
            const isCurrentSelection = selectedOffer?.offer_id === offer.offer_id;
            return (
              <div
                key={offer.offer_id ?? i}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all group ${
                  isCurrentSelection
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : "bg-muted/40 border-border hover:border-primary/30 hover:bg-muted/60"
                }`}
              >
                {/* Rank badge */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isCurrentSelection
                    ? "bg-emerald-500 text-white"
                    : i === 0
                    ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {isCurrentSelection ? "✓" : i + 1}
                </div>

                {/* Airline logo */}
                {offer.airline_logo ? (
                  <img
                    src={offer.airline_logo}
                    alt={offer.airline}
                    className="w-7 h-7 rounded object-contain shrink-0 bg-white p-0.5"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : null}

                {/* Route */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <span>{offer.departure_iata}</span>
                    <Plane className="w-3 h-3 text-primary shrink-0" />
                    <span>{offer.arrival_iata}</span>
                    {offer.stops > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-1">
                        {offer.stops} stop{offer.stops > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span>{offer.airline || "—"}</span>
                    {offer.flight_number && (
                      <>
                        <span>·</span>
                        <span className="font-mono">{offer.flight_number}</span>
                      </>
                    )}
                    {offer.duration && (
                      <>
                        <span>·</span>
                        <Clock className="w-2.5 h-2.5" />
                        <span>{parseDuration(offer.duration)}</span>
                      </>
                    )}
                    {offer.departure_time && (
                      <>
                        <span>·</span>
                        <span>{formatFlightTime(offer.departure_time)} → {formatFlightTime(offer.arrival_time)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Price + book / select */}
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <p className="text-sm font-bold text-foreground">
                    {parseFloat(offer.total_amount).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{offer.currency}</span>
                  </p>
                  
                  <div className="flex items-center gap-2">
                    <a
                      href={getBookingUrl(offer.deep_link, origin, destination, date)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-muted-foreground hover:text-primary hover:underline"
                    >
                      Book
                    </a>
                    <button
                      type="button"
                      onClick={() => handleSelectOffer(offer)}
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-all ${
                        isCurrentSelection
                          ? "bg-emerald-500 text-white cursor-default"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                    >
                      {isCurrentSelection ? "Selected" : "Select"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard Component ─────────────────────────────────────────────────

const FlightInfoDashboard = ({
  preferences,
  destinationIata,
  destinationName,
  onUpdatePreferences,
}: FlightInfoDashboardProps) => {
  const [resolvedArrivalTime, setResolvedArrivalTime] = useState<string | null>(null);

  const { hasFlight, flightCode, originIata, startDate } = preferences;
  const isFlightActive = (hasFlight === "yes" && !!flightCode) || (hasFlight === "no" && !!originIata);

  const [isOpen, setIsOpen] = useState(isFlightActive);

  // Form mode: "track" | "search"
  const [mode, setMode] = useState<"track" | "search">(hasFlight === "no" ? "search" : "track");
  const [flightCodeInput, setFlightCodeInput] = useState<string>(flightCode ?? "");
  const [originIataInput, setOriginIataInput] = useState<string>(originIata ?? "");

  useEffect(() => {
    if (hasFlight === "yes") {
      setMode("track");
      setFlightCodeInput(flightCode ?? "");
      if (flightCode) {
        setIsOpen(true);
      }
    } else if (hasFlight === "no") {
      setMode("search");
      setOriginIataInput(originIata ?? "");
      if (originIata) {
        setIsOpen(true);
      }
    }
  }, [hasFlight, flightCode, originIata]);

  const handleTrackSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanCode = flightCodeInput.trim().toUpperCase();
    if (!cleanCode) return;

    onUpdatePreferences?.({
      hasFlight: "yes",
      flightCode: cleanCode,
      originIata: undefined,
    });
    setIsOpen(true);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanOrigin = originIataInput.trim().toUpperCase();
    if (!cleanOrigin) return;

    onUpdatePreferences?.({
      hasFlight: "no",
      originIata: cleanOrigin,
      flightCode: undefined,
    });
    setIsOpen(true);
  };

  const handleRemoveFlight = () => {
    onUpdatePreferences?.({
      hasFlight: undefined,
      flightCode: undefined,
      originIata: undefined,
    });
    setFlightCodeInput("");
    setOriginIataInput("");
    setResolvedArrivalTime(null);
  };

  // Safely parse startDate whether it's a Date instance, ISO string, or YYYY-MM-DD string
  const validStartDate = (() => {
    if (!startDate) return new Date();
    if (startDate instanceof Date && !isNaN(startDate.getTime())) return startDate;
    const parsed = new Date(startDate);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  })();

  // Use local date to avoid UTC-offset shifting the date back by 1 day
  const departureDateStr = [
    validStartDate.getFullYear(),
    String(validStartDate.getMonth() + 1).padStart(2, "0"),
    String(validStartDate.getDate()).padStart(2, "0"),
  ].join("-");

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-md transition-all duration-300">
      {/* Header */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-primary/10 to-transparent border-b border-border cursor-pointer hover:bg-primary/[0.03] transition-all select-none"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <Plane className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Flight Info {!isFlightActive && "(Optional - Tap to expand)"}
          </p>
          <p className="text-sm font-semibold text-foreground">
            {hasFlight === "yes" && flightCode
              ? `Flight ${flightCode}`
              : hasFlight === "no" && originIata
              ? `Flights from ${originIata} to ${destinationName}`
              : `Flights to ${destinationName} (Optional)`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {isFlightActive && (
            <Badge
              variant="outline"
              className={`text-xs font-medium ${
                hasFlight === "yes"
                  ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              }`}
            >
              {hasFlight === "yes" ? "Live Tracking" : "Best Deals"}
            </Badge>
          )}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}>
        {/* Body */}
        <div className="px-5 py-4 border-b border-border">
          {isFlightActive ? (
            <div className="space-y-4">
              {/* Active Header Action */}
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {hasFlight === "yes" ? `Tracking Flight Status` : `Searching Flight Deals`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFlight}
                  className="h-7 px-2.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1.5 rounded-lg font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบเที่ยวบิน</span>
                </Button>
              </div>

              {hasFlight === "yes" && flightCode ? (
                <FlightStatusPanel
                  flightCode={flightCode}
                  onArrivalTimeResolved={setResolvedArrivalTime}
                />
              ) : hasFlight === "no" && originIata ? (
                <FlightOffersPanel
                  origin={originIata}
                  destination={destinationIata || ""}
                  date={departureDateStr}
                />
              ) : null}
            </div>
          ) : (
            /* Setup / Add Flight Form */
            <div className="space-y-4 py-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">
                  ใส่เลขเที่ยวบินเพื่อเทรคสถานะ หรือ ค้นหาตั๋วเครื่องบินราคาดีที่สุด (Optional)
                </p>
              </div>

              {/* Mode Toggle Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("track")}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                    mode === "track"
                      ? "border-primary bg-primary/5 text-primary font-semibold"
                      : "border-border hover:border-primary/30 bg-card text-foreground"
                  }`}
                >
                  <Plane className="w-5 h-5" />
                  <span className="text-xs">ใส่เลขเที่ยวบิน</span>
                  <span className="text-[10px] text-muted-foreground">ติดตามสถานะ Real-time</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("search")}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                    mode === "search"
                      ? "border-primary bg-primary/5 text-primary font-semibold"
                      : "border-border hover:border-primary/30 bg-card text-foreground"
                  }`}
                >
                  <Search className="w-5 h-5" />
                  <span className="text-xs">ค้นหาเที่ยวบิน</span>
                  <span className="text-[10px] text-muted-foreground">เปรียบเทียบราคาที่ดีที่สุด</span>
                </button>
              </div>

              {/* Mode A: Track Flight Number */}
              {mode === "track" && (
                <form onSubmit={handleTrackSubmit} className="space-y-3 pt-2 border-t border-border">
                  <div className="space-y-1.5">
                    <Label htmlFor="flight-code-input" className="text-xs font-medium flex items-center gap-1.5">
                      <Plane className="w-3.5 h-3.5 text-primary" />
                      หมายเลขเที่ยวบิน (Flight Number)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="flight-code-input"
                        placeholder="เช่น TG682, XJ600"
                        value={flightCodeInput}
                        onChange={(e) => setFlightCodeInput(e.target.value)}
                        className="uppercase text-xs h-9 flex-1"
                        maxLength={8}
                      />
                      <Button type="submit" size="sm" className="h-9 text-xs px-4" disabled={!flightCodeInput.trim()}>
                        ติดตามเที่ยวบิน
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      เราจะแสดงสถานะสดและเวลาเดินทางมาถึง เพื่อคำนวณวันแรกของตารางเดินทางให้อัตโนมัติ
                    </p>
                  </div>
                </form>
              )}

              {/* Mode B: Search Flights by Origin Airport */}
              {mode === "search" && (
                <form onSubmit={handleSearchSubmit} className="space-y-3 pt-2 border-t border-border">
                  <div className="space-y-2">
                    <Label htmlFor="origin-airport-input" className="text-xs font-medium flex items-center gap-1.5">
                      <PlaneTakeoff className="w-3.5 h-3.5 text-primary" />
                      สนามบินต้นทาง (Departure Airport)
                    </Label>
                    <AirportSelectCombobox
                      id="origin-airport-input"
                      value={originIataInput}
                      onChange={setOriginIataInput}
                      placeholder="ค้นหาสนามบิน เช่น BKK, DMK, CNX, HKT..."
                    />
                    <Button type="submit" size="sm" className="w-full h-8 text-xs font-semibold" disabled={!originIataInput.trim()}>
                      ค้นหาเที่ยวบินราคาดีที่สุด
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer: arrival time hint for Itinerary AI */}
        {resolvedArrivalTime && isFlightActive && (
          <div className="px-5 py-3 bg-primary/5 flex items-center gap-2 text-xs text-primary">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              Your itinerary starts from{" "}
              <strong>{formatFlightTime(resolvedArrivalTime)}</strong> — adjusted to your arrival time.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlightInfoDashboard;
export type { FlightInfoDashboardProps };
