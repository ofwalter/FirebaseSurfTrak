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
  TouchableOpacity,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { collection, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import MapView, { Polyline, Marker } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Modalize } from 'react-native-modalize';
import { Session, Wave, GeoPoint } from '../types'; // Import shared types

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

// --- Constants ---
// Define default region outside
const defaultInitialRegion = {
    latitude: 34.0100, // Santa Monica default
    longitude: -118.4960,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
};

const WAVE_SELECTOR_HEIGHT = 60; // Example height
const PRIMARY_METRICS_HEIGHT = 80; // Example height
const BOTTOM_SHEET_PEEK_HEIGHT = 80; // How much space Modalize might take when closed

// Type for Navigation Params - KEEP THESE
type SessionDetailRouteParams = {
  SessionDetail: {
    sessionId: string;
  };
};
type SessionDetailScreenRouteProp = RouteProp<SessionDetailRouteParams, 'SessionDetail'>;

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

// Helper component for displaying a single stat row
interface StatRowProps {
    icon: string;
    label: string;
    value: string;
    unit?: string;
}
const StatRow: React.FC<StatRowProps> = ({ icon, label, value, unit }) => (
    <View style={styles.statRow}>
        <Ionicons name={icon} size={20} color={colors.primaryBlue} style={styles.statRowIcon} />
        <Text style={styles.statRowLabel}>{label}</Text>
        <Text style={styles.statRowValue}>{value}{unit && <Text style={styles.statRowUnit}> {unit}</Text>}</Text>
    </View>
);

// Helper component for primary metric display
interface PrimaryStatProps {
    icon: string;
    label: string;
    value: string;
    unit?: string;
}
const PrimaryStat: React.FC<PrimaryStatProps> = ({ icon, label, value, unit }) => (
    <View style={styles.primaryStatItem}>
        <Ionicons name={icon} size={18} color={colors.textSecondary} style={styles.primaryStatIcon} />
        <View>
            <Text style={styles.primaryStatValue}>{value}{unit && <Text style={styles.primaryStatUnit}> {unit}</Text>}</Text>
            <Text style={styles.primaryStatLabel}>{label}</Text>
        </View>
    </View>
);

// --- SessionDetailScreen Implementation ---

const SessionDetailScreen = () => {
  const route = useRoute<SessionDetailScreenRouteProp>();
  const { sessionId } = route.params;
  const mapRef = useRef<MapView>(null);
  const modalizeRef = useRef<Modalize>(null);

  const [sessionData, setSessionData] = useState<Session | null>(null);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWaveIndex, setSelectedWaveIndex] = useState(-1);
  const [mapDetailReady, setMapDetailReady] = useState(false);

  // --- Define Edge Padding Constants Here --- 
  // Padding for SUMMARY view (index = -1)
  const SUMMARY_EDGE_PADDING = { top: 80, right: 60, bottom: screenHeight * 0.30, left: 60 }; // Use the current value

  // Padding for INDIVIDUAL WAVE view (index >= 0)
  const WAVE_EDGE_PADDING = { top: 60, right: 50, bottom: screenHeight * 0.30, left: 50 }; // Use the current value
  // ----------------------------------------

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

  // Map Initialization Effect
  useEffect(() => {
    if (sessionData && waves.length > 0 && mapRef.current && !loading) {
        const allCoordsFlat = waves.flatMap(wave => wave.coordinates || []);
        if (allCoordsFlat.length > 0) {
            setTimeout(() => {
                 mapRef.current?.fitToCoordinates(allCoordsFlat, {
                    edgePadding: SUMMARY_EDGE_PADDING, 
                    animated: false, 
                 });
            }, 100); 
        }
      setMapDetailReady(true);
    }
  }, [sessionData, waves, mapRef, loading]);

  // Memoized Values for Map - Recalculate selectedWave here too for clarity
  const { selectedWave, allWaveCoordinates, sessionRegion } = useMemo(() => {
    if (!sessionData) { // Base check on sessionData only for region
        return {
            selectedWave: undefined,
            allWaveCoordinates: [],
            sessionRegion: defaultInitialRegion
        };
    }
    // Calculate actual region based on sessionData
    const actualSessionRegion = {
      latitude: sessionData.startLatitude,
      longitude: sessionData.startLongitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    // Determine selected wave directly within this memo
    const currentSelectedWave = selectedWaveIndex >= 0 && waves.length > selectedWaveIndex
        ? waves[selectedWaveIndex]
        : null;

    const allCoords = waves
        .map(w => w.coordinates)
        .filter((coords): coords is GeoPoint[] => !!coords && coords.length > 1);

    return { 
        selectedWave: currentSelectedWave, // Use the calculated one
        allWaveCoordinates: allCoords, 
        sessionRegion: actualSessionRegion 
    };
  }, [sessionData, waves, selectedWaveIndex]);

  // Filter displayable waves (needed for summary stats)
  const displayableWaves = useMemo(() => 
      waves.filter(w => w.coordinates && w.coordinates.length > 0), 
      [waves]
  );

  // Calculate Summary Stats (Moved BEFORE early returns)
  const summaryStats = useMemo(() => {
    const count = displayableWaves.length;
    if (count === 0) return null;

    const totalDuration = displayableWaves.reduce((sum, w) => sum + w.duration, 0);
    const totalDistance = displayableWaves.reduce((sum, w) => sum + calculatePathDistance(w.coordinates), 0);
    const avgDuration = totalDuration / count;
    const avgMaxSpeed = displayableWaves.reduce((sum, w) => sum + w.topSpeed, 0) / count;
    const bestMaxSpeed = Math.max(...displayableWaves.map(w => w.topSpeed));
    const firstWaveStart = displayableWaves[0].startTime?.toDate().getTime();
    const lastWaveEnd = displayableWaves[count - 1].endTime?.toDate().getTime();
    const sessionLengthSeconds = (firstWaveStart && lastWaveEnd) ? (lastWaveEnd - firstWaveStart) / 1000 : 0;

    return {
        count,
        totalDuration,
        sessionLengthSeconds,
        avgDuration,
        avgMaxSpeed,
        bestMaxSpeed,
        totalDistance,
    };
  }, [displayableWaves]); // Depend on displayableWaves

  // --- Formatters (Defined before potential early returns) ---
  const formatTimestamp = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const formatDuration = (seconds: number | undefined): string => {
    if (seconds === undefined) return '0 sec';
    return `${Math.round(seconds)} sec`;
  };

  // --- Handlers (Defined before potential early returns) ---
  const handleSelectSummary = () => {
    if (selectedWaveIndex !== -1) {
        handleWaveSelect(-1);
    }
  };

  const handleSelectPrevious = () => {
    const newIndex = selectedWaveIndex === -1 
        ? displayableWaves.length - 1 // Wrap from summary to last wave
        : Math.max(-1, selectedWaveIndex - 1); // Go to previous or summary (-1)
    handleWaveSelect(newIndex);
  };

  const handleSelectNext = () => {
     const newIndex = selectedWaveIndex === displayableWaves.length - 1
         ? -1 // Wrap from last wave to summary
         : Math.min(displayableWaves.length - 1, selectedWaveIndex + 1); // Go to next or last wave
     handleWaveSelect(newIndex);
  };

  // Update handleWaveSelect to mostly handle state update and map animation
  const handleWaveSelect = (index: number) => {
    if (index === selectedWaveIndex) return; // Avoid re-selecting the same

    setSelectedWaveIndex(index);

    if (!mapRef.current) return; // Ensure map is ready

    if (index === -1) {
        const allCoordsFlat = waves.flatMap(w => w.coordinates || []);
        if (allCoordsFlat.length > 0) {
             mapRef.current.fitToCoordinates(allCoordsFlat, {
                 edgePadding: SUMMARY_EDGE_PADDING, // Use constant
                 animated: true,
             });
        } else {
             mapRef.current.animateToRegion(sessionRegion, 500);
        }
    } else if (index >= 0 && waves[index]?.coordinates) {
        const coords = waves[index].coordinates!;
        if (coords.length > 0) {
             mapRef.current.fitToCoordinates(coords, {
                 edgePadding: WAVE_EDGE_PADDING, // Use constant
                 animated: true,
             });
        }
    }
  };

  // --- Heatmap Helper Functions ---

  // Calculate speed between two points given distance (km) and time diff (seconds)
  const calculateSpeedMph = (distanceKm: number, timeDiffSeconds: number): number => {
    if (timeDiffSeconds <= 0) return 0;
    const distanceMiles = distanceKm * 0.621371;
    const timeHours = timeDiffSeconds / 3600;
    return distanceMiles / timeHours;
  };

  // Define the color scale for speed heatmap
  const getSpeedColor = (speedMph: number): string => {
      if (speedMph < 5) return '#5e8cff'; // Blueish (Slow)
      if (speedMph < 12) return '#5eff8c'; // Greenish (Medium)
      if (speedMph < 18) return '#fffa5e'; // Yellowish (Fast)
      return '#ff5e5e'; // Reddish (Very Fast)
      // Adjust ranges and colors as needed
  };

  // Generate heatmap segments for a selected wave
  const generateHeatmapSegments = (wave: Wave | null): { points: GeoPoint[], color: string }[] => {
    if (!wave || !wave.coordinates || wave.coordinates.length < 2) {
        return [];
    }
    const segments: { points: GeoPoint[], color: string }[] = [];
    for (let i = 0; i < wave.coordinates.length - 1; i++) {
        const p1 = wave.coordinates[i];
        const p2 = wave.coordinates[i+1];
        
        // Get speeds, default to 0 if undefined
        const speed1 = p1.speed ?? 0;
        const speed2 = p2.speed ?? 0;
        
        let segmentAvgSpeed: number;

        if (p1.speed !== undefined && p1.speed !== null) {
             // If p1 has speed, average it with p2 (or use p1 if p2 is missing)
             segmentAvgSpeed = (speed1 + (speed2 ?? speed1)) / 2;
        } else {
            // If p1 speed is missing, estimate using distance/time
            const distKm = getDistanceFromLatLonInKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
            const timeDiff = p2.timestamp.seconds - p1.timestamp.seconds + (p2.timestamp.nanoseconds - p1.timestamp.nanoseconds) / 1e9;
            segmentAvgSpeed = calculateSpeedMph(distKm, timeDiff);
        }
        
        const color = getSpeedColor(segmentAvgSpeed);
        segments.push({ points: [p1, p2], color });
    }
    return segments;
  };

  // Memoize heatmap generation
  const heatmapSegments = useMemo(() => {
    if (!selectedWave) {
      return [];
    }
    return generateHeatmapSegments(selectedWave);
  }, [selectedWave]);

  // --- Render Logic ---
  // Early returns are now AFTER all hooks
  if (loading) {
    return <ActivityIndicator size="large" style={styles.loadingContainer} />;
  }
  if (error) {
    return <Text style={styles.errorContainer}>{error}</Text>;
  }
  if (!sessionData) {
    return <Text style={styles.errorContainer}>Session data could not be loaded.</Text>;
  }

  // --- Main Return --- (summaryStats is already calculated)
  return (
    <GestureHandlerRootView style={{ flex: 1 }}> 
        {/* Container for Map and Overlays */} 
        <View style={styles.container}>
            {/* Map View - Now satellite */}
      <MapView
        ref={mapRef}
                style={styles.map} // Make map cover background
                mapType="satellite" // Set map type to satellite
                initialRegion={sessionRegion} 
        onMapReady={() => setMapDetailReady(true)}
                showsUserLocation={false}
                showsPointsOfInterest={false}
                // Disable map interactions while modal is potentially open?
                // scrollEnabled={false} 
                // zoomEnabled={false}
            >
                {/* Render ALL non-selected wave paths (dimly) */}
                {waves.map((wave, waveIdx) => {
                    // Use optional chaining and check length
                    if (waveIdx === selectedWaveIndex || !wave.coordinates || wave.coordinates.length < 2) {
                        return null;
                    }
                    // Render non-selected waves using original coordinates (no smoothing here)
                    return (
                        <Polyline
                            key={`wave-path-${waveIdx}`}
                            coordinates={wave.coordinates} // Use original coordinates
                            strokeColor={colors.primaryBlueRGBA} 
                            strokeWidth={3} 
                            zIndex={0} 
                        />
                    );
                })}
    
                {/* Render selected wave as HEATMAP */}
                {heatmapSegments.map((segment, index) => (
                    <Polyline
                        key={`heatmap-segment-${selectedWaveIndex}-${index}`}
                        coordinates={segment.points} // Use the 2 points for the segment
                        strokeColor={segment.color}
                        strokeWidth={5} 
                        zIndex={1} 
                    />
                ))}
                {/* Markers for start/end of selected wave */}
                {selectedWave?.coordinates && selectedWave.coordinates.length > 0 && (
             <>
                          <Marker
                              coordinate={selectedWave.coordinates[0]}
                              title={`Wave ${selectedWaveIndex + 1} Start`}
                              pinColor={colors.markerAqua} 
                          />
                          <Marker
                              coordinate={selectedWave.coordinates[selectedWave.coordinates.length - 1]}
                              title={`Wave ${selectedWaveIndex + 1} End`}
                              pinColor={colors.red}
                          />
             </>
         )}
      </MapView>

            {/* --- Overlays Container --- */}
            <View style={styles.overlayContainer}>
                {/* --- NEW Wave Slider --- */} 
                <View style={styles.waveSliderOuterContainer}>
                     <View style={styles.waveSliderInnerContainer}>
                        {/* Summary Button */} 
                         <TouchableOpacity style={styles.waveNavButton} onPress={handleSelectSummary}>
                            <Ionicons name="list-outline" size={24} color={selectedWaveIndex === -1 ? colors.white : colors.textPrimary} />
                         </TouchableOpacity>

                        {/* Previous Button */} 
                        <TouchableOpacity style={styles.waveNavButton} onPress={handleSelectPrevious}>
                             <Ionicons name="chevron-back-outline" size={26} color={colors.textPrimary} />
                        </TouchableOpacity>

                        {/* Slider Track / Text Indicator */} 
                        <View style={styles.waveSliderTrack}>
                             {/* Optional: Add a visual progress bar background */} 
                             <View style={styles.waveSliderProgressBackground} /> 
                             {/* Optional: Add a visual progress bar foreground */} 
                             {displayableWaves.length > 0 && (
                                 <View style={[styles.waveSliderProgressForeground, {
                                     width: `${((selectedWaveIndex + 1) / displayableWaves.length) * 100}%`
                                 }]} /> 
                             )}
                             {/* Text Indicator */} 
                             <Text style={styles.waveSliderText}>
                                {selectedWaveIndex === -1 ? 
                                    "Session Summary" : 
                                    `Wave ${selectedWaveIndex + 1} / ${displayableWaves.length}`
                                }
                             </Text>
          </View>

                         {/* Next Button */} 
                         <TouchableOpacity style={styles.waveNavButton} onPress={handleSelectNext}>
                             <Ionicons name="chevron-forward-outline" size={26} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>
                    </View>

                {/* --- Primary Metrics Box --- */} 
                <View style={styles.primaryMetricsContainer}>
                    {selectedWaveIndex === -1 ? (
                        // Session Summary Primary Stats
                        summaryStats ? (
                            <View style={styles.primaryStatsGrid}>
                                <PrimaryStat icon="water-outline" label="Total Waves" value={summaryStats.count.toString()} />
                                <PrimaryStat icon="map-outline" label="Total Distance" value={summaryStats.totalDistance.toFixed(0)} unit="m" />
                                <PrimaryStat icon="flash-outline" label="Best Speed" value={summaryStats.bestMaxSpeed.toFixed(1)} unit="mph" />
                                <PrimaryStat icon="stopwatch-outline" label="Total Wave Time" value={formatDuration(summaryStats.totalDuration)} />
                            </View>
             ) : (
                            <Text style={styles.noStatsText}>No Summary Available</Text> 
                        )
                    ) : (
                        // Selected Wave Primary Stats
                        selectedWave ? (
                            <View style={styles.primaryStatsGrid}>
                                <PrimaryStat icon="flag-outline" label="Wave #" value={`${selectedWaveIndex + 1} / ${displayableWaves.length}`} />
                                <PrimaryStat icon="navigate-outline" label="Distance" value={calculatePathDistance(selectedWave.coordinates).toFixed(0)} unit="m" />
                                <PrimaryStat icon="flash-outline" label="Max Speed" value={selectedWave.topSpeed.toFixed(1)} unit="mph" />
                                <PrimaryStat icon="time-outline" label="Duration" value={formatDuration(selectedWave.duration)} />
                            </View>
                        ) : (
                            <Text style={styles.noStatsText}>No Wave Data</Text>
                        )
             )}
         </View>
            </View>
        </View>
        
         {/* --- Modalize Bottom Sheet (Stays outside the map container) --- */}
         <Modalize
            ref={modalizeRef}
            adjustToContentHeight
            handleStyle={styles.modalHandle}
            modalStyle={styles.modalContainer}
            HeaderComponent={
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                         {selectedWaveIndex === -1 ? 'Session Summary' : `Wave ${selectedWaveIndex + 1} Details`}
                    </Text>
                </View>
            }
        >
            <ScrollView contentContainerStyle={styles.panelContentContainer}>
                 {selectedWaveIndex === -1 ? (
                    // Session Summary View
                    summaryStats ? (
                        <View>
                            <StatRow icon="water-outline" label="Total Waves" value={summaryStats.count.toString()} />
                            <StatRow icon="stopwatch-outline" label="Total Wave Time" value={formatDuration(summaryStats.totalDuration)} />
                            <StatRow icon="calendar-outline" label="Session Length" value={formatDuration(summaryStats.sessionLengthSeconds)} />
                            <StatRow icon="time-outline" label="Avg Wave Duration" value={formatDuration(summaryStats.avgDuration)} />
                            <StatRow icon="speedometer-outline" label="Avg Max Speed" value={summaryStats.avgMaxSpeed.toFixed(1)} unit="mph" />
                            <StatRow icon="flash-outline" label="Best Max Speed" value={summaryStats.bestMaxSpeed.toFixed(1)} unit="mph" />
                            <StatRow icon="map-outline" label="Total Distance" value={summaryStats.totalDistance.toFixed(0)} unit="m" />
                            {/* Add more summary stats if desired */}
                        </View>
                    ) : (
                        <Text style={styles.noStatsText}>No wave data to summarize.</Text>
                    )
                 ) :
                    // Individual Wave View
                     selectedWave ? (
                         <View>
                            <StatRow icon="time-outline" label="Duration" value={formatDuration(selectedWave.duration)} />
                            <StatRow icon="flash-outline" label="Max Speed" value={selectedWave.topSpeed.toFixed(1)} unit="mph" />
                            <StatRow icon="speedometer-outline" label="Avg Speed" value={selectedWave.averageSpeed.toFixed(1)} unit="mph" />
                            <StatRow icon="navigate-outline" label="Distance" value={calculatePathDistance(selectedWave.coordinates).toFixed(0)} unit="m" />
                            <StatRow icon="play-back-circle-outline" label="Start Time" value={formatTimestamp(selectedWave.startTime)} />
                            <StatRow icon="play-forward-circle-outline" label="End Time" value={formatTimestamp(selectedWave.endTime)} />
    </View>
                     ) : (
                         <Text style={styles.noStatsText}>Wave data not available.</Text>
                     )
                 }
            </ScrollView>
        </Modalize>
    </GestureHandlerRootView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, // Fallback background
  },
  map: {
     // Make map fill the container initially
    ...StyleSheet.absoluteFillObject,
  },
  overlayContainer: {
    position: 'absolute',
      // Position above the bottom sheet handle/peek area
      bottom: BOTTOM_SHEET_PEEK_HEIGHT, 
    left: 0,
    right: 0,
      alignItems: 'center',
  },
  loadingContainer: {
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
     backgroundColor: colors.background,
  },
  errorContainer: {
     flex: 1,
     justifyContent: 'center',
      alignItems: 'center',
     padding: 20,
  },
  errorText: {
     fontSize: 16,
     color: colors.red,
     textAlign: 'center',
  },
  waveSliderOuterContainer: {
      width: '90%', // Take most of screen width
      marginBottom: 10, // Space between slider and metrics box
  },
  waveSliderInnerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.85)', // Opaque white background
      borderRadius: 30, // Fully rounded ends
      paddingHorizontal: 5,
      paddingVertical: 5,
      height: WAVE_SELECTOR_HEIGHT, // Fixed height
      // Add shadow for depth
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2, },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
  },
  waveNavButton: {
      paddingHorizontal: 15,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
  },
  waveSliderTrack: {
      flex: 1, // Take remaining space
      height: '80%', // Slightly smaller than container
      backgroundColor: 'rgba(0, 0, 0, 0.05)', // Faint track background
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative', // For absolute positioning of progress bars
      overflow: 'hidden', // Clip progress bars
      marginHorizontal: 5,
  },
   waveSliderProgressBackground: {
       ...StyleSheet.absoluteFillObject, // Optional full background
       backgroundColor: 'rgba(0, 0, 0, 0.05)', 
   },
   waveSliderProgressForeground: {
       position: 'absolute',
       left: 0,
       top: 0,
       bottom: 0,
       backgroundColor: colors.primaryBlue, // Progress color
       borderRadius: 20,
   },
  waveSliderText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      zIndex: 1, // Ensure text is above progress bars
  },
  primaryMetricsContainer: {
      width: '90%', 
      // height: PRIMARY_METRICS_HEIGHT, // Height will be dynamic based on content
      backgroundColor: colors.cardBackground,
      borderRadius: 15,
      padding: 15,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2, },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
      // Remove center alignment, grid will handle layout
      // justifyContent: 'center',
      // alignItems: 'center',
  },
  primaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  primaryStatItem: {
      width: '48%', // Two items per row with slight gap
      flexDirection: 'row',
    alignItems: 'center',
      marginBottom: 10, // Space between rows
  },
  primaryStatIcon: {
      marginRight: 8,
  },
  primaryStatValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.textPrimary,
  },
  primaryStatUnit: {
      fontSize: 12,
      fontWeight: 'normal',
      color: colors.textSecondary,
  },
  primaryStatLabel: {
    fontSize: 12,
      color: colors.textSecondary,
  },
  modalContainer: {
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      backgroundColor: colors.cardBackground,
      paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  modalHandle: {
      width: 40,
      height: 5,
      backgroundColor: colors.inputBorder,
      borderRadius: 2.5,
      marginTop: 10,
  },
  modalHeader: {
     paddingVertical: 15,
     paddingHorizontal: 20,
     borderBottomWidth: 1,
     borderBottomColor: colors.inputBorder,
     backgroundColor: colors.cardBackground,
     borderTopLeftRadius: 25,
     borderTopRightRadius: 25,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
     color: colors.textPrimary,
     textAlign: 'center',
  },
  panelContentContainer: {
       paddingVertical: 20,
       paddingHorizontal: 20,
  },
  statRow: {
     flexDirection: 'row',
    alignItems: 'center',
     paddingVertical: 12,
     borderBottomWidth: 1,
     borderBottomColor: colors.background,
  },
  statRowIcon: {
      marginRight: 15,
  },
  statRowLabel: {
     flex: 1,
     fontSize: 15,
     color: colors.textPrimary,
  },
  statRowValue: {
     fontSize: 15,
     fontWeight: 'bold',
     color: colors.textPrimary,
     textAlign: 'right',
  },
  statRowUnit: {
     fontSize: 13,
     fontWeight: 'normal',
       color: colors.textSecondary,
   },
  noStatsText: {
      textAlign: 'center',
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textSecondary,
  }
});

export default SessionDetailScreen; 