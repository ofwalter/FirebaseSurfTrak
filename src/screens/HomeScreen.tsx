import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { collection, query, where, getDocs, Timestamp, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { useNavigation } from '@react-navigation/native';

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
  completedGreen: '#10B981',
};

// --- Reusable Components (Defined inline for simplicity) ---

// Update TopBar to receive navigation prop
// Use the specific navigation type from HomeScreen
interface TopBarProps {
  navigation: HomeScreenNavigationProp;
}

const TopBar = ({ navigation }: TopBarProps) => (
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

      {/* Settings Button - Add onPress handler */}
      <TouchableOpacity 
        style={styles.settingsButton}
        onPress={() => navigation.navigate('Settings')}
      >
        <Ionicons name="settings-outline" size={24} color={colors.primaryBlue} />
      </TouchableOpacity>
    </View>
  </BlurView>
);

interface GoalCardProps {
  goal: DisplayGoal | null; // Can be null if all completed or none to feature
  allCompleted: boolean;
  // Remove daysLeft, currentWaves, goalWaves - derived from goal object
}

const GoalCard = ({ goal, allCompleted }: GoalCardProps) => {
   // --- State for rotating message (keep as is) ---
   const encouragementMessages = [
        "Keep paddling.",
        "Focus on the next wave.",
        "Every wave counts.",
        "Consistency is key.",
        "Push your limits.",
        "Stay committed.",
        "Ride it out.",
        "One more!",
        "You got this!"
   ];
   const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

   // --- Calculate progress and values based on the goal prop ---
   const isTrulyCompleted = goal ? goal.completed : false;
   const progress = goal && goal.target > 0 ? Math.min(goal.progress / goal.target, 1) : (isTrulyCompleted ? 1 : 0);
   const progressPercent = Math.round(progress * 100);
   // Use goal?.target, goal?.progress safely
   const targetValue = goal?.target ?? 0;
   const currentValue = goal?.progress ?? 0;

   // --- Effect for rotating message ---
   useEffect(() => {
       let intervalId: NodeJS.Timeout | null = null;
        // Rotate only if there's an incomplete goal being displayed
       if (goal && !isTrulyCompleted && !allCompleted) {
           intervalId = setInterval(() => {
               setCurrentMessageIndex(prevIndex => 
                   (prevIndex + 1) % encouragementMessages.length
               );
           }, 4000); 
       } else {
            setCurrentMessageIndex(0); // Reset if completed or no goal
       }
       return () => {
           if (intervalId) clearInterval(intervalId);
       };
   // Depend on whether there is a goal and its completion state
   }, [goal, isTrulyCompleted, allCompleted]); 

    // --- Determine display content ---
    let title = "Today's Focus";
    let subtitle = "Keep going!";
    let progressText = "";
    let motivationMessage = encouragementMessages[currentMessageIndex];
    let gradientColors: readonly [string, string, ...string[]] = [colors.secondaryBlue, colors.primaryBlue, colors.lightBlue]; // Default gradient

    // Formatting helper (copied from GoalsScreen - ideally move to utils)
    const formatValue = (value: number, metric?: GoalDefinition['metric']): string => {
        if (!metric) return value.toLocaleString();
        if (metric === 'sessionDuration' || metric === 'longestWaveDuration') {
            const minutes = Math.floor(value / 60);
            const seconds = value % 60;
            if (minutes > 0) return `${minutes}m ${seconds}s`;
            return `${seconds}s`;
        }
        if (metric === 'topSpeed') {
            return `${value.toFixed(1)} mph`; 
        }
        return value.toLocaleString();
    };

    if (allCompleted) {
        title = "Goals Cleared!";
        subtitle = "Awesome job today!";
        progressText = "All goals met! 🔥";
        motivationMessage = "Time to relax or shred freely!";
        gradientColors = ['#10B981', '#059669', '#047857'] as const; 
    } else if (goal) {
        title = goal.type === 'daily' ? "Daily Goal" : "Weekly Goal";
        subtitle = goal.description;
        progressText = `${formatValue(currentValue, goal.metric)} / ${formatValue(targetValue, goal.metric)}`;
        if (isTrulyCompleted) { // If THIS specific goal is done, but not all
            motivationMessage = "Nice one! What's next?";
            gradientColors = ['#6b7280', '#4b5563', '#374151'] as const; // Grey gradient for completed focus
        } else {
             motivationMessage = encouragementMessages[currentMessageIndex]; // Use rotating message
        }
    } else {
        // Case: No goals assigned or available to feature
        title = "No Active Goals";
        subtitle = "Check the Goals tab later!";
        progressText = "-";
        motivationMessage = "Go enjoy the surf!";
        gradientColors = ['#6b7280', '#4b5563', '#374151'] as const; // Grey gradient
    }

   return (
      <LinearGradient
        colors={gradientColors} // Use dynamic gradient
        style={styles.goalCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.goalCardHeader}>
          <Text style={styles.goalCardTitle}>{title}</Text>
          <Text style={styles.goalCardSubtitle}>{subtitle}</Text>
          {/* Keep options button, maybe link to Goals screen? */}
          <TouchableOpacity style={styles.goalOptionsButton}>
              <Ionicons name="ellipsis-horizontal-outline" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
        {/* Conditionally render progress bar and text */} 
        {!allCompleted && goal && (
             <View style={styles.progressBarBackground}>
                 <View style={[styles.progressBarForeground, 
                     { width: `${progressPercent}%` },
                     // Use specific color for completed individual goal bar
                     isTrulyCompleted && { backgroundColor: colors.completedGreen } 
                 ]} />
             </View>
        )}
        <Text style={styles.goalCardWaves}>{progressText}</Text>
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

// Keep LifetimeStatsData separate again
interface LifetimeStatsData {
    avgSpeed: number;
    longestWave: number;
    bestSpeed: number;
    totalSessions: number;
    totalWaves: number;
    totalTime: number;
    avgWavesPerSession: number;
}

// Separate interface for User Profile data read from Firestore
interface UserProfileBaseData { 
    uid: string;
    name: string;
    email: string;
    xp: number;
    rankLevel: number;
    activeGoals: { [key: string]: { progress: number; completed: boolean; lastReset?: Timestamp } };
    // Fetched rank details
    currentRankName?: string; 
    currentRankThreshold?: number;
    nextRankThreshold?: number;
}

const LifetimeStats = ({ stats }: { stats: LifetimeStatsData }) => {
    const gradients: { [key: string]: readonly [string, string, ...string[]] } = {
        avgSpeed: ['#1A73E8', '#4AB1FF'],
        longestWave: ['#0056B3', '#1A73E8'],
        bestSpeed: ['#1A73E8', '#6E9EFF'],
        totalSessions: ['#004D99', '#1976D2'], // New gradient
        totalWaves: ['#29B6F6', '#81D4FA'],    // New gradient
        totalTime: ['#039BE5', '#4FC3F7'],       // New gradient
        avgWavesPerSession: ['#0D47A1', '#1976D2'], // Changed from Teal to Blue gradient
    };

    // Helper to format total time (seconds to HHh MMm or MMm)
    const formatTotalTime = (totalSeconds: number): string => {
        if (totalSeconds <= 0) return '0m'; // Show 0m instead of nothing
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
             return `${minutes}m`;
        } else {
             // If less than a minute, show seconds or '<1m'
             const seconds = Math.round(totalSeconds % 60);
             return seconds > 0 ? `${seconds}s` : '<1m';
        }
    };


    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Lifetime Stats</Text>
                <Text style={styles.seeAllText}>Summary</Text>
            </View>
            <View style={styles.lifetimeStatsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    contentContainerStyle={styles.scrollViewContent}
                >
                    {/* Existing Cards */}
                    <StatCard iconName="speedometer-outline" title="Avg Speed" value={stats.avgSpeed > 0 ? stats.avgSpeed.toFixed(1) : '0'} unit="mph" gradientColors={gradients.avgSpeed} />
                    <StatCard iconName="time-outline" title="Longest Wave" value={stats.longestWave > 0 ? stats.longestWave.toFixed(0) : '0'} unit="sec" gradientColors={gradients.longestWave} />
                    <StatCard iconName="flash-outline" title="Best Speed" value={stats.bestSpeed > 0 ? stats.bestSpeed.toFixed(1) : '0'} unit="mph" gradientColors={gradients.bestSpeed} />

                    {/* New Cards */}
                    <StatCard iconName="calendar-outline" title="Total Sessions" value={stats.totalSessions.toString()} unit="" gradientColors={gradients.totalSessions} />
                    <StatCard iconName="water-outline" title="Total Waves" value={stats.totalWaves.toString()} unit="" gradientColors={gradients.totalWaves} />
                    <StatCard iconName="hourglass-outline" title="Total Time" value={formatTotalTime(stats.totalTime)} unit="" gradientColors={gradients.totalTime} />
                    <StatCard iconName="stats-chart-outline" title="Avg Waves/Session" value={stats.avgWavesPerSession > 0 ? stats.avgWavesPerSession.toFixed(1) : '0'} unit="" gradientColors={gradients.avgWavesPerSession} />

                </ScrollView>
            </View>
        </View>
    );
};

// Make GoalsSection accept navigation prop
interface GoalsSectionProps {
  navigation: NativeStackNavigationProp<AppStackParamList, 'AppTabs'>;
}

const GoalsSection = ({ navigation }: GoalsSectionProps) => (
    <View style={styles.goalsSectionContainer}>
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Goals</Text>
        </View>
        {/* Wrap card in TouchableOpacity for navigation */}
        <TouchableOpacity 
            style={styles.goalLinkCard}
            onPress={() => navigation.navigate('Goals')} // Navigate to Goals screen
        >
            <LinearGradient
                 colors={[colors.primaryBlue, colors.lightBlue]}
                 style={StyleSheet.absoluteFill}
                 start={{ x: 0, y: 0 }}
                 end={{ x: 1, y: 1 }}
             />
            <View style={styles.goalLinkIconContainer}>
                 <Ionicons name="trophy-outline" size={32} color={'#FFD700'} />
            </View>
            <View style={styles.goalLinkTextContainer}>
                 <Text style={styles.goalLinkTitle}>Rank Up Challenges</Text>
                 <Text style={styles.goalLinkSubtitle}>Take on challenges, complete goals, and increase your rank.</Text>
            </View>
        </TouchableOpacity>
    </View>
);

// --- Interfaces for Rank/User Data ---
interface RankData {
    rankLevel: number;
    name: string;
    xpThreshold: number;
}

// --- New RankCard Component ---
interface RankCardProps {
    rankName?: string;
    currentXp?: number;
    currentRankThreshold?: number;
    nextRankXp?: number;
}

const RankCard = ({ 
    rankName = "Rookie", 
    currentXp = 0, 
    currentRankThreshold = 0,
    nextRankXp = 100 
}: RankCardProps) => {
    // Calculate progress within the current rank range
    const xpInCurrentRank = Math.max(0, currentXp - currentRankThreshold);
    const xpRangeForRank = Math.max(1, nextRankXp - currentRankThreshold); // Avoid division by zero
    const isMaxRank = currentXp === nextRankXp; // Check if user might be at max rank (where next = current)

    const progress = isMaxRank ? 1 : Math.min(xpInCurrentRank / xpRangeForRank, 1);
    const progressPercent = isMaxRank ? 100 : Math.round(progress * 100);
    const xpNeeded = isMaxRank ? 0 : Math.max(0, nextRankXp - currentXp);

    return (
        <View style={styles.rankCardContainer}>
            <View style={styles.rankHeader}>
                <Ionicons name="shield-checkmark-outline" size={24} color={colors.primaryBlue} style={styles.rankIcon} />
                <Text style={styles.rankTitle}>{rankName}</Text>
                <Text style={styles.rankLevelText}>{isMaxRank ? "Max Rank" : `Level ${progressPercent}%`}</Text> 
            </View>
            <View style={styles.rankProgressBarBackground}>
                <LinearGradient
                    colors={[colors.secondaryBlue, colors.primaryBlue, colors.lightBlue]}
                    style={[styles.rankProgressBarForeground, { width: `${progressPercent}%` }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                />
            </View>
            <View style={styles.rankXpContainer}>
                <Text style={styles.rankXpText}>{currentXp.toLocaleString()} XP</Text>
                {!isMaxRank && (
                     <Text style={styles.rankXpNeededText}>({xpNeeded.toLocaleString()} XP to next rank)</Text>
                 )}
                 {isMaxRank && (
                    <Text style={styles.rankXpNeededText}>(Max Rank Achieved)</Text>
                )}
            </View>
        </View>
    );
};

// --- Interfaces --- (Add Goal/Progress interfaces, similar to GoalsScreen)
interface GoalDefinition {
    goalId: string;
    description: string;
    type: "daily" | "weekly" | "lifetime";
    metric: "waveCount" | "sessionCount" | "sessionDuration" | "longestWaveDuration" | "topSpeed"; 
    target: number;
    xpReward: number;
}

interface ActiveGoalProgress {
    progress: number;
    completed: boolean;
    lastReset?: Timestamp;
}

// Combined type for display
interface DisplayGoal extends GoalDefinition, ActiveGoalProgress { }

// --- HomeScreen Implementation ---

type HomeScreenNavigationProp = NativeStackNavigationProp<AppStackParamList, 'AppTabs'>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen = ({ navigation }: HomeScreenProps) => { 
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true); 
  const [loadingData, setLoadingData] = useState(false); // Combined loading for profile & stats
  const [weeklyWaves, setWeeklyWaves] = useState(0);
  // Separate state for profile/rank data
  const [userProfile, setUserProfile] = useState<UserProfileBaseData | null>(null);
  // Separate state for calculated lifetime stats
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStatsData>({
      avgSpeed: 0, longestWave: 0, bestSpeed: 0, totalSessions: 0,
      totalWaves: 0, totalTime: 0, avgWavesPerSession: 0,
  });
  
  // *** NEW STATE for Goals ***
  const [loadingGoals, setLoadingGoals] = useState(true); // Separate loading for goals
  const [activeGoalsMap, setActiveGoalsMap] = useState<{ [key: string]: ActiveGoalProgress }>({});
  const [allGoalDefinitions, setAllGoalDefinitions] = useState<{ [key: string]: GoalDefinition }>({});
  const [allRankDefinitions, setAllRankDefinitions] = useState<{ [key: string]: RankData }>({});
  // *** END NEW STATE ***

  const weeklyGoal = 100; // Example goal

  // Effect 1: Handle Auth State Changes
  useEffect(() => {
    setLoadingAuth(true);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
          // Reset all data if user logs out
          setUserProfile(null);
          setWeeklyWaves(0);
          setLifetimeStats({ // Reset stats state
              avgSpeed: 0, longestWave: 0, bestSpeed: 0, totalSessions: 0,
              totalWaves: 0, totalTime: 0, avgWavesPerSession: 0,
          });
          setLoadingData(false); 
          // Also reset goal states on logout
          setActiveGoalsMap({});
          setLoadingGoals(false);
      }
      setLoadingAuth(false); 
    });
    return () => unsubscribeAuth();
  }, []);

  // *** NEW Effect: Fetch Goal Definitions (Runs Once) ***
  useEffect(() => {
      const fetchGoalDefinitions = async () => {
          setLoadingGoals(true);
          try {
              const goalsCollectionRef = collection(db, 'goals');
              // Add where clause to only fetch active goals if applicable (optional optimization)
              // const q = query(goalsCollectionRef, where("isActive", "==", true)); 
              const goalsSnapshot = await getDocs(goalsCollectionRef); 
              const definitions: { [key: string]: GoalDefinition } = {};
              goalsSnapshot.forEach((doc) => {
                  const data = doc.data();
                  definitions[doc.id] = { 
                      goalId: doc.id, 
                      description: data.description, 
                      type: data.type, 
                      metric: data.metric, 
                      target: data.target, 
                      xpReward: data.xpReward 
                  } as GoalDefinition;
              });
              setAllGoalDefinitions(definitions);
          } catch (error) {
              console.error("Error fetching goal definitions:", error);
          } 
          // Consider setting loadingGoals false here only if NOT combined with profile listener
      };
      fetchGoalDefinitions();
  }, []); // Run once on mount
  // *** END NEW Effect ***

  // Effect 3: Fetch Profile & Listen for Active Goals (Combined for efficiency)
  useEffect(() => {
    if (!currentUser) {
      setLoadingData(false);
      setLoadingGoals(false); // Ensure loading stops if no user
      setUserProfile(null);
      setActiveGoalsMap({}); // Clear goals map
      return;
    }

    setLoadingData(true);
    setLoadingGoals(true); // Set loading true here
    const userRef = doc(db, 'users', currentUser.uid);

    const unsubscribeProfile = onSnapshot(userRef, async (userDoc) => {
        if (userDoc.exists()) {
            const profileData = userDoc.data() as Partial<UserProfileBaseData>;
            // --- Fetch Rank details like in ProfileScreen --- 
            const currentRankLevel = profileData.rankLevel ?? 1;
            const currentXp = profileData.xp ?? 0;
            
            let fetchedRankName = 'Rookie'; // Defaults
            let fetchedCurrentRankThreshold = 0; // Added default for current threshold
            let fetchedNextRankThreshold = currentXp; // Default to current XP if no next rank

            try {
                const currentRankRef = doc(db, 'ranks', String(currentRankLevel));
                const nextRankRef = doc(db, 'ranks', String(currentRankLevel + 1));
                const [currentRankSnap, nextRankSnap] = await Promise.all([
                    getDoc(currentRankRef),
                    getDoc(nextRankRef),
                ]);

                if (currentRankSnap.exists()) {
                    const currentRankData = currentRankSnap.data() as RankData;
                    fetchedRankName = currentRankData.name;
                    fetchedCurrentRankThreshold = currentRankData.xpThreshold; // Assign current threshold
                }
                if (nextRankSnap.exists()) {
                    fetchedNextRankThreshold = (nextRankSnap.data() as RankData).xpThreshold;
                } else {
                    // If no next rank, use current XP for max display
                    // Current threshold remains as fetched (or 0 if rank 1 didn't exist)
                    fetchedNextRankThreshold = currentXp; 
                }
            } catch (rankError) {
                 console.error("HomeScreen: Error fetching rank data: ", rankError);
                 // Use defaults if fetch fails
            }

            setUserProfile({
                uid: profileData.uid ?? currentUser.uid,
                name: profileData.name ?? 'User',
                email: profileData.email ?? 'No email',
                xp: currentXp,
                rankLevel: currentRankLevel,
                activeGoals: profileData.activeGoals ?? {},
                // Use the fetched values
                currentRankName: fetchedRankName, 
                currentRankThreshold: fetchedCurrentRankThreshold, // Added current threshold
                nextRankThreshold: fetchedNextRankThreshold,
            });
            // --- END Rank fetching ---

            // *** Update Active Goals Map State ***
            setActiveGoalsMap(profileData.activeGoals || {});
            setLoadingGoals(false); // Goal loading finished

        } else {
            console.log("User profile document does not exist for UID:", currentUser.uid);
            setUserProfile(null);
            setActiveGoalsMap({});
            setLoadingGoals(false);
        }
        setLoadingData(false); // Profile loading finished
    }, (error) => {
        console.error("Error listening to user profile:", error);
        setUserProfile(null);
        setActiveGoalsMap({});
        setLoadingData(false);
        setLoadingGoals(false);
    });

    // Separate listener for sessions/stats (keep as is)
    const sessionsQuery = query(collection(db, "sessions"), where("userId", "==", currentUser.uid));
    const unsubscribeSessions = onSnapshot(sessionsQuery, async (querySnapshot) => {
        const sessionDocs = querySnapshot.docs;
        const totalSessionsCount = sessionDocs.length;
        let calculatedWeeklyWaves = 0;
        let lifetimeTotalWavesCount = 0;
        const sevenDaysAgo = Timestamp.now().seconds - (7 * 24 * 60 * 60);

        sessionDocs.forEach((doc) => {
            const session = doc.data();
            const sessionWaveCount = session.waveCount || 0;
            lifetimeTotalWavesCount += sessionWaveCount;
            if (session.sessionDate && session.sessionDate.seconds >= sevenDaysAgo) {
                calculatedWeeklyWaves += sessionWaveCount;
            }
        });
        setWeeklyWaves(calculatedWeeklyWaves); // Update weekly waves state

        // Calculate Detailed Lifetime Stats
        let totalSpeedSum = 0;
        let waveCountForAvgSpeed = 0;
        let maxDuration = 0;
        let maxSpeed = 0;
        let totalSurfTime = 0;

        try {
            const waveFetchPromises = sessionDocs.map(sessionDoc =>
                getDocs(collection(db, 'sessions', sessionDoc.id, 'waves'))
            );
            const waveSnapshots = await Promise.all(waveFetchPromises);

            waveSnapshots.forEach(waveSnapshot => {
                waveSnapshot.forEach(waveDoc => {
                    const wave = waveDoc.data();
                    const avgSpeedForWave = wave.averageSpeed || 0;
                    const topSpeedForWave = wave.topSpeed || 0;
                    const duration = wave.duration || 0;

                    if (avgSpeedForWave > 0) {
                        totalSpeedSum += avgSpeedForWave;
                        waveCountForAvgSpeed++;
                    }
                    if (topSpeedForWave > maxSpeed) maxSpeed = topSpeedForWave;
                    if (duration > 0) {
                        totalSurfTime += duration;
                        if (duration > maxDuration) maxDuration = duration;
                    }
                });
            });

            const avgSpeed = waveCountForAvgSpeed > 0 ? totalSpeedSum / waveCountForAvgSpeed : 0;
            const avgWavesPerSession = totalSessionsCount > 0 ? lifetimeTotalWavesCount / totalSessionsCount : 0;

            // Update ONLY the lifetimeStats state
            setLifetimeStats({ 
                avgSpeed: avgSpeed,
                longestWave: maxDuration,
                bestSpeed: maxSpeed,
                totalSessions: totalSessionsCount,
                totalWaves: lifetimeTotalWavesCount,
                totalTime: totalSurfTime,
                avgWavesPerSession: avgWavesPerSession,
            });

        } catch (waveError) {
            console.error("Error fetching wave data for lifetime stats:", waveError);
            // Optionally reset stats or show an error
        }

    }, (error) => {
        console.error("Error listening to sessions collection:", error);
        // Handle error appropriately
    });

    return () => {
        unsubscribeProfile();
        unsubscribeSessions();
    };
  }, [currentUser]);

  // *** NEW: Process goals to select one for the homepage card ***
  const { featuredGoal, allDailyWeeklyGoalsCompleted } = useMemo(() => {
    const activeGoals: DisplayGoal[] = Object.keys(activeGoalsMap)
      .map(goalId => {
        const definition = allGoalDefinitions[goalId];
        const progressData = activeGoalsMap[goalId];
        if (definition && progressData) {
          return { ...definition, ...progressData };
        }
        return null;
      })
      .filter((goal): goal is DisplayGoal => goal !== null);

    const incompleteDailyWeekly = activeGoals.filter(g => 
        (g.type === 'daily' || g.type === 'weekly') && !g.completed
    );

    const allCompleted = incompleteDailyWeekly.length === 0 && activeGoals.some(g => g.type === 'daily' || g.type === 'weekly');

    let selectedGoal: DisplayGoal | null = null;
    if (!allCompleted && incompleteDailyWeekly.length > 0) {
        // Simple random selection for now
        selectedGoal = incompleteDailyWeekly[Math.floor(Math.random() * incompleteDailyWeekly.length)];
    }

    return { 
        featuredGoal: selectedGoal, 
        allDailyWeeklyGoalsCompleted: allCompleted 
    };
  }, [activeGoalsMap, allGoalDefinitions]);
  // *** END NEW Goal Processing ***

  // --- Render Logic ---
  if (loadingAuth) { // Initial auth check loader
     return (
       <View style={styles.mainLoader}>
         <ActivityIndicator size="large" color={colors.primaryBlue} />
       </View>
     );
   }

   if (!currentUser) { // If logged out
       return null; 
   }

   // If logged in but data still loading (profile OR stats)
   if (loadingData || !userProfile) { // Check !userProfile as well
         return (
           <View style={styles.mainLoader}>
             <ActivityIndicator size="large" color={colors.primaryBlue} />
           </View>
         );
   }

  // Main Render when logged in and data is available
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Pass navigation prop to TopBar */}
      <TopBar navigation={navigation} />
      <ScrollView 
          style={styles.container} 
          showsVerticalScrollIndicator={false}
      >
          <GoalCard 
              goal={featuredGoal}
              allCompleted={allDailyWeeklyGoalsCompleted}
          />
          {/* Pass separate stats data */}
          <LifetimeStats stats={lifetimeStats} /> 
          <GoalsSection navigation={navigation} /> 
          {/* Pass separate profile data */}
          <RankCard 
              rankName={userProfile.currentRankName}
              currentXp={userProfile.xp}
              currentRankThreshold={userProfile.currentRankThreshold}
              nextRankXp={userProfile.nextRankThreshold}
          />
          <View style={{ height: 50 }} />
        </ScrollView>
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
  // Recent Activity Styles (Renamed to Goals Section Styles)
   goalsSectionContainer: { // Renamed style for the section container
       paddingHorizontal: 15,
       marginTop: 25, // Keep similar spacing
   },
  // REMOVED Recommended Card Styles (recommendedCard, recommendedIconContainer, etc.)
  // Add NEW Goal Link Card Styles
  goalLinkCard: {
    backgroundColor: colors.primaryBlue, // Fallback background, changed to blue
    borderRadius: 20, // More rounded corners
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden', // Important for gradient absolute positioning
    minHeight: 100, // Make card taller
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  goalLinkIconContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)', // Adjusted alpha for blue background
      padding: 15, // Larger padding
      borderRadius: 15, // Rounded square
      marginRight: 20, // More spacing
  },
  goalLinkTextContainer: {
      flex: 1,
  },
  goalLinkTitle: {
      fontSize: 18, // Larger title
      fontWeight: 'bold',
      color: colors.white, // Changed title color to white for contrast on blue
      marginBottom: 5,
  },
  goalLinkSubtitle: {
      fontSize: 14,
      color: colors.white, // Changed subtitle color to white for contrast on blue
      opacity: 0.9, // Slightly reduced opacity for subtitle
      lineHeight: 20, // Improve readability
  },
  mainLoader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background, // Ensure loader has background
  },
  // Add NEW RankCard Styles
  rankCardContainer: {
      backgroundColor: colors.cardBackground,
      borderRadius: 15,
      padding: 15,
      marginHorizontal: 15, // Add horizontal margin to match other sections
      marginTop: 25, // Space above the rank card
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
  },
  rankHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
  },
  rankIcon: {
      marginRight: 10,
  },
  rankTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textPrimary,
      flex: 1, // Allow title to take available space
  },
  rankLevelText: { // Style for the percentage
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
  },
  rankProgressBarBackground: {
      height: 8,
      backgroundColor: colors.background, // Changed from inputBackground
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
  },
  rankProgressBarForeground: {
      height: '100%',
      borderRadius: 4,
  },
  rankXpContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
  },
  rankXpText: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
  },
  rankXpNeededText: {
      fontSize: 12,
      color: colors.textSecondary,
  },
});

export default HomeScreen; 