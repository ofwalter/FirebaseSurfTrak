import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { collection, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import MapView, { Polyline, Marker, Region } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient'; // For stat cards

// Interfaces & Types
interface GeoPoint {
    latitude: number;
    longitude: number;
}

interface Wave {
  id?: string;
  startTime: Timestamp;
  endTime: Timestamp;
  duration: number;
  topSpeed: number;
  averageSpeed: number;
  coordinates?: GeoPoint[]; // Coordinates are optional now
}

interface Session {
    // Define fields needed from the session doc
    startLatitude: number;
    startLongitude: number;
    // Add others if needed, e.g., location name for title
}

type SessionDetailRouteParams = {
  SessionDetail: {
    sessionId: string;
    sessionLocation: string;
  };
};
type SessionDetailScreenRouteProp = RouteProp<SessionDetailRouteParams, 'SessionDetail'>;

// Define colors (reuse or centralize later)
const colors = {
  primaryBlue: '#1A73E8',
  secondaryBlue: '#0056B3',
  lightBlue: '#4AB1FF',
  background: '#f0f4f8',
  cardBackground: '#ffffff',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  white: '#ffffff',
  sliderMin: '#a5b4fc', // Example color for slider track
  sliderMax: '#e0e7ff',
};

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const MAP_HEIGHT = screenHeight * 0.57; // Approx 4/7ths
const DETAILS_PANEL_HEIGHT = screenHeight * 0.43;

// --- Reusable Wave Stat Card Component ---
interface WaveStatCardProps {
  iconName: string;
  label: string;
  value: string;
  unit?: string;
  gradientColors: readonly [string, string, ...string[]];
}

const WaveStatCard = ({ iconName, label, value, unit, gradientColors }: WaveStatCardProps) => (
  <LinearGradient
    colors={gradientColors}
    style={styles.waveStatCard}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
  >
    <Ionicons name={iconName} size={20} color={colors.white} style={styles.statIcon} />
    <Text style={styles.statLabel}>{label}</Text>
    <View style={styles.statValueContainer}>
        <Text style={styles.statValueText}>{value}</Text>
        {unit && <Text style={styles.statUnitText}>{unit}</Text>}
    </View>
  </LinearGradient>
);

// --- SessionDetailScreen Implementation ---

const SessionDetailScreen = () => {
  const route = useRoute<SessionDetailScreenRouteProp>();
  const { sessionId } = route.params;
  const mapRef = useRef<MapView>(null); // Ref for controlling the map

  const [sessionData, setSessionData] = useState<Session | null>(null);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWaveIndex, setSelectedWaveIndex] = useState(0);

  // Fetch Session and Waves Effect
  useEffect(() => {
    const fetchSessionAndWaves = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!sessionId) throw new Error("Session ID is missing");

        // 1. Fetch Session Document
        const sessionDocRef = doc(db, 'sessions', sessionId);
        const sessionDocSnap = await getDoc(sessionDocRef);
        if (!sessionDocSnap.exists()) {
            throw new Error("Session data not found.");
        }
        const fetchedSessionData = sessionDocSnap.data() as Session;
        setSessionData(fetchedSessionData);

        // 2. Fetch Waves Subcollection
        const wavesQuery = collection(db, 'sessions', sessionId, 'waves');
        const querySnapshot = await getDocs(wavesQuery);
        const fetchedWaves: Wave[] = [];
        querySnapshot.forEach((doc) => {
          fetchedWaves.push({ id: doc.id, ...doc.data() } as Wave);
        });
        fetchedWaves.sort((a, b) => a.startTime.seconds - b.startTime.seconds);
        setWaves(fetchedWaves);

        // 3. Set initial map region based on session start coords
        if (fetchedSessionData.startLatitude && fetchedSessionData.startLongitude) {
             // Animate map only on initial load
             mapRef.current?.animateToRegion(
                {
                    latitude: fetchedSessionData.startLatitude,
                    longitude: fetchedSessionData.startLongitude,
                    latitudeDelta: 0.01, // Zoom in closer for waves
                    longitudeDelta: 0.01,
                },
                1000 // Animation duration in ms
            );
        }

      } catch (err: any) {
        console.error("Error fetching session/wave data: ", err);
        setError("Could not fetch session or wave data.");
        Alert.alert("Error", "Could not load session details.");
      } finally {
        setLoading(false);
      }
    };
    fetchSessionAndWaves();
  }, [sessionId]);

  // Memoize selected wave data
  const selectedWave = useMemo(() => {
    return waves.length > 0 ? waves[selectedWaveIndex] : null;
  }, [waves, selectedWaveIndex]);

  // Memoize map region based on session data (used for initialRegion)
  const initialMapRegion = useMemo(() => ({
    latitude: sessionData?.startLatitude ?? 34.0100, // Default if no session data yet
    longitude: sessionData?.startLongitude ?? -118.4960,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  }), [sessionData]);

  // Animate map to selected wave when index changes
  useEffect(() => {
      if (selectedWave?.coordinates && selectedWave.coordinates.length > 0 && mapRef.current) {
          // Optional: Fit map to the Polyline bounds
          mapRef.current.fitToCoordinates(selectedWave.coordinates, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true,
          });
      }
  }, [selectedWave]); // Dependency on the selected wave data

  // Handler for slider value change
  const handleSliderChange = (value: number) => {
    setSelectedWaveIndex(Math.round(value));
  };

  if (loading) {
    return <ActivityIndicator size="large" style={styles.fullScreenLoader} />;
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  return (
    <View style={styles.screenContainer}>
      <MapView
        ref={mapRef} // Assign ref
        style={styles.mapView}
        initialRegion={initialMapRegion}
        // provider={PROVIDER_GOOGLE} // Optional: Use Google Maps if configured
      >
         {/* Draw Polyline for selected wave if coordinates exist */}
         {selectedWave?.coordinates && selectedWave.coordinates.length > 1 && (
             <Polyline
                 coordinates={selectedWave.coordinates}
                 strokeColor={colors.primaryBlue}
                 strokeWidth={4}
                 lineCap="round"
            />
         )}
         {/* Add Markers for start/end of selected wave */}
         {selectedWave?.coordinates && selectedWave.coordinates.length > 0 && (
             <>
                 <Marker
                     coordinate={selectedWave.coordinates[0]}
                     title={`Wave ${selectedWaveIndex + 1} Start`}
                     pinColor="green" // Example color
                 />
                 <Marker
                     coordinate={selectedWave.coordinates[selectedWave.coordinates.length - 1]}
                     title={`Wave ${selectedWaveIndex + 1} End`}
                     pinColor="red" // Example color
                 />
             </>
         )}
      </MapView>

      {/* Details Panel */}
      <View style={styles.detailsPanel}>
          {waves.length > 0 && selectedWave ? (
             <>
                {/* Wave Slider */}
                <View style={styles.sliderContainer}>
                    <Text style={styles.sliderLabel}>Wave {selectedWaveIndex + 1} / {waves.length}</Text>
                    <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={waves.length - 1}
                        step={1}
                        value={selectedWaveIndex}
                        onValueChange={handleSliderChange}
                        minimumTrackTintColor={colors.primaryBlue}
                        maximumTrackTintColor={colors.sliderMax}
                        thumbTintColor={colors.primaryBlue}
                    />
                </View>

                {/* Wave Stats Cards */}
                <View style={styles.statsGrid}>
                    <WaveStatCard
                        iconName="time-outline"
                        label="Duration"
                        value={selectedWave.duration?.toFixed(0) ?? '0'}
                        unit="sec"
                        gradientColors={[colors.primaryBlue, colors.lightBlue]}
                     />
                     <WaveStatCard
                        iconName="speedometer-outline"
                        label="Avg Speed"
                        value={selectedWave.averageSpeed?.toFixed(1) ?? '0'}
                        unit="mph"
                        gradientColors={[colors.secondaryBlue, colors.primaryBlue]}
                     />
                     <WaveStatCard
                        iconName="flash-outline"
                        label="Top Speed"
                        value={selectedWave.topSpeed?.toFixed(1) ?? '0'}
                        unit="mph"
                        gradientColors={[colors.lightBlue, colors.primaryBlue]}
                     />
                      <WaveStatCard
                        iconName="stopwatch-outline"
                        label="Start Time"
                        value={selectedWave.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '-'}
                        gradientColors={[colors.secondaryBlue, colors.lightBlue]}
                     />
                </View>
             </>
          ) : (
              <Text style={styles.noWavesText}>No wave data available for this session.</Text>
          )}
      </View>
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background, // Background for the whole screen
  },
  mapView: {
    height: MAP_HEIGHT,
    width: '100%',
  },
  detailsPanel: {
    height: DETAILS_PANEL_HEIGHT,
    backgroundColor: colors.cardBackground, // White background for the panel
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    marginTop: -24, // Pull panel up slightly to overlap map with rounded corners
    // Shadow for the panel
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  sliderContainer: {
      marginBottom: 20,
      alignItems: 'center',
  },
  sliderLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  waveStatCard: {
    width: '48%', // Two cards per row with a small gap
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    // Shadow for stat cards
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statIcon: {
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 13,
    color: colors.white,
    opacity: 0.9,
    marginBottom: 4,
  },
   statValueContainer: {
       flexDirection: 'row',
       alignItems: 'baseline',
   },
  statValueText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },
  statUnitText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.white,
      marginLeft: 3,
      opacity: 0.8,
  },
  fullScreenLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
     flex: 1,
     textAlign: 'center',
     marginTop: 50,
     color: 'red',
     fontSize: 16,
     paddingHorizontal: 20,
  },
   noWavesText: {
       textAlign: 'center',
       marginTop: 30,
       fontSize: 16,
       color: colors.textSecondary,
   },
});

export default SessionDetailScreen; 