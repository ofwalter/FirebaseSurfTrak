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
  onFilterPress: () => void;
  onRefreshPress: () => void;
  isAdding: boolean;
}

// Revert to a structure that allows better centering and button styling
const SessionsHeader = ({ onAddPress, onFilterPress, onRefreshPress, isAdding }: SessionsHeaderProps) => {
    return (
        <View style={styles.headerContainer}> 
            {/* Left Button (Add) - Styled like right buttons */} 
            <View style={styles.headerSideContainer}> 
                 {/* Replace circle button with icon button */} 
                 <TouchableOpacity style={styles.headerIconButton} onPress={onAddPress} disabled={isAdding} activeOpacity={0.7}>
                    {isAdding 
                        ? <ActivityIndicator size="small" color={colors.primaryBlue}/> 
                        : <Ionicons name="add-outline" size={28} color={colors.primaryBlue} /> // Adjusted size and color
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

                let speedMph = 0;
                if (p > 0) {
                    // Calculate speed based on previous point
                    const prevPoint = waveCoordinates[p - 1];
                    const distKm = getDistanceFromLatLonInKm(prevPoint.latitude, prevPoint.longitude, lat, lon);
                    // Use actual time interval for speed calc
                    const timeDiff = currentTimestamp.seconds - prevPoint.timestamp.seconds + (currentTimestamp.nanoseconds - prevPoint.timestamp.nanoseconds) / 1e9;
                    speedMph = calculateSpeedMph(distKm, timeDiff);

                    // Simulate speed variation (e.g., faster in the middle)
                    const speedFactor = 1 + Math.sin(progress * Math.PI) * 0.5; // Faster middle
                    speedMph *= speedFactor;
                    speedMph = Math.max(0, Math.min(speedMph, 30)); // Clamp speed (0-30 mph)

                    waveTotalSpeedSum += speedMph;
                    speedPointsCount++;
                    if (speedMph > waveMaxSpeed) waveMaxSpeed = speedMph;
                    if (speedMph > sessionMaxSpeed) sessionMaxSpeed = speedMph;
                }

                waveCoordinates.push({ 
                    latitude: lat, 
                    longitude: lon, 
                    timestamp: currentTimestamp, 
                    speed: speedMph // Store calculated speed
                });
            }

            const waveAverageSpeed = speedPointsCount > 0 ? waveTotalSpeedSum / speedPointsCount : 0;

            // Create wave data with calculated aggregates
            const newWaveData: Omit<Wave, 'id'> = {
                startTime: waveStartTime,
                endTime: waveEndTime,
                duration: waveDurationSeconds,
                topSpeed: waveMaxSpeed, // Use calculated max speed for the wave
                averageSpeed: waveAverageSpeed, // Use calculated average speed
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
          onFilterPress={() => setIsSortModalVisible(true)}
          onRefreshPress={fetchSessions}
          isAdding={adding}
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