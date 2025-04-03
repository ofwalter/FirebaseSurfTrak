import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  Animated,
  PanResponder,
  TouchableOpacity,
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
  primaryBlueRGBA: 'rgba(26, 115, 232, 0.7)', // Added RGBA version with 70% opacity
  secondaryBlue: '#0056B3',
  lightBlue: '#4AB1FF',
  green: '#16A34A',
  orange: '#EA580C',
  red: '#DC2626',
  background: '#f0f4f8',
  cardBackground: '#ffffff',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  white: '#ffffff',
  sliderMin: '#a5b4fc',
  sliderMax: '#e0e7ff',
  inputBorder: '#d1d5db',
  pathAqua: '#00C8C8', // Added
  pathAquaRGBA: 'rgba(0, 200, 200, 0.8)', // Added
  markerAqua: '#00A0A0', // Added
};

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const MAP_HEIGHT = screenHeight * 0.57;
const PANEL_DOWN_POSITION = MAP_HEIGHT - 30;
const PANEL_UP_POSITION = screenHeight * 0.15;
const DRAG_THRESHOLD = 70;

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

// --- SessionDetailScreen Implementation ---

const SessionDetailScreen = () => {
  const route = useRoute<SessionDetailScreenRouteProp>();
  const { sessionId } = route.params;
  const mapRef = useRef<MapView>(null); // Ref for controlling the map

  const [sessionData, setSessionData] = useState<Session | null>(null);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWaveIndex, setSelectedWaveIndex] = useState(-1);
  const [mapDetailReady, setMapDetailReady] = useState(false);
  const [mapRenderKey, setMapRenderKey] = useState(0);

  // Animated value for panel position
  const panelY = useRef(new Animated.Value(PANEL_DOWN_POSITION)).current;
  // Store the last stable position before dragging starts
  const lastPanelY = useRef(PANEL_DOWN_POSITION);

  // --- PanResponder Setup ---
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // Set the offset to the *last known stable position*
        panelY.setOffset(lastPanelY.current);
        // Reset the base value to 0 as we are now working with offset + delta
        panelY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Move relative to the offset
        let newRelativeY = gestureState.dy;
        // Calculate potential absolute position (for clamping)
        let absoluteY = lastPanelY.current + newRelativeY;

        // Clamp the absolute position
        if (absoluteY < PANEL_UP_POSITION) {
          newRelativeY = PANEL_UP_POSITION - lastPanelY.current;
        } else if (absoluteY > PANEL_DOWN_POSITION) {
          newRelativeY = PANEL_DOWN_POSITION - lastPanelY.current;
        }
        panelY.setValue(newRelativeY);
      },
      onPanResponderRelease: (_, gestureState) => {
        // Combine offset and final value *before* flattening
        const finalY = lastPanelY.current + gestureState.dy;
        // Flatten offset now, making the panelY value absolute again
        panelY.flattenOffset();
        // Update the last stable position reference
        lastPanelY.current = finalY < PANEL_UP_POSITION ? PANEL_UP_POSITION : (finalY > PANEL_DOWN_POSITION ? PANEL_DOWN_POSITION : finalY);
        // Set the Animated value to the potentially clamped final position
        panelY.setValue(lastPanelY.current);

        // Determine target position based on release velocity and final clamped position
        let targetPosition = PANEL_DOWN_POSITION;
        if (gestureState.vy < -0.5 || (gestureState.dy < 0 && lastPanelY.current < PANEL_DOWN_POSITION - DRAG_THRESHOLD)) {
            targetPosition = PANEL_UP_POSITION;
        } else if (gestureState.vy > 0.5 || (gestureState.dy > 0 && lastPanelY.current > PANEL_UP_POSITION + DRAG_THRESHOLD)) {
            targetPosition = PANEL_DOWN_POSITION;
        } else {
             targetPosition = (lastPanelY.current - PANEL_UP_POSITION < PANEL_DOWN_POSITION - lastPanelY.current) ? PANEL_UP_POSITION : PANEL_DOWN_POSITION;
        }

        // Animate to target position
        Animated.spring(panelY, {
          toValue: targetPosition,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }).start(({ finished }) => {
            // After animation finishes, update lastPanelY to the final target
            if (finished) {
                lastPanelY.current = targetPosition;
            }
        });
      },
    })
  ).current;
  // --- End PanResponder Setup ---

  // Fetch Session and Waves Effect
  useEffect(() => {
    const fetchSessionAndWaves = async () => {
      setLoading(true);
      setError(null);
      setMapDetailReady(false); // Reset map ready state on new fetch
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

        // Reset index to summary when new data loads (optional, good practice)
        setSelectedWaveIndex(-1);

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
  const selectedWaveRaw = useMemo(() => {
    return selectedWaveIndex >= 0 && waves.length > selectedWaveIndex
        ? waves[selectedWaveIndex]
        : null;
  }, [waves, selectedWaveIndex]);

  // Memoize smoothed coordinates for the selected wave
  const selectedWaveSmoothedCoords = useMemo(() => {
      return selectedWaveRaw?.coordinates ? smoothPath(selectedWaveRaw.coordinates) : [];
  }, [selectedWaveRaw]);

  // Memoize smoothed coordinates for ALL waves (for summary view)
  const allSmoothedCoordinates = useMemo(() => {
      // Smooth each wave path individually, then combine
      return waves.flatMap(wave => wave.coordinates ? smoothPath(wave.coordinates) : []);
      // Alternative: Smooth the combined raw coordinates (might connect unrelated paths)
      // return smoothPath(waves.flatMap(wave => wave.coordinates || []));
  }, [waves]);

  // Use raw coordinates for map fitting (more accurate bounds)
  const allRawCoordinates = useMemo(() => {
      return waves.flatMap(wave => wave.coordinates || []);
  }, [waves]);

  // Memoize map region based on session data (used for initialRegion)
  const initialMapRegion = useMemo(() => ({
    latitude: sessionData?.startLatitude ?? 34.0100, // Default if no session data yet
    longitude: sessionData?.startLongitude ?? -118.4960,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  }), [sessionData]);

  // Calculate Summary Statistics
  const summaryStats = useMemo(() => {
    if (!waves || waves.length === 0) {
      return { count: 0, avgDuration: 0, avgAvgSpeed: 0, avgTopSpeed: 0 };
    }
    const totalDuration = waves.reduce((sum, wave) => sum + (wave.duration || 0), 0);
    const totalAvgSpeed = waves.reduce((sum, wave) => sum + (wave.averageSpeed || 0), 0);
    const totalTopSpeed = waves.reduce((sum, wave) => sum + (wave.topSpeed || 0), 0);
    const count = waves.length;
    return {
      count: count,
      avgDuration: count > 0 ? totalDuration / count : 0,
      avgAvgSpeed: count > 0 ? totalAvgSpeed / count : 0,
      avgTopSpeed: count > 0 ? totalTopSpeed / count : 0,
    };
  }, [waves]);

  // --- Map Animation Effect ---
  useEffect(() => {
    if (!mapDetailReady || !mapRef.current) return;
    const isSummaryActive = selectedWaveIndex === -1;
    if (isSummaryActive) {
        if (allRawCoordinates.length > 0) {
            setTimeout(() => {
                mapRef.current?.fitToCoordinates(allRawCoordinates, {
                    edgePadding: { top: 60, right: 60, bottom: screenHeight * 0.5, left: 60 },
                    animated: true,
                });
            }, 250);
        } else if (sessionData) {
             mapRef.current.animateToRegion(initialMapRegion, 1000);
        }
    } else {
        if (selectedWaveRaw?.coordinates && selectedWaveRaw.coordinates.length > 0) {
            setTimeout(() => {
                 mapRef.current?.fitToCoordinates(selectedWaveRaw.coordinates, {
                    edgePadding: { top: 50, right: 50, bottom: screenHeight * 0.5, left: 50 },
                    animated: true,
                });
            }, 250);
        } else if (sessionData) {
             mapRef.current.animateToRegion(initialMapRegion, 1000);
        }
    }
  }, [mapDetailReady, selectedWaveIndex, selectedWaveRaw, allRawCoordinates, sessionData, initialMapRegion, mapRenderKey]);

  // Handler for slider value change
  const handleSliderChange = (value: number) => {
    const newIndex = Math.round(value);
    setSelectedWaveIndex(newIndex);
    // Increment the key to force MapView remount when index changes
    setMapRenderKey(prevKey => prevKey + 1);
    // Also reset map ready state, as it will remount
    setMapDetailReady(false);
  };

  // Return loading indicator first
  if (loading) {
    return <ActivityIndicator size="large" style={styles.fullScreenLoader} />;
  }

  // Check for sessionData AFTER loading is false
  if (!sessionData) {
    return <Text style={styles.errorText}>{error || "Session data could not be loaded."}</Text>;
  }

  const isSummaryActive = selectedWaveIndex === -1;

  return (
    <View style={styles.screenContainer}>
      <MapView
        key={mapRenderKey}
        ref={mapRef}
        style={styles.mapView}
        initialRegion={initialMapRegion}
        mapType="satellite"
        onMapReady={() => setMapDetailReady(true)}
      >
        {/* ---- Start: Render Polylines ---- */}

        {/* 1. Summary Polylines */} 
        {mapDetailReady && waves.map((wave, index) => {
            const smoothedCoords = wave.coordinates ? smoothPath(wave.coordinates) : [];
            return smoothedCoords.length > 1 && (
                <Polyline
                    key={`wave-summary-poly-${wave.id || index}`}
                    coordinates={smoothedCoords}
                    strokeColor={isSummaryActive ? colors.pathAquaRGBA : 'transparent'}
                    strokeWidth={2.5}
                    lineCap="round"
                    zIndex={isSummaryActive ? 1 : 0}
               />
            );
        })}

        {/* 2. Selected Wave Polyline */} 
        {mapDetailReady && selectedWaveSmoothedCoords.length > 1 && (
             <Polyline
                 key={`selected-wave-poly-${selectedWaveRaw?.id || selectedWaveIndex}`}
                 coordinates={selectedWaveSmoothedCoords}
                 strokeColor={!isSummaryActive ? colors.pathAquaRGBA : 'transparent'}
                 strokeWidth={3.5}
                 lineCap="round"
                 zIndex={!isSummaryActive ? 2 : 0}
            />
         )}

        {/* ---- End: Render Polylines ---- */}

        {/* ---- Start: Render Markers (Conditional) ---- */}
         {mapDetailReady && !isSummaryActive && selectedWaveRaw?.coordinates && selectedWaveRaw.coordinates.length > 0 && (
             <>
                 {/* Custom Start Marker */}
                 <Marker
                     coordinate={selectedWaveRaw.coordinates[0]}
                     anchor={{ x: 0.5, y: 0.5 }}
                     zIndex={3} // Ensure markers are on top
                 >
                    <View style={[styles.customMarker, { backgroundColor: colors.markerAqua }]} />
                 </Marker>
                 {/* Custom End Marker */}
                 <Marker
                     coordinate={selectedWaveRaw.coordinates[selectedWaveRaw.coordinates.length - 1]}
                     anchor={{ x: 0.5, y: 0.5 }}
                     zIndex={3} // Ensure markers are on top
                 >
                    <View style={[styles.customMarker, { backgroundColor: colors.markerAqua }]} />
                 </Marker>
             </>
         )}
        {/* ---- End: Render Markers ---- */}

      </MapView>

      <Animated.View
        style={[
          styles.detailsPanel,
          { transform: [{ translateY: panelY }] },
        ]}
        {...panResponder.panHandlers}
      >
          <View style={styles.handleIndicatorContainer}>
              <View style={styles.handleIndicator} />
          </View>
         <View style={styles.panelContentContainer}>
             {waves.length > 0 ? (
                 <>
                    {/* --- Slider Title / Wave Selector --- */} 
                    <View style={styles.sliderContainer}>
                         <Text style={styles.sliderLabel}>
                            {isSummaryActive ? "Session Summary" : `Wave ${selectedWaveIndex + 1} / ${waves.length}`}
                         </Text>
                         <Slider
                            style={styles.slider}
                            minimumValue={-1}
                            maximumValue={waves.length - 1}
                            step={1}
                            value={selectedWaveIndex}
                            onValueChange={handleSliderChange}
                            minimumTrackTintColor={colors.primaryBlue}
                            maximumTrackTintColor={colors.sliderMax}
                            thumbTintColor={colors.primaryBlue}
                         />
                    </View>

                    {/* --- Conditional Stats Grid --- */}
                    <View style={styles.statsGrid}>
                        {isSummaryActive ? (
                            <>
                                <WaveStatCard label="Total Waves" value={summaryStats.count.toString()} gradientColors={[colors.primaryBlue, colors.lightBlue]} iconName="water-outline" />
                                <WaveStatCard label="Avg Duration" value={summaryStats.avgDuration.toFixed(0)} unit="sec" gradientColors={[colors.secondaryBlue, colors.primaryBlue]} iconName="time-outline" />
                                <WaveStatCard label="Avg Speed" value={summaryStats.avgAvgSpeed.toFixed(1)} unit="mph" gradientColors={[colors.lightBlue, colors.primaryBlue]} iconName="speedometer-outline" />
                                <WaveStatCard label="Avg Top Speed" value={summaryStats.avgTopSpeed.toFixed(1)} unit="mph" gradientColors={[colors.secondaryBlue, colors.lightBlue]} iconName="flash-outline" />
                            </>
                        ) : selectedWaveRaw ? (
                            <>
                                <WaveStatCard label="Duration" value={selectedWaveRaw.duration?.toFixed(0) ?? '0'} unit="sec" gradientColors={[colors.primaryBlue, colors.lightBlue]} iconName="time-outline" />
                                <WaveStatCard label="Avg Speed" value={selectedWaveRaw.averageSpeed?.toFixed(1) ?? '0'} unit="mph" gradientColors={[colors.secondaryBlue, colors.primaryBlue]} iconName="speedometer-outline" />
                                <WaveStatCard label="Top Speed" value={selectedWaveRaw.topSpeed?.toFixed(1) ?? '0'} unit="mph" gradientColors={[colors.lightBlue, colors.primaryBlue]} iconName="flash-outline" />
                                <WaveStatCard label="Start Time" value={selectedWaveRaw.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '-'} gradientColors={[colors.secondaryBlue, colors.lightBlue]} iconName="stopwatch-outline" />
                            </>
                        ) : null}
                    </View>
                    {/* --- End Conditional Stats Grid --- */}

                 </>
             ) : (
                 <Text style={styles.noWavesText}>No wave data available for this session.</Text>
             )}
         </View>
      </Animated.View>
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapView: {
    // Map still needs to cover the whole background initially
    ...StyleSheet.absoluteFillObject,
  },
  detailsPanel: {
    // Use absolute positioning instead of relying on height/marginTop
    position: 'absolute',
    left: 0,
    right: 0,
    // Height will be determined by content + potential expansion, set a minHeight?
    // Or calculate based on potential expanded view? Let's rely on content for now.
    // minHeight: DETAILS_PANEL_HEIGHT, // Remove fixed height
    bottom: 0, // Stick to bottom initially? No, position with translateY
    top: 0, // Position absolutely, translateY controls visual position
    height: screenHeight - PANEL_UP_POSITION + 30, // Ensure enough height to contain content even when up

    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // marginTop: -24, // Remove this
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    overflow: 'hidden', // Clip content within rounded corners
  },
  handleIndicatorContainer: {
      // Container for the drag handle
      alignItems: 'center',
      paddingVertical: 8,
      // Maybe add a borderBottom here if needed
  },
  handleIndicator: {
      // The little grey bar
      width: 50,
      height: 5,
      backgroundColor: colors.inputBorder,
      borderRadius: 3,
  },
  panelContentContainer: {
      paddingHorizontal: 20,
      paddingTop: 0,
      paddingBottom: 40, // Reduced padding after removing button
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
  customMarker: {
      width: 10,
      height: 10,
      borderRadius: 5,
      // backgroundColor is set inline
  },
});

export default SessionDetailScreen; 