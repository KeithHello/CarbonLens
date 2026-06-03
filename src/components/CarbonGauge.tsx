"use client";

import { useEffect, useState } from "react";

interface CarbonGaugeProps {
  /** 0-100 percentile to point the needle at */
  percentile: number;
  /** Label shown below the percentage (for example, "Global rank"). */
  label: string;
  /** Diameter in px, default 200 */
  size?: number;
}

const ARC_RADIUS = 80; // inner radius for the arc
const GRADIENT_STOPS = [
  { offset: 0, color: "#2E7D32" },
  { offset: 25, color: "#66BB6A" },
  { offset: 50, color: "#FFA726" },
  { offset: 75, color: "#EF5350" },
  { offset: 100, color: "#1B1B1B" },
];

/** Arc is drawn from -90deg (left) to +90deg (right) = 180° total. */
function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M",
    start.x,
    start.y,
    "A",
    r,
    r,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

export default function CarbonGauge({
  percentile,
  label,
  size = 200,
}: CarbonGaugeProps) {
  const clampedPercentile = Math.min(99, Math.max(1, percentile));
  // Map percentile to angle: 1%→-90°, 50%→0°, 99%→90°
  const needleAngle = (clampedPercentile / 100) * 180 - 90;
  const [animAngle, setAnimAngle] = useState<number>(-90);

  useEffect(() => {
    // Trigger animation on mount
    const raf = requestAnimationFrame(() => setAnimAngle(needleAngle));
    return () => cancelAnimationFrame(raf);
  }, [needleAngle]);

  const padding = 20;
  const viewSize = size + padding * 2;
  const cx = viewSize / 2;
  const cy = size; // center bottom
  const thick = 20;

  // Build gradient arc segments
  const arcSegments = [
    { start: -90, end: -45, color: "#2E7D32" },
    { start: -45, end: 0, color: "#66BB6A" },
    { start: 0, end: 45, color: "#FFA726" },
    { start: 45, end: 90, color: "#EF5350" },
    { start: 90, end: 90, color: "#1B1B1B" }, // this one is covered, just show the extreme tip
  ];

  // Build inner colored segments on the arc
  const innerR = ARC_RADIUS - thick;
  const outerR = ARC_RADIUS;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        width={size}
        height={size * 0.6}
        className="overflow-visible"
        role="img"
        aria-label={`${label}: Top ${clampedPercentile}%`}
      >
        {/* Background arc */}
        <path
          d={describeArc(cx, cy, outerR, -90, 90)}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={thick}
          strokeLinecap="round"
        />

        {/* Colored segments */}
        {[
          { start: -90, end: -46, color: "#2E7D32" },
          { start: -45, end: -1, color: "#66BB6A" },
          { start: 0, end: 45, color: "#FFA726" },
          { start: 45, end: 90, color: "#EF5350" },
        ].map((seg) => (
          <path
            key={`${seg.start}-${seg.end}`}
            d={describeArc(cx, cy, outerR, seg.start, seg.end)}
            fill="none"
            stroke={seg.color}
            strokeWidth={thick}
            strokeLinecap="butt"
          />
        ))}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + innerR * Math.cos(((animAngle + 90) * Math.PI) / 180)}
          y2={cy - innerR * Math.sin(((animAngle + 90) * Math.PI) / 180)}
          stroke="#1F2937"
          strokeWidth={3}
          strokeLinecap="round"
          style={{ transition: "transform 0.8s ease-out" }}
          transform={`rotate(${animAngle - needleAngle}, ${cx}, ${cy})`}
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={6} fill="#1F2937" />

        {/* Percentage text */}
        <text
          x={cx}
          y={cy - 35}
          textAnchor="middle"
          className="fill-gray-900 font-extrabold"
          fontSize={28}
        >
          Top {clampedPercentile}%
        </text>

        {/* Label text */}
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          className="fill-gray-500"
          fontSize={12}
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
