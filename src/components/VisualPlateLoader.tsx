import React, { useMemo } from 'react';
import {
  STANDARD_BAR_WEIGHT_KG,
  STANDARD_BAR_WEIGHT_LBS,
  calculateVisualBarbellPlates,
  type PlateUnit
} from '../utils/plateLoader';

export interface VisualPlateLoaderProps {
  /** Target total weight (bar + both sides of plates) */
  targetWeight: number;
  /** Standard bar weight (defaults to 45 lbs or 20 kg) */
  barWeight?: number;
  /** Weight unit (defaults to 'lbs') */
  unit?: PlateUnit;
  /** Optional custom plate inventory per side */
  availablePlates?: readonly number[];
  /** Optional exercise label for screen readers */
  exerciseName?: string;
  className?: string;
}

/**
 * Inline Visual Plate Loader (Dyscalculia Support — 100% Free Beta Access)
 *
 * Eliminates gym-floor mental math by translating a target weight on a standard
 * 45 lb barbell into a proportional, color-coded SVG diagram (Blue 45s, Green 25s,
 * White 10s, Red 5s, Purple 2.5s) with explicit text labels for color-blind clarity.
 */
export const VisualPlateLoader: React.FC<VisualPlateLoaderProps> = ({
  targetWeight,
  barWeight,
  unit = 'lbs',
  availablePlates,
  exerciseName,
  className = ''
}) => {
  const resolvedBarWeight =
    typeof barWeight === 'number'
      ? barWeight
      : unit === 'kg'
        ? STANDARD_BAR_WEIGHT_KG
        : STANDARD_BAR_WEIGHT_LBS;

  const calculation = useMemo(
    () =>
      calculateVisualBarbellPlates(targetWeight, {
        barWeight: resolvedBarWeight,
        unit,
        availablePlates
      }),
    [targetWeight, resolvedBarWeight, unit, availablePlates]
  );

  const svgWidth = 320;
  const svgHeight = 104;
  const centerY = 44;
  const leftSleeveStart = 128;
  const rightSleeveStart = 192;
  const plateGap = 3;

  const positionedPlates = useMemo(() => {
    let rightX = rightSleeveStart + 6;
    let leftX = leftSleeveStart - 6;

    return calculation.platesPerSide.slice(0, 7).map((plate, index) => {
      const currentRightX = rightX;
      rightX += plate.widthPx + plateGap;

      const currentLeftX = leftX - plate.widthPx;
      leftX -= plate.widthPx + plateGap;

      return {
        key: `${plate.weight}-${index}`,
        plate,
        y: centerY - plate.heightPx / 2,
        rightX: currentRightX,
        leftX: currentLeftX
      };
    });
  }, [calculation.platesPerSide]);

  const ariaSummary = exerciseName
    ? `${exerciseName}: ${calculation.accessibleDescription}`
    : calculation.accessibleDescription;

  return (
    <section
      aria-label={`Visual Plate Loader for ${calculation.targetWeight} ${calculation.unit}`}
      data-testid="visual-plate-loader"
      data-target-weight={calculation.targetWeight}
      data-bar-weight={calculation.barWeight}
      className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] p-3 space-y-2.5 text-[var(--text-primary)] ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold leading-relaxed text-sky-400">
          Visual Plate Loader ({calculation.barWeight} {calculation.unit} Bar)
        </span>
        <span
          data-testid="visual-plate-summary"
          className="text-xs font-extrabold tabular-nums text-[var(--text-primary)]"
        >
          {calculation.perSideSummary}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        role="img"
        aria-label={ariaSummary}
        className="block h-auto w-full max-w-[30rem] mx-auto"
      >
        {/* Main Olympic Barbell Shaft */}
        <rect
          x={14}
          y={centerY - 4}
          width={svgWidth - 28}
          height={8}
          rx={4}
          fill="#94A3B8"
        />

        {/* Center Bar Label Section */}
        <rect
          x={leftSleeveStart}
          y={centerY - 5}
          width={rightSleeveStart - leftSleeveStart}
          height={10}
          rx={2}
          fill="#475569"
          stroke="#CBD5E1"
          strokeWidth={1}
        />
        <text
          x={svgWidth / 2}
          y={centerY + 3}
          textAnchor="middle"
          fill="#F8FAFC"
          className="text-[0.625rem] font-extrabold"
        >
          {calculation.barWeight}
          {calculation.unit}
        </text>

        {/* Inner Sleeve Collars */}
        <rect x={leftSleeveStart - 5} y={centerY - 11} width={5} height={22} rx={1.5} fill="#CBD5E1" />
        <rect x={rightSleeveStart} y={centerY - 11} width={5} height={22} rx={1.5} fill="#CBD5E1" />

        {/* Mirrored Left & Right Color-Coded Plates */}
        {positionedPlates.map(({ key, plate, y, leftX, rightX }) => (
          <g key={key}>
            <rect
              x={leftX}
              y={y}
              width={plate.widthPx}
              height={plate.heightPx}
              rx={3}
              fill={plate.fillHex}
              stroke={plate.strokeHex}
              strokeWidth={1.5}
            />
            <text
              x={leftX + plate.widthPx / 2}
              y={centerY + 3}
              textAnchor="middle"
              fill={plate.textHex}
              className="text-[0.5625rem] font-extrabold"
            >
              {plate.label}
            </text>

            <rect
              x={rightX}
              y={y}
              width={plate.widthPx}
              height={plate.heightPx}
              rx={3}
              fill={plate.fillHex}
              stroke={plate.strokeHex}
              strokeWidth={1.5}
            />
            <text
              x={rightX + plate.widthPx / 2}
              y={centerY + 3}
              textAnchor="middle"
              fill={plate.textHex}
              className="text-[0.5625rem] font-extrabold"
            >
              {plate.label}
            </text>
          </g>
        ))}

        {/* Bottom Plain-English Total Summary */}
        <text
          x={svgWidth / 2}
          y={97}
          textAnchor="middle"
          fill="#CBD5E1"
          className="text-[0.625rem] font-bold"
        >
          Each side: {calculation.perSideWeight} {calculation.unit} · Total: {calculation.targetWeight}{' '}
          {calculation.unit}
        </text>
      </svg>

      {/* Color-Blind Safe Text + Color Plate List */}
      <div className="flex flex-wrap items-center gap-2" aria-label="Plates to load on each side">
        {calculation.isEmptyBar ? (
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            Empty {calculation.barWeight} {calculation.unit} bar — 0 plates per side.
          </span>
        ) : (
          calculation.platesPerSide.map((plate, idx) => (
            <span
              key={`${plate.weight}-badge-${idx}`}
              className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-extrabold tabular-nums"
              style={{
                borderColor: plate.strokeHex,
                backgroundColor: plate.fillHex,
                color: plate.textHex
              }}
            >
              {plate.weight} {calculation.unit} ({plate.colorName})
            </span>
          ))
        )}
        {calculation.remainderPerSide > 0 && (
          <span className="text-xs font-bold text-amber-300">
            +{calculation.remainderPerSide} {calculation.unit} micro-plate
          </span>
        )}
      </div>
    </section>
  );
};

export default VisualPlateLoader;
