import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  totalDuration: number; // seconds
  // Optional: Add startLatitude/Longitude if needed for initial map centering
  // startLatitude?: number;
  // startLongitude?: number;
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

// Helper to format duration (seconds) into Hh Mm
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
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
  const durationFormatted = formatDuration(session.totalDuration);
  const mapViewRef = useRef<MapView>(null);
  const [rawCoordinates, setRawCoordinates] = useState<GeoPoint[]>([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Effect to fetch wave coordinates for the map preview
  useEffect(() => {
    const fetchCoords = async () => {
      if (!session.id) return;
      setMapLoading(true);
      setMapReady(false);
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

  // Effect to fit map to coordinates once loaded
  useEffect(() => {
    if (mapReady && !mapLoading && smoothedWaveCoordinates.length > 1 && mapViewRef.current) {
      setTimeout(() => {
          mapViewRef.current?.fitToCoordinates(smoothedWaveCoordinates, {
              edgePadding: { top: 15, right: 15, bottom: 15, left: 15 },
              animated: false,
          });
      }, 200);
    } else if (mapReady && !mapLoading && rawCoordinates.length <= 1) {
    }
  }, [mapReady, mapLoading, smoothedWaveCoordinates, rawCoordinates, session.id]);

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
            key={session.id}
            ref={mapViewRef}
            style={styles.mapPreview}
            mapType="satellite"
            onMapReady={() => setMapReady(true)}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            showsUserLocation={false}
            showsMyLocationButton={false}
         >
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

         {/* Loading / No Data / Error Indicator */}
         {mapLoading ? (
             <View style={styles.mapOverlayContainer}>
                 <ActivityIndicator size="small" color={colors.primaryBlue} />
             </View>
         ) : (
            rawCoordinates.length <= 1 && (
                <View style={styles.mapOverlayContainer}>
                    <Ionicons name="warning-outline" size={20} color={colors.textSecondary} />
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
    backgroundColor: colors.white, // Background for shadow
    marginVertical: 10,
    marginHorizontal: 15,
    minHeight: 140, // Slightly increased minHeight for more map space
    // Shadow
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  leftSide: {
    flex: 2, // Reduced flex
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
      backgroundColor: 'rgba(238, 242, 247, 0.6)',
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