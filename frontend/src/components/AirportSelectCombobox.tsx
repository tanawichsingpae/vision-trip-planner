import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, MapPin, Plane, X, Search } from "lucide-react";
import { AIRPORTS, searchAirports, findNearestAirport, type Airport } from "@/data/airports";
import { toast } from "sonner";

interface AirportSelectComboboxProps {
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
  id?: string;
}

const THAI_QUICK_AIRPORTS = ["BKK", "DMK", "CNX", "HKT", "HDY", "UTH", "CEI", "USM", "KBV", "UBP"];

export const AirportSelectCombobox = ({
  value,
  onChange,
  placeholder = "ค้นหาสนามบิน...",
  id,
}: AirportSelectComboboxProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedAirport = AIRPORTS.find((a) => a.iata === value) ?? null;
  const results = searchAirports(query, 8);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectAirport = (airport: Airport) => {
    onChange(airport.iata);
    setQuery("");
    setIsOpen(false);
  };

  const clearSelection = () => {
    onChange("");
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // GPS nearest airport detection
  const detectNearestAirport = useCallback(() => {
    if (!("geolocation" in navigator)) {
      toast.error("เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง GPS");
      return;
    }
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = findNearestAirport(pos.coords.latitude, pos.coords.longitude);
        onChange(nearest.iata);
        toast.success(
          `📍 ตรวจพบสนามบิน: ${nearest.flag} ${nearest.nameTH} (${nearest.iata})`,
          { duration: 4000 }
        );
        setIsDetecting(false);
      },
      () => {
        toast.error("ไม่สามารถเข้าถึง GPS ได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง");
        setIsDetecting(false);
      },
      { timeout: 8000 }
    );
  }, [onChange]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlighted]) selectAirport(results[highlighted]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
    }
  };

  const thaiQuickList = THAI_QUICK_AIRPORTS.map((iata) =>
    AIRPORTS.find((a) => a.iata === iata)
  ).filter(Boolean) as Airport[];

  return (
    <div ref={containerRef} className="relative w-full space-y-2">
      {/* ── Search Input ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        {selectedAirport && !isOpen ? (
          // Display selected airport chip
          <div className="flex items-center gap-2.5 h-10 pl-9 pr-3 rounded-xl border border-primary/40 bg-primary/5 text-sm font-medium cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          >
            <span className="text-base">{selectedAirport.flag}</span>
            <span className="font-semibold text-foreground">
              {selectedAirport.iata}
            </span>
            <span className="text-muted-foreground text-xs truncate">
              {selectedAirport.nameTH} · {selectedAirport.cityEN}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearSelection(); }}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            id={id}
            type="text"
            autoComplete="off"
            value={query}
            placeholder={placeholder}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setHighlighted(0); }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>

      {/* ── Detect GPS Button ── */}
      <button
        type="button"
        onClick={detectNearestAirport}
        disabled={isDetecting}
        className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
      >
        {isDetecting ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <MapPin className="w-3 h-3" />
        )}
        {isDetecting ? "กำลังตรวจหาตำแหน่ง GPS…" : "📍 หาสนามบินใกล้ฉัน"}
      </button>

      {/* ── Dropdown Results ── */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 top-[calc(100%-8px)] left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-[260px] overflow-y-auto">
            {results.map((airport, i) => (
              <button
                key={airport.iata}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectAirport(airport)}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  highlighted === i ? "bg-primary/10" : "hover:bg-muted/60"
                }`}
              >
                <span className="text-lg shrink-0 leading-none">{airport.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      {airport.iata}
                    </span>
                    <span className="text-xs font-semibold text-foreground truncate">
                      {airport.nameTH}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {airport.nameEN} · {airport.city} ({airport.cityEN})
                  </p>
                </div>
                <Plane className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Thai Quick Select Chips ── */}
      {!isOpen && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-muted-foreground font-medium self-center">🇹🇭 ด่วน:</span>
          {thaiQuickList.map((airport) => (
            <button
              key={airport.iata}
              type="button"
              onClick={() => selectAirport(airport)}
              className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                value === airport.iata
                  ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                  : "border-border/60 hover:border-primary/40 bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {airport.iata} · {airport.nameTH}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AirportSelectCombobox;
