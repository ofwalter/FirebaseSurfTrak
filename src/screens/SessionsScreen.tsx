import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Button, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { db, auth } from '../services/firebaseConfig'; // Import db and auth
import { collection, addDoc, query, where, getDocs, Timestamp, doc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth'; // Import User type
import { useNavigation } from '@react-navigation/native'; // Import navigation hook
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Import stack navigation prop type
import { AppStackParamList } from '../navigation/AppNavigator'; // Import the stack param list type

// Define interfaces for our data structures
interface Wave {
  id?: string; // Firestore document ID (optional)
  startTime: Timestamp;
  endTime: Timestamp;
  duration: number; // seconds
  topSpeed: number; // km/h or mph
  averageSpeed: number;
}

interface Session {
  id?: string; // Firestore document ID (optional)
  userId: string;
  location: string;
  sessionDate: Timestamp;
  waveCount: number;
  totalDuration: number; // seconds
  // waves?: Wave[]; // We'll load waves separately when needed
}

// Define the type for the navigation prop based on our AppStackParamList
// This helps TypeScript understand the navigate function and its params
type SessionsScreenNavigationProp = NativeStackNavigationProp<
  AppStackParamList, // The list of all screens in the stack
  'AppTabs'         // The current screen's route name within the stack (Tabs container)
>;

const SessionsScreen = () => {
  const navigation = useNavigation<SessionsScreenNavigationProp>(); // Get navigation object
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        // Handle logged out state if necessary (e.g., clear sessions)
        setSessions([]);
        setLoading(false);
      }
    });
    return () => unsubscribe(); // Cleanup subscription
  }, []);

  // Fetch sessions for the current user
  const fetchSessions = useCallback(async () => {
    if (!currentUser) {
       setLoading(false);
       return; // No user logged in
    }
    setLoading(true);
    try {
      const sessionsRef = collection(db, 'sessions');
      const q = query(sessionsRef, where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const fetchedSessions: Session[] = [];
      querySnapshot.forEach((doc) => {
        // Add Firestore ID to the session object
        fetchedSessions.push({ id: doc.id, ...doc.data() } as Session);
      });
      // Sort sessions by date, newest first
      fetchedSessions.sort((a, b) => b.sessionDate.seconds - a.sessionDate.seconds);
      setSessions(fetchedSessions);
    } catch (error) {
      console.error("Error fetching sessions: ", error);
      Alert.alert("Error", "Could not fetch sessions.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]); // Dependency: refetch if user changes

  // Fetch sessions when user is available or changes
  useEffect(() => {
    if (currentUser) {
      fetchSessions();
    }
  }, [currentUser, fetchSessions]);


  // Function to add a fake session with fake waves
  const addFakeSession = async () => {
     if (!currentUser) {
        Alert.alert("Error", "You must be logged in to add a session.");
        return;
     }
     setAdding(true);
    try {
        const sessionDate = Timestamp.now();
        const waveCount = Math.floor(Math.random() * 10) + 3; // 3-12 waves
        let totalDuration = 0;

        // 1. Create the main session document data
        const newSessionData: Omit<Session, 'id'> = {
            userId: currentUser.uid,
            location: `Fake Beach ${Math.floor(Math.random() * 10)}`,
            sessionDate: sessionDate,
            waveCount: waveCount,
            totalDuration: 0, // We'll update this after creating waves
        };

         // 2. Add the session document to get its ID
         const sessionRef = await addDoc(collection(db, "sessions"), newSessionData);
         console.log("Session added with ID: ", sessionRef.id);


        // 3. Create fake wave data and add them to a subcollection using a batch write
        const batch = writeBatch(db);
        const wavesSubCollectionRef = collection(db, "sessions", sessionRef.id, "waves");

        for (let i = 0; i < waveCount; i++) {
             const duration = Math.floor(Math.random() * 45) + 5; // 5-50 seconds
             const startTime = Timestamp.fromMillis(sessionDate.toMillis() + i * 60000 + Math.random() * 5000); // Stagger start times
             const endTime = Timestamp.fromMillis(startTime.toMillis() + duration * 1000);
             totalDuration += duration;

            const newWaveData: Omit<Wave, 'id'> = {
                startTime: startTime,
                endTime: endTime,
                duration: duration,
                topSpeed: Math.random() * 30 + 10, // 10-40 units
                averageSpeed: Math.random() * 15 + 5, // 5-20 units
            };
             // Add wave creation to the batch using the subcollection ref
             const waveDocRef = doc(wavesSubCollectionRef); // Auto-generate ID for the wave doc
             batch.set(waveDocRef, newWaveData);
        }

        // 4. Update the session document with the calculated totalDuration in the same batch
        batch.update(sessionRef, { totalDuration: totalDuration });

        // 5. Commit the batch
        await batch.commit();
        console.log("Waves subcollection and session update committed.");


        Alert.alert("Success", "Fake session and waves added!");
        fetchSessions(); // Refresh the list

    } catch (error) {
        console.error("Error adding fake session: ", error);
        Alert.alert("Error", "Could not add fake session.");
    } finally {
         setAdding(false);
    }
  };

  // Render item for FlatList
  const renderSessionCard = ({ item }: { item: Session }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
          if (item.id) {
            navigation.navigate('SessionDetail', {
              sessionId: item.id,
              sessionLocation: item.location // Pass location for the header
            });
          } else {
            Alert.alert("Error", "Session ID is missing, cannot navigate.");
          }
      }}
    >
      <Text style={styles.cardTitle}>{item.location}</Text>
      <Text>Date: {item.sessionDate.toDate().toLocaleDateString()}</Text>
      <Text>Waves: {item.waveCount}</Text>
      <Text>Total Wave Time: {(item.totalDuration / 60).toFixed(1)} min</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Surf Sessions</Text>

       <Button
          title={adding ? "Adding..." : "Add Fake Session"}
          onPress={addFakeSession}
          disabled={adding || !currentUser} // Disable if adding or not logged in
        />

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSessionCard}
          keyExtractor={(item) => item.id!} // Use Firestore ID as key
          style={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No sessions recorded yet. Add one!</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // justifyContent: 'center', // Removed to allow list to fill space
    alignItems: 'center',
    paddingTop: 20, // Add some padding at the top
     paddingHorizontal: 10,
  },
  title: {
    fontSize: 24,
     marginBottom: 15,
  },
   loader: {
    marginTop: 50,
  },
  list: {
    width: '100%', // Ensure list takes full width
    marginTop: 15,
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
   emptyText: {
    marginTop: 40,
    textAlign: 'center',
    color: 'grey',
  },
});

export default SessionsScreen; 