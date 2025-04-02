import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { collection, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';

// Define types expected as navigation parameters
type SessionDetailRouteParams = {
  SessionDetail: {
    sessionId: string;
    sessionLocation: string; // Pass location for header title
  };
};

// Type for the route prop specific to this screen
type SessionDetailScreenRouteProp = RouteProp<SessionDetailRouteParams, 'SessionDetail'>;

// Re-use Wave interface (consider moving interfaces to a types file later)
interface Wave {
  id?: string; // Firestore document ID
  startTime: Timestamp;
  endTime: Timestamp;
  duration: number; // seconds
  topSpeed: number;
  averageSpeed: number;
}

const SessionDetailScreen = () => {
  const route = useRoute<SessionDetailScreenRouteProp>();
  const { sessionId, sessionLocation } = route.params;

  const [waves, setWaves] = useState<Wave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWaves = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!sessionId) {
          throw new Error("Session ID is missing");
        }

        // Path to the waves subcollection
        const wavesQuery = collection(db, 'sessions', sessionId, 'waves');
        const querySnapshot = await getDocs(wavesQuery);

        const fetchedWaves: Wave[] = [];
        querySnapshot.forEach((doc) => {
          fetchedWaves.push({ id: doc.id, ...doc.data() } as Wave);
        });

        // Sort waves by start time
        fetchedWaves.sort((a, b) => a.startTime.seconds - b.startTime.seconds);
        setWaves(fetchedWaves);

      } catch (err: any) {
        console.error("Error fetching waves: ", err);
        setError("Could not fetch wave data for this session.");
        Alert.alert("Error", "Could not load wave details.");
      } finally {
        setLoading(false);
      }
    };

    fetchWaves();
  }, [sessionId]); // Refetch if sessionId changes (shouldn't normally happen)

  // Render item for Wave FlatList
  const renderWaveCard = ({ item, index }: { item: Wave, index: number }) => (
    <View style={styles.card}>
       <Text style={styles.cardTitle}>Wave {index + 1}</Text>
       <Text>Start: {item.startTime.toDate().toLocaleTimeString()}</Text>
       <Text>Duration: {item.duration} seconds</Text>
       <Text>Top Speed: {item.topSpeed.toFixed(1)} units</Text>
       <Text>Avg Speed: {item.averageSpeed.toFixed(1)} units</Text>
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  return (
    <View style={styles.container}>
      {/* Header is handled by navigation options, but keep title here for context */}
      {/* <Text style={styles.title}>{sessionLocation} - Waves</Text> */}
      <FlatList
        data={waves}
        renderItem={renderWaveCard}
        keyExtractor={(item) => item.id!} // Use Firestore wave ID as key
        style={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No wave data found for this session.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10, // Add some padding at the top
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    width: '100%',
  },
  card: {
    backgroundColor: '#e9e9e9', // Slightly different background for wave cards
    padding: 15,
    marginVertical: 8,
    borderRadius: 8,
    // Basic styling, no shadows for now
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  emptyText: {
    marginTop: 40,
    textAlign: 'center',
    color: 'grey',
  },
  errorText: {
     flex: 1,
     textAlign: 'center',
     marginTop: 50,
     color: 'red',
     fontSize: 16,
  }
});

export default SessionDetailScreen; 