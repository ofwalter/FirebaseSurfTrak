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

// Interfaces (can be moved to types file)
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
  coordinates: GeoPoint[]; // Added coordinates array
}

// Define Session interface locally (ensure ID is required)
interface Session {
  id: string; 
  userId: string;
  location: string;
  sessionDate: Timestamp;
  waveCount: number;
  duration: number;
  longestWave?: number;
  maxSpeed?: number;
  startLatitude: number;
  startLongitude: number;
}

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

    // --- Select Random Surf Spot --- 
    const randomSpotIndex = Math.floor(Math.random() * surfSpots.length);
    const selectedSpot = surfSpots[randomSpotIndex];
    const baseLatitude = selectedSpot.latitude + (Math.random() - 0.5) * 0.002; // Add slight variation
    const baseLongitude = selectedSpot.longitude + (Math.random() - 0.5) * 0.002;
    const locationName = selectedSpot.name;
    // -------------------------------

    try {
        const sessionDate = Timestamp.now();
        const waveCount = Math.floor(Math.random() * 5) + 2;
        let calculatedTotalDuration = 0;
        let calculatedMaxDuration = 0;
        let calculatedMaxSpeed = 0;

        const newSessionData: Omit<Session, 'id' | 'duration' | 'longestWave' | 'maxSpeed'> = {
            userId: currentUser.uid,
            location: locationName,
            sessionDate: sessionDate,
            waveCount: waveCount,
            startLatitude: baseLatitude,
            startLongitude: baseLongitude,
        };
        const sessionRef = await addDoc(collection(db, "sessions"), newSessionData);

        const batch = writeBatch(db);
        const wavesSubCollectionRef = collection(db, "sessions", sessionRef.id, "waves");

        for (let i = 0; i < waveCount; i++) {
            const waveDuration = Math.floor(Math.random() * 15) + 5;
            const waveTopSpeed = Math.random() * 20 + 10;
            const startTime = Timestamp.fromMillis(sessionDate.toMillis() + i * 60000 + Math.random() * 5000);
            const endTime = Timestamp.fromMillis(startTime.toMillis() + waveDuration * 1000);
            
            calculatedTotalDuration += waveDuration;
            if (waveDuration > calculatedMaxDuration) {
                calculatedMaxDuration = waveDuration;
            }
            if (waveTopSpeed > calculatedMaxSpeed) {
                calculatedMaxSpeed = waveTopSpeed;
            }

            const waveCoordinates: GeoPoint[] = [];
            const pointsCount = waveDuration * 2;
            const startLatOffset = (Math.random() - 0.5) * 0.001;
            const startLonOffset = (Math.random() - 0.5) * 0.001;
            const waveStartLat = baseLatitude + 0.0015 + startLatOffset;
            const waveStartLon = baseLongitude + startLonOffset;
            const waveEndLat = baseLatitude - 0.0003 + (Math.random() - 0.5) * 0.0003;
            const waveEndLon = baseLongitude + (Math.random() - 0.5) * 0.0003;

            for (let p = 0; p < pointsCount; p++) {
                const progress = p / (pointsCount - 1);
                const lat = waveStartLat + (waveEndLat - waveStartLat) * progress + (Math.random() - 0.5) * 0.00005;
                const lon = waveStartLon + (waveEndLon - waveStartLon) * progress + (Math.random() - 0.5) * 0.00005;
                waveCoordinates.push({ latitude: lat, longitude: lon });
            }

            const newWaveData: Omit<Wave, 'id'> = {
                startTime: startTime,
                endTime: endTime,
                duration: waveDuration,
                topSpeed: waveTopSpeed,
                averageSpeed: Math.random() * 10 + 5,
                coordinates: waveCoordinates,
            };
            const waveDocRef = doc(wavesSubCollectionRef);
            batch.set(waveDocRef, newWaveData);
        }
        
        batch.update(sessionRef, { 
            duration: calculatedTotalDuration,
            longestWave: calculatedMaxDuration,
            maxSpeed: calculatedMaxSpeed
        });
        
        await batch.commit();

        Alert.alert("Success", `Fake session at ${locationName} added!`);
        fetchSessions();
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