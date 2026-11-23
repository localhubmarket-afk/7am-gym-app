/**
 * Visual Plate Loader Engine (Dyscalculia Support — 100% Free Beta Access)
 *
 * Calculates exact barbell plates per side from a target total weight and bar weight
 * (standard 45 lb Olympic bar by default) and produces color-coded visual specs and
 * accessible inline SVG markup so lifters never have to do mental math on the gym floor.
 */

export type PlateUnit = 'lbs' | 'kg';

export interface PlateVisualSpec {
  weight: number;
  unit: PlateUnit;
  label: string;
  colorName: string;
  fillHex: string;
  strokeHex: string;
  textHex: string;
  heightPx: number;
  widthPx: number;
}

export interface VisualPlateLoadCalculation {
  targetWeight: number;
  barWeight: number;
  unit: PlateUnit;
  totalPlatesWeight: number;
  perSideWeight: number;
  platesPerSide: PlateVisualSpec[];
  remainderPerSide: number;
  isEmptyBar: boolean;
  isBelowBar: boolean;
  perSideSummary: string;
  accessibleDescription: string;
}

export const STANDARD_BAR_WEIGHT_LBS = 45;
export const STANDARD_BAR_WEIGHT_KG = 20;

export const LBS_PLATE_PALETTE: Record<
  number,
  { colorName: string; fillHex: string; strokeHex: string; textHex: string; heightPx: number; widthPx: number }
> = {
  45: { colorName: 'Blue', fillHex: '#2563EB', strokeHex: '#93C5FD', textHex: '#FFFFFF', heightPx: 66, widthPx: 22 },
  35: { colorName: 'Amber', fillHex: '#D97706', strokeHex: '#FDE68A', textHex: '#FFFFFF', heightPx: 58, widthPx: 20 },
  25: { colorName: 'Green', fillHex: '#16A34A', strokeHex: '#86EFAC', textHex: '#FFFFFF', heightPx: 52, widthPx: 19 },
  10: { colorName: 'White', fillHex: '#E2E8F0', strokeHex: '#64748B', textHex: '#0A1128', heightPx: 42, widthPx: 16 },
  5: { colorName: 'Red', fillHex: '#DC2626', strokeHex: '#FCA5A5', textHex: '#FFFFFF', heightPx: 34, widthPx: 15 },
  2.5: { colorName: 'Purple', fillHex: '#9333EA', strokeHex: '#D8B4FE', textHex: '#FFFFFF', heightPx: 28, widthPx: 14 },
  1.25: { colorName: 'Teal', fillHex: '#0D9488', strokeHex: '#99F6E4', textHex: '#FFFFFF', heightPx: 24, widthPx: 13 }
};

export const KG_PLATE_PALETTE: Record<
  number,
  { colorName: string; fillHex: string; strokeHex: string; textHex: string; heightPx: number; widthPx: number }
> = {
  25: { colorName: 'Red', fillHex: '#DC2626', strokeHex: '#FCA5A5', textHex: '#FFFFFF', heightPx: 66, widthPx: 22 },
  20: { colorName: 'Blue', fillHex: '#2563EB', strokeHex: '#93C5FD', textHex: '#FFFFFF', heightPx: 62, widthPx: 20 },
  15: { colorName: 'Amber', fillHex: '#D97706', strokeHex: '#FDE68A', textHex: '#FFFFFF', heightPx: 56, widthPx: 19 },
  10: { colorName: 'Green', fillHex: '#16A34A', strokeHex: '#86EFAC', textHex: '#FFFFFF', heightPx: 48, widthPx: 17 },
  5: { colorName: 'White', fillHex: '#E2E8F0', strokeHex: '#64748B', textHex: '#0A1128', heightPx: 38, widthPx: 15 },
  2.5: { colorName: 'Purple', fillHex: '#9333EA', strokeHex: '#D8B4FE', textHex: '#FFFFFF', heightPx: 30, widthPx: 14 },
  1.25: { colorName: 'Teal', fillHex: '#0D9488', strokeHex: '#99F6E4', textHex: '#FFFFFF', heightPx: 24, widthPx: 13 }
};

/**
 * Standard plate inventory:
 * - lbs: 45, 25, 10, 5, 2.5 (standard commercial gym set, avoids odd 35s unless explicitly enabled)
 * - kg: 25, 20, 15, 10, 5, 2.5, 1.25
 */
export const DEFAULT_LBS_PLATES: readonly number[] = [45, 25, 10, 5, 2.5];
export const DEFAULT_KG_PLATES: readonly number[] = [25, 20, 15, 10, 5, 2.5, 1.25];

export function calculateVisualBarbellPlates(
  targetWeight: number,
  options?: {
    barWeight?: number;
    unit?: PlateUnit;
    availablePlates?: readonly number[];
  }
): VisualPlateLoadCalculation {
  const unit: PlateUnit = options?.unit === 'kg' ? 'kg' : 'lbs';
  const defaultBar = unit === 'kg' ? STANDARD_BAR_WEIGHT_KG : STANDARD_BAR_WEIGHT_LBS;
  const barWeight =
    typeof options?.barWeight === 'number' && Number.isFinite(options.barWeight) && options.barWeight >= 0
      ? options.barWeight
      : defaultBar;

  const cleanTarget = Number.isFinite(targetWeight) ? Math.max(0, +Number(targetWeight).toFixed(2)) : barWeight;
  const isBelowBar = cleanTarget < barWeight;
  const effectiveWeight = Math.max(barWeight, cleanTarget);
  const totalPlatesWeight = Math.max(0, +(effectiveWeight - barWeight).toFixed(2));
  const perSideWeight = Math.max(0, +(totalPlatesWeight / 2).toFixed(2));

  const inventory =
    options?.availablePlates && options.availablePlates.length > 0
      ? [...options.availablePlates].sort((a, b) => b - a)
      : unit === 'kg'
        ? [...DEFAULT_KG_PLATES]
        : [...DEFAULT_LBS_PLATES];

  const palette = unit === 'kg' ? KG_PLATE_PALETTE : LBS_PLATE_PALETTE;
  const platesPerSide: PlateVisualSpec[] = [];
  let remaining = perSideWeight;

  for (const plateWeight of inventory) {
    if (plateWeight <= 0) continue;
    while (remaining >= plateWeight - 0.01) {
      const style = palette[plateWeight] || {
        colorName: 'Slate',
        fillHex: '#475569',
        strokeHex: '#CBD5E1',
        textHex: '#FFFFFF',
        heightPx: 30,
        widthPx: 14
      };
      platesPerSide.push({
        weight: plateWeight,
        unit,
        label: String(plateWeight),
        ...style
      });
      remaining = +(remaining - plateWeight).toFixed(2);
    }
  }

  const remainderPerSide = remaining >= 0.05 ? +remaining.toFixed(2) : 0;
  const isEmptyBar = platesPerSide.length === 0 && remainderPerSide === 0;

  const perSideSummary = isEmptyBar
    ? `Empty ${barWeight} ${unit} bar (no plates needed)`
    : `${platesPerSide.map((p) => `${p.weight}`).join(' + ')}${remainderPerSide > 0 ? ` + ${remainderPerSide}` : ''} ${unit} per side`;

  const accessibleDescription = isEmptyBar
    ? `Load empty ${barWeight} ${unit} barbell for ${effectiveWeight} ${unit} total.`
    : `For ${effectiveWeight} ${unit} total on a ${barWeight} ${unit} bar, load each side with: ${platesPerSide
        .map((p) => `${p.weight} ${unit} ${p.colorName} plate`)
        .join(', ')}${remainderPerSide > 0 ? `, plus ${remainderPerSide} ${unit} micro-plate` : ''}.`;

  return {
    targetWeight: effectiveWeight,
    barWeight,
    unit,
    totalPlatesWeight,
    perSideWeight,
    platesPerSide,
    remainderPerSide,
    isEmptyBar,
    isBelowBar,
    perSideSummary,
    accessibleDescription
  };
}

/**
 * Generates accessible, color-coded SVG markup representing one side of the barbell
 * (or symmetric double-sided barbell view) for inline gym-floor rendering.
 * Note: Uses relative `rem` typography so zero absolute `px` font-size rules exist.
 */
export function buildVisualPlateLoaderSvgHtml(
  targetWeight: number,
  options?: {
    barWeight?: number;
    unit?: PlateUnit;
    availablePlates?: readonly number[];
  }
): string {
  const calc = calculateVisualBarbellPlates(targetWeight, options);
  const svgWidth = 320;
  const svgHeight = 104;
  const centerY = 44;
  const leftSleeveStart = 128;
  const rightSleeveStart = 192;
  const gap = 3;

  // Build right-side plates (inner to outer) and mirrored left-side plates
  let rightCursor = rightSleeveStart + 6;
  const rightRects: string[] = [];
  const leftRects: string[] = [];
  let leftCursor = leftSleeveStart - 6;

  calc.platesPerSide.slice(0, 7).forEach((plate) => {
    const y = centerY - plate.heightPx / 2;
    const rx = 3;

    // Right plate
    const rxPos = rightCursor;
    rightRects.push(
      `<rect x="${rxPos}" y="${y}" width="${plate.widthPx}" height="${plate.heightPx}" rx="${rx}" fill="${plate.fillHex}" stroke="${plate.strokeHex}" stroke-width="1.5" />` +
        `<text x="${rxPos + plate.widthPx / 2}" y="${centerY + 3}" text-anchor="middle" fill="${plate.textHex}" style="font-size: 0.5625rem; font-weight: 800;">${plate.label}</text>`
    );
    rightCursor += plate.widthPx + gap;

    // Mirrored left plate
    const lxPos = leftCursor - plate.widthPx;
    leftRects.push(
      `<rect x="${lxPos}" y="${y}" width="${plate.widthPx}" height="${plate.heightPx}" rx="${rx}" fill="${plate.fillHex}" stroke="${plate.strokeHex}" stroke-width="1.5" />` +
        `<text x="${lxPos + plate.widthPx / 2}" y="${centerY + 3}" text-anchor="middle" fill="${plate.textHex}" style="font-size: 0.5625rem; font-weight: 800;">${plate.label}</text>`
    );
    leftCursor -= plate.widthPx + gap;
  });

  const legendItems = calc.isEmptyBar
    ? `<span class="text-xs font-bold text-slate-300">Empty ${calc.barWeight} ${calc.unit} bar — 0 plates per side</span>`
    : calc.platesPerSide
        .map(
          (p) =>
            `<span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-extrabold" style="border-color: ${p.strokeHex}; background-color: ${p.fillHex}; color: ${p.textHex};">${p.weight} ${calc.unit} (${p.colorName})</span>`
        )
        .join('');

  return `
    <div class="visual-plate-loader-box rounded-xl border border-slate-700 bg-slate-950/95 p-2.5 space-y-2" data-visual-plate-loader="true" data-target-weight="${calc.targetWeight}" data-bar-weight="${calc.barWeight}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-extrabold text-sky-300">Visual Plate Loader (${calc.barWeight} ${calc.unit} Bar)</span>
        <span class="text-xs font-extrabold text-white tabular-nums">${calc.perSideSummary}</span>
      </div>
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="${calc.accessibleDescription.replace(/"/g, '&quot;')}" class="w-full h-auto block max-w-[30rem] mx-auto">
        <!-- Barbell Shaft -->
        <rect x="14" y="${centerY - 4}" width="${svgWidth - 28}" height="8" rx="4" fill="#94A3B8" />
        <!-- Center Knurling Shaft -->
        <rect x="${leftSleeveStart}" y="${centerY - 5}" width="${rightSleeveStart - leftSleeveStart}" height="10" rx="2" fill="#475569" stroke="#CBD5E1" stroke-width="1" />
        <text x="${svgWidth / 2}" y="${centerY + 3}" text-anchor="middle" fill="#F8FAFC" style="font-size: 0.625rem; font-weight: 800;">${calc.barWeight}${calc.unit}</text>
        <!-- Inner Collars -->
        <rect x="${leftSleeveStart - 5}" y="${centerY - 11}" width="5" height="22" rx="1.5" fill="#CBD5E1" />
        <rect x="${rightSleeveStart}" y="${centerY - 11}" width="5" height="22" rx="1.5" fill="#CBD5E1" />
        <!-- Left & Right Color-Coded Plates -->
        ${leftRects.join('')}
        ${rightRects.join('')}
        <!-- Total Readout Label -->
        <text x="${svgWidth / 2}" y="97" text-anchor="middle" fill="#CBD5E1" style="font-size: 0.625rem; font-weight: 700;">Each side: ${calc.perSideWeight} ${calc.unit} • Total: ${calc.targetWeight} ${calc.unit}</text>
      </svg>
      <div class="flex flex-wrap items-center gap-1.5" aria-label="Color-coded plates per side">
        ${legendItems}
        ${calc.remainderPerSide > 0 ? `<span class="text-xs font-bold text-amber-300">+${calc.remainderPerSide} ${calc.unit} micro</span>` : ''}
      </div>
    </div>
  `.trim();
}
