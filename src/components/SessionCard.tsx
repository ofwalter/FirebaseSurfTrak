import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Timestamp, collection, getDocs } from 'firebase/firestore';
import MapView, { Polyline } from 'react-native-maps';
import { db } from '../services/firebaseConfig';
import { BlurView } from 'expo-blur';

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

// Define colors (adjust as needed)
const colors = {
  primaryBlue: '#1A73E8',
  primaryBlueRGBA: 'rgba(26, 115, 232, 0.7)',
  secondaryBlue: '#0056B3',
  lightBlue: '#4AB1FF',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  white: '#ffffff',
  pathAqua: '#00C8C8',
  pathAquaRGBA: 'rgba(0, 200, 200, 0.9)',
  cardBackground: 'rgba(255, 255, 255, 0.7)',
  textOnDark: '#f0f4f8',
  textOnDarkSecondary: '#cbd5e1',
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
              edgePadding: { top: 40, right: 40, bottom: 70, left: 40 },
              animated: false,
          });
      }, 150); // Slightly longer delay might help
    }
  // Add dependencies: re-run if loading state changes or coords update *after* map is ready
  }, [mapLoading, smoothedWaveCoordinates]);

  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.85}>
      {/* Background Map */}
      <MapView
         ref={mapViewRef}
         style={styles.mapBackground}
         mapType="satellite"
         onMapReady={handleMapReady}
         scrollEnabled={false}
         zoomEnabled={false}
         pitchEnabled={false}
         rotateEnabled={false}
         showsPointsOfInterest={false}
         initialRegion={{
             latitude: session.startLatitude ?? 0,
             longitude: session.startLongitude ?? 0,
             latitudeDelta: 0.015, // Default zoom
             longitudeDelta: 0.015,
         }}
         customMapStyle={[{ "featureType": "all", "stylers": [{ "saturation": -50 }, { "lightness": -10 }] }]}
      >
         {mapReady && !mapLoading && smoothedWaveCoordinates.length > 1 && (
             <Polyline
                 coordinates={smoothedWaveCoordinates}
                 strokeColor={colors.pathAquaRGBA}
                 strokeWidth={3}
                 zIndex={1}
             />
         )}
      </MapView>

      {/* Map Loading Indicator */}
      {mapLoading && (
          <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator size="small" color={colors.white} />
          </View>
      )}

      {/* Content Overlay with Blur */}
      <BlurView intensity={70} tint="dark" style={styles.contentOverlay}>
          <View style={styles.textContainer}>
             <Text style={styles.locationText} numberOfLines={1}>{session.location || 'Unknown Location'}</Text>
             <Text style={styles.dateTimeText}>{date} • {timeRange}</Text>
          </View>
          <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                  <Ionicons name="water-outline" size={16} color={colors.textOnDarkSecondary} />
                  <Text style={styles.statValue}>{session.waveCount || 0}</Text>
                  <Text style={styles.statLabel}>Waves</Text>
              </View>
              <View style={styles.statSeparator} />
              <View style={styles.statItem}>
                   <Ionicons name="stopwatch-outline" size={16} color={colors.textOnDarkSecondary} />
                   <Text style={styles.statValue}>{durationFormatted}</Text>
                   <Text style={styles.statLabel}>Time</Text>
              </View>
              {session.maxSpeed !== undefined && (
                 <>
                     <View style={styles.statSeparator} />
                     <View style={styles.statItem}>
                         <Ionicons name="flash-outline" size={16} color={colors.textOnDarkSecondary} />
                         <Text style={styles.statValue}>{session.maxSpeed.toFixed(0)}</Text>
                         <Text style={styles.statLabel}>mph</Text>
                     </View>
                 </>
              )}
          </View>
      </BlurView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 15,
    marginHorizontal: 15,
    backgroundColor: colors.secondaryBlue,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  mapBackground: {
      ...StyleSheet.absoluteFillObject,
  },
  mapLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
  },
  contentOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingTop: 15,
      paddingBottom: Platform.OS === 'ios' ? 15 : 12,
      paddingHorizontal: 15,
      zIndex: 3,
  },
  textContainer: {
      marginBottom: 10,
  },
  locationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 3,
  },
  dateTimeText: {
    fontSize: 13,
    color: colors.textOnDarkSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 15,
  },
  statSeparator: {
      height: '60%',
      width: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      marginRight: 15,
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.white,
    marginLeft: 5,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textOnDarkSecondary,
    marginLeft: 4,
  },
});

export default SessionCard; 