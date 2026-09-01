import React from "react";
import { Plane } from "lucide-react";
import "./GlobeFlightBackground.css";

interface GlobeFlightBackgroundProps {
  variant?: "bottom" | "header";
  className?: string;
}

const GlobeFlightBackground: React.FC<GlobeFlightBackgroundProps> = ({
  variant = "bottom",
  className = "",
}) => {
  if (variant === "header") {
    return (
      <div
        className={`globe-flight-header-container pointer-events-none absolute inset-x-0 bottom-0 h-[420px] overflow-hidden z-0 ${className}`}
        aria-hidden="true"
      >
        {/* Atmosphere Glow for Header */}
        <div className="globe-header-atmosphere-glow" />

        {/* Header Globe SVG Orbits & Hemisphere */}
        <svg
          className="globe-svg-header-orbits absolute bottom-0 left-1/2 -translate-x-1/2 w-[1600px] h-[420px] max-w-none"
          viewBox="0 0 1600 420"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="header-orbit-grad-teal" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d5f1ef" stopOpacity="0.05" />
              <stop offset="30%" stopColor="#67c4bd" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#67c4bd" stopOpacity="0.05" />
            </linearGradient>

            <linearGradient id="header-orbit-grad-coral" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ff9276" stopOpacity="0.05" />
              <stop offset="35%" stopColor="#ff9276" stopOpacity="0.65" />
              <stop offset="65%" stopColor="#ffe0a9" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#ff9276" stopOpacity="0.05" />
            </linearGradient>

            <linearGradient id="header-orbit-grad-cyan" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#3ca89f" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#d8ffef" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#3ca89f" stopOpacity="0.05" />
            </linearGradient>

            <radialGradient id="header-globe-crest-glow" cx="50%" cy="0%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="35%" stopColor="#67c4bd" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#126c78" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Header Orbital Arcs */}
          {/* Arc 1: Wide High Orbit (Left to Right) */}
          <path
            d="M 60 410 C 260 130, 1340 130, 1540 410"
            stroke="url(#header-orbit-grad-teal)"
            strokeWidth="1.6"
            strokeDasharray="8 8"
            className="orbit-path-anim-slow"
          />

          {/* Arc 2: Diagonal Cross Orbit (Right to Left) */}
          <path
            d="M 1500 390 C 1220 110, 380 150, 100 400"
            stroke="url(#header-orbit-grad-coral)"
            strokeWidth="1.6"
            strokeDasharray="6 7"
            className="orbit-path-anim-fast"
          />

          {/* Arc 3: Equatorial Glide */}
          <path
            d="M 220 415 C 440 210, 1160 210, 1380 415"
            stroke="url(#header-orbit-grad-cyan)"
            strokeWidth="1.3"
            strokeDasharray="7 9"
          />

          {/* ── Globe Hemisphere Structure (Bottom Center of Header) ── */}
          <ellipse
            cx="800"
            cy="420"
            rx="640"
            ry="200"
            stroke="rgba(216, 255, 239, 0.35)"
            strokeWidth="1.5"
            fill="url(#header-globe-crest-glow)"
          />

          {/* Latitudes */}
          <ellipse cx="800" cy="420" rx="560" ry="165" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1" strokeDasharray="6 6" />
          <ellipse cx="800" cy="420" rx="460" ry="125" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1" strokeDasharray="5 5" />
          <ellipse cx="800" cy="420" rx="340" ry="85" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="1" strokeDasharray="4 4" />
          <ellipse cx="800" cy="420" rx="180" ry="40" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />

          {/* Meridians */}
          <path d="M 800 220 L 800 420" stroke="rgba(255, 255, 255, 0.22)" strokeWidth="1" strokeDasharray="5 5" />
          <path d="M 620 240 C 670 300, 690 360, 700 420" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1" strokeDasharray="5 5" />
          <path d="M 980 240 C 930 300, 910 360, 900 420" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1" strokeDasharray="5 5" />
          <path d="M 460 290 C 540 335, 570 380, 580 420" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" strokeDasharray="4 4" />
          <path d="M 1140 290 C 1060 335, 1030 380, 1020 420" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" strokeDasharray="4 4" />

          {/* Waypoints on Header Globe */}
          <circle cx="800" cy="220" r="4" fill="#ff9276" />
          <circle cx="800" cy="220" r="10" stroke="#ff9276" strokeWidth="1.5" className="globe-pin-pulse" />

          <circle cx="620" cy="240" r="3.5" fill="#67c4bd" />
          <circle cx="620" cy="240" r="8" stroke="#67c4bd" strokeWidth="1.2" className="globe-pin-pulse-delay-1" />

          <circle cx="980" cy="240" r="3.5" fill="#ffe0a9" />
          <circle cx="980" cy="240" r="8" stroke="#ffe0a9" strokeWidth="1.2" className="globe-pin-pulse-delay-2" />

          <circle cx="460" cy="290" r="3" fill="#ffffff" />
          <circle cx="460" cy="290" r="7" stroke="#ffffff" strokeWidth="1" className="globe-pin-pulse-delay-3" />

          <circle cx="1140" cy="290" r="3" fill="#ff9276" />
          <circle cx="1140" cy="290" r="7" stroke="#ff9276" strokeWidth="1" className="globe-pin-pulse-delay-1" />
        </svg>

        {/* Airplanes for Header Set */}
        {/* Header Plane 1: High Orbit (Left to Right) */}
        <div className="flight-plane-header-track header-track-1">
          <div className="flight-plane-wrapper plane-teal">
            <div className="plane-beacon beacon-cyan" />
            <Plane className="w-5 h-5 text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.8)] fill-white" />
          </div>
        </div>

        {/* Header Plane 2: Cross Orbit (Right to Left) */}
        <div className="flight-plane-header-track header-track-2">
          <div className="flight-plane-wrapper plane-coral">
            <div className="plane-beacon beacon-coral" />
            <Plane className="w-5 h-5 text-[#ff9276] drop-shadow-[0_2px_10px_rgba(255,146,118,0.9)] fill-[#ffe0a9]" />
          </div>
        </div>

        {/* Header Plane 3: Mid Orbit (Left to Right) */}
        <div className="flight-plane-header-track header-track-3">
          <div className="flight-plane-wrapper plane-gold">
            <div className="plane-beacon beacon-gold" />
            <Plane className="w-4 h-4 text-[#ffe0a9] drop-shadow-[0_2px_8px_rgba(255,224,169,0.7)] fill-white" />
          </div>
        </div>

        {/* Header Plane 4: Swift Low Orbit (Right to Left) */}
        <div className="flight-plane-header-track header-track-4">
          <div className="flight-plane-wrapper plane-mini">
            <Plane className="w-3.5 h-3.5 text-[#d8ffef] drop-shadow-[0_2px_6px_rgba(216,255,239,0.7)] fill-[#3ca89f]" />
          </div>
        </div>
      </div>
    );
  }

  // Default: Bottom Viewport Globe Set
  return (
    <div
      className={`globe-flight-container pointer-events-none fixed inset-0 overflow-hidden z-0 ${className}`}
      aria-hidden="true"
    >
      {/* ── Ambient Radial Atmosphere Glow ── */}
      <div className="globe-atmosphere-glow" />

      {/* ── SVG Flight Paths & Orbits Overlay ── */}
      <svg
        className="globe-svg-orbits absolute bottom-0 left-1/2 -translate-x-1/2 w-[1400px] h-[720px] max-w-none"
        viewBox="0 0 1400 720"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="orbit-grad-teal" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#126c78" stopOpacity="0.05" />
            <stop offset="30%" stopColor="#188c91" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#67c4bd" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#126c78" stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="orbit-grad-coral" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ff9276" stopOpacity="0.05" />
            <stop offset="35%" stopColor="#ff9276" stopOpacity="0.5" />
            <stop offset="65%" stopColor="#ffe0a9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff9276" stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="orbit-grad-cyan" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#3ca89f" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#48ada6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3ca89f" stopOpacity="0.05" />
          </linearGradient>

          <radialGradient id="globe-crest-glow" cx="50%" cy="0%" r="50%">
            <stop offset="0%" stopColor="#67c4bd" stopOpacity="0.35" />
            <stop offset="40%" stopColor="#188c91" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#126c78" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer & Inner Orbital Dashed Curves */}
        <path
          d="M 100 680 C 250 180, 1150 180, 1300 680"
          stroke="url(#orbit-grad-teal)"
          strokeWidth="1.8"
          strokeDasharray="8 8"
          className="orbit-path-anim-slow"
        />

        <path
          d="M 1250 620 C 1050 120, 350 240, 150 650"
          stroke="url(#orbit-grad-coral)"
          strokeWidth="1.8"
          strokeDasharray="6 7"
          className="orbit-path-anim-fast"
        />

        <path
          d="M 220 700 C 400 320, 1000 320, 1180 700"
          stroke="url(#orbit-grad-cyan)"
          strokeWidth="1.5"
          strokeDasharray="7 9"
        />

        <path
          d="M 320 710 C 460 410, 940 410, 1080 710"
          stroke="rgba(255, 255, 255, 0.22)"
          strokeWidth="1.2"
          strokeDasharray="4 6"
        />

        {/* Globe Hemisphere Structure (Bottom Center) */}
        <ellipse
          cx="700"
          cy="720"
          rx="520"
          ry="380"
          stroke="rgba(24, 140, 145, 0.45)"
          strokeWidth="2"
          fill="url(#globe-crest-glow)"
        />

        {/* Globe Latitudes */}
        <ellipse cx="700" cy="720" rx="460" ry="320" stroke="rgba(103, 196, 189, 0.22)" strokeWidth="1.2" strokeDasharray="6 6" />
        <ellipse cx="700" cy="720" rx="380" ry="240" stroke="rgba(103, 196, 189, 0.2)" strokeWidth="1.2" strokeDasharray="5 5" />
        <ellipse cx="700" cy="720" rx="280" ry="160" stroke="rgba(103, 196, 189, 0.18)" strokeWidth="1" strokeDasharray="4 4" />
        <ellipse cx="700" cy="720" rx="160" ry="90" stroke="rgba(103, 196, 189, 0.15)" strokeWidth="1" />

        {/* Globe Longitudes */}
        <path d="M 700 340 L 700 720" stroke="rgba(103, 196, 189, 0.28)" strokeWidth="1.2" strokeDasharray="5 5" />
        <path d="M 520 380 C 580 480, 600 620, 600 720" stroke="rgba(103, 196, 189, 0.2)" strokeWidth="1.2" strokeDasharray="5 5" />
        <path d="M 880 380 C 820 480, 800 620, 800 720" stroke="rgba(103, 196, 189, 0.2)" strokeWidth="1.2" strokeDasharray="5 5" />
        <path d="M 370 470 C 460 550, 490 650, 500 720" stroke="rgba(103, 196, 189, 0.16)" strokeWidth="1" strokeDasharray="4 4" />
        <path d="M 1030 470 C 940 550, 910 650, 900 720" stroke="rgba(103, 196, 189, 0.16)" strokeWidth="1" strokeDasharray="4 4" />

        {/* Waypoint Pulse Dots */}
        <circle cx="700" cy="340" r="4" fill="#ff9276" />
        <circle cx="700" cy="340" r="10" stroke="#ff9276" strokeWidth="1.5" className="globe-pin-pulse" />

        <circle cx="520" cy="380" r="3.5" fill="#67c4bd" />
        <circle cx="520" cy="380" r="8" stroke="#67c4bd" strokeWidth="1.2" className="globe-pin-pulse-delay-1" />

        <circle cx="880" cy="380" r="3.5" fill="#ffe0a9" />
        <circle cx="880" cy="380" r="8" stroke="#ffe0a9" strokeWidth="1.2" className="globe-pin-pulse-delay-2" />

        <circle cx="410" cy="480" r="3" fill="#3ca89f" />
        <circle cx="410" cy="480" r="7" stroke="#3ca89f" strokeWidth="1" className="globe-pin-pulse-delay-3" />

        <circle cx="990" cy="480" r="3" fill="#ff9276" />
        <circle cx="990" cy="480" r="7" stroke="#ff9276" strokeWidth="1" className="globe-pin-pulse-delay-1" />
      </svg>

      {/* Airplanes Flying Along Orbits */}
      <div className="flight-plane-track track-1">
        <div className="flight-plane-wrapper plane-teal">
          <div className="plane-beacon beacon-cyan" />
          <Plane className="w-5 h-5 text-[#126c78] drop-shadow-[0_2px_8px_rgba(24,140,145,0.6)] fill-white" />
        </div>
      </div>

      <div className="flight-plane-track track-2">
        <div className="flight-plane-wrapper plane-coral">
          <div className="plane-beacon beacon-coral" />
          <Plane className="w-5 h-5 text-[#ff9276] drop-shadow-[0_2px_8px_rgba(255,146,118,0.7)] fill-[#ffe0a9]" />
        </div>
      </div>

      <div className="flight-plane-track track-3">
        <div className="flight-plane-wrapper plane-gold">
          <div className="plane-beacon beacon-gold" />
          <Plane className="w-4 h-4 text-[#188c91] drop-shadow-[0_2px_6px_rgba(24,140,145,0.5)] fill-[#fff2db]" />
        </div>
      </div>

      <div className="flight-plane-track track-4">
        <div className="flight-plane-wrapper plane-mini">
          <Plane className="w-3.5 h-3.5 text-[#ff9276] drop-shadow-[0_2px_6px_rgba(255,146,118,0.5)] fill-white" />
        </div>
      </div>
    </div>
  );
};

export default GlobeFlightBackground;
