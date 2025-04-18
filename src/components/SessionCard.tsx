import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Timestamp, collection, getDocs } from 'firebase/firestore';
import MapView, { Polyline } from 'react-native-maps';
import { db } from '../services/firebaseConfig';

// Re-use Session interface (Consider moving to a shared types file later)
interface GeoPoint {
    latitude: number;
    longitude: number;
}
interface Session {
  id: string; // Ensure ID is always present for fetching subcollection
  userId: string;
  location: string;
  sessionDate: Timestamp;
  waveCount: number;
  duration: number; // Field name updated here too
  longestWave?: number;
  maxSpeed?: number;
  startLatitude: number;
  startLongitude: number;
}

// Define colors (could also import from a central constants file)
const colors = {
  primaryBlue: '#1A73E8',
  primaryBlueRGBA: 'rgba(26, 115, 232, 0.7)', // Added for polyline
  secondaryBlue: '#0056B3',
  lightBlue: '#4AB1FF',
  mapBackground: '#eef2f7', // Slightly lighter map background
  mapIcon: '#60a5fa', // Slightly darker blue for map icons
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  white: '#ffffff',
  pathAqua: '#00C8C8',
  pathAquaRGBA: 'rgba(0, 200, 200, 0.8)',
  markerAqua: '#00A0A0',
};

// Helper to format duration (seconds to HH:MM:SS or MM:SS)
const formatDuration = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  let formatted = '';
  if (h > 0) formatted += `${h}h `;
  if (m > 0 || h === 0) formatted += `${m}m`; // Show minutes if hours > 0 or if hours === 0
  return formatted.trim();
};

// Helper to format Timestamp into Date and Time Range
const formatDateAndTime = (timestamp: Timestamp): { date: string; timeRange: string } => {
  if (!timestamp) return { date: '', timeRange: '' };
  const dateObj = timestamp.toDate();
  const dateOptions: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };

  // Assuming totalDuration gives a rough end time for placeholder purposes
  // In reality, you'd store session start and end times
  // We'll just show the start time for now as per original data
  const startTime = dateObj.toLocaleTimeString('en-US', timeOptions);

  return {
    date: dateObj.toLocaleDateString('en-US', dateOptions),
    timeRange: startTime, // Placeholder: just showing start time
    // timeRange: `${startTime} - ${endTime}`, // Need endTime later
  };
};

// Simple Path Smoothing Function
const smoothPath = (path: GeoPoint[], windowSize: number = 3): GeoPoint[] => {
  if (!path || path.length < windowSize) return path;
  const smoothed: GeoPoint[] = [path[0]];
  const halfWindow = Math.floor(windowSize / 2);
  for (let i = 1; i < path.length - 1; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(path.length - 1, i + halfWindow);
    let sumLat = 0, sumLon = 0, count = 0;
    for (let j = start; j <= end; j++) {
      sumLat += path[j].latitude; sumLon += path[j].longitude; count++;
    }
    smoothed.push(count > 0 ? { latitude: sumLat / count, longitude: sumLon / count } : path[i]);
  }
  smoothed.push(path[path.length - 1]);
  return smoothed;
};

interface SessionCardProps {
  session: Session;
  onPress: () => void;
}

const SessionCard = ({ session, onPress }: SessionCardProps) => {
  const { date, timeRange } = formatDateAndTime(session.sessionDate);
  const durationFormatted = formatDuration(session.duration);
  const mapViewRef = useRef<MapView>(null);
  const [rawCoordinates, setRawCoordinates] = useState<GeoPoint[]>([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Effect to fetch wave coordinates
  useEffect(() => {
    const fetchCoords = async () => {
      if (!session.id) return;
      setMapLoading(true);
      // Don't reset mapReady here, let onMapReady control it
      try {
        const wavesQuery = collection(db, 'sessions', session.id, 'waves');
        const querySnapshot = await getDocs(wavesQuery);
        const allCoords: GeoPoint[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.coordinates && Array.isArray(data.coordinates)) {
            allCoords.push(...data.coordinates);
          }
        });
        setRawCoordinates(allCoords);
      } catch (error) {
        console.error(`Error fetching coords for session ${session.id}:`, error);
        setRawCoordinates([]);
      } finally {
        setMapLoading(false);
      }
    };

    fetchCoords();
  }, [session.id]);

  // Memoize the smoothed coordinates
  const smoothedWaveCoordinates = useMemo(() => {
      return smoothPath(rawCoordinates);
  }, [rawCoordinates]);

  // Callback for when the map component signals it's ready
  const handleMapReady = useCallback(() => {
    setMapReady(true);
    // Attempt to fit coordinates *only when map is ready AND coordinates are available*
    if (!mapLoading && smoothedWaveCoordinates.length > 1 && mapViewRef.current) {
      // Use setTimeout to ensure layout is complete after map ready signal
      setTimeout(() => {
          mapViewRef.current?.fitToCoordinates(smoothedWaveCoordinates, {
              edgePadding: { top: 15, right: 15, bottom: 15, left: 15 },
              animated: false, // No animation needed for card preview
          });
      }, 100); // Short delay
    }
  // Add dependencies: re-run if loading state changes or coords update *after* map is ready
  }, [mapLoading, smoothedWaveCoordinates]);

  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.8}>
      {/* Left Side - Gradient */}
      <LinearGradient
        colors={[colors.primaryBlue, colors.secondaryBlue]}
        style={styles.leftSide}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.locationText}>{session.location || 'Unknown Location'}</Text>
        <Text style={styles.dateTimeText}>{date}</Text>
        <Text style={styles.dateTimeText}>{timeRange}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Waves</Text>
            <Text style={styles.statValue}>{session.waveCount || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{durationFormatted}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Right Side - Map Preview */}
      <View style={styles.rightSide}>
         <MapView
            // key prop might not be needed here if we handle updates correctly
            ref={mapViewRef}
            style={styles.mapPreview}
            mapType="satellite"
            onMapReady={handleMapReady} // Use the callback
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            showsUserLocation={false}
            showsMyLocationButton={false}
            // Set initial region to prevent showing the whole world initially
            initialRegion={{
                latitude: session.startLatitude ?? 0,
                longitude: session.startLongitude ?? 0,
                latitudeDelta: 0.01, // Reasonable initial zoom
                longitudeDelta: 0.01,
            }}
         >
            {/* Render polyline only when map is ready and coords exist */}
            {mapReady && !mapLoading && smoothedWaveCoordinates.length > 1 && (
                <Polyline
                    coordinates={smoothedWaveCoordinates}
                    strokeColor={colors.pathAquaRGBA}
                    strokeWidth={2}
                    zIndex={2}
                />
            )}
         </MapView>

         {/* Blending Gradient Overlay */}
         <LinearGradient
            colors={['rgba(26, 115, 232, 0.3)', 'transparent']}
            style={styles.blendingGradient}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.8, y: 0.5 }}
            pointerEvents="none"
         />

         {/* Loading / No Data Indicator */}
         {mapLoading ? (
             <View style={styles.mapOverlayContainer}>
                 <ActivityIndicator size="small" color={colors.primaryBlue} />
             </View>
         ) : (
            // Show indicator if not loading but no coords found
            mapReady && rawCoordinates.length <= 1 && (
                <View style={styles.mapOverlayContainer}>
                    <Ionicons name="map-outline" size={20} color={colors.textSecondary} />
                    {/* Optional: Text("No path data") */}
                </View>
            )
         )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.white,
    marginVertical: 10,
    marginHorizontal: 15,
    minHeight: 140,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  leftSide: {
    flex: 2,
    padding: 15,
    justifyContent: 'space-between',
  },
  rightSide: {
    flex: 3,
    backgroundColor: colors.mapBackground,
    position: 'relative',
    overflow: 'hidden',
  },
  locationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 5,
  },
  dateTimeText: {
    fontSize: 13,
    color: colors.white,
    opacity: 0.9,
    marginBottom: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  statItem: {
    marginRight: 20,
  },
  statLabel: {
    fontSize: 12,
    color: colors.white,
    opacity: 0.8,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
  },
  mapPreview: {
      ...StyleSheet.absoluteFillObject,
  },
  blendingGradient: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1,
  },
  mapOverlayContainer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(238, 242, 247, 0.7)', // Slightly more opaque overlay
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 3,
  },
  mapIcon: {
       // Removed as MapView is used now
  },
  noDataText: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 2,
  }
});

export default SessionCard; 