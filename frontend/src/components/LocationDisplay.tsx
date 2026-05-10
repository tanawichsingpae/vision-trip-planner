import { MapPin, Check } from "lucide-react";
import { type ImageCandidate } from "@/services/aiService";

export interface LocationData {
  name: string;
  type: string;
  country: string;
  coordinates: { lat: number; lng: number };
  weather: string;
  temperature: string;
  airQuality: string;
  timezone: string;
  sunlight: string;
}

interface LocationDisplayProps {
    locations: Array<{
    place: string;
    type: string;
    country: string;
    confidence?: number;
    similar_locations?: Array<{ name: string; similarity: number }>;
    ai_reasoning?: string[];
    initial_candidates?: ImageCandidate[];
    top_candidates?: ImageCandidate[];
  }>;
}

const LocationDisplay = ({ locations }: LocationDisplayProps) => {
  return (
    <div className="animate-slide-up max-w-4xl mx-auto">
      <div className="glass-card rounded-3xl p-8 border border-primary/10 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
        
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl travel-gradient flex items-center justify-center shadow-lg">
            <MapPin className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">Identified Destination</h3>
            <p className="text-muted-foreground text-sm">Visual Verification results</p>
          </div>
        </div>

        <div className="space-y-6">
          {locations.map((loc, i) => (
            <div key={i} className="flex flex-col p-6 rounded-2xl bg-muted/40 border border-border/50 hover:border-primary/30 transition-all hover:bg-muted/60 group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center font-bold text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                    {i + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-xl">{loc.place}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">{loc.type}</span>
                      <span className="text-muted-foreground text-xs">{loc.country}</span>
                    </div>
                  </div>
                </div>
                
                {loc.confidence !== undefined && (
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">Visual Match</span>
                      <span className="text-sm font-bold text-primary">{(loc.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-32 h-2 bg-background rounded-full overflow-hidden border border-border/50">
                      <div 
                        className="h-full travel-gradient transition-all duration-1000" 
                        style={{ width: `${loc.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {loc.confidence !== undefined && (
                <div className="mt-4 p-4 rounded-xl border border-border/50 bg-background/50">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Confidence Status</p>
                  {loc.confidence >= 0.75 ? (
                    <div className="flex flex-col gap-2">
                      <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 uppercase tracking-tighter">
                        HIGH CONFIDENCE
                      </span>
                      <p className="text-xs text-green-800 font-medium">
                        ระบบมีความมั่นใจสูงว่าสถานที่ในภาพตรงกับผลลัพธ์ที่ระบุ
                      </p>
                    </div>
                  ) : loc.confidence >= 0.4 ? (
                    <div className="flex flex-col gap-2">
                      <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-orange-700 border border-orange-200 uppercase tracking-tighter">
                        MEDIUM CONFIDENCE
                      </span>
                      <p className="text-xs text-orange-800 font-medium">
                        ผลลัพธ์อาจมีความคลาดเคลื่อนเล็กน้อย แนะนำให้ตรวจสอบสถานที่ใกล้เคียงเพิ่มเติม
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 uppercase tracking-tighter">
                        LOW CONFIDENCE
                      </span>
                      <p className="text-xs text-red-800 font-medium">
                        ระบบมีความมั่นใจต่ำ มีความเป็นไปได้ว่าสถานที่ที่ระบุอาจไม่ถูกต้อง กรุณาลองอัปโหลดภาพใหม่
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Initial Guesses Section */}
              {loc.initial_candidates && loc.initial_candidates.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border/20">
                  <h5 className="text-sm font-bold text-foreground mb-4">Initial Guesses from AI (LLM)</h5>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {loc.initial_candidates.map((cand, idx) => (
                      <div key={idx} className="flex flex-col rounded-xl overflow-hidden bg-background/40 border border-border/50 group/cand">
                        <div className="relative h-24 overflow-hidden">
                          <img 
                            src={cand.photo_url || `https://source.unsplash.com/400x300/?${encodeURIComponent(cand.name)}`} 
                            alt={cand.name}
                            className="w-full h-full object-cover group-hover/cand:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[8px] text-white font-bold uppercase tracking-tighter">
                            LLM Candidate
                          </div>
                        </div>
                        <div className="p-2">
                          <p className="text-[10px] font-bold text-foreground line-clamp-1">{cand.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CLIP Ranking Section */}
              {loc.top_candidates && loc.top_candidates.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border/20">
                  <h5 className="text-sm font-bold text-foreground mb-4">CLIP Visual Similarity Ranking (Top 3)</h5>
                  <div className="space-y-3">
                    {loc.top_candidates.map((cand, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${
                          idx === 0 ? "bg-green-50/50 border-green-200 shadow-sm" : "bg-background/40 border-border/50"
                        }`}
                      >
                        <div className="text-2xl w-10 flex justify-center">
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                        </div>
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-border/20 flex-shrink-0">
                          <img 
                            src={cand.photo_url || `https://source.unsplash.com/400x300/?${encodeURIComponent(cand.name)}`} 
                            alt={cand.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center justify-between">
                            <h6 className="text-sm font-bold text-foreground">Rank {idx + 1} – {cand.name}</h6>
                            <span className={`text-xs font-bold ${idx === 0 ? "text-green-600" : "text-primary"}`}>
                              Similarity: {(cand.similarity * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-background rounded-full mt-2 overflow-hidden border border-border/20">
                            <div 
                              className={`h-full transition-all duration-1000 ${idx === 0 ? "bg-green-500" : "travel-gradient"}`}
                              style={{ width: `${cand.similarity * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loc.similar_locations && loc.similar_locations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/20">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Visually Similar Locations</p>
                  <div className="flex flex-wrap gap-2">
                    {loc.similar_locations.map((sim, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/50 border border-border/50 text-xs">
                        <span className="font-medium text-foreground">{sim.name}</span>
                        <span className="text-primary font-bold">{(sim.similarity * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loc.ai_reasoning && loc.ai_reasoning.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50 text-sm text-muted-foreground">
                  <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Visual Evidence
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    {loc.ai_reasoning.map((reason, idx) => (
                      <li key={idx} className="text-xs leading-relaxed">{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LocationDisplay;
