import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface MapQRCodeProps {
  value: string;
  size?: number;
}

/**
 * Renders a QR code as an SVG for a Google Maps URL.
 * If the value is empty or QR generation fails, renders nothing.
 */
const MapQRCode: React.FC<MapQRCodeProps> = ({ value, size = 36 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgMarkup, setSvgMarkup] = useState<string>("");

  useEffect(() => {
    if (!value) {
      setSvgMarkup("");
      return;
    }

    QRCode.toString(value, {
      type: "svg",
      width: size,
      margin: 0,
      color: {
        dark: "#334155",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((svg) => {
        setSvgMarkup(svg);
      })
      .catch(() => {
        setSvgMarkup("");
      });
  }, [value, size]);

  if (!value || !svgMarkup) return null;

  return (
    <div
      ref={containerRef}
      className="activity-card-qr"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
      title="Scan to open in Google Maps"
    />
  );
};

export default MapQRCode;
