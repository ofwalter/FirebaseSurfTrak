// Conversion Factors
const KPH_TO_MPH = 0.621371;
const METERS_TO_FEET = 3.28084;

// --- Conversion Functions ---

export const kphToMph = (kph: number): number => {
  return kph * KPH_TO_MPH;
};

export const mphToKph = (mph: number): number => {
  return mph / KPH_TO_MPH;
};

export const metersToFeet = (meters: number): number => {
  return meters * METERS_TO_FEET;
};

export const feetToMeters = (feet: number): number => {
  return feet / METERS_TO_FEET;
};

// --- Formatting Functions ---

// Type alias from UnitContext (adjust path if needed)
// Consider defining this globally if used in many places
type UnitSystem = 'metric' | 'imperial';

/**
 * Formats a speed value (assumed to be in KPH initially)
 * according to the selected unit system.
 */
export const formatSpeed = (speedKph: number | undefined, unitSystem: UnitSystem, precision: number = 1): string => {
  if (speedKph === undefined || isNaN(speedKph)) return '-';

  if (unitSystem === 'imperial') {
    const speedMph = kphToMph(speedKph);
    return `${speedMph.toFixed(precision)} mph`;
  } else {
    // Metric system
    return `${speedKph.toFixed(precision)} kph`;
  }
};

/**
 * Formats a distance value (assumed to be in Meters initially)
 * according to the selected unit system.
 */
export const formatDistance = (distanceMeters: number | undefined, unitSystem: UnitSystem, precision: number = 0): string => {
  if (distanceMeters === undefined || isNaN(distanceMeters)) return '-';

  if (unitSystem === 'imperial') {
    const distanceFeet = metersToFeet(distanceMeters);
    return `${distanceFeet.toFixed(precision)} ft`;
  } else {
    // Metric system
    return `${distanceMeters.toFixed(precision)} m`;
  }
};

/**
 * Formats a duration value (in seconds) into a readable string.
 * (This doesn't depend on the unit system, but good to have here).
 */
export const formatDuration = (seconds: number | undefined): string => {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return '0 sec';
  // Simple formatting for now, can be enhanced later (e.g., HH:MM:SS)
  return `${Math.round(seconds)} sec`;
};

// Add other formatters as needed (e.g., formatTemperature)
