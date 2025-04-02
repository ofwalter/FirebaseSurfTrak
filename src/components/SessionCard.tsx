import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Timestamp } from 'firebase/firestore';
import MapView, { Marker } from 'react-native-maps';

// Re-use Session interface (Consider moving to a shared types file later)
interface Session {
  id?: string;
  userId: string;
  location: string;
  sessionDate: Timestamp;
  waveCount: number;
  totalDuration: number; // seconds
}

// Define colors (could also import from a central constants file)
const colors = {
  primaryBlue: '#1A73E8',
  secondaryBlue: '#0056B3',
  lightBlue: '#4AB1FF',
  mapBackground: '#dbeafe', // Light blue-gray for map placeholder
  mapIcon: '#60a5fa', // Slightly darker blue for map icons
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  white: '#ffffff',
};

// Helper to format duration (seconds) into Hh Mm
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  let formatted = '';
  if (h > 0) formatted += `${h}h `;
  if (m > 0 || h === 0) formatted += `${m}m`; // Show minutes if hours > 0 or if hours === 0
  return formatted.trim();
};

// Helper to format Timestamp into Date and Time Range
const formatDateAndTime = (timestamp: Timestamp): { date: string; timeRange: string } => {
  if (!timestamp) return { date: '', timeRange: '' };
  const dateObj = timestamp.toDate();
  const dateOptions: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };

  // Assuming totalDuration gives a rough end time for placeholder purposes
  // In reality, you'd store session start and end times
  // We'll just show the start time for now as per original data
  const startTime = dateObj.toLocaleTimeString('en-US', timeOptions);

  return {
    date: dateObj.toLocaleDateString('en-US', dateOptions),
    timeRange: startTime, // Placeholder: just showing start time
    // timeRange: `${startTime} - ${endTime}`, // Need endTime later
  };
};

interface SessionCardProps {
  session: Session;
  onPress: () => void;
}

const SessionCard = ({ session, onPress }: SessionCardProps) => {
  const { date, timeRange } = formatDateAndTime(session.sessionDate);
  const durationFormatted = formatDuration(session.totalDuration);

  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.8}>
      {/* Left Side - Gradient */}
      <LinearGradient
        colors={[colors.primaryBlue, colors.secondaryBlue]}
        style={styles.leftSide}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.locationText}>{session.location || 'Unknown Location'}</Text>
        <Text style={styles.dateTimeText}>{date}</Text>
        <Text style={styles.dateTimeText}>{timeRange}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Waves</Text>
            <Text style={styles.statValue}>{session.waveCount || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{durationFormatted}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Right Side - Map Preview */}
      <View style={styles.rightSide}>
         {/* MapView replaces the placeholder */}
         <MapView
            style={styles.mapPreview}
            initialRegion={{
              // Placeholder region - replace with actual session coords later
              latitude: 34.0522, // Los Angeles Example
              longitude: -118.2437,
              latitudeDelta: 0.04, // Zoom level
              longitudeDelta: 0.05,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
         >
             {/* Optional: Add a single marker for the session location */}
              <Marker
                coordinate={{ latitude: 34.0522, longitude: -118.2437 }}
                // You could use a custom marker image/icon here later
              />
         </MapView>
          {/* Map Marker Icon - maybe remove this if map shows location */}
         {/* <View style={styles.mapMarkerCircle}>
             <Ionicons name="location-sharp" size={16} color={colors.primaryBlue} />
         </View> */}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.white, // Background for shadow
    marginVertical: 10,
    marginHorizontal: 15,
    minHeight: 130, // Ensure consistent height
    // Shadow
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  leftSide: {
    flex: 2, // Takes up more space
    padding: 15,
    justifyContent: 'space-between',
  },
  rightSide: {
    flex: 1,
    backgroundColor: colors.mapBackground,
    // alignItems/justifyContent removed as MapView fills the space
    position: 'relative',
  },
  locationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 5,
  },
  dateTimeText: {
    fontSize: 13,
    color: colors.white,
    opacity: 0.9,
    marginBottom: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  statItem: {
    marginRight: 20,
  },
  statLabel: {
    fontSize: 12,
    color: colors.white,
    opacity: 0.8,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
  },
  mapPreview: {
      ...StyleSheet.absoluteFillObject, // Make map fill the rightSide container
  },
  mapMarkerCircle: {
     // Style might be removed or kept depending on final design
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.white,
    borderRadius: 15,
    padding: 5,
    zIndex: 1, // Ensure it's above map
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
   },
   mapIcon: {
       // Removed as MapView is used now
   },
});

export default SessionCard; 