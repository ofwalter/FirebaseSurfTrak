import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { db, auth } from '../services/firebaseConfig';
import { collection, query, where, getDocs, Timestamp, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.35;
const CARD_MARGIN = 10;
const GOAL_CARD_HORIZONTAL_PADDING = 15;
const GOAL_CARD_CONTENT_WIDTH = screenWidth - (GOAL_CARD_HORIZONTAL_PADDING * 2);

// Define Color Palette
const colors = {
  primaryBlue: '#1A73E8',
  secondaryBlue: '#0056B3',
  lightBlue: '#4AB1FF',
  background: '#f0f4f8', // Light background for the page
  cardBackground: '#ffffff',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  white: '#ffffff',
  iconBlue: '#1A73E8', // Color for settings icon background
};

// --- Reusable Components (Defined inline for simplicity) ---

const TopBar = () => (
  <BlurView intensity={80} tint="light" style={styles.topBarContainer}>
    <View style={styles.topBarContent}>
      {/* Use actual Profile Photo - Corrected Path */}
      <Image
        // Path goes up two levels from src/screens to root, then into assets
        source={require('../../assets/placeholder-profilephoto.png')}
        style={styles.profilePhoto}
      />

      {/* Use actual Logo Image - Corrected Path and Case */}
      <Image
        source={require('../../assets/SurfTrak-FullLogo.png')}
        style={styles.logoImage}
      />

      {/* Settings Button */}
      <TouchableOpacity style={styles.settingsButton}>
        <Ionicons name="settings-outline" size={24} color={colors.primaryBlue} />
      </TouchableOpacity>
    </View>
  </BlurView>
);

interface GoalCardProps {
  currentWaves: number;
  goalWaves: number;
  daysLeft: number; // Keep static for now
}

const GoalCard = ({ currentWaves, goalWaves, daysLeft }: GoalCardProps) => {
   const progress = goalWaves > 0 ? Math.min(currentWaves / goalWaves, 1) : 0;
   const progressBarPixelWidth = GOAL_CARD_CONTENT_WIDTH * progress;
   const wavesToGo = Math.max(0, goalWaves - currentWaves);
   const motivationMessage = wavesToGo > 0
        ? `You're doing great! Just ${wavesToGo} more waves to go 🏄`
        : "Goal achieved! Amazing work! 🎉";

   return (
      <LinearGradient
        colors={[colors.secondaryBlue, colors.primaryBlue, colors.lightBlue]}
        style={styles.goalCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.goalCardHeader}>
          <Text style={styles.goalCardTitle}>Weekly Goal</Text>
          <Text style={styles.goalCardSubtitle}>{daysLeft} days left</Text>
          <TouchableOpacity style={styles.goalOptionsButton}>
              <Ionicons name="ellipsis-horizontal-outline" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
        <Text style={styles.goalCardWaves}>{currentWaves}/{goalWaves} waves</Text>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarForeground, { width: progressBarPixelWidth }]} />
        </View>
        <Text style={styles.goalCardMotivation}>{motivationMessage}</Text>
      </LinearGradient>
   );
};

interface StatCardProps {
  iconName: string;
  title: string;
  value: string;
  unit: string;
  gradientColors: readonly [string, string, ...string[]];
}

const StatCard = ({ iconName, title, value, unit, gradientColors }: StatCardProps) => (
  <LinearGradient
      colors={gradientColors} // Use passed gradient colors
      style={styles.statCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
  >
      <Ionicons name={iconName} size={24} color={colors.white} style={styles.statIcon} />
      <Text style={styles.statTitle}>{title}</Text>
      <View style={styles.statValueContainer}>
           <Text style={styles.statValue}>{value}</Text>
           <Text style={styles.statUnit}>{unit}</Text>
      </View>

  </LinearGradient>
);

interface LifetimeStatsData {
    avgSpeed: number;
    longestWave: number;
    bestSpeed: number;
}

const LifetimeStats = ({ stats }: { stats: LifetimeStatsData }) => {
    const gradients: { [key: string]: readonly [string, string, ...string[]] } = {
        avgSpeed: ['#1A73E8', '#4AB1FF'],
        longestWave: ['#0056B3', '#1A73E8'],
        bestSpeed: ['#1A73E8', '#6E9EFF'],
    };

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Lifetime Stats</Text>
                <TouchableOpacity>
                    <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.lifetimeStatsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    contentContainerStyle={styles.scrollViewContent}
                >
                    <StatCard iconName="speedometer-outline" title="Avg Speed" value={stats.avgSpeed > 0 ? stats.avgSpeed.toFixed(1) : '0'} unit="mph" gradientColors={gradients.avgSpeed} />
                    <StatCard iconName="time-outline" title="Longest Wave" value={stats.longestWave > 0 ? stats.longestWave.toFixed(0) : '0'} unit="sec" gradientColors={gradients.longestWave} />
                    <StatCard iconName="flash-outline" title="Best Speed" value={stats.bestSpeed > 0 ? stats.bestSpeed.toFixed(1) : '0'} unit="mph" gradientColors={gradients.bestSpeed} />
                </ScrollView>
            </View>
        </View>
    );
};

const RecentActivity = () => (
    <View style={styles.recentActivityContainer}>
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.recommendedCard}>
            <View style={styles.recommendedIconContainer}>
                 <Ionicons name="navigate-outline" size={24} color={colors.primaryBlue} />
            </View>
            <View style={styles.recommendedTextContainer}>
                 <Text style={styles.recommendedTitle}>Recommended Sessions</Text>
                 <Text style={styles.recommendedSubtitle}>Check out nearby surf spots with good conditions</Text>
            </View>
        </TouchableOpacity>
    </View>
);

// --- HomeScreen Implementation ---

const HomeScreen = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [weeklyWaves, setWeeklyWaves] = useState(0);
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStatsData>({
      avgSpeed: 0,
      longestWave: 0,
      bestSpeed: 0,
  });
  const weeklyGoal = 100; // Updated weekly goal

  // Get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
          // Reset stats if user logs out
          setWeeklyWaves(0);
          setLifetimeStats({ avgSpeed: 0, longestWave: 0, bestSpeed: 0 });
          setLoadingStats(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch stats using real-time listener for sessions
  useEffect(() => {
    if (!currentUser) {
      setLoadingStats(false);
      setWeeklyWaves(0); // Ensure reset if user becomes null
      setLifetimeStats({ avgSpeed: 0, longestWave: 0, bestSpeed: 0 });
      return; // Exit if no user
    }

    setLoadingStats(true);
    const sessionsRef = collection(db, 'sessions');
    const q = query(sessionsRef, where('userId', '==', currentUser.uid));

    // Set up the real-time listener
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        let calculatedWeeklyWaves = 0;
        const sevenDaysAgo = Timestamp.now().seconds - (7 * 24 * 60 * 60);
        const sessionDocs = querySnapshot.docs; // Get all session documents from the snapshot

        // --- Calculate Weekly Waves (updates in real-time) ---
        sessionDocs.forEach((doc) => {
            const session = doc.data();
            if (session.sessionDate && session.sessionDate.seconds >= sevenDaysAgo) {
                calculatedWeeklyWaves += session.waveCount || 0;
            }
        });
        setWeeklyWaves(calculatedWeeklyWaves);

        // --- Calculate Lifetime Stats (fetches all waves - potentially slow) ---
        // NOTE: This part runs every time the listener fires. For better performance,
        // consider running this less often or using Cloud Functions.
        let totalSpeedSum = 0;
        let waveCountForAvg = 0;
        let maxDuration = 0;
        let maxSpeed = 0;

        try {
            // Create promises to fetch waves for all sessions in parallel
            const wavePromises = sessionDocs.map(sessionDoc =>
                getDocs(collection(db, 'sessions', sessionDoc.id, 'waves'))
            );
            const sessionsWavesSnapshots = await Promise.all(wavePromises);

            // Process waves from all sessions
            sessionsWavesSnapshots.forEach(wavesSnapshot => {
                wavesSnapshot.forEach(waveDoc => {
                    const wave = waveDoc.data();
                    if (wave) {
                        totalSpeedSum += wave.averageSpeed || 0;
                        waveCountForAvg++;
                        maxDuration = Math.max(maxDuration, wave.duration || 0);
                        maxSpeed = Math.max(maxSpeed, wave.topSpeed || 0);
                    }
                });
            });

            const calculatedAvgSpeed = waveCountForAvg > 0 ? totalSpeedSum / waveCountForAvg : 0;

            setLifetimeStats({
                avgSpeed: calculatedAvgSpeed,
                longestWave: maxDuration,
                bestSpeed: maxSpeed,
            });

        } catch (waveError) {
             console.error("Error fetching or processing wave data: ", waveError);
             // Keep previous/default stats on wave fetch error
             setLifetimeStats(prevStats => prevStats); // Or set to 0s
        }
        // --- End Lifetime Stat Calculation ---

        setLoadingStats(false); // Loading finished after all processing

    }, (error) => {
        // Handle listener errors
        console.error("Error listening to sessions: ", error);
        setLoadingStats(false);
        setWeeklyWaves(0);
        setLifetimeStats({ avgSpeed: 0, longestWave: 0, bestSpeed: 0 });
    });

    // Cleanup: Unsubscribe from the listener when the component unmounts or user changes
    return () => unsubscribe();

  }, [currentUser]); // Re-run effect if currentUser changes

  return (
    <View style={styles.safeArea}>
      <TopBar />
      {loadingStats ? (
          <ActivityIndicator size="large" style={styles.mainLoader} />
      ) : (
          <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <GoalCard
                currentWaves={weeklyWaves}
                goalWaves={weeklyGoal}
                daysLeft={5}
             />
            <LifetimeStats stats={lifetimeStats} />
            <RecentActivity />
            <View style={{ height: 50 }} />
          </ScrollView>
      )}
    </View>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    // padding removed, handled by components/sections
  },
  // Top Bar Styles
  topBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 55 : 30, // Increased top padding further
    paddingBottom: 20, // Increased bottom padding further
    borderBottomWidth: 0,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  profilePhoto: { // Style for actual profile photo
    width: 45,
    height: 45,
    borderRadius: 22.5, // Keep it circular
  },
  logoImage: { // Style for actual logo image
    width: 150, // Adjust width as needed
    height: 35, // Adjust height as needed
    resizeMode: 'contain', // Scale the image appropriately
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  // Goal Card Styles
  goalCard: {
    marginHorizontal: GOAL_CARD_HORIZONTAL_PADDING,
    marginTop: 130, // Increased top margin even further to clear larger header
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
   goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  goalCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
  },
  goalCardSubtitle: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.8,
    position: 'absolute', // Position below title
    left: 0,
    top: 22,
  },
  goalOptionsButton: {
     padding: 5,
  },
  goalCardWaves: {
    fontSize: 36, // Large text for wave count
    fontWeight: 'bold',
    color: colors.white,
    textAlign: 'center',
    marginVertical: 15,
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressBarForeground: {
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 5,
  },
  goalCardMotivation: {
    fontSize: 14,
    color: colors.white,
    textAlign: 'center',
    opacity: 0.9,
    marginTop: 10,
  },
  // Section Styles
  sectionContainer: {
    marginTop: 25,
    // paddingHorizontal removed for LifetimeStats specifically
    // It will be kept for RecentActivity or added individually where needed
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 15, // Add padding back for the header text
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primaryBlue,
    fontWeight: '500',
  },
  // Lifetime Stats Styles
  lifetimeStatsContainer: { // New style to contain only the ScrollView without side padding
    // No horizontal padding here
  },
  scrollViewContent: {
    paddingLeft: 15, // Start content aligned with screen padding
    paddingRight: 5, // Less padding on the right to emphasize scroll
  },
   statCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.1,
    borderRadius: 15,
    padding: 15,
    marginRight: CARD_MARGIN, // Keep margin between cards
    justifyContent: 'space-between', // Distribute content vertically
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  statIcon: {
    marginBottom: 5,
     alignSelf: 'flex-start', // Icon at the top left
  },
  statTitle: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '500',
  },
   statValueContainer: {
       flexDirection: 'row',
       alignItems: 'baseline', // Align value and unit
   },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.white,
  },
   statUnit: {
       fontSize: 14,
       fontWeight: '500',
       color: colors.white,
       marginLeft: 4,
       opacity: 0.9,
   },
  // Recent Activity Styles
   recentActivityContainer: { // Add padding back for this section
       paddingHorizontal: 15,
       marginTop: 25, // Keep similar spacing
   },
  recommendedCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  recommendedIconContainer: {
      backgroundColor: '#e0eaff', // Light blue background for icon
      padding: 12,
      borderRadius: 10,
      marginRight: 15,
  },
  recommendedTextContainer: {
      flex: 1,
  },
  recommendedTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 3,
  },
  recommendedSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
  },
  mainLoader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  },
});

export default HomeScreen; 