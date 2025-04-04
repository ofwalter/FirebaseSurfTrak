import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { auth, db } from '../services/firebaseConfig';
import { signOut, User } from 'firebase/auth'; // Import User
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore'; // Import firestore functions
import { BlurView } from 'expo-blur';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

// Define colors (reuse or centralize later)
const colors = {
  primaryBlue: '#1A73E8',
  secondaryBlue: '#0056B3',
  lightBlue: '#4AB1FF',
  green: '#16A34A',
  orange: '#EA580C',
  red: '#DC2626',
  background: '#f0f4f8',
  cardBackground: '#ffffff',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  white: '#ffffff',
  iconBackgroundBlue: '#e0f2fe', // Light blue for icon bg
  iconBackgroundGreen: '#dcfce7', // Light green
  iconBackgroundOrange: '#fff7ed', // Light orange
  iconBackgroundRed: '#fee2e2', // Light red
  borderLight: '#dee2e6', // Added missing border color
};

// --- Reusable Components (Inline for simplicity) ---

const ProfileHeader = () => (
  <BlurView intensity={80} tint="light" style={styles.headerContainer}>
    <View style={styles.headerContent}>
      {/* Title */}
      <Text style={styles.headerTitle}>Profile</Text>

      {/* Settings Button (can link to settings menu item later) */}
      <TouchableOpacity style={styles.settingsButton}>
        <Ionicons name="settings-outline" size={24} color={colors.primaryBlue} />
      </TouchableOpacity>
    </View>
  </BlurView>
);

// --- Define Interfaces (similar to HomeScreen) ---
interface RankData {
    rankLevel: number;
    name: string;
    xpThreshold: number;
}

interface UserProfileData { // Define base user profile structure
    uid: string;
    name: string;
    email: string;
    xp: number;
    rankLevel: number;
    activeGoals: { [key: string]: { progress: number; completed: boolean; lastReset?: Timestamp } };
    // Add optional fields fetched later
    currentRankName?: string;
    nextRankThreshold?: number;
    sessionsCount?: number; // Add placeholder stats fields
    totalWavesCount?: number;
}

// Update ProfileCard props and content
interface ProfileCardProps {
    userProfile: UserProfileData | null;
    // Remove explicit stats props, get from userProfile
}

const ProfileCard = ({ userProfile }: ProfileCardProps) => {
    if (!userProfile) {
        return null; // Or a placeholder/loading state
    }

    const { name, email, xp = 0, currentRankName = "Rookie", nextRankThreshold = 100 } = userProfile;

    // Calculate progress
    const progress = nextRankThreshold > 0 ? Math.min(xp / nextRankThreshold, 1) : 1;
    const progressPercent = Math.round(progress * 100);

    return (
        <View style={styles.profileCardContainer}>
            <Image
                source={require('../../assets/placeholder-profilephoto.png')}
                style={styles.profilePicture}
            />
            <Text style={styles.profileName}>{name || email || 'SurfTrak User'}</Text>
            {/* Display Rank */}
            <Text style={styles.profileRank}>{currentRankName}</Text>

            {/* XP Progress Bar */}
            <View style={styles.xpBarContainer}>
                 <LinearGradient
                     colors={[colors.secondaryBlue, colors.primaryBlue, colors.lightBlue]}
                     style={[styles.xpBarForeground, { width: `${progressPercent}%` }]}
                     start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                 />
             </View>
            <View style={styles.xpTextContainer}>
                 <Text style={styles.xpText}>{xp.toLocaleString()} XP</Text>
                 <Text style={styles.xpNextText}>{nextRankThreshold.toLocaleString()} XP to next rank</Text>
             </View>
        </View>
    );
};

interface MenuCardProps {
  iconName: string;
  iconColor: string;
  iconBackgroundColor: string;
  text: string;
  gradientColors: readonly [string, string, ...string[]];
  onPress: () => void;
}

const MenuCard = ({ iconName, iconColor, iconBackgroundColor, text, gradientColors, onPress }: MenuCardProps) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <LinearGradient
            colors={gradientColors}
            style={styles.menuCard}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
        >
            <View style={styles.menuCardContent}>
                <View style={[styles.menuIconContainer, { backgroundColor: iconBackgroundColor }]}>
                    <Ionicons name={iconName} size={22} color={iconColor} />
                </View>
                <Text style={styles.menuText}>{text}</Text>
                <Ionicons name="chevron-forward-outline" size={20} color={colors.textSecondary} />
            </View>
        </LinearGradient>
    </TouchableOpacity>
);

// --- ProfileScreen Implementation ---

const ProfileScreen = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

   // Effect 1: Update current user from auth state
   useEffect(() => {
     const unsubscribe = auth.onAuthStateChanged(user => {
       if (user !== currentUser) {
          setCurrentUser(user);
          if (!user) {
              // Clear profile if user logs out
              setUserProfile(null);
              setLoadingProfile(false); // No profile to load
          }
       }
     });
     return unsubscribe; 
   }, [currentUser]);

   // Effect 2: Fetch user profile and rank data when currentUser changes
   useEffect(() => {
     if (!currentUser) {
       setLoadingProfile(false);
       setUserProfile(null); // Clear profile if no user
       return; // Exit if no user
     }

     setLoadingProfile(true);
     const userRef = doc(db, 'users', currentUser.uid);

     const unsubscribeProfile = onSnapshot(userRef, async (userDoc) => {
       if (userDoc.exists()) {
         const profileData = userDoc.data() as Partial<UserProfileData>;
         const currentRankLevel = profileData.rankLevel ?? 1;
         const currentXp = profileData.xp ?? 0;

         // Fetch current and next rank definitions
         const currentRankRef = doc(db, 'ranks', String(currentRankLevel));
         const nextRankRef = doc(db, 'ranks', String(currentRankLevel + 1));

         try {
             const [currentRankSnap, nextRankSnap] = await Promise.all([
                 getDoc(currentRankRef),
                 getDoc(nextRankRef),
             ]);

             const rankName = currentRankSnap.exists() ? (currentRankSnap.data() as RankData).name : 'Rookie';
             const nextRankThreshold = nextRankSnap.exists() ? (nextRankSnap.data() as RankData).xpThreshold : currentXp; // Use current XP if no next rank

             // Combine fetched data
             setUserProfile({
                 uid: profileData.uid ?? currentUser.uid,
                 name: profileData.name ?? 'User',
                 email: profileData.email ?? 'No email',
                 xp: currentXp,
                 rankLevel: currentRankLevel,
                 activeGoals: profileData.activeGoals ?? {},
                 currentRankName: rankName,
                 nextRankThreshold: nextRankThreshold,
                 // NOTE: sessionsCount & totalWavesCount aren't directly in user profile
                 // These might need separate fetching or come from lifetime stats if available
                 sessionsCount: 0, // Placeholder - Fetch or calculate elsewhere
                 totalWavesCount: 0, // Placeholder - Fetch or calculate elsewhere
             });
         } catch (error) {
              console.error("Error fetching rank data: ", error);
              // Set profile with defaults if rank fetch fails
              setUserProfile({
                    uid: profileData.uid ?? currentUser.uid,
                    name: profileData.name ?? 'User',
                    email: profileData.email ?? 'No email',
                    xp: currentXp,
                    rankLevel: currentRankLevel,
                    activeGoals: profileData.activeGoals ?? {},
                    currentRankName: 'Rookie', // Default rank name on error
                    nextRankThreshold: currentXp,
                    sessionsCount: 0,
                    totalWavesCount: 0,
              });
         }

       } else {
         console.log("User profile document does not exist for UID:", currentUser.uid);
         setUserProfile(null); // Handle case where profile doesn't exist
       }
       setLoadingProfile(false); // Profile loading finished
     }, (error) => {
       console.error("Error listening to user profile: ", error);
       setUserProfile(null); // Clear profile on error
       setLoadingProfile(false);
     });

     // Cleanup listener on unmount or currentUser change
     return () => unsubscribeProfile();
   }, [currentUser]);

  const handleLogout = async () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
              // AuthNavigator handles navigation
              console.log('User logged out from Profile');
            } catch (error) {
              console.error("Logout Error:", error);
              Alert.alert("Error", "Could not log out.");
            }
          }
        }
      ]
    );
  };

  // Placeholder actions for other menu items
  const handleSettings = () => Alert.alert("Settings", "Settings not implemented yet.");
  const handleDeviceManager = () => Alert.alert("Device Manager", "Device Manager not implemented yet.");
  const handleHelp = () => Alert.alert("Help & Support", "Help & Support not implemented yet.");

  // Render loading indicator while profile is loading
  if (loadingProfile) {
     return (
         <View style={styles.loadingContainer}>
             <ActivityIndicator size="large" color={colors.primaryBlue} />
         </View>
     );
  }

  return (
    <View style={styles.screenContainer}>
      <ProfileHeader />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContentContainer}>
        {/* Pass fetched userProfile data to ProfileCard */}
        <ProfileCard userProfile={userProfile} />

        {/* Menu Options */}
        <View style={styles.menuGroup}>
            <MenuCard
                iconName="settings-outline"
                iconColor={colors.primaryBlue}
                iconBackgroundColor={colors.iconBackgroundBlue}
                text="Settings"
                gradientColors={['#ffffff', '#f9fafb']} // Subtle white gradient
                onPress={handleSettings}
            />
            <MenuCard
                iconName="watch-outline" // Example icon for device manager
                iconColor={colors.green}
                iconBackgroundColor={colors.iconBackgroundGreen}
                text="Device Manager"
                gradientColors={['#ffffff', '#f9fafb']}
                onPress={handleDeviceManager}
            />
            <MenuCard
                iconName="help-circle-outline"
                iconColor={colors.orange}
                iconBackgroundColor={colors.iconBackgroundOrange}
                text="Help & Support"
                gradientColors={['#ffffff', '#f9fafb']}
                onPress={handleHelp}
            />
            <MenuCard
                iconName="log-out-outline"
                iconColor={colors.red}
                iconBackgroundColor={colors.iconBackgroundRed}
                text="Log Out"
                gradientColors={['#ffffff', '#f9fafb']}
                onPress={handleLogout}
            />
        </View>
      </ScrollView>
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
      flex: 1,
  },
  scrollContentContainer: {
      paddingBottom: 30,
      paddingTop: 115, // Increased paddingTop for more space
  },
  // Header Styles (similar to Sessions)
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 55 : 30, // Adjusted padding
    paddingBottom: 15,
    borderBottomWidth: Platform.OS === 'ios' ? 0 : 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  headerTitle: {
    fontSize: 28, // 3xl approx
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1, // Allow title to take space
    textAlign: 'center', // Center title
    marginLeft: 40, // Offset for the left (empty) space to center properly
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    width: 40, // Ensure consistent size
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Profile Card Styles
  profileCardContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 25,
    marginHorizontal: 15,
    backgroundColor: colors.white,
    borderRadius: 20,
    marginTop: 0, // Sits right below the header space
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profilePicture: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: colors.white,
    marginBottom: 15,
    // Add shadow to picture itself for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    backgroundColor: '#eee', // Background while loading
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  profileRank: { // Style for the rank name
      fontSize: 16,
      fontWeight: '500',
      color: colors.primaryBlue,
      marginBottom: 15, // Space below rank
  },
  // XP Bar Styles (similar to RankCard)
  xpBarContainer: {
      width: '80%', // Make bar slightly smaller than card width
      height: 10,
      backgroundColor: colors.background, // Use screen background color
      borderRadius: 5,
      overflow: 'hidden',
      marginBottom: 8,
  },
  xpBarForeground: {
      height: '100%',
      borderRadius: 5,
  },
  xpTextContainer: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     width: '80%', // Match bar width
     marginBottom: 20, // Space below XP text
  },
  xpText: {
      fontSize: 13,
      color: colors.textPrimary,
      fontWeight: '500',
  },
  xpNextText: {
      fontSize: 13,
      color: colors.textSecondary,
  },
  // Menu Styles
  menuGroup: {
    marginTop: 25,
    marginHorizontal: 15,
  },
  menuCard: {
    // backgroundColor: colors.white, // Gradient handles background
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    overflow: 'hidden',
  },
  menuCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  loadingContainer: { // Style for loading indicator view
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
  },
});

export default ProfileScreen; 