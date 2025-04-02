import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { db, auth } from '../services/firebaseConfig';
import { collection, addDoc, query, where, getDocs, Timestamp, doc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
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
interface Session {
  id?: string;
  userId: string;
  location: string;
  sessionDate: Timestamp;
  waveCount: number;
  totalDuration: number;
  // Add base coordinates for map centering
  startLatitude: number;
  startLongitude: number;
}

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
};

type SessionsScreenNavigationProp = NativeStackNavigationProp<AppStackParamList, 'AppTabs'>;

// --- Header Component ---
interface SessionsHeaderProps {
  onAddPress: () => void;
  onFilterPress: () => void; // Placeholder for filter action
  isAdding: boolean; // To disable add button while processing
}

const SessionsHeader = ({ onAddPress, onFilterPress, isAdding }: SessionsHeaderProps) => (
  <BlurView intensity={80} tint="light" style={styles.headerContainer}>
    <View style={styles.headerContent}>
      {/* Add Button */}
      <TouchableOpacity
        style={styles.headerButtonCircle}
        onPress={onAddPress}
        disabled={isAdding}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={30} color={colors.white} />
      </TouchableOpacity>

      {/* Title */}
      <Text style={styles.headerTitle}>Sessions</Text>

      {/* Filter Button */}
      <TouchableOpacity
        style={styles.headerButtonCircleSmall}
        onPress={onFilterPress}
        activeOpacity={0.7}
      >
        <Ionicons name="filter-outline" size={20} color={colors.primaryBlue} />
      </TouchableOpacity>
    </View>
  </BlurView>
);

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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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
        let totalDuration = 0;

        const newSessionData: Omit<Session, 'id'> = {
            userId: currentUser.uid,
            location: locationName, // Use selected spot name
            sessionDate: sessionDate,
            waveCount: waveCount,
            totalDuration: 0,
            startLatitude: baseLatitude, // Use selected spot coords (with variation)
            startLongitude: baseLongitude,
        };
        const sessionRef = await addDoc(collection(db, "sessions"), newSessionData);

        const batch = writeBatch(db);
        const wavesSubCollectionRef = collection(db, "sessions", sessionRef.id, "waves");

        for (let i = 0; i < waveCount; i++) {
            const duration = Math.floor(Math.random() * 15) + 5;
            const startTime = Timestamp.fromMillis(sessionDate.toMillis() + i * 60000 + Math.random() * 5000);
            const endTime = Timestamp.fromMillis(startTime.toMillis() + duration * 1000);
            totalDuration += duration;

            // --- Generate Fake Coordinates Relative to Spot ---
            const waveCoordinates: GeoPoint[] = [];
            const pointsCount = duration * 2;
            const startLatOffset = (Math.random() - 0.5) * 0.001;
            const startLonOffset = (Math.random() - 0.5) * 0.001;
            // Start slightly further out from the base spot location
            const waveStartLat = baseLatitude + 0.0015 + startLatOffset;
            const waveStartLon = baseLongitude + startLonOffset;
            // End closer to the base spot location
            const waveEndLat = baseLatitude - 0.0003 + (Math.random() - 0.5) * 0.0003;
            const waveEndLon = baseLongitude + (Math.random() - 0.5) * 0.0003;

            for (let p = 0; p < pointsCount; p++) {
                const progress = p / (pointsCount - 1);
                const lat = waveStartLat + (waveEndLat - waveStartLat) * progress + (Math.random() - 0.5) * 0.00005;
                const lon = waveStartLon + (waveEndLon - waveStartLon) * progress + (Math.random() - 0.5) * 0.00005;
                waveCoordinates.push({ latitude: lat, longitude: lon });
            }
            // --------------------------------------------------

            const newWaveData: Omit<Wave, 'id'> = {
                startTime: startTime,
                endTime: endTime,
                duration: duration,
                topSpeed: Math.random() * 20 + 10,
                averageSpeed: Math.random() * 10 + 5,
                coordinates: waveCoordinates,
            };
            const waveDocRef = doc(wavesSubCollectionRef);
            batch.set(waveDocRef, newWaveData);
        }
        batch.update(sessionRef, { totalDuration: totalDuration });
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

  const handleFilterPress = () => {
      Alert.alert("Filter", "Filter functionality not implemented yet.");
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
          onFilterPress={handleFilterPress}
          isAdding={adding}
      />
      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSessionItem}
          keyExtractor={(item) => item.id!} // Use Firestore ID as key
          style={styles.list}
          contentContainerStyle={styles.listContentContainer} // Add padding for header
          ListEmptyComponent={<Text style={styles.emptyText}>No sessions recorded yet. Add one!</Text>}
        />
      )}
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header Styles
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
    paddingBottom: 10,
    borderBottomWidth: Platform.OS === 'ios' ? 0 : 0.5, // Optional border for android
    borderBottomColor: 'rgba(0,0,0,0.1)',
    // BlurView handles background
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  headerButtonCircle: {
    backgroundColor: colors.primaryBlue,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
   headerButtonCircleSmall: {
    backgroundColor: colors.cardBackground,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 24, // Reduced font size from 28
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  // List Styles
  loader: {
    flex: 1, // Take remaining space
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    width: '100%',
  },
   listContentContainer: {
       paddingTop: 100, // Adjust based on final header height
       paddingBottom: 20, // Space at the bottom
   },
  emptyText: {
    marginTop: 40,
    textAlign: 'center',
    color: 'grey',
    fontSize: 16,
  },
  // Remove old card styles as they are now in SessionCard.tsx
});

export default SessionsScreen; 