import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { auth, db } from '../services/firebaseConfig';
import { User } from 'firebase/auth';
import { doc, onSnapshot, collection, getDocs, Timestamp } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

// --- Interfaces --- 
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

// Define colors (reuse or centralize later)
const colors = {
  background: '#f0f4f8',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  cardBackground: '#ffffff',
  primaryBlue: '#1A73E8', // For progress bar
  secondaryBlue: '#0056B3',
  lightBlue: '#4AB1FF',
  borderLight: '#dee2e6',
  completedGreen: '#16A34A', // Color for completed text
  progressBg: '#e5e7eb',
  gold: '#FFD700', // For XP
};

// --- Reusable Goal Card Component ---
interface GoalCardProps {
  goal: DisplayGoal;
}

const GoalCard = ({ goal }: GoalCardProps) => {
    const progress = goal.target > 0 ? Math.min(goal.progress / goal.target, 1) : (goal.completed ? 1 : 0);
    const progressPercent = Math.round(progress * 100);
    const isCompleted = goal.completed;

    // Helper to format target/progress for readability (e.g., duration in minutes)
    const formatValue = (value: number, metric: GoalDefinition['metric']): string => {
        if (metric === 'sessionDuration' || metric === 'longestWaveDuration') {
            const minutes = Math.floor(value / 60);
            const seconds = value % 60;
            if (minutes > 0) return `${minutes}m ${seconds}s`;
            return `${seconds}s`;
        } 
        // Add formatting for speed (mph/kph based on settings eventually)
        if (metric === 'topSpeed') {
            return `${value.toFixed(1)} mph`; // Assuming mph for now
        }
        // Default: waveCount, sessionCount
        return value.toLocaleString();
    };

    return (
        <View style={[styles.goalCard, isCompleted && styles.goalCardCompleted]}>
            <View style={styles.goalCardHeader}>
                 <Text style={styles.goalDescription}>{goal.description}</Text>
                 <View style={styles.xpContainer}>
                      <Ionicons name="star" size={14} color={colors.gold} />
                      <Text style={styles.xpText}>{goal.xpReward} XP</Text>
                 </View>
            </View>
            <View style={styles.progressContainer}>
                 {/* Progress Bar */}
                 <View style={styles.progressBarBackground}>
                     <LinearGradient
                         colors={isCompleted ? [colors.completedGreen, colors.completedGreen] : [colors.secondaryBlue, colors.primaryBlue, colors.lightBlue]}
                         style={[styles.progressBarForeground, { width: `${progressPercent}%` }]}
                         start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                     />
                 </View>
                 {/* Progress Text */}
                 <Text style={[styles.goalProgressText, isCompleted && styles.goalProgressTextCompleted]}>
                    {isCompleted ? 'Completed!' : `${formatValue(goal.progress, goal.metric)} / ${formatValue(goal.target, goal.metric)}`}
                 </Text>
            </View>
         </View>
    );
};

// --- Reusable Goal Category Section Component ---
interface GoalCategorySectionProps {
    title: string;
    iconName: string; // Ionicons name
    goals: DisplayGoal[];
}

const GoalCategorySection = ({ title, iconName, goals }: GoalCategorySectionProps) => {
    if (goals.length === 0) return null; // Don't render empty sections

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Ionicons name={iconName} size={24} color={colors.textPrimary} style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {goals.map(goal => <GoalCard key={goal.goalId} goal={goal} />)}
        </View>
    );
}

const GoalsScreen = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  // State for user's active goal progress map ({ goalId: { progress, completed } })
  const [activeGoalsMap, setActiveGoalsMap] = useState<{ [key: string]: ActiveGoalProgress }>({});
  // State for all goal definitions ({ goalId: { description, target, ... } })
  const [allGoalDefinitions, setAllGoalDefinitions] = useState<{ [key: string]: GoalDefinition }>({});

  // Effect 1: Get current user
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
       setCurrentUser(user);
       if (!user) { // Clear data if logged out
          setActiveGoalsMap({});
          setLoading(false);
       }
    });
    return unsubscribeAuth;
  }, []);

  // Effect 2: Fetch all goal definitions once
  useEffect(() => {
      const fetchGoalDefinitions = async () => {
          try {
              const goalsCollectionRef = collection(db, 'goals');
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
      };
      fetchGoalDefinitions();
  }, []); // Empty dependency array ensures this runs only once

  // Effect 3: Listen to user profile for active goals changes
  useEffect(() => {
      if (!currentUser) {
          setLoading(false);
          setActiveGoalsMap({}); // Clear map if no user
          return;
      }
      
      setLoading(true);
      const userRef = doc(db, 'users', currentUser.uid);
      const unsubscribeProfile = onSnapshot(userRef, (userDoc) => {
          if (userDoc.exists()) {
              const userData = userDoc.data();
              setActiveGoalsMap(userData.activeGoals || {}); // Update state with activeGoals map
          } else {
              setActiveGoalsMap({}); // User profile doesn't exist
          }
          setLoading(false);
      }, (error) => {
          console.error("Error listening to user profile for goals:", error);
          setActiveGoalsMap({});
          setLoading(false);
      });

      return () => unsubscribeProfile(); // Cleanup listener
  }, [currentUser]);

  // --- Process and Group Goals using useMemo ---
  const { daily, weekly, lifetime } = useMemo(() => {
      const allActiveGoals: DisplayGoal[] = Object.keys(activeGoalsMap)
          .map(goalId => {
              const definition = allGoalDefinitions[goalId];
              const progressData = activeGoalsMap[goalId];
              if (definition && progressData) {
                  return { ...definition, ...progressData };
              }
              return null;
          })
          .filter((goal): goal is DisplayGoal => goal !== null)
          // Sort incomplete first within each category later if needed
          .sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);
          
      // Group by type
      const grouped = {
          daily: [] as DisplayGoal[],
          weekly: [] as DisplayGoal[],
          lifetime: [] as DisplayGoal[],
      };
      allActiveGoals.forEach(goal => {
          if (goal.type === 'daily') grouped.daily.push(goal);
          else if (goal.type === 'weekly') grouped.weekly.push(goal);
          else if (goal.type === 'lifetime') grouped.lifetime.push(goal);
      });
      return grouped;
  }, [activeGoalsMap, allGoalDefinitions]);

  if (loading) {
      return (
          <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primaryBlue} />
          </View>
      );
  }

  const hasGoals = daily.length > 0 || weekly.length > 0 || lifetime.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* <Text style={styles.screenTitle}>Your Goals</Text> */}

      {!hasGoals && !loading && (
          <Text style={styles.noGoalsText}>No active goals found. Check back later!</Text>
      )}

      {/* Render sections using the correct variable names */}
      <GoalCategorySection title="Daily Goals" iconName="sunny-outline" goals={daily} />
      <GoalCategorySection title="Weekly Goals" iconName="calendar-outline" goals={weekly} />
      <GoalCategorySection title="Lifetime Goals" iconName="trophy-outline" goals={lifetime} />

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 40, // Add padding at bottom
  },
  loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
  },
  screenTitle: { // Renamed from title to avoid conflict
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 25,
    paddingHorizontal: 5,
  },
  sectionContainer: {
    marginBottom: 30, // Space between sections
  },
  sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
      paddingHorizontal: 5,
  },
  sectionIcon: {
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  noGoalsText: {
      textAlign: 'center',
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 50,
      marginBottom: 30,
  },
  // GoalCard Styles
  goalCard: {
    backgroundColor: colors.cardBackground,
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  goalCardCompleted: {
     opacity: 0.75, // Fade completed goals slightly
  },
  goalCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
  },
  goalDescription: {
    flex: 1, // Allow text to wrap
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginRight: 10,
  },
  xpContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fffbeb', // Light yellow background for XP
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
  },
  xpText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#b45309', // Darker yellow/brown for text
      marginLeft: 4,
  },
  progressContainer: {
     flexDirection: 'row',
     alignItems: 'center',
  },
  progressBarBackground: {
      flex: 1,
      height: 8,
      backgroundColor: colors.progressBg,
      borderRadius: 4,
      overflow: 'hidden',
      marginRight: 12,
  },
  progressBarForeground: {
      height: '100%',
      borderRadius: 4,
  },
  goalProgressText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    minWidth: 80, // Adjust as needed
    textAlign: 'right',
  },
  goalProgressTextCompleted: {
     color: colors.completedGreen,
  },
});

export default GoalsScreen; 