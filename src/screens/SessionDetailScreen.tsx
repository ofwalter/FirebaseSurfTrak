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
import MapView, { Polyline, Marker } from 'react-native-maps';
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

// --- Helper Functions ---

// Degrees to Radians
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Calculate distance between two lat/lon points in kilometers
function getDistanceFromLatLonInKm(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

// Calculate total distance of a path (array of GeoPoints)
function calculatePathDistance(coordinates: GeoPoint[] | undefined): number {
    let totalDistanceKm = 0;
    if (!coordinates || coordinates.length < 2) {
        return 0;
    }
    for (let i = 0; i < coordinates.length - 1; i++) {
        totalDistanceKm += getDistanceFromLatLonInKm(
            coordinates[i].latitude, coordinates[i].longitude,
            coordinates[i+1].latitude, coordinates[i+1].longitude
        );
    }
    return totalDistanceKm * 1000; // Return distance in meters
}

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
  const mapRef = useRef<MapView>(null);

  const [sessionData, setSessionData] = useState<Session | null>(null);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWaveIndex, setSelectedWaveIndex] = useState(-1);
  const [sliderDisplayIndex, setSliderDisplayIndex] = useState(-1);
  const [mapDetailReady, setMapDetailReady] = useState(false);

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
      setMapDetailReady(false);
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

        // Reset index to summary when new data loads
        setSelectedWaveIndex(-1);
        setSliderDisplayIndex(-1);

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

  // --- Map Animation Effect (Depends on selectedWaveIndex) ---
  useEffect(() => {
    // Only run if map is ready and we are not loading session/wave data
    if (!mapDetailReady || !mapRef.current || loading) return;

    const isSummaryActive = selectedWaveIndex === -1;
    const coordinatesToFit = isSummaryActive
      ? allRawCoordinates // Use raw for bounds fitting
      : (selectedWaveRaw?.coordinates && selectedWaveRaw.coordinates.length > 0 ? selectedWaveRaw.coordinates : null);

    if (coordinatesToFit && coordinatesToFit.length > 0) {
        // Use a slight delay to allow rendering updates to settle after state change
        setTimeout(() => {
             mapRef.current?.fitToCoordinates(coordinatesToFit, {
                // Adjust padding: Less bottom padding needed now panel doesn't overlap map state directly?
                // Give more padding at the top to account for potential status bar/notch
                // Let panel handle its own space.
                edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
                animated: true,
            });
        }, 250); // Keep a small delay
    } else if (sessionData) {
        // Fallback: If no coords to fit, gently animate to initial session region
        mapRef.current.animateToRegion(initialMapRegion, 1000);
    }
  // Update dependencies: Run when index changes, map is ready, or coords data updates
  }, [mapDetailReady, selectedWaveIndex, selectedWaveRaw, allRawCoordinates, sessionData, initialMapRegion, loading]);

  // Handler for slider value change *during* the slide (updates label)
  const handleSliderValueUpdate = (value: number) => {
    const newIndex = Math.round(value);
    setSliderDisplayIndex(newIndex); // Update temporary display index for label
  };

  // Handler for when the user *finishes* sliding
  const handleSlidingComplete = (value: number) => {
    const finalIndex = Math.round(value);
    setSelectedWaveIndex(finalIndex); // Set the actual state that triggers effects
    setSliderDisplayIndex(finalIndex); // Sync display index
    // No map remount needed here
    // The useEffect hook depending on selectedWaveIndex will handle map fitting
  };

  // Return loading indicator first
  if (loading) {
    return <ActivityIndicator size="large" style={styles.fullScreenLoader} />;
  }

  // Check for sessionData AFTER loading is false
  if (!sessionData || error) {
    return <Text style={styles.errorText}>{error || "Session data could not be loaded."}</Text>;
  }

  const isSummaryActive = selectedWaveIndex === -1;
  // Use sliderDisplayIndex for the label text so it updates live
  const isDisplaySummary = sliderDisplayIndex === -1;

  return (
    <View style={styles.screenContainer}>
      <MapView
        ref={mapRef}
        style={styles.mapView}
        initialRegion={initialMapRegion}
        mapType="satellite"
        onMapReady={() => setMapDetailReady(true)}
      >
        {/* ---- Start: Render Polylines ---- */}

        {/* 1. Summary Polylines (Render all waves, dim if one is selected) */}
        {mapDetailReady && waves.map((wave, index) => {
            const smoothedCoords = wave.coordinates ? smoothPath(wave.coordinates) : [];
            // Determine opacity based on whether summary is active OR this specific wave is selected
            const isActive = isSummaryActive || index === selectedWaveIndex;
            // Use a more distinct color/opacity difference
            const strokeColor = isActive ? colors.pathAquaRGBA : 'rgba(0, 200, 200, 0.2)'; // Dimmer if inactive
            const strokeWidth = isActive ? 3 : 2; // Thicker if active
            const zIndex = isActive ? 1 : 0; // Ensure active line is above others

            return smoothedCoords.length > 1 && (
                <Polyline
                    key={`wave-poly-${wave.id || index}`} // Unique key needed
                    coordinates={smoothedCoords}
                    strokeColor={strokeColor}
                    strokeWidth={strokeWidth}
                    lineCap="round"
                    zIndex={zIndex}
               />
            );
        })}

        {/* Polyline for selected wave is handled by the loop above now */}

        {/* ---- End: Render Polylines ---- */}

        {/* ---- Start: Render Markers (Only for selected wave) ---- */}
         {mapDetailReady && !isSummaryActive && selectedWaveRaw?.coordinates && selectedWaveRaw.coordinates.length > 0 && (
             <>
                 <Marker coordinate={selectedWaveRaw.coordinates[0]} anchor={{ x: 0.5, y: 0.5 }} zIndex={3}>
                    <View style={[styles.customMarker, { backgroundColor: colors.markerAqua }]} />
                 </Marker>
                 <Marker coordinate={selectedWaveRaw.coordinates[selectedWaveRaw.coordinates.length - 1]} anchor={{ x: 0.5, y: 0.5 }} zIndex={3}>
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
                    <View style={styles.sliderContainer}>
                         <Text style={styles.sliderLabel}>
                            {isDisplaySummary ? "Session Summary" : `Wave ${sliderDisplayIndex + 1} / ${waves.length}`}
                         </Text>
                         <Slider
                            style={styles.slider}
                            minimumValue={-1}
                            maximumValue={waves.length - 1}
                            step={1}
                            value={sliderDisplayIndex}
                            onValueChange={handleSliderValueUpdate}
                            onSlidingComplete={handleSlidingComplete}
                            minimumTrackTintColor={colors.primaryBlue}
                            maximumTrackTintColor={colors.sliderMax}
                            thumbTintColor={colors.primaryBlue}
                         />
                    </View>

                    {/* --- Conditional Stats Grid (Uses selectedWaveIndex for data) --- */}
                    <View style={styles.statsGrid}>
                        {isSummaryActive ? (
                            <>
                                {/* Summary Stats - First Row (existing) */}
                                <WaveStatCard label="Total Waves" value={summaryStats.count.toString()} gradientColors={[colors.primaryBlue, colors.lightBlue]} iconName="water-outline" />
                                <WaveStatCard label="Avg Duration" value={summaryStats.avgDuration.toFixed(0)} unit="sec" gradientColors={[colors.secondaryBlue, colors.primaryBlue]} iconName="time-outline" />
                                <WaveStatCard label="Avg Speed" value={summaryStats.avgAvgSpeed.toFixed(1)} unit="mph" gradientColors={[colors.lightBlue, colors.primaryBlue]} iconName="speedometer-outline" />
                                <WaveStatCard label="Avg Top Speed" value={summaryStats.avgTopSpeed.toFixed(1)} unit="mph" gradientColors={[colors.secondaryBlue, colors.lightBlue]} iconName="flash-outline" />
                                
                                {/* Summary Stats - Additional Metrics */}
                                <WaveStatCard 
                                    label="Total Distance" 
                                    value={waves.reduce((sum, wave) => sum + calculatePathDistance(wave.coordinates), 0).toFixed(0)} 
                                    unit="m" 
                                    gradientColors={[colors.green, colors.primaryBlue]} 
                                    iconName="map-outline" 
                                />
                                <WaveStatCard 
                                    label="Total Time" 
                                    value={(waves.reduce((sum, wave) => sum + (wave.duration || 0), 0) / 60).toFixed(1)} 
                                    unit="min" 
                                    gradientColors={[colors.orange, colors.secondaryBlue]} 
                                    iconName="hourglass-outline" 
                                />
                                <WaveStatCard 
                                    label="Longest Wave" 
                                    value={Math.max(...waves.map(wave => wave.duration || 0)).toFixed(0)} 
                                    unit="sec" 
                                    gradientColors={[colors.primaryBlue, colors.green]} 
                                    iconName="analytics-outline" 
                                />
                                <WaveStatCard 
                                    label="Fastest Wave" 
                                    value={Math.max(...waves.map(wave => wave.topSpeed || 0)).toFixed(1)} 
                                    unit="mph" 
                                    gradientColors={[colors.red, colors.orange]} 
                                    iconName="flash-outline" 
                                />
                                <WaveStatCard 
                                    label="Avg Distance" 
                                    value={(waves.reduce((sum, wave) => sum + calculatePathDistance(wave.coordinates), 0) / (waves.length || 1)).toFixed(0)} 
                                    unit="m" 
                                    gradientColors={[colors.green, colors.lightBlue]} 
                                    iconName="navigate-outline" 
                                />
                                <WaveStatCard 
                                    label="Longest Distance" 
                                    value={Math.max(...waves.map(wave => calculatePathDistance(wave.coordinates))).toFixed(0)} 
                                    unit="m" 
                                    gradientColors={[colors.secondaryBlue, colors.green]} 
                                    iconName="resize-outline" 
                                />
                                <WaveStatCard 
                                    label="Session Length" 
                                    value={waves.length > 0 ? 
                                        ((waves[waves.length-1].endTime.toDate().getTime() - waves[0].startTime.toDate().getTime()) / 60000).toFixed(0) 
                                        : "0"} 
                                    unit="min" 
                                    gradientColors={[colors.primaryBlue, colors.orange]} 
                                    iconName="calendar-outline" 
                                />
                                <WaveStatCard 
                                    label="Waves/Hour" 
                                    value={waves.length > 0 ? 
                                        (waves.length / ((waves[waves.length-1].endTime.toDate().getTime() - waves[0].startTime.toDate().getTime()) / 3600000)).toFixed(1) 
                                        : "0"} 
                                    gradientColors={[colors.orange, colors.red]} 
                                    iconName="trending-up-outline" 
                                />
                            </>
                        ) : selectedWaveRaw ? (
                            <>
                                {/* Selected Wave Stats - First Row (existing) */}
                                <WaveStatCard label="Duration" value={selectedWaveRaw.duration?.toFixed(0) ?? '0'} unit="sec" gradientColors={[colors.primaryBlue, colors.lightBlue]} iconName="time-outline" />
                                <WaveStatCard label="Avg Speed" value={selectedWaveRaw.averageSpeed?.toFixed(1) ?? '0'} unit="mph" gradientColors={[colors.secondaryBlue, colors.primaryBlue]} iconName="speedometer-outline" />
                                <WaveStatCard label="Top Speed" value={selectedWaveRaw.topSpeed?.toFixed(1) ?? '0'} unit="mph" gradientColors={[colors.lightBlue, colors.primaryBlue]} iconName="flash-outline" />
                                <WaveStatCard label="Start Time" value={selectedWaveRaw.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '-'} gradientColors={[colors.secondaryBlue, colors.lightBlue]} iconName="stopwatch-outline" />
                                
                                {/* Selected Wave Stats - Additional Metrics */}
                                <WaveStatCard 
                                    label="Distance" 
                                    value={calculatePathDistance(selectedWaveRaw.coordinates).toFixed(0)} 
                                    unit="m" 
                                    gradientColors={[colors.green, colors.lightBlue]} 
                                    iconName="navigate-outline" 
                                />
                                <WaveStatCard 
                                    label="End Time" 
                                    value={selectedWaveRaw.endTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '-'} 
                                    gradientColors={[colors.orange, colors.secondaryBlue]} 
                                    iconName="flag-outline" 
                                />
                                <WaveStatCard 
                                    label="Efficiency" 
                                    value={((calculatePathDistance(selectedWaveRaw.coordinates) / (selectedWaveRaw.duration || 1)) * 3.6).toFixed(1)} 
                                    unit="km/h" 
                                    gradientColors={[colors.primaryBlue, colors.green]} 
                                    iconName="trending-up-outline" 
                                />
                                <WaveStatCard 
                                    label="Wave #" 
                                    value={`${selectedWaveIndex + 1} of ${waves.length}`} 
                                    gradientColors={[colors.red, colors.orange]} 
                                    iconName="layers-outline" 
                                />
                                {selectedWaveRaw.coordinates && selectedWaveRaw.coordinates.length >= 2 && (
                                    <WaveStatCard 
                                        label="Direction" 
                                        value={(() => {
                                            const first = selectedWaveRaw.coordinates?.[0];
                                            const last = selectedWaveRaw.coordinates?.[selectedWaveRaw.coordinates.length - 1];
                                            if (!first || !last) return "-";
                                            const bearing = Math.atan2(
                                                last.longitude - first.longitude, 
                                                last.latitude - first.latitude
                                            ) * (180 / Math.PI);
                                            const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
                                            const index = Math.round(((bearing + 360) % 360) / 45) % 8;
                                            return directions[index];
                                        })()} 
                                        gradientColors={[colors.secondaryBlue, colors.green]} 
                                        iconName="compass-outline" 
                                    />
                                )}
                                <WaveStatCard 
                                    label="Relative Speed" 
                                    value={((selectedWaveRaw.averageSpeed || 0) / summaryStats.avgAvgSpeed * 100).toFixed(0)} 
                                    unit="%" 
                                    gradientColors={[colors.green, colors.orange]} 
                                    iconName="stats-chart-outline" 
                                />
                                <WaveStatCard 
                                    label="Speed Diff" 
                                    value={((selectedWaveRaw.topSpeed || 0) - (selectedWaveRaw.averageSpeed || 0)).toFixed(1)} 
                                    unit="mph" 
                                    gradientColors={[colors.orange, colors.red]} 
                                    iconName="pulse-outline" 
                                />
                                <WaveStatCard 
                                    label="Time of Day" 
                                    value={selectedWaveRaw.startTime?.toDate().getHours() < 12 ? "Morning" : 
                                            selectedWaveRaw.startTime?.toDate().getHours() < 17 ? "Afternoon" : "Evening"} 
                                    gradientColors={[colors.primaryBlue, colors.lightBlue]} 
                                    iconName="sunny-outline" 
                                />
                            </>
                        ) : null /* Should not happen if !isSummaryActive */}
                    </View>
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
    ...StyleSheet.absoluteFillObject,
  },
  detailsPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: screenHeight - PANEL_UP_POSITION + 30,
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  handleIndicatorContainer: {
      alignItems: 'center',
      paddingVertical: 8,
  },
  handleIndicator: {
      width: 50,
      height: 5,
      backgroundColor: colors.inputBorder,
      borderRadius: 3,
  },
  panelContentContainer: {
      paddingHorizontal: 20,
      paddingTop: 0,
      paddingBottom: 40,
  },
  sliderContainer: {
      marginBottom: 15,
      alignItems: 'center',
  },
  sliderLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 5,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  waveStatCard: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statIcon: {
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    color: colors.white,
    opacity: 0.9,
    marginBottom: 3,
  },
   statValueContainer: {
       flexDirection: 'row',
       alignItems: 'baseline',
   },
  statValueText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
  },
  statUnitText: {
      fontSize: 11,
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
     color: colors.red,
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
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.7)',
  },
});

export default SessionDetailScreen; 