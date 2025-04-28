import { Timestamp } from 'firebase/firestore';

// Represents a single point tracked during a wave
export interface GeoPoint {
  latitude: number;
  longitude: number;
  timestamp: Timestamp; // Timestamp for this specific point
  speed?: number; // Speed at this point (e.g., in mph), optional for now
}

// Represents a single wave surfed within a session
export interface Wave {
  id?: string; // Firestore document ID
  startTime: Timestamp; // Timestamp when the wave tracking started
  endTime: Timestamp; // Timestamp when the wave tracking ended
  duration: number; // Calculated duration in seconds
  topSpeed: number; // Maximum speed recorded during the wave (mph)
  averageSpeed: number; // Average speed during the wave (mph)
  coordinates: GeoPoint[]; // Array of detailed points for the wave path
  distance?: number; // Optional: Calculated total distance of the wave in meters
}

// Represents a surf session
export interface Session {
  id: string; // Firestore document ID (required for subcollection fetching)
  userId: string;
  location: string;
  sessionDate: Timestamp;
  waveCount: number;
  duration: number; // Total session duration in seconds
  longestWave?: number; // Duration of the longest wave in seconds
  maxSpeed?: number; // Highest speed achieved across all waves in the session (mph)
  startLatitude: number; // Initial latitude when session started
  startLongitude: number; // Initial longitude when session started
  // Add any other relevant session-level fields if needed
} 