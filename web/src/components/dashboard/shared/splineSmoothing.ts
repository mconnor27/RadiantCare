// Spline and Rolling Average Smoothing Algorithms
import { logger } from '../../../lib/logger'
// Test function to verify smoothing algorithms work correctly
export function testSmoothingAlgorithms() {
  // Create test data with known endpoints
  const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const y = [10, 12, 15, 18, 22, 25, 28, 30, 32, 33, 35];

  logger.debug('DATA_TRANSFORM', 'Original data:');
  logger.debug('DATA_TRANSFORM', 'x:', x);
  logger.debug('DATA_TRANSFORM', 'y:', y);

  // Test with different smoothing factors (0-10 range) - now uses full linear range
  const smoothingFactors = [0, 2, 4, 6, 8, 10];

  smoothingFactors.forEach(factor => {
    logger.debug('DATA_TRANSFORM', `\n=== Smoothing factor ${factor} ===`);

    // Test B-spline smoothing
    const bSplineSmoothed = applySmoothing(x, y, factor, SmoothingMethod.B_SPLINE);
    const testN = x.length;
    const minControlPoints = 2; // degree 1 + 1
    const maxControlPoints = testN;
    const reductionPercent = factor / 10;
    const reduction = Math.floor(reductionPercent * (maxControlPoints - minControlPoints));
    const controlPointCount = Math.max(minControlPoints, maxControlPoints - reduction);
    logger.debug('DATA_TRANSFORM', `B-spline smoothed (${controlPointCount} control points):`, bSplineSmoothed);
    logger.debug('DATA_TRANSFORM', 'B-spline endpoints preserved', {
      startPreserved: Math.abs(bSplineSmoothed[0] - y[0]) < 0.01,
      endPreserved: Math.abs(bSplineSmoothed[bSplineSmoothed.length - 1] - y[y.length - 1]) < 0.01
    });

    // Test rolling average smoothing
    const rollingSmoothed = applySmoothing(x, y, factor, SmoothingMethod.ROLLING_AVERAGE);
    logger.debug('DATA_TRANSFORM', 'Rolling average smoothed:', rollingSmoothed);
    logger.debug('DATA_TRANSFORM', 'Rolling average endpoints preserved', {
      startPreserved: Math.abs(rollingSmoothed[0] - y[0]) < 0.01,
      endPreserved: Math.abs(rollingSmoothed[rollingSmoothed.length - 1] - y[y.length - 1]) < 0.01
    });

    // Test improved rolling average smoothing (scales based on dataset size)
    const improvedRolled = applySmoothing(x, y, factor, SmoothingMethod.IMPROVED_ROLLING_AVERAGE);
    const testDataLength = x.length;
    const baseEffectiveRange = 6; // Increased for more aggressive smoothing
    const datasetScalingFactor = 365 / testDataLength;
    const maxEffectiveSmoothing = baseEffectiveRange * datasetScalingFactor;
    const effectiveFactor = (factor / 100) * maxEffectiveSmoothing;
    logger.debug('DATA_TRANSFORM', `Improved rolling average (display: ${factor}, dataset: ${testDataLength} pts, max effective: ${maxEffectiveSmoothing.toFixed(1)}, effective: ${effectiveFactor.toFixed(1)}):`, improvedRolled);
    logger.debug('DATA_TRANSFORM', 'Improved rolling average endpoints preserved', {
      startPreserved: Math.abs(improvedRolled[0] - y[0]) < 0.01,
      endPreserved: Math.abs(improvedRolled[improvedRolled.length - 1] - y[y.length - 1]) < 0.01
    });


    // Compare the methods
    const diffRolling = bSplineSmoothed.map((val, i) => Math.abs(val - rollingSmoothed[i]));
    const avgDiffRolling = diffRolling.reduce((a, b) => a + b, 0) / diffRolling.length;
    logger.debug('DATA_TRANSFORM', 'Average difference B-spline vs Rolling:', avgDiffRolling.toFixed(3));

    const diffImproved = bSplineSmoothed.map((val, i) => Math.abs(val - improvedRolled[i]));
    const avgDiffImproved = diffImproved.reduce((a, b) => a + b, 0) / diffImproved.length;
    logger.debug('DATA_TRANSFORM', 'Average difference B-spline vs Improved Rolling:', avgDiffImproved.toFixed(3));
  });

  return true;
}

// Legacy function name for backward compatibility
export function testSplineSmoothing() {
  return testSmoothingAlgorithms();
}

/**
 * Creates a clamped knot vector for B-spline interpolation.
 * The knot vector repeats the first and last knots (degree + 1) times
 * to ensure the curve passes through the first and last control points.
 *
 * @param numPoints - Number of control points
 * @param degree - Polynomial degree of the spline (typically 3 for cubic)
 * @returns Array of knot values
 */
function createClampedKnotVector(numPoints: number, degree: number): number[] {
  const n = numPoints - 1; // Number of intervals
  const knots: number[] = [];

  // Repeat first knot (degree + 1) times with value 0
  for (let i = 0; i <= degree; i++) {
    knots.push(0);
  }

  // Calculate number of internal knots
  const internalKnots = n - degree;

  // Add internal knots evenly spaced between 0 and 1
  for (let i = 1; i <= internalKnots; i++) {
    knots.push(i / (internalKnots + 1));
  }

  // Repeat last knot (degree + 1) times with value 1
  for (let i = 0; i <= degree; i++) {
    knots.push(1);
  }

  return knots;
}

/**
 * Cox-de Boor recursion formula for B-spline basis functions.
 * This is the recursive definition that defines B-spline basis functions.
 *
 * @param i - Basis function index
 * @param p - Degree of the basis function
 * @param t - Parameter value in [0, 1]
 * @param knots - Knot vector array
 * @returns Basis function value
 */
function basisFunction(i: number, p: number, t: number, knots: number[]): number {
  // Base case: degree 0
  if (p === 0) {
    return (knots[i] <= t && t < knots[i + 1]) ? 1 : 0;
  }

  // Recursive case
  let term1 = 0;
  let term2 = 0;

  const denom1 = knots[i + p] - knots[i];
  const denom2 = knots[i + p + 1] - knots[i + 1];

  if (denom1 > 0) {
    term1 = ((t - knots[i]) / denom1) * basisFunction(i, p - 1, t, knots);
  }

  if (denom2 > 0) {
    term2 = ((knots[i + p + 1] - t) / denom2) * basisFunction(i + 1, p - 1, t, knots);
  }

  return term1 + term2;
}

/**
 * Evaluates a B-spline curve at a given parameter t.
 *
 * @param t - Parameter value in [0, 1]
 * @param degree - Polynomial degree
 * @param points - Array of control points [[x0, y0], [x1, y1], ...]
 * @param knots - Knot vector
 * @returns [x, y] coordinates on the spline
 */
function evaluateBSpline(t: number, degree: number, points: number[][], knots: number[]): number[] {
  // Clamp t to [0, 1] range
  let clampedT = Math.max(0, Math.min(1, t));

  // Handle edge case: if t = 1, set t = 1 - epsilon to avoid boundary issues
  if (clampedT === 1) {
    clampedT = 1 - 1e-10;
  }

  const numPoints = points.length;
  let x = 0;
  let y = 0;

  // Sum contributions from all basis functions
  for (let i = 0; i < numPoints; i++) {
    const basis = basisFunction(i, degree, clampedT, knots);
    x += basis * points[i][0];
    y += basis * points[i][1];
  }

  return [x, y];
}

/**
 * Applies B-spline smoothing to data using De Boor's algorithm with adaptive control point subsampling.
 * The smoothingFactor controls how many control points to use (higher = fewer points = more smoothing).
 *
 * @param x - X coordinates (e.g., time indices or date positions)
 * @param y - Y coordinates (e.g., income values to smooth)
 * @param degree - B-spline degree (fixed at 1 for linear)
 * @param smoothingFactor - Controls control point density (0 = all points, 10 = minimal points) with linear 10% steps
 * @returns Smoothed y values
 */
function applyBSplineSmoothing(x: number[], y: number[], degree: number, smoothingFactor: number): number[] {
  const n = x.length;

  // Need at least (degree + 1) points for meaningful B-spline
  if (n < degree + 1) {
    return y.slice();
  }

  // Calculate number of control points based on smoothing factor with linear integer mapping
  // Each integer step (0-10) reduces control points by a fixed percentage
  const minControlPoints = Math.max(degree + 4, n/15);
  const maxControlPoints = n;

  // Linear mapping: each integer step reduces control points by 10%
  // Factor 0: 0% reduction (all points)
  // Factor 1: 10% reduction
  // Factor 2: 20% reduction
  // ...
  // Factor 10: 100% reduction (minimum points)
  const reductionPercent = smoothingFactor / 10; // 0 to 1
  const reduction = Math.floor(reductionPercent * (maxControlPoints - minControlPoints));
  const controlPointCount = Math.max(minControlPoints, maxControlPoints - reduction);

  // Create subsampled control points
  const controlPoints: number[][] = [];
  if (controlPointCount === n) {
    // Use all points
    for (let i = 0; i < n; i++) {
      controlPoints.push([x[i], y[i]]);
    }
  } else {
    // Subsample points evenly
    const step = (n - 1) / (controlPointCount - 1);
    for (let i = 0; i < controlPointCount; i++) {
      const index = Math.round(i * step);
      controlPoints.push([x[index], y[index]]);
    }
  }

  // Generate clamped knot vector for the control points
  const knots = createClampedKnotVector(controlPointCount, degree);

  // Sample the B-spline at the original x positions
  const smoothed = new Array(n);
  const maxX = Math.max(...x);

  for (let i = 0; i < n; i++) {
    // Normalize x[i] to [0, 1] parameter space
    const t = x[i] / maxX;

    // Handle the t=1 edge case
    let clampedT = t;
    if (clampedT === 1) {
      clampedT = 1 - 1e-10;
    }

    const [_, smoothedY] = evaluateBSpline(clampedT, 1, controlPoints, knots);
    smoothed[i] = smoothedY;
  }

  return smoothed;
}

/**
 * Apply B-spline smoothing to data based on smoothing factor.
 * Smoothing factor of 0 means no smoothing, 10 means maximum smoothing.
 * Uses clamped cubic B-splines (degree 3) with adaptive control point subsampling.
 *
 * @param x - X coordinates (indices or positions)
 * @param y - Y coordinates (values to smooth)
 * @param smoothingFactor - Smoothing intensity from 0 to 10 (controls control point density)
 * @returns Smoothed y values with endpoints preserved
 */
/**
 * Apply improved rolling average smoothing with better endpoint handling.
 * Uses adaptive window sizing and smooth transitions to eliminate endpoint jumps.
 *
 * @param y - Y coordinates (values to smooth)
 * @param smoothingFactor - Effective window size factor (scaled based on dataset size from applySmoothing)
 * @returns Smoothed y values with smooth endpoint transitions
 */
function applyImprovedRollingAverageSmoothing(
  y: number[],
  smoothingFactor: number
): number[] {
  const n = y.length;

  // No smoothing for factor 0 or insufficient data
  if (smoothingFactor <= 0 || n < 3) {
    return y.slice();
  }

  // Calculate base window size based on effective smoothing factor (already scaled for dataset size)
  const baseWindowSize = Math.max(3, Math.min(n - 1, Math.floor((smoothingFactor / 12) * (n / 2))));
  const smoothed = new Array(n);

  // Preserve endpoints exactly
  smoothed[0] = y[0];
  smoothed[n - 1] = y[n - 1];

  // Apply rolling average to middle points with adaptive window sizing
  for (let i = 1; i < n - 1; i++) {
    // Adaptive window size - smaller near endpoints to prevent pulling away
    const distanceFromStart = i;
    const distanceFromEnd = n - 1 - i;
    const minDistance = Math.min(distanceFromStart, distanceFromEnd);

    // Window size grows with distance from endpoints, but caps at a reasonable size
    const adaptiveFactor = Math.min(minDistance / (n / 4), 1);
    const windowSize = Math.max(3, Math.floor(baseWindowSize * (0.2 + 0.8 * adaptiveFactor)));

    const halfWindow = Math.floor(windowSize / 2);
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(n - 1, i + halfWindow);

    let sum = 0;
    let totalWeight = 0;

    for (let j = start; j <= end; j++) {
      // Distance-based gaussian weighting
      const distanceFromCenter = Math.abs(j - i);
      const sigma = halfWindow * 10; // Standard deviation for gaussian
      const gaussianWeight = Math.exp(-(distanceFromCenter * distanceFromCenter) / (2 * sigma * sigma));

      // Extra weight for points near the current position
      let proximityWeight = 1;
      if (distanceFromCenter === 0) {
        proximityWeight = 2; // Center point gets double weight
      } else if (distanceFromCenter <= 1) {
        proximityWeight = 1.5; // Adjacent points get 1.5x weight
      }

      // For points very close to start or end, reduce weight of the preserved endpoints
      // to prevent abrupt jumps
      let endpointReduction = 1;
      if (i <= 3 && j === 0) { // First few points near start
        const proximityToStart = i; // How close are we to the start?
        endpointReduction = Math.max(0.1, 1 - (proximityToStart / 3) * 0.8);
      } else if (i >= n - 4 && j === n - 1) { // Last few points near end
        const proximityToEnd = n - 1 - i; // How close are we to the end?
        endpointReduction = Math.max(0.1, 1 - (proximityToEnd / 3) * 0.8);
      }

      const weight = gaussianWeight * proximityWeight * endpointReduction;
      sum += y[j] * weight;
      totalWeight += weight;
    }

    smoothed[i] = sum / totalWeight;
  }

  return smoothed;
}

/**
 * Apply original rolling average smoothing (for comparison)
 */
function applyOriginalRollingAverageSmoothing(
  y: number[],
  smoothingFactor: number
): number[] {
  const n = y.length;

  // No smoothing for factor 0 or insufficient data
  if (smoothingFactor <= 0 || n < 3) {
    return y.slice();
  }

  // Calculate window size based on smoothing factor
  const windowSize = Math.max(1, Math.min(n - 1, Math.floor((smoothingFactor / 10) * (n / 2))));
  const smoothed = new Array(n);

  // Preserve endpoints
  smoothed[0] = y[0];
  smoothed[n - 1] = y[n - 1];

  // Apply rolling average to middle points
  for (let i = 1; i < n - 1; i++) {
    const halfWindow = Math.floor(windowSize / 2);
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(n - 1, i + halfWindow);

    let sum = 0;
    let count = 0;

    for (let j = start; j <= end; j++) {
      let weight = 1;
      if (j === 0 || j === n - 1) {
        weight = 2;
      } else if (j === start || j === end) {
        weight = 1.5;
      }

      sum += y[j] * weight;
      count += weight;
    }

    smoothed[i] = sum / count;
  }

  return smoothed;
}






/**
 * Smoothing method enumeration for easy configuration
 */
export enum SmoothingMethod {
  B_SPLINE = 'b_spline',
  ROLLING_AVERAGE = 'rolling_average',
  IMPROVED_ROLLING_AVERAGE = 'improved_rolling_average'
}

/**
 * Apply smoothing to data using the specified method.
 * Both methods preserve endpoints and use the same smoothingFactor parameter.
 *
 * @param x - X coordinates (indices or positions)
 * @param y - Y coordinates (values to smooth)
 * @param smoothingFactor - Smoothing intensity from 0 to 10
 * @param method - Smoothing algorithm to use (default: B_SPLINE)
 * @returns Smoothed y values with endpoints preserved
 */
export function applySmoothing(
  x: number[],
  y: number[],
  smoothingFactor: number,
  method: SmoothingMethod = SmoothingMethod.B_SPLINE
): number[] {
  // No smoothing for factor 0 or insufficient data
  if (smoothingFactor <= 0 || y.length < 3) {
    return y.slice();
  }

  // Validate inputs
  if (x.length !== y.length) {
    logger.error('DATA_TRANSFORM', 'Smoothing error: x and y arrays must have the same length.');
    return y.slice();
  }

  switch (method) {
    case SmoothingMethod.ROLLING_AVERAGE:
      return applyOriginalRollingAverageSmoothing(y, smoothingFactor);
    case SmoothingMethod.IMPROVED_ROLLING_AVERAGE:
      // For improved rolling average, scale based on dataset size
      // Larger datasets need less aggressive smoothing, smaller datasets need more
      const n = y.length;
      const baseEffectiveRange = 30; // Increased base range for more aggressive smoothing
      const datasetScalingFactor = 365 / n; // Scale factor based on dataset size
      const maxEffectiveSmoothing = baseEffectiveRange * datasetScalingFactor;
      const effectiveSmoothing = (smoothingFactor / 100) * maxEffectiveSmoothing;
      return applyImprovedRollingAverageSmoothing(y, effectiveSmoothing);
    case SmoothingMethod.B_SPLINE:
    default:
      return applyBSplineSmoothing(x, y, 1, smoothingFactor);
  }
}

/**
 * Legacy function for backward compatibility - uses B-spline smoothing
 */
export function applySplineSmoothing(
  x: number[],
  y: number[],
  smoothingFactor: number
): number[] {
  return applySmoothing(x, y, smoothingFactor, SmoothingMethod.B_SPLINE);
}

/**
 * Apply smoothing to YTDPoint data arrays.
 * This is a convenience function for the common case of smoothing cumulative income data.
 *
 * @param data - Array of objects with cumulative income and date information
 * @param smoothingFactor - Smoothing intensity from 0 to 10
 * @param method - Smoothing algorithm to use (default: B_SPLINE)
 * @returns New array with smoothed cumulative income values
 */
export function applySmoothingToYTDData<T extends { cumulativeIncome: number }>(
  data: T[],
  smoothingFactor: number,
  method: SmoothingMethod = SmoothingMethod.B_SPLINE
): T[] {
  if (smoothingFactor <= 0 || data.length < 3) {
    return data;
  }

  // Extract y values (cumulative income)
  const y = data.map(d => d.cumulativeIncome);

  // Create simple x indices
  const x = data.map((_, i) => i);

  // Apply smoothing
  const smoothedY = applySmoothing(x, y, smoothingFactor, method);

  // Return new array with smoothed values
  return data.map((item, i) => ({
    ...item,
    cumulativeIncome: smoothedY[i]
  }));
}
