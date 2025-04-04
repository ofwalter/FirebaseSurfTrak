import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { auth, db } from '../services/firebaseConfig';
import { User } from 'firebase/auth';
import { doc, onSnapshot, collection, getDocs, Timestamp } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';

// --- Interfaces --- 
interface GoalDefinition {
    goalId: string;
    description: string;
    type: "daily" | "weekly" | "lifetime";
    metric: "waveCount" | "sessionCount";
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
};

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
                  definitions[doc.id] = { goalId: doc.id, ...doc.data() } as GoalDefinition;
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

  // Combine active progress with definitions for display
  const displayGoals: DisplayGoal[] = Object.keys(activeGoalsMap)
    .map(goalId => {
      const definition = allGoalDefinitions[goalId];
      const progressData = activeGoalsMap[goalId];
      if (definition && progressData) {
        return { ...definition, ...progressData };
      }
      return null; // Handle cases where definition might be missing
    })
    .filter((goal): goal is DisplayGoal => goal !== null) // Type guard to remove nulls
    // Optional: Sort goals (e.g., incomplete first, then by type)
    .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1; // Incomplete first
        if (a.type !== b.type) { // Then sort by type (daily, weekly, lifetime)
             const typeOrder = { daily: 1, weekly: 2, lifetime: 3 };
             return (typeOrder[a.type] || 9) - (typeOrder[b.type] || 9);
        }
        return a.description.localeCompare(b.description); // Finally by description
    });

  if (loading) {
      return (
          <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primaryBlue} />
          </View>
      );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Your Goals</Text>

      {displayGoals.length === 0 && !loading && (
          <Text style={styles.noGoalsText}>No active goals found. Check back later!</Text>
      )}

      {displayGoals.map((goal) => {
          const progress = goal.target > 0 ? Math.min(goal.progress / goal.target, 1) : (goal.completed ? 1 : 0);
          const progressPercent = Math.round(progress * 100);
          return (
              <View key={goal.goalId} style={[styles.goalCard, goal.completed && styles.goalCardCompleted]}>
                  <Text style={styles.goalDescription}>{goal.description}</Text>
                  <View style={styles.progressContainer}>
                       {/* Progress Bar */}
                       <View style={styles.progressBarBackground}>
                           <LinearGradient
                               colors={goal.completed ? [colors.completedGreen, colors.completedGreen] : [colors.secondaryBlue, colors.primaryBlue, colors.lightBlue]}
                               style={[styles.progressBarForeground, { width: `${progressPercent}%` }]}
                               start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                           />
                       </View>
                       {/* Progress Text */}
                       <Text style={[styles.goalProgressText, goal.completed && styles.goalProgressTextCompleted]}>
                          {goal.completed ? 'Completed!' : `${goal.progress.toLocaleString()} / ${goal.target.toLocaleString()}`}
                       </Text>
                  </View>
               </View>
          );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 15, // Adjusted padding
    paddingTop: 20,
  },
  loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
  },
  title: {
    fontSize: 28, // Larger title
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 25,
    paddingHorizontal: 5, // Align with card padding
  },
  noGoalsText: {
      textAlign: 'center',
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 50,
  },
  goalCard: {
    backgroundColor: colors.cardBackground,
    padding: 20, // Increased padding
    borderRadius: 15, // More rounded
    marginBottom: 20, // Increased spacing
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  goalCardCompleted: {
     // Add subtle indication if needed, e.g., border color
     // borderColor: colors.completedGreen,
     // borderWidth: 1,
     opacity: 0.8, // Slightly fade completed goals
  },
  goalDescription: {
    fontSize: 17, // Slightly larger
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 15, // More space before progress
  },
  progressContainer: {
     flexDirection: 'row',
     alignItems: 'center',
  },
  progressBarBackground: {
      flex: 1, // Take available space
      height: 10, // Thicker bar
      backgroundColor: colors.background, 
      borderRadius: 5,
      overflow: 'hidden',
      marginRight: 15, // Space between bar and text
  },
  progressBarForeground: {
      height: '100%',
      borderRadius: 5,
  },
  goalProgressText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    minWidth: 90, // Ensure enough space for text
    textAlign: 'right',
  },
  goalProgressTextCompleted: {
     color: colors.completedGreen, // Green text when completed
  },
});

export default GoalsScreen; 