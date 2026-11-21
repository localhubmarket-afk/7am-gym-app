import * as d3 from 'd3';
import {
  ONE_RM_LIFT_CONFIGS,
  extractOneRmProgressionSeries,
  formatOneRmTooltipText,
  type OneRmChartPoint,
  type OneRmLiftKey
} from './utils/workoutLogic';

export interface RenderOneRmD3ChartOptions {
  container: HTMLElement;
  tooltipReadoutEl?: HTMLElement | null;
  liftKey: OneRmLiftKey;
  workoutLogs: Record<string, any>;
  exerciseHistory?: Record<string, any[]>;
  unit?: 'lbs' | 'kg';
}

export function renderOneRmD3Chart(options: RenderOneRmD3ChartOptions): {
  rendered: boolean;
  pointCount: number;
  activeTooltipText: string;
} {
  const { container, tooltipReadoutEl, liftKey, workoutLogs, exerciseHistory, unit = 'lbs' } = options;
  if (!container) {
    return { rendered: false, pointCount: 0, activeTooltipText: '' };
  }

  const liftCfg = ONE_RM_LIFT_CONFIGS[liftKey] || ONE_RM_LIFT_CONFIGS.bench;
  const points: OneRmChartPoint[] = extractOneRmProgressionSeries(
    liftCfg.key,
    workoutLogs,
    exerciseHistory,
    new Date()
  );

  // Strict mobile scroll protection: never trap vertical scroll over the chart
  container.style.touchAction = 'pan-y';
  container.style.background = 'transparent';
  container.style.position = 'relative';

  d3.select(container).selectAll('*').remove();

  if (points.length === 0) {
    d3.select(container)
      .append('div')
      .attr('class', 'rounded-xl border border-slate-800 px-3 py-5 text-center text-xs text-slate-300')
      .style('background', 'transparent')
      .style('letter-spacing', '0.02em')
      .style('line-height', '1.5')
      .text(`Log a set of ${liftCfg.fullName} to see your strength line here.`);
    if (tooltipReadoutEl) {
      tooltipReadoutEl.textContent = `No ${liftCfg.pillLabel} sets logged yet.`;
    }
    return { rendered: false, pointCount: 0, activeTooltipText: '' };
  }

  const width = 336;
  const height = 186;
  const margin = { top: 34, right: 18, bottom: 30, left: 42 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const displayVal = (pt: OneRmChartPoint): number =>
    unit === 'kg' ? Math.round(pt.oneRmLbs / 2.20462) : Math.round(pt.oneRmLbs);

  const values = points.map(displayVal);
  const rawMin = d3.min(values) ?? 0;
  const rawMax = d3.max(values) ?? 100;
  const pad = Math.max(8, Math.round((rawMax - rawMin) * 0.25));
  const yMin = Math.max(0, Math.floor((rawMin - pad) / 5) * 5);
  const yMax = Math.ceil((rawMax + pad) / 5) * 5;

  const xScale = d3
    .scalePoint<number>()
    .domain(points.map((_p, i) => i))
    .range([0, innerW])
    .padding(0.18);

  const yScale = d3.scaleLinear().domain([yMin, Math.max(yMin + 10, yMax)]).range([innerH, 0]).nice(4);

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', `${liftCfg.fullName} 1-Rep Max progression chart`)
    .attr('data-onerm-chart-svg', liftCfg.key)
    .style('width', '100%')
    .style('height', 'auto')
    .style('display', 'block')
    .style('background', 'transparent')
    .style('touch-action', 'pan-y')
    .style('overflow', 'visible')
    .style('font-family', 'system-ui, -apple-system, sans-serif')
    .style('letter-spacing', '0.02em');

  // Subtle soft gradient under the curve
  const gradId = `onerm-area-grad-${liftCfg.key}`;
  const defs = svg.append('defs');
  const grad = defs
    .append('linearGradient')
    .attr('id', gradId)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', liftCfg.strokeColor).attr('stop-opacity', 0.2);
  grad.append('stop').attr('offset', '100%').attr('stop-color', liftCfg.strokeColor).attr('stop-opacity', 0.0);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // 3 or 4 very faint horizontal gridlines ONLY (zero vertical gridlines)
  const yTicks = yScale.ticks(4).slice(0, 4);
  g.append('g')
    .attr('class', 'd3-onerm-h-grid')
    .selectAll('line')
    .data(yTicks)
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', (d) => yScale(d))
    .attr('y2', (d) => yScale(d))
    .attr('stroke', 'rgba(255,255,255,0.1)')
    .attr('stroke-width', 1);

  // Clean Y-axis labels
  g.append('g')
    .attr('class', 'd3-onerm-y-labels')
    .selectAll('text')
    .data(yTicks)
    .enter()
    .append('text')
    .attr('x', -8)
    .attr('y', (d) => yScale(d))
    .attr('dy', '0.32em')
    .attr('text-anchor', 'end')
    .attr('fill', '#94a3b8')
    .style('font-size', '10px')
    .style('font-weight', '600')
    .style('letter-spacing', '0.02em')
    .text((d) => `${d}`);

  // Clean X-axis labels (show up to 4 evenly spaced dates to avoid crowding)
  const labelIndices = new Set<number>([0, points.length - 1]);
  if (points.length >= 4) {
    labelIndices.add(Math.floor((points.length - 1) / 3));
    labelIndices.add(Math.floor(((points.length - 1) * 2) / 3));
  } else if (points.length === 3) {
    labelIndices.add(1);
  }

  g.append('g')
    .attr('class', 'd3-onerm-x-labels')
    .selectAll('text')
    .data(points.map((pt, i) => ({ pt, i })).filter((d) => labelIndices.has(d.i)))
    .enter()
    .append('text')
    .attr('x', (d) => xScale(d.i) ?? 0)
    .attr('y', innerH + 20)
    .attr('text-anchor', 'middle')
    .attr('fill', '#cbd5e1')
    .style('font-size', '10px')
    .style('font-weight', '700')
    .style('letter-spacing', '0.02em')
    .text((d) => d.pt.dateLabel);

  // Area under the smooth curve
  const areaGen = d3
    .area<OneRmChartPoint>()
    .x((_d, i) => xScale(i) ?? 0)
    .y0(innerH)
    .y1((d) => yScale(displayVal(d)))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('fill', `url(#${gradId})`)
    .attr('d', areaGen);

  // Main thick smooth line (stroke-width: 3px)
  const lineGen = d3
    .line<OneRmChartPoint>()
    .x((_d, i) => xScale(i) ?? 0)
    .y((d) => yScale(displayVal(d)))
    .curve(d3.curveMonotoneX);

  g.append('path')
    .datum(points)
    .attr('class', 'd3-onerm-line-path')
    .attr('fill', 'none')
    .attr('stroke', liftCfg.strokeColor)
    .attr('stroke-width', 3)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .attr('d', lineGen);

  // Active point highlight ring
  const activeRing = g
    .append('circle')
    .attr('class', 'd3-onerm-active-ring')
    .attr('r', 8)
    .attr('fill', liftCfg.strokeColor)
    .attr('fill-opacity', 0.25)
    .attr('stroke', liftCfg.strokeColor)
    .attr('stroke-width', 1.5);

  // Visible data dots
  const dots = g
    .selectAll('circle.d3-onerm-dot')
    .data(points)
    .enter()
    .append('circle')
    .attr('class', 'd3-onerm-dot')
    .attr('data-onerm-point-idx', (_d, i) => String(i))
    .attr('cx', (_d, i) => xScale(i) ?? 0)
    .attr('cy', (d) => yScale(displayVal(d)))
    .attr('r', 4.5)
    .attr('fill', liftCfg.strokeColor)
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 2);

  // Floating ELI12 SVG Tooltip pill (clamped inside chart width so it never clips)
  const tooltipGroup = g.append('g').attr('class', 'd3-onerm-tooltip-group').style('pointer-events', 'none');
  const tooltipRect = tooltipGroup
    .append('rect')
    .attr('rx', 8)
    .attr('ry', 8)
    .attr('height', 24)
    .attr('fill', '#1e293b')
    .attr('stroke', liftCfg.strokeColor)
    .attr('stroke-width', 1.25);

  const tooltipTextEl = tooltipGroup
    .append('text')
    .attr('class', 'd3-onerm-tooltip-text')
    .attr('fill', '#f8fafc')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .style('font-size', '11px')
    .style('font-weight', '800')
    .style('font-family', 'system-ui, -apple-system, sans-serif')
    .style('letter-spacing', '0.02em');

  let activeIdx = points.length - 1;
  let lastTooltipLabel = '';

  function selectPoint(idx: number): void {
    const safeIdx = Math.max(0, Math.min(points.length - 1, idx));
    activeIdx = safeIdx;
    const pt = points[safeIdx];
    const cx = xScale(safeIdx) ?? 0;
    const cy = yScale(displayVal(pt));
    lastTooltipLabel = formatOneRmTooltipText(pt, unit);

    activeRing.attr('cx', cx).attr('cy', cy);
    dots.attr('r', (_d, i) => (i === safeIdx ? 5.5 : 4));

    tooltipTextEl.text(lastTooltipLabel);
    const estW = Math.max(96, lastTooltipLabel.length * 7.2 + 18);
    const clampedX = Math.max(estW / 2, Math.min(innerW - estW / 2, cx));
    const tipY = Math.max(-28, cy - 34);

    tooltipRect.attr('x', clampedX - estW / 2).attr('y', tipY).attr('width', estW);
    tooltipTextEl.attr('x', clampedX).attr('y', tipY + 12);

    if (tooltipReadoutEl) {
      tooltipReadoutEl.textContent = lastTooltipLabel;
    }
  }

  // Large invisible mobile tap targets for each point
  g.selectAll('circle.d3-onerm-hit')
    .data(points)
    .enter()
    .append('circle')
    .attr('class', 'd3-onerm-hit')
    .attr('data-onerm-hit-idx', (_d, i) => String(i))
    .attr('cx', (_d, i) => xScale(i) ?? 0)
    .attr('cy', (d) => yScale(displayVal(d)))
    .attr('r', 16)
    .attr('fill', 'transparent')
    .style('cursor', 'pointer')
    .style('touch-action', 'pan-y')
    .on('click', (_event, d) => {
      const idx = points.indexOf(d);
      if (idx >= 0) selectPoint(idx);
    });

  // Horizontal-only drag scrubbing (vertical swipes pass through natively via touch-action: pan-y)
  let pointerStartX: number | null = null;
  let pointerStartY: number | null = null;

  function findNearestIndexByClientX(clientX: number): number {
    const svgNode = svg.node();
    if (!svgNode) return activeIdx;
    const rect = svgNode.getBoundingClientRect();
    if (!rect || rect.width <= 0) return activeIdx;
    const svgX = ((clientX - rect.left) / rect.width) * width - margin.left;
    let bestIdx = 0;
    let bestDist = Infinity;
    points.forEach((_p, i) => {
      const px = xScale(i) ?? 0;
      const dist = Math.abs(px - svgX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });
    return bestIdx;
  }

  svg
    .on('pointerdown', (event: PointerEvent) => {
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      selectPoint(findNearestIndexByClientX(event.clientX));
    })
    .on('pointermove', (event: PointerEvent) => {
      if (pointerStartX === null || pointerStartY === null) return;
      if (event.buttons === 0 && event.pointerType === 'mouse') return;
      const dx = Math.abs(event.clientX - pointerStartX);
      const dy = Math.abs(event.clientY - pointerStartY);
      // Only scrub tooltip when horizontal movement exceeds vertical movement
      if (dx > dy && dx > 4) {
        selectPoint(findNearestIndexByClientX(event.clientX));
      }
    })
    .on('pointerup', () => {
      pointerStartX = null;
      pointerStartY = null;
    })
    .on('pointercancel', () => {
      pointerStartX = null;
      pointerStartY = null;
    });

  // Default active point is the latest data point
  selectPoint(points.length - 1);

  return {
    rendered: true,
    pointCount: points.length,
    activeTooltipText: lastTooltipLabel
  };
}

// Expose cleanly to the single-file app script in index.html
declare global {
  interface Window {
    d3?: typeof d3;
    renderOneRmD3Chart?: typeof renderOneRmD3Chart;
    extractOneRmProgressionSeries?: typeof extractOneRmProgressionSeries;
    ONE_RM_LIFT_CONFIGS?: typeof ONE_RM_LIFT_CONFIGS;
  }
}

if (typeof window !== 'undefined') {
  window.d3 = d3;
  window.renderOneRmD3Chart = renderOneRmD3Chart;
  window.extractOneRmProgressionSeries = extractOneRmProgressionSeries;
  window.ONE_RM_LIFT_CONFIGS = ONE_RM_LIFT_CONFIGS;
  window.dispatchEvent(new CustomEvent('d3-onerm-bridge-ready'));
}
