import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { collection, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import MapView, { Polyline } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Session, Wave, GeoPoint } from '../types';
import { AppStackParamList } from '../navigation/AppNavigator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ThemeContext } from '../context/ThemeContext';
import { Colors } from '../constants/Colors';
import { useUnits } from '../context/UnitContext';
import { formatDistance, formatDuration, formatSpeed } from '../utils/units';

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

// Define height for the new bottom section - adjust as needed
const BOTTOM_INFO_AREA_HEIGHT = screenHeight * 0.35; // Adjusted height slightly

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

// --- SessionDetailScreen Implementation ---

const SessionDetailScreen = () => {
  const route = useRoute<SessionDetailScreenRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { sessionId } = route.params;
  const mapRef = useRef<MapView>(null);
  const { theme } = useContext(ThemeContext);
  const { units, isUnitLoading } = useUnits();
  const styles = getStyles(theme);

  const [sessionData, setSessionData] = useState<Session | null>(null);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWaveIndex, setSelectedWaveIndex] = useState(-1);
  const [mapDetailReady, setMapDetailReady] = useState(false);

  // --- Adjust Edge Padding for new bottom section height ---
  // Ensure bottom padding accounts for the info area height + some extra space
  const SUMMARY_EDGE_PADDING = { top: 80, right: 60, bottom: BOTTOM_INFO_AREA_HEIGHT + 30, left: 60 };
  const WAVE_EDGE_PADDING = { top: 60, right: 50, bottom: BOTTOM_INFO_AREA_HEIGHT + 30, left: 50 };
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

  // Calculate Summary Stats (Adjust for required stats)
  const summaryStats = useMemo(() => {
    const count = displayableWaves.length;
    if (!sessionData || count === 0) return null;

    // Calculate total duration of the session (first wave start to last wave end)
    const firstWaveStartMs = displayableWaves[0].startTime?.toDate().getTime();
    const lastWaveEndMs = displayableWaves[count - 1].endTime?.toDate().getTime();
    const sessionDurationSec = (firstWaveStartMs && lastWaveEndMs) ? (lastWaveEndMs - firstWaveStartMs) / 1000 : 0;
    // const totalWaveDurationSec = displayableWaves.reduce((sum, w) => sum + w.duration, 0);

    // Find longest ride (distance)
    const longestRideMeters = Math.max(...displayableWaves.map(w => calculatePathDistance(w.coordinates) || 0));

    // Find top speed across all waves
    const topSpeedKph = Math.max(...displayableWaves.map(w => w.topSpeed || 0));

    // Get start/end times for display - ensure we call .toDate()
    const sessionStartTimestamp = displayableWaves[0].startTime;
    const sessionEndTimestamp = displayableWaves[count - 1].endTime;
    const sessionStartTime = sessionStartTimestamp ? sessionStartTimestamp.toDate() : (sessionData.sessionDate instanceof Timestamp ? sessionData.sessionDate.toDate() : sessionData.sessionDate);
    const sessionEndTime = sessionEndTimestamp ? sessionEndTimestamp.toDate() : (sessionData.sessionDate instanceof Timestamp ? sessionData.sessionDate.toDate() : sessionData.sessionDate); // Fallback

    return {
        count,
        longestRideFormatted: formatDistance(longestRideMeters, units, 0),
        topSpeedFormatted: formatSpeed(topSpeedKph, units, 1),
        startTimeFormatted: sessionStartTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '-',
        endTimeFormatted: sessionEndTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '-',
    };
  }, [displayableWaves, sessionData, units]);

  // Formatters
  const formatTimestamp = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateInput: Date | Timestamp | undefined): string => {
      if (!dateInput) return 'Date Unknown';
      // Convert Timestamp to Date if necessary
      const date = dateInput instanceof Timestamp ? dateInput.toDate() : dateInput;
      // Example Format: Tue 03 Jan 2023
      return date.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Handlers
  const handleBack = () => navigation.goBack();
  const handleFilter = () => console.log('Filter pressed (placeholder)');
  const handleShare = () => console.log('Share pressed (placeholder)');

  const handleSelectSummary = () => {
    if (selectedWaveIndex !== -1) {
        handleWaveSelect(-1);
    }
  };

  const handleSelectPrevious = () => {
    const newIndex = selectedWaveIndex <= 0 // Allow -1 for summary
        ? displayableWaves.length - 1 // Wrap from summary/first wave to last wave
        : selectedWaveIndex - 1; // Go to previous
    handleWaveSelect(newIndex);
  };

  const handleSelectNext = () => {
     const newIndex = selectedWaveIndex === displayableWaves.length - 1
         ? -1 // Wrap from last wave to summary
         : selectedWaveIndex + 1; // Go to next or first wave (from summary)
     handleWaveSelect(newIndex);
  };

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
        } else if (sessionRegion) {
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

  // MapView and Polylines
  const renderMapContent = () => {
    // Show loading indicator for the map itself if mapDetailReady is false and still loading session/wave data
    if (!mapDetailReady && loading) {
      return <ActivityIndicator size="large" color={Colors[theme].activityIndicator} style={styles.mapLoadingIndicator} />;
    }
    // Show no data message if sessionData is missing or no coordinates to display
    if (!sessionData || (!sessionData.startLatitude && waves.length === 0 && (!selectedWave || !selectedWave.coordinates || selectedWave.coordinates.length === 0))) {
      return <Text style={styles.noDataText}>No map data available for this session.</Text>;
    }

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={sessionRegion} // sessionRegion is memoized and handles default
        mapType="satellite"
        provider={undefined}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onMapReady={() => setMapDetailReady(true)} // Ensure map readiness is reported for fitToCoordinates
      >
        {/* Polylines - Conditional Rendering based on selectedWaveIndex */}
        {selectedWaveIndex === -1 && waves.map((wave, waveIdx) => {
          if (!wave.coordinates || wave.coordinates.length < 2) {
            return null;
          }
          return (
            <Polyline
              key={`wave-path-summary-${waveIdx}`}
              coordinates={wave.coordinates}
              strokeColor={Colors[theme].waveUnselected} 
              strokeWidth={3} 
              lineCap="round"
              lineJoin="round"
              zIndex={0} 
            />
          );
        })}

        {selectedWaveIndex !== -1 && selectedWave && selectedWave.coordinates && selectedWave.coordinates.length >= 2 && (
          <Polyline
            key={`wave-path-selected-${selectedWaveIndex}`}
            coordinates={selectedWave.coordinates}
            strokeColor={Colors[theme].waveSelected}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            zIndex={1} 
          />
        )}
      </MapView>
    );
  };

  // --- Render Logic ---
  if (loading || isUnitLoading) {
    return <ActivityIndicator size="large" style={styles.loadingContainer} color={Colors[theme].text} />;
  }
  if (error) {
    return <Text style={[styles.errorText, { textAlign: 'center', marginTop: 50 }]}>{error}</Text>;
  }
  if (!sessionData || !summaryStats) {
    return <Text style={[styles.errorText, { textAlign: 'center', marginTop: 50 }]}>Session data could not be loaded.</Text>;
  }

  // Get data for the currently selected wave (if any)
  const currentWaveData = selectedWaveIndex >= 0 ? displayableWaves[selectedWaveIndex] : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Main container takes full screen */}
        <View style={styles.container}>
            {/* Map takes full space available initially */}
            {renderMapContent()}

            {/* Floating Map Controls - Re-add Back Button */}
            <View style={styles.mapControlsContainer}>
                 {/* Back button re-added */}
                 <TouchableOpacity style={styles.iconButtonTouchable} onPress={handleBack}>
                    <Ionicons name="arrow-back" size={28} color={Colors[theme].icon} />
                 </TouchableOpacity>
                {/* Right controls */}
                <View style={styles.rightMapControls}>
                    <TouchableOpacity style={styles.iconButtonTouchable} onPress={handleFilter}>
                        <Ionicons name="filter" size={24} color={Colors[theme].icon} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconButtonTouchable, { marginLeft: 10 }]} onPress={handleShare}>
                        <Ionicons name="share-social" size={24} color={Colors[theme].icon} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom Info Area - Absolutely Positioned */} 
            <View style={styles.bottomInfoArea}>
                {/* Wave Slider */}
                <View style={styles.waveSliderContainer}>
                    <TouchableOpacity style={styles.waveNavButton} onPress={handleSelectSummary}>
                        <Ionicons name="list-outline" size={24} color={Colors[theme].text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.waveNavButton} onPress={handleSelectPrevious} disabled={displayableWaves.length === 0}>
                         <Ionicons name="chevron-back-outline" size={26} color={Colors[theme].text} />
                    </TouchableOpacity>
                    {/* New Slider Area */}
                    <View style={styles.newSliderContainer}>
                        <Text style={styles.waveSliderText}>  {/* Re-added Text Label */}
                            {selectedWaveIndex === -1 ?
                                "Session Summary" :
                                `Wave ${selectedWaveIndex + 1} / ${displayableWaves.length}`
                            }
                        </Text>
                        <View style={styles.newSliderTrackBase}>
                            {/* Trail line - dynamically sized */}
                            <View style={[
                                styles.newSliderTrail,
                                {
                                    width: displayableWaves.length > 0 ? 
                                           `${((selectedWaveIndex + 1) / (displayableWaves.length)) * 100}%` : 
                                           '0%',
                                },
                            ]} />
                            {/* Handle - dynamically positioned */}
                            <View style={[
                                styles.newSliderHandle,
                                {
                                    left: displayableWaves.length > 0 ? 
                                          `${((selectedWaveIndex + 1) / (displayableWaves.length)) * 100}%` : 
                                          '0%',
                                    // Adjust left position slightly to center the handle over the point if handle has width
                                    // transform: [{ translateX: -HANDLE_SIZE / 2 }] // HANDLE_SIZE would be a constant
                                },
                            ]} />
                        </View>
                    </View>
                    <TouchableOpacity style={styles.waveNavButton} onPress={handleSelectNext} disabled={displayableWaves.length === 0}>
                         <Ionicons name="chevron-forward-outline" size={26} color={Colors[theme].text} />
                    </TouchableOpacity>
                 </View>

                {/* Session Info */} 
                <View style={styles.sessionInfoContainer}>
                    <View>
                        <Text style={styles.sessionDateText}>{formatDate(sessionData.sessionDate)}</Text>
                        <Text style={styles.sessionLocationText}>{sessionData.location ?? 'Unknown Location'}</Text>
                    </View>
                    <Text style={styles.sessionTimeText}>
                        {summaryStats.startTimeFormatted} – {summaryStats.endTimeFormatted}
                    </Text>
                </View>

                {/* Primary Stats Display - Corrected Font Styles */}
                {selectedWaveIndex === -1 ? (
                    // Summary Stats View
                    <View style={styles.primaryStatsContainer}>
                        <View style={styles.primaryStatItem}>
                            <Text style={styles.primaryStatValueLarge}>{summaryStats.count}</Text>
                            <Text style={styles.primaryStatLabel}>Waves</Text>
                        </View>
                        <View style={styles.primaryStatItem}>
                            <Text style={styles.primaryStatValueSmall}>{summaryStats.longestRideFormatted.split(' ')[0]}</Text>
                            <Text style={styles.primaryStatLabel}>Longest {summaryStats.longestRideFormatted.split(' ')[1]}</Text>
                        </View>
                        <View style={styles.primaryStatItem}>
                            <Text style={styles.primaryStatValueSmall}>{summaryStats.topSpeedFormatted.split(' ')[0]}</Text>
                            <Text style={styles.primaryStatLabel}>Top Speed {summaryStats.topSpeedFormatted.split(' ')[1]}</Text>
                        </View>
                    </View>
                ) : (
                    // Individual Wave Stats View
                    currentWaveData ? (
                        <View style={styles.primaryStatsContainer}>
                            {/* First Item: Duration (Large) */}
                            <View style={styles.primaryStatItem}>
                                <Text style={styles.primaryStatValueLarge}>{formatDuration(currentWaveData.duration).split(' ')[0]}</Text>
                                <Text style={styles.primaryStatLabel}>Duration sec</Text>
                            </View>
                             {/* Subsequent Items (Small) */}
                            <View style={styles.primaryStatItem}>
                                <Text style={styles.primaryStatValueSmall}>{formatSpeed(currentWaveData.topSpeed, units, 1).split(' ')[0]}</Text>
                                <Text style={styles.primaryStatLabel}>Top Speed {formatSpeed(currentWaveData.topSpeed, units, 1).split(' ')[1]}</Text>
                            </View>
                            <View style={styles.primaryStatItem}>
                                <Text style={styles.primaryStatValueSmall}>{formatSpeed(currentWaveData.averageSpeed, units, 1).split(' ')[0]}</Text>
                                <Text style={styles.primaryStatLabel}>Avg Speed {formatSpeed(currentWaveData.averageSpeed, units, 1).split(' ')[1]}</Text>
                            </View>
                             <View style={styles.primaryStatItem}>
                                <Text style={styles.primaryStatValueSmall}>{formatDistance(calculatePathDistance(currentWaveData.coordinates), units, 0).split(' ')[0]}</Text>
                                <Text style={styles.primaryStatLabel}>Distance {formatDistance(calculatePathDistance(currentWaveData.coordinates), units, 0).split(' ')[1]}</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.primaryStatsContainer}>
                            <Text style={styles.errorText}>Wave data unavailable.</Text>
                        </View>
                    )
                )}
                 {/* Placeholder for reactions/empty space */}
                 <View style={{ height: 30 }} /> 
            </View>
        </View>
    </GestureHandlerRootView>
  );
};

// --- Styles ---
const getStyles = (theme: 'light' | 'dark') => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors[theme].background, // Background color for area outside map/bottom sheet
  },
  // Remove mapContainer style, map directly fills the space
  map: {
    flex: 1, // Let the map initially try to fill the container
    // It will be overlaid by the absolutely positioned bottomInfoArea
  },
  mapControlsContainer: {
        position: 'absolute',
        top: Platform.OS === 'android' ? 15 : 50,
        left: 15, // Re-add left spacing for back button
        right: 15,
        flexDirection: 'row', // Added back for layout
        justifyContent: 'space-between', // Added back for layout
        alignItems: 'center', // Align items vertically
        zIndex: 10,
    },
    rightMapControls: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButtonTouchable: {
        backgroundColor: Colors[theme].iconBackground,
        padding: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
  loadingContainer: {
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
     backgroundColor: Colors[theme].background,
  },
  errorText: {
     fontSize: 16,
     color: Colors[theme].red,
  },
  bottomInfoArea: {
    position: 'absolute', // Position absolutely over the map
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_INFO_AREA_HEIGHT,
    backgroundColor: Colors[theme].cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: theme === 'dark' ? 0.2 : 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  waveSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors[theme].sliderBackground, // Use new semi-transparent background
    borderRadius: 30, // Fully rounded ends
    paddingHorizontal: 5,
    paddingVertical: 5,
    height: 55, // Adjust height as needed
    marginBottom: 15, // Space below slider
  },
  waveNavButton: {
      paddingHorizontal: 10,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
  },
  waveSliderTrack: {
      // This style is no longer directly used for the track itself, 
      // but its container 'newSliderContainer' will manage layout.
      // Keeping it for now in case any sub-component needs it, or remove if truly unused.
      // flex: 1, 
      // height: '100%',
      // justifyContent: 'center',
      // alignItems: 'center',
      // marginHorizontal: 5,
  },
  // Remove old dot styles if they are no longer used by other components
  // waveSliderDotsContainer: { ... },
  // waveDot: { ... },
  // waveDotActive: { ... },

  newSliderContainer: { // Container for the entire new slider mechanism
    flex: 1,
    paddingVertical: 5, // Add some vertical padding
    alignItems: 'center',
    marginHorizontal: 5,
  },
  waveSliderText: { // Re-purposed for the label above the slider
    fontSize: 16,
    fontWeight: '600',
    color: Colors[theme].text,
    marginBottom: 8, // Space between label and track
  },
  newSliderTrackBase: { // The visual bar/track of the slider
    height: 6, // Example height for the track bar
    width: '100%',
    backgroundColor: Colors[theme].border, // A neutral color for the base track
    borderRadius: 3,
    justifyContent: 'center',
    position: 'relative', // For positioning trail and handle
    marginBottom: 8, // Space between track and labels below
  },
  newSliderTrail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors[theme].primary, // Changed to primary color (blue)
    borderRadius: 3,
    height: '100%', // Match track height
  },
  newSliderHandle: {
    position: 'absolute',
    top: -4, // Position slightly above the track center for a 14x14 handle on a 6px track
    width: 14, // Example size for the handle
    height: 14,
    borderRadius: 7, // Make it a circle
    backgroundColor: Colors[theme].primary, // Use primary color for now, glow later
    // transform: [{ translateX: -7 }], // Center the handle on its 'left' position. This needs to be calculated dynamically if left is a percentage
    shadowColor: Colors[theme].primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 5, // For Android shadow
  },
  sessionInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15, // Space below session info
    paddingHorizontal: 5, // Slight indent
  },
  sessionDateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors[theme].text,
    marginBottom: 2,
  },
  sessionLocationText: {
    fontSize: 14,
    color: Colors[theme].textSecondary,
  },
  sessionTimeText: {
    fontSize: 14,
    color: Colors[theme].textSecondary,
    fontWeight: '500',
  },
  primaryStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Distribute stats evenly
    alignItems: 'flex-start', // Align items to the top
    // backgroundColor: 'lightgreen', // Debugging layout
  },
  primaryStatItem: {
    alignItems: 'center', // Center text horizontally
    minWidth: '25%', // Adjust width as needed (3 or 4 items)
    paddingHorizontal: 5,
    // backgroundColor: 'pink', // Debugging layout
  },
  primaryStatValueLarge: { // Style for the first stat value
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors[theme].primary,
    marginBottom: -2,
    lineHeight: 52,
  },
  primaryStatValueSmall: { // Style for other stat values
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors[theme].primary,
    marginBottom: 0,
    lineHeight: 36,
  },
  primaryStatLabel: {
    fontSize: 13,
    color: Colors[theme].textSecondary,
    marginTop: 0,
  },
  mapLoadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 16,
    color: Colors[theme].textSecondary,
  },
});

export default SessionDetailScreen; 