// Example usage of the smoothing algorithms
// This shows how to easily switch between B-spline and rolling average smoothing

// Import the functions (in actual usage, these would be imported from the TypeScript module)
const { applySmoothing, SmoothingMethod, applySmoothingToYTDData } = require('./src/components/dashboard/shared/splineSmoothing.ts');

// Example data - cumulative income over time
const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const y = [10, 12, 15, 18, 22, 25, 28, 30, 32, 33, 35];

// Example 1: Basic usage with different methods
console.log('=== Basic Smoothing Examples ===');

// B-spline smoothing (default)
const bSplineSmoothed = applySmoothing(x, y, 5, SmoothingMethod.B_SPLINE);
console.log('B-spline smoothed:', bSplineSmoothed);

// Rolling average smoothing
const rollingSmoothed = applySmoothing(x, y, 5, SmoothingMethod.ROLLING_AVERAGE);
console.log('Rolling average smoothed:', rollingSmoothed);

// Example 2: Using with YTD data objects
console.log('\n=== YTD Data Example ===');

const ytdData = [
  { date: '2024-01-01', cumulativeIncome: 100 },
  { date: '2024-02-01', cumulativeIncome: 250 },
  { date: '2024-03-01', cumulativeIncome: 400 },
  { date: '2024-04-01', cumulativeIncome: 580 },
  { date: '2024-05-01', cumulativeIncome: 750 },
  { date: '2024-06-01', cumulativeIncome: 920 },
  { date: '2024-07-01', cumulativeIncome: 1100 },
  { date: '2024-08-01', cumulativeIncome: 1250 },
  { date: '2024-09-01', cumulativeIncome: 1400 },
  { date: '2024-10-01', cumulativeIncome: 1550 },
  { date: '2024-11-01', cumulativeIncome: 1700 },
  { date: '2024-12-01', cumulativeIncome: 1850 }
];

// Apply B-spline smoothing
const bSplineYTD = applySmoothingToYTDData(ytdData, 3, SmoothingMethod.B_SPLINE);
console.log('B-spline YTD data (first 3 points):', bSplineYTD.slice(0, 3));

// Apply rolling average smoothing
const rollingYTD = applySmoothingToYTDData(ytdData, 3, SmoothingMethod.ROLLING_AVERAGE);
console.log('Rolling average YTD data (first 3 points):', rollingYTD.slice(0, 3));

// Example 3: Comparing different smoothing factors
console.log('\n=== Comparing Smoothing Factors ===');

[0, 3, 6, 9].forEach(factor => {
  const bSplineResult = applySmoothing(x, y, factor, SmoothingMethod.B_SPLINE);
  const rollingResult = applySmoothing(x, y, factor, SmoothingMethod.ROLLING_AVERAGE);

  console.log(`Factor ${factor}: B-spline[${bSplineResult[5].toFixed(1)}] Rolling[${rollingResult[5].toFixed(1)}]`);
});

console.log('\n=== Configuration Options ===');
console.log('To switch between methods in your application:');
console.log('1. Import: import { applySmoothing, SmoothingMethod } from "./splineSmoothing"');
console.log('2. Use B-spline: applySmoothing(data, values, factor, SmoothingMethod.B_SPLINE)');
console.log('3. Use Rolling Average: applySmoothing(data, values, factor, SmoothingMethod.ROLLING_AVERAGE)');
console.log('4. Default is B_SPLINE for backward compatibility');

console.log('\nBoth methods preserve endpoints and use the same smoothingFactor parameter (0-10).');
console.log('- Factor 0: No smoothing (returns original data)');
console.log('- Factor 10: Maximum smoothing');
console.log('- Rolling average uses adaptive window sizes');
console.log('- B-spline uses adaptive control point subsampling');
