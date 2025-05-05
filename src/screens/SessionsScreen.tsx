import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  SafeAreaView,
} from 'react-native';
import { db, auth } from '../services/firebaseConfig';
import { collection, addDoc, query, where, getDocs, Timestamp, doc, writeBatch, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { BlurView } from 'expo-blur';
import Ionicons from 'react-native-vector-icons/Ionicons';
import SessionCard from '../components/SessionCard';
import { Session, Wave, GeoPoint } from '../types'; // Import shared types
import * as DocumentPicker from 'expo-document-picker'; // Import document picker
import Papa from 'papaparse'; // Import papaparse
import * as FileSystem from 'expo-file-system'; // Import FileSystem
import * as Location from 'expo-location'; // Import expo-location

// --- Wave Segmentation Parameters --- (Easily Editable)
const WAVE_START_SPEED_KPH = 10.5; // Speed threshold to start detecting a wave (kph)
const WAVE_END_SPEED_KPH = 3.0;   // Speed threshold to stop detecting a wave (kph)
const WAVE_GAP_TOLERANCE_SECONDS = 2; // Max duration (seconds) speed can be below END_SPEED before ending wave
const MIN_WAVE_DURATION_SECONDS = 3.0; // Minimum duration (seconds) for a valid wave
// ------------------------------------

// Define SortCriteria type outside the component
type SortCriteria = 'latest' | 'oldest' | 'spot_az' | 'most_waves';

// Define colors (reuse from HomeScreen or centralize)
const colors = {
  primaryBlue: '#1A73E8',
  secondaryBlue: '#0056B3',
  lightBlue: '#4AB1FF',
  background: '#f0f4f8',
  cardBackground: '#ffffff',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  white: '#ffffff',
  backgroundLight: '#f8f9fa',
  borderLight: '#e5e7eb',
};

type SessionsScreenNavigationProp = NativeStackNavigationProp<AppStackParamList, 'AppTabs'>;

// --- Header Component ---
interface SessionsHeaderProps {
  onAddPress: () => void;
  onUploadPress: () => void;
  onFilterPress: () => void;
  onRefreshPress: () => void;
  isAdding: boolean;
  isUploading?: boolean;
}

// Revert to a structure that allows better centering and button styling
const SessionsHeader = ({ onAddPress, onUploadPress, onFilterPress, onRefreshPress, isAdding, isUploading }: SessionsHeaderProps) => {
    return (
        <View style={styles.headerContainer}> 
            {/* Left Buttons (Add, Upload) */}
            <View style={styles.headerSideContainer}> 
                 {/* Add Fake Session Button */}
                 <TouchableOpacity style={styles.headerIconButton} onPress={onAddPress} disabled={isAdding} activeOpacity={0.7}>
                    {isAdding 
                        ? <ActivityIndicator size="small" color={colors.primaryBlue}/> 
                        : <Ionicons name="add-circle-outline" size={28} color={colors.primaryBlue} /> // Changed icon slightly
                    } 
                 </TouchableOpacity>
                 {/* Upload CSV Button */} 
                 <TouchableOpacity style={styles.headerIconButton} onPress={onUploadPress} disabled={isUploading} activeOpacity={0.7}>
                    {isUploading 
                        ? <ActivityIndicator size="small" color={colors.primaryBlue}/> 
                        : <Ionicons name="cloud-upload-outline" size={28} color={colors.primaryBlue} /> 
                    } 
                 </TouchableOpacity>
            </View>

            {/* Centered Title */} 
            <View style={styles.headerTitleContainer}>
                {/* Keep title style */}
                <Text style={styles.headerTitle}>Sessions</Text>
            </View>

            {/* Right Buttons (Refresh, Filter) - Keep structure */} 
             <View style={[styles.headerSideContainer, styles.headerRightButtons]}>
                 <TouchableOpacity style={styles.headerIconButton} onPress={onRefreshPress}> 
                     <Ionicons name="refresh-outline" size={26} color={colors.primaryBlue} />
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.headerIconButton} onPress={onFilterPress}> 
                     <Ionicons name="filter-outline" size={26} color={colors.primaryBlue} />
                 </TouchableOpacity>
             </View>
        </View>
    );
};

// --- Predefined Surf Spots --- (Coordinates approx. in the water near the break)
const surfSpots = [
  { name: "Steamer Lane", latitude: 36.9558, longitude: -122.0245 },
  { name: "Ocean Beach, SF", latitude: 37.7570, longitude: -122.5107 },
  { name: "Mavericks", latitude: 37.4945, longitude: -122.5010 },
  { name: "Huntington Beach Pier", latitude: 33.6535, longitude: -118.0000 },
  { name: "Trestles (Uppers)", latitude: 33.3850, longitude: -117.5890 },
  { name: "Pipeline, Oahu", latitude: 21.6640, longitude: -158.0535 },
  { name: "Waikiki Beach", latitude: 21.2750, longitude: -157.8300 },
];
// -----------------------------

// Define calculateSpeedMph locally or move to utils
const calculateSpeedMph = (distanceKm: number, timeDiffSeconds: number): number => {
  if (timeDiffSeconds <= 0) return 0;
  const distanceMiles = distanceKm * 0.621371;
  const timeHours = timeDiffSeconds / 3600;
  return distanceMiles / timeHours;
};

// --- Helper Functions Needed Here ---

// Degrees to Radians
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Calculate distance between two lat/lon points in kilometers
// (Copied from SessionDetailScreen - consider moving to a shared utils file later)
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

// --- End Helper Functions ---

// --- SessionsScreen Implementation ---

const SessionsScreen = () => {
  const navigation = useNavigation<SessionsScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false); // Add uploading state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('latest');
  const [isSortModalVisible, setIsSortModalVisible] = useState(false);

  // Get current user (same as before)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
       setCurrentUser(user);
        if (!user) {
            setSessions([]);
            setLoading(false);
        }
    });
    return () => unsubscribe();
  }, []);

  // Fetch sessions (same as before)
  const fetchSessions = useCallback(async () => {
    if (!currentUser) {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
        const sessionsRef = collection(db, 'sessions');
        const q = query(sessionsRef, where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        const fetchedSessions: Session[] = [];
        querySnapshot.forEach((doc) => {
            fetchedSessions.push({ id: doc.id, ...doc.data() } as Session);
        });
        fetchedSessions.sort((a, b) => b.sessionDate.seconds - a.sessionDate.seconds);
        setSessions(fetchedSessions);
    } catch (error) {
        console.error("Error fetching sessions: ", error);
        Alert.alert("Error", "Could not fetch sessions.");
    } finally {
        setLoading(false);
    }
  }, [currentUser]);

  // Fetch sessions when user available (same as before)
  useEffect(() => {
    if (currentUser) {
        fetchSessions();
    }
  }, [currentUser, fetchSessions]);

  // Memoize the sorted sessions
  const sortedSessions = useMemo(() => {
    const sessionsCopy = [...sessions]; // Create a copy to avoid mutating original state
    switch (sortCriteria) {
      case 'latest':
        return sessionsCopy.sort((a, b) => b.sessionDate.seconds - a.sessionDate.seconds);
      case 'oldest':
        return sessionsCopy.sort((a, b) => a.sessionDate.seconds - b.sessionDate.seconds);
      case 'spot_az':
        return sessionsCopy.sort((a, b) => a.location.localeCompare(b.location));
      case 'most_waves':
        return sessionsCopy.sort((a, b) => b.waveCount - a.waveCount);
      default:
        return sessionsCopy;
    }
  }, [sessions, sortCriteria]);

  // Handle CSV Upload -> File Picking and Parsing
  const handleUploadCsv = async () => {
      setUploading(true);
      try {
          const pickerResult = await DocumentPicker.getDocumentAsync({
              type: 'text/csv', // Only allow CSV files
              copyToCacheDirectory: true, // Ensure file is accessible via URI
          });

          // Check if the user cancelled or didn't select a file
          if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
              console.log('CSV upload cancelled or no file selected.');
              setUploading(false);
              return; // Exit if no file was selected
          }

          const fileUri = pickerResult.assets[0].uri;
          const fileName = pickerResult.assets[0].name;
          console.log(`Selected CSV: ${fileName} at ${fileUri}`);

          // Read the file content
          let fileContent = await FileSystem.readAsStringAsync(fileUri);

          // Pre-process the string: Remove BOM and normalize line endings
          if (fileContent.charCodeAt(0) === 0xFEFF) { // Check for BOM
              console.log("Removing BOM from file content.");
              fileContent = fileContent.substring(1);
          }
          console.log("Normalizing line endings.");
          fileContent = fileContent.replace(/\r\n|\r/g, '\n'); // Replace \r\n and \r with \n
          // Parse the CLEANED CSV content
          Papa.parse(fileContent, {
              header: true,
              skipEmptyLines: true,
              delimiter: ",", 
              // No explicit newline - rely on auto-detection on the *cleaned* string
              dynamicTyping: true, 
              complete: (results) => {
                  console.log('PapaParse complete. Metadata:', results.meta);
                  console.log(`Parsed ${results.data.length} rows.`);
                  
                  if (results.errors.length > 0) {
                      console.error('CSV Parsing Errors:', results.errors);
                      const errorMessages = results.errors.map(e => `${e.message} (Row: ${e.row})`).join('\n');
                      Alert.alert('Parsing Error', `Could not parse CSV file. Check format and content.\n${errorMessages}`);
                      setUploading(false);
                      return;
                  }

                  // Headers are validated *before* calling processAndStoreSession below
                  if (!results.meta || !results.meta.fields) {
                       Alert.alert('Parsing Error', 'Could not detect headers in the CSV file (results.meta missing).');
                       setUploading(false);
                       return;
                  }
                  
                  // Call validation and processing function
                  validateAndProcessCsvData(results.data, results.meta.fields, fileName);
              },
              error: (error: Error) => {
                  console.error('CSV Parsing Failed:', error);
                  Alert.alert('Parsing Error', `Failed to parse CSV: ${error.message}`);
                  setUploading(false);
              }
          });

      } catch (error) {
          console.error("Error picking or reading CSV file: ", error);
          Alert.alert("Upload Error", "Could not pick or read the CSV file.");
          setUploading(false);
      }
      // Note: setUploading(false) will be called within processAndStoreSession or on error
  };

  // New function to Validate Headers and then Process/Store
  const validateAndProcessCsvData = async (csvData: any[], actualHeaders: string[], fileName: string) => {
        // 1. Validate Headers
        const expectedHeaders = ['Time', 'Latitude', 'Longitude', 'Altitude', 'Satellites', 'Speed', 'AccelX', 'AccelY', 'AccelZ'];
        const missingHeaders = expectedHeaders.filter(h => !actualHeaders.includes(h));

        if (missingHeaders.length > 0) {
            console.error('Missing CSV Headers:', missingHeaders);
            Alert.alert('Invalid CSV', `Missing required columns: ${missingHeaders.join(', ')}`);
            setUploading(false);
            return;
        }
        console.log("CSV headers validated.");
        
        // Call the original processing function (now just processing/storing)
        processAndStoreSession(csvData, fileName);
  }

  // Process Parsed CSV Data and Store as Session/Waves in Firebase
  // (Now assumes headers are already validated)
  const processAndStoreSession = async (csvData: any[], fileName: string) => {
      console.log(`Processing ${csvData.length} validated rows from ${fileName}...`);
      const uploadTimestamp = Timestamp.now(); // Get the timestamp at the start of processing
      const uploadDate = uploadTimestamp.toDate(); // Get the Date object for the upload day

      if (!currentUser) {
          Alert.alert("Error", "User not logged in.");
          setUploading(false);
          return;
      }

      // 2. Prepare Data & Filter Invalid Rows
      // Store the original time string along with parsed values
      const processedPoints: { 
          timestamp: Timestamp; // This will be the combined date+time 
          latitude: number; 
          longitude: number; 
          speedKph: number; 
          timeString: string; // Store original HH:MM:SS
      }[] = [];
      
      for (const row of csvData) {
          try {
              const timeString = row.Time; // e.g., "17:41:23"
              const latitude = parseFloat(row.Latitude);
              const longitude = parseFloat(row.Longitude);
              const speedKph = parseFloat(row.Speed); 

              // Basic validation for numeric types
              if (isNaN(latitude) || isNaN(longitude) || isNaN(speedKph) || typeof timeString !== 'string' || !timeString.match(/^\d{2}:\d{2}:\d{2}$/)) {
                  console.warn('Skipping invalid row (parsing/format error):', row);
                  continue;
              }

              // Construct Date object using upload date + CSV time
              const [hours, minutes, seconds] = timeString.split(':').map(Number);
              const pointDate = new Date(uploadDate); // Start with the upload date
              pointDate.setHours(hours, minutes, seconds, 0); // Set the time from CSV
              
              // Convert the valid Date object to a Timestamp
              const pointTimestamp = Timestamp.fromDate(pointDate);

              processedPoints.push({ timestamp: pointTimestamp, latitude, longitude, speedKph, timeString });
          } catch (e) {
              console.warn('Error processing row, skipping:', row, e);
              continue; // Skip row on error
          }
      }

      if (processedPoints.length < 2) {
          Alert.alert('Invalid Data', 'Not enough valid data points found in the CSV to create a session.');
          setUploading(false);
          return;
      }
      console.log(`Processed ${processedPoints.length} valid data points.`);

      // Sort points by timestamp just in case CSV isn't ordered
      processedPoints.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

      // --- Determine Location via Reverse Geocoding --- 
      let locationName = "Uploaded Session"; // Default location
      /* // Temporarily disable reverse geocoding
      const startLatitude = processedPoints[0].latitude;
      const startLongitude = processedPoints[0].longitude;
      try {
          // Request permissions if not already granted (needed for geocoding)
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
              console.warn('Location permission not granted for reverse geocoding.');
          } else {
              console.log(`Attempting reverse geocode for: ${startLatitude}, ${startLongitude}`);
              let geocodeResult = await Location.reverseGeocodeAsync({ latitude: startLatitude, longitude: startLongitude });
              if (geocodeResult && geocodeResult.length > 0) {
                  // Construct a meaningful name - prioritize specific names, fallback to broader areas
                  const firstResult = geocodeResult[0];
                  locationName = 
                      firstResult.name || 
                      firstResult.street || 
                      firstResult.subregion || // e.g., County or larger area
                      firstResult.city || 
                      firstResult.region || // e.g., State
                      "Geocoded Location"; // Generic fallback if specific names are null
                  console.log(`Reverse geocode successful: ${locationName}`);
              } else {
                  console.warn('Reverse geocode returned no results.');
              }
          }
      } catch (error) {
          console.error('Reverse geocoding failed:', error);
          // Keep the default locationName = "Uploaded Session"
      }
      */ // End temporarily disabled block
      // --------------------------------------------------

      // 3. Segment into Waves (using speed thresholds and gap tolerance)
      console.log(`Segmenting using: Start > ${WAVE_START_SPEED_KPH}kph, End < ${WAVE_END_SPEED_KPH}kph, Gap: ${WAVE_GAP_TOLERANCE_SECONDS}s, Min Duration: ${MIN_WAVE_DURATION_SECONDS}s`);
      
      const wavesRawData: typeof processedPoints[] = []; // Array of arrays of points
      let currentWavePoints: typeof processedPoints = [];
      let state: 'SEARCHING' | 'IN_WAVE' | 'POTENTIAL_END' = 'SEARCHING';
      let potentialEndIndex = -1; // Index in processedPoints where speed dropped below threshold

      for (let i = 0; i < processedPoints.length; i++) {
          const point = processedPoints[i];
          const currentSpeedKph = point.speedKph;

          switch (state) {
              case 'SEARCHING':
                  if (currentSpeedKph > WAVE_START_SPEED_KPH) {
                      // Start of a potential wave
                      console.log(`Potential wave start at index ${i}, speed: ${currentSpeedKph.toFixed(1)} kph`);
                      currentWavePoints = [point];
                      state = 'IN_WAVE';
                      potentialEndIndex = -1; // Reset potential end
                  }
                  break;

              case 'IN_WAVE':
                  currentWavePoints.push(point); // Add current point to wave
                  if (currentSpeedKph < WAVE_END_SPEED_KPH) {
                      // Speed dropped below end threshold, potential end
                      console.log(`Potential wave end trigger at index ${i}, speed: ${currentSpeedKph.toFixed(1)} kph`);
                      state = 'POTENTIAL_END';
                      potentialEndIndex = i; // Record the index where speed first dropped
                  }
                  break;

              case 'POTENTIAL_END':
                  currentWavePoints.push(point); // Still add point while checking gap
                  if (currentSpeedKph > WAVE_END_SPEED_KPH) {
                      // Speed recovered, continue the wave
                      console.log(`Wave continues at index ${i}, speed recovered: ${currentSpeedKph.toFixed(1)} kph`);
                      state = 'IN_WAVE';
                      potentialEndIndex = -1;
                  } else {
                      // Speed still low, check gap tolerance
                      const timeSincePotentialEnd = point.timestamp.seconds - processedPoints[potentialEndIndex].timestamp.seconds;
                      if (timeSincePotentialEnd > WAVE_GAP_TOLERANCE_SECONDS) {
                          // Gap tolerance exceeded, wave has ended
                          // The wave ends at the point *before* the potential end index, or maybe AT potentialEndIndex?
                          // Let's say the wave includes up to the point *at* potentialEndIndex where speed first dropped.
                          const finalWavePoints = currentWavePoints.slice(0, currentWavePoints.length - (i - potentialEndIndex));
                          
                          console.log(`Wave ended at index ${potentialEndIndex}. Duration check needed. Points: ${finalWavePoints.length}`);
                          if (finalWavePoints.length >= 2) {
                               const waveDuration = finalWavePoints[finalWavePoints.length - 1].timestamp.seconds - finalWavePoints[0].timestamp.seconds;
                               if (waveDuration >= MIN_WAVE_DURATION_SECONDS) {
                                   console.log(`Valid wave found! Duration: ${waveDuration.toFixed(1)}s`);
                                   wavesRawData.push(finalWavePoints);
                               } else {
                                   console.log(`Wave too short (${waveDuration.toFixed(1)}s), discarding.`);
                               }
                          } else {
                               console.log("Segment too short after gap processing, discarding.");
                          }
                          
                          // Reset for next wave search, starting from the current point
                          currentWavePoints = [];
                          state = 'SEARCHING';
                          potentialEndIndex = -1;
                          // Re-evaluate the current point in SEARCHING state immediately
                          i--; // Decrement i so the loop processes this point again in SEARCHING state
                      }
                  }
                  break;
          }
      }

      // Handle the last wave if the loop finished while IN_WAVE or POTENTIAL_END
      if (state === 'IN_WAVE' || state === 'POTENTIAL_END') {
            // If POTENTIAL_END, the wave actually finished at potentialEndIndex
            const finalWavePoints = (state === 'POTENTIAL_END' && potentialEndIndex !== -1) 
                ? currentWavePoints.slice(0, currentWavePoints.length - (processedPoints.length - 1 - potentialEndIndex))
                : currentWavePoints;

          console.log(`Checking final segment. State: ${state}, Points: ${finalWavePoints.length}`);
          if (finalWavePoints.length >= 2) {
              const waveDuration = finalWavePoints[finalWavePoints.length - 1].timestamp.seconds - finalWavePoints[0].timestamp.seconds;
              if (waveDuration >= MIN_WAVE_DURATION_SECONDS) {
                  console.log(`Valid final wave found! Duration: ${waveDuration.toFixed(1)}s`);
                  wavesRawData.push(finalWavePoints);
              } else {
                  console.log(`Final wave too short (${waveDuration.toFixed(1)}s), discarding.`);
              }
          } else {
               console.log("Final segment too short, discarding.");
          }
      }

      if (wavesRawData.length === 0) {
          Alert.alert('No Waves Found', 'Could not segment data into waves based on speed thresholds.');
          setUploading(false);
          return;
      }
      console.log(`Segmented into ${wavesRawData.length} potential waves.`);

      // 4. Calculate Wave Stats
      const finalWaves: Omit<Wave, 'id'>[] = [];
      let sessionTotalDuration = 0;
      let sessionLongestWave = 0;
      let sessionMaxSpeed = 0;

      for (const wavePoints of wavesRawData) {
          if (wavePoints.length < 2) continue; // Skip waves with insufficient points

          const startTime = wavePoints[0].timestamp;
          const endTime = wavePoints[wavePoints.length - 1].timestamp;
          const duration = endTime.seconds - startTime.seconds; // Duration in seconds

          let waveDistance = 0;
          let waveTopSpeedMph = 0;
          let waveSpeedSumMph = 0;
          let speedCalcPoints = 0;
          const coordinates: GeoPoint[] = [];

          for (let i = 0; i < wavePoints.length; i++) {
              const p = wavePoints[i];
              coordinates.push({ latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp });

              if (i > 0) {
                  const prevP = wavePoints[i - 1];
                  const distKm = getDistanceFromLatLonInKm(prevP.latitude, prevP.longitude, p.latitude, p.longitude);
                  const timeDiff = p.timestamp.seconds - prevP.timestamp.seconds + (p.timestamp.nanoseconds - prevP.timestamp.nanoseconds) / 1e9;
                  
                  if (timeDiff > 0) {
                       waveDistance += distKm;
                       const speedMph = calculateSpeedMph(distKm, timeDiff);
                       waveSpeedSumMph += speedMph;
                       speedCalcPoints++;
                       if (speedMph > waveTopSpeedMph) {
                           waveTopSpeedMph = speedMph;
                       }
                  }
              }
          }
          
          const averageSpeed = speedCalcPoints > 0 ? waveSpeedSumMph / speedCalcPoints : 0;
          
          // Update session aggregates
          sessionTotalDuration += duration;
          if (duration > sessionLongestWave) {
              sessionLongestWave = duration;
          }
          if (waveTopSpeedMph > sessionMaxSpeed) {
              sessionMaxSpeed = waveTopSpeedMph;
          }

          finalWaves.push({
              startTime,
              endTime,
              duration,
              topSpeed: waveTopSpeedMph,
              averageSpeed,
              coordinates,
              // distance: waveDistance * 1000 // Optional: Store distance in meters
          });
      }

      if (finalWaves.length === 0) {
          Alert.alert('Processing Error', 'No valid waves could be processed from the data.');
          setUploading(false);
          return;
      }
      console.log(`Calculated stats for ${finalWaves.length} waves.`);

      // 5. Calculate Session Stats
      const sessionDate = uploadTimestamp; 
      // Need start lat/lon for session doc even if geocoding is off
      const startLatitude = processedPoints[0].latitude; 
      const startLongitude = processedPoints[0].longitude;
      const location = locationName; // Will use the default "Uploaded Session"

      // 6. Store in Firebase
      try {
          // Create Session Doc (without aggregates initially)
          const sessionRef = await addDoc(collection(db, "sessions"), {
              userId: currentUser.uid,
              location: location,
              sessionDate: sessionDate,
              waveCount: finalWaves.length,
              startLatitude: startLatitude,
              startLongitude: startLongitude,
              // Aggregates will be updated via batch
              duration: 0, 
              longestWave: 0,
              maxSpeed: 0
          });
          console.log(`Created session document: ${sessionRef.id}`);

          // Create Waves in Subcollection using Batch
          const batch = writeBatch(db);
          const wavesSubCollectionRef = collection(db, "sessions", sessionRef.id, "waves");
          finalWaves.forEach(waveData => {
              const waveDocRef = doc(wavesSubCollectionRef); // Auto-generate ID
              batch.set(waveDocRef, waveData);
          });

          // Update Session Doc with Aggregates
          batch.update(sessionRef, { 
              duration: sessionTotalDuration,
              longestWave: sessionLongestWave,
              maxSpeed: sessionMaxSpeed
          });

          // Commit Batch
          await batch.commit();
          console.log("Batch committed successfully.");

          // 7. Update UI
          Alert.alert("Success", `Session from ${fileName} uploaded successfully with ${finalWaves.length} waves!`);
          fetchSessions(); // Refresh the list

      } catch (error) {
          console.error("Error storing session/waves in Firebase: ", error);
          Alert.alert("Database Error", "Could not save the session data.");
      } finally {
          setUploading(false); // Ensure loading state is turned off
      }
  };

  // Add Fake Session
  const addFakeSession = async () => {
    if (!currentUser) {
        Alert.alert("Error", "You must be logged in to add a session.");
        return;
    }
    setAdding(true);

    const randomSpotIndex = Math.floor(Math.random() * surfSpots.length);
    const selectedSpot = surfSpots[randomSpotIndex];
    const baseLatitude = selectedSpot.latitude + (Math.random() - 0.5) * 0.002;
    const baseLongitude = selectedSpot.longitude + (Math.random() - 0.5) * 0.002;
    const locationName = selectedSpot.name;

    try {
        const sessionTimestamp = Timestamp.now();
        const waveCount = Math.floor(Math.random() * 5) + 2; // 2 to 6 waves
        let totalSessionDurationSeconds = 0;
        let sessionLongestWaveDuration = 0;
        let sessionMaxSpeed = 0;

        // Prepare session data (without aggregates initially)
        const newSessionData: Omit<Session, 'id' | 'duration' | 'longestWave' | 'maxSpeed'> = {
            userId: currentUser.uid,
            location: locationName,
            sessionDate: sessionTimestamp,
            waveCount: waveCount,
            startLatitude: baseLatitude,
            startLongitude: baseLongitude,
        };
        const sessionRef = await addDoc(collection(db, "sessions"), newSessionData);

        const batch = writeBatch(db);
        const wavesSubCollectionRef = collection(db, "sessions", sessionRef.id, "waves");

        // Generate Waves with detailed coordinates
        for (let i = 0; i < waveCount; i++) {
            // Realistic wave duration (e.g., 5 to 20 seconds)
            const waveDurationSeconds = Math.floor(Math.random() * 16) + 5;
            totalSessionDurationSeconds += waveDurationSeconds; // Add to session total
            if (waveDurationSeconds > sessionLongestWaveDuration) {
                sessionLongestWaveDuration = waveDurationSeconds;
            }

            // Simulate wave path parameters
            const pointsCount = Math.max(2, Math.ceil(waveDurationSeconds * 2)); // Approx 0.5s interval
            const timeIntervalSeconds = waveDurationSeconds / (pointsCount - 1);
            const waveStartTime = Timestamp.fromMillis(sessionTimestamp.toMillis() + i * 60000 + Math.random() * 5000); // Stagger waves
            const waveEndTime = Timestamp.fromMillis(waveStartTime.toMillis() + waveDurationSeconds * 1000);

            const startLatOffset = (Math.random() - 0.5) * 0.001;
            const startLonOffset = (Math.random() - 0.5) * 0.001;
            const waveStartLat = baseLatitude + 0.0015 + startLatOffset;
            const waveStartLon = baseLongitude + startLonOffset;
            const waveEndLat = baseLatitude - 0.0003 + (Math.random() - 0.5) * 0.0003;
            const waveEndLon = baseLongitude + (Math.random() - 0.5) * 0.0003;

            let waveMaxSpeed = 0;
            let waveTotalSpeedSum = 0;
            let speedPointsCount = 0;
            const waveCoordinates: GeoPoint[] = [];

            // Generate individual points with timestamps and speeds
            for (let p = 0; p < pointsCount; p++) {
                const progress = p / (pointsCount - 1);
                const currentTimestamp = Timestamp.fromMillis(waveStartTime.toMillis() + p * timeIntervalSeconds * 1000);

                // Simulate position with slight randomness
                const lat = waveStartLat + (waveEndLat - waveStartLat) * progress + (Math.random() - 0.5) * 0.00005;
                const lon = waveStartLon + (waveEndLon - waveStartLon) * progress + (Math.random() - 0.5) * 0.00005;

                waveCoordinates.push({ 
                    latitude: lat, 
                    longitude: lon, 
                    timestamp: currentTimestamp, 
                });
            }

            // REMOVE AVERAGE/TOP SPEED CALC BASED ON POINT SPEED
            // TODO: Need to calculate average/top speed differently now, perhaps based on overall wave stats?
            // For now, just set placeholder values.
            const placeholderWaveAverageSpeed = 10; // Placeholder
            const placeholderWaveMaxSpeed = 15; // Placeholder
            if (placeholderWaveMaxSpeed > sessionMaxSpeed) sessionMaxSpeed = placeholderWaveMaxSpeed; // Still track session max speed
            // END REMOVAL/REPLACEMENT

            // Create wave data with calculated aggregates
            const newWaveData: Omit<Wave, 'id'> = {
                startTime: waveStartTime,
                endTime: waveEndTime,
                duration: waveDurationSeconds,
                topSpeed: placeholderWaveMaxSpeed, // Use placeholder max speed for the wave
                averageSpeed: placeholderWaveAverageSpeed, // Use placeholder average speed
                coordinates: waveCoordinates, // Include detailed coords
            };

            // Add wave document to batch
            const waveDocRef = doc(wavesSubCollectionRef);
            batch.set(waveDocRef, newWaveData);
        }

        // Update session document with calculated aggregates
        batch.update(sessionRef, { 
            duration: totalSessionDurationSeconds, // Total duration of all waves
            longestWave: sessionLongestWaveDuration,
            maxSpeed: sessionMaxSpeed // Overall max speed from all waves
        });

        // Commit the batch
        await batch.commit();

        Alert.alert("Success", `Fake session at ${locationName} added!`);
        fetchSessions(); // Refresh the list
    } catch (error) {
        console.error("Error adding fake session: ", error);
        Alert.alert("Error", "Could not add fake session.");
    } finally {
        setAdding(false);
    }
  };

  const handleSelectSort = (criteria: SortCriteria) => {
    setSortCriteria(criteria);
    setIsSortModalVisible(false);
  };

  // Navigate to Detail Screen function
  const navigateToDetail = (session: Session) => {
      if (session.id) {
          navigation.navigate('SessionDetail', {
              sessionId: session.id,
              sessionLocation: session.location
          });
      } else {
          Alert.alert("Error", "Session ID is missing, cannot navigate.");
      }
  };

  // Render item using the new SessionCard component
  const renderSessionItem = ({ item }: { item: Session }) => (
    <SessionCard
      session={item}
      onPress={() => navigateToDetail(item)}
    />
  );

  return (
    <View style={styles.screenContainer}>
      <SessionsHeader
          onAddPress={addFakeSession}
          onUploadPress={handleUploadCsv}
          onFilterPress={() => setIsSortModalVisible(true)}
          onRefreshPress={fetchSessions}
          isAdding={adding}
          isUploading={uploading} // Pass uploading state
      />
      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={sortedSessions}
          renderItem={renderSessionItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContentContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>No sessions recorded yet. Add one!</Text>}
        />
      )}

      <Modal
        animationType="fade"
        transparent={true}
        visible={isSortModalVisible}
        onRequestClose={() => setIsSortModalVisible(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort By</Text>
            <TouchableOpacity style={styles.sortOptionButton} onPress={() => handleSelectSort('latest')}>
              <Text style={styles.sortOptionText}>Latest</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortOptionButton} onPress={() => handleSelectSort('oldest')}>
              <Text style={styles.sortOptionText}>Oldest</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortOptionButton} onPress={() => handleSelectSort('spot_az')}>
              <Text style={styles.sortOptionText}>Spot (A-Z)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sortOptionButton} onPress={() => handleSelectSort('most_waves')}>
              <Text style={styles.sortOptionText}>Most Waves</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sortOptionButton, styles.cancelButton]} onPress={() => setIsSortModalVisible(false)}>
              <Text style={[styles.sortOptionText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.backgroundLight || '#f8f9fa',
  },
  headerContainer: {
    flexDirection: 'row',
    paddingTop: Platform.OS === 'ios' ? 55 : 30, // Maintain vertical padding
    paddingBottom: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background, // Match screen background
    borderBottomWidth: 1, // Keep separator
    borderBottomColor: colors.borderLight, // Use lighter border
    width: '100%', // Ensure it takes full width
  },
  headerSideContainer: {
    flex: 1, // Allows title to center correctly
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 2, // Give title more space to center
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20, // Slightly smaller title
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerRightButtons: {
    justifyContent: 'flex-end', // Align right buttons to the end
  },
  headerIconButton: {
    padding: 8, // Consistent padding for all icon buttons
    marginLeft: 8, // Space between right icons
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    width: '100%',
  },
  listContentContainer: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  emptyText: {
    marginTop: 40,
    textAlign: 'center',
    color: 'grey',
    fontSize: 16,
  },
  sortButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1f2937',
  },
  sortOptionButton: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sortOptionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#1A73E8',
  },
  cancelButton: {
    borderBottomWidth: 0,
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#ef4444',
  },
});

export default SessionsScreen; 