// Simple test script for smoothing algorithms
const fs = require('fs');
const path = require('path');

// Read the TypeScript file and extract the smoothing functions for testing
const tsFile = fs.readFileSync('./src/components/dashboard/shared/splineSmoothing.ts', 'utf8');

// Simple JavaScript version for testing
function applyRollingAverageSmoothing(y, smoothingFactor) {
  const n = y.length;

  if (smoothingFactor <= 0 || n < 3) {
    return y.slice();
  }

  const windowSize = Math.max(1, Math.min(n - 1, Math.floor((smoothingFactor / 10) * (n / 2))));
  const smoothed = new Array(n);

  smoothed[0] = y[0];
  smoothed[n - 1] = y[n - 1];

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

// Test data
const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const y = [10, 12, 15, 18, 22, 25, 28, 30, 32, 33, 35];

console.log('Original data:');
console.log('x:', x);
console.log('y:', y);

const smoothingFactors = [0, 3, 6, 9];

smoothingFactors.forEach(factor => {
  console.log(`\n=== Smoothing factor ${factor} ===`);

  const rollingSmoothed = applyRollingAverageSmoothing(y, factor);
  console.log('Rolling average smoothed:', rollingSmoothed);
  console.log('Endpoints preserved:', Math.abs(rollingSmoothed[0] - y[0]) < 0.01, Math.abs(rollingSmoothed[rollingSmoothed.length - 1] - y[y.length - 1]) < 0.01);
});
