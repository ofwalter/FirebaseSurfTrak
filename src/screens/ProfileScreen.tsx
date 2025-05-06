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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppNavigator'; // Import AppStackParamList
import { useTheme } from '../context/ThemeContext'; // Import theme hook
import { Colors } from '../constants/Colors'; // Import Colors

// --- Reusable Components (Need theme awareness) ---

interface ProfileHeaderProps {
    navigation: NativeStackNavigationProp<AppStackParamList, 'AppTabs'>;
    colors: typeof Colors.light; // Pass theme colors needed
}

// Pass colors down
const ProfileHeader = ({ navigation, colors }: ProfileHeaderProps) => (
  <BlurView intensity={80} tint={colors === Colors.light ? "light" : "dark"} style={getHeaderStyles(colors).headerContainer}>
    <View style={getHeaderStyles(colors).headerContent}>
      <Text style={getHeaderStyles(colors).headerTitle}>Profile</Text>
      <TouchableOpacity 
        style={getHeaderStyles(colors).settingsButton}
        onPress={() => navigation.navigate('Settings')} 
      >
        <Ionicons name="settings-outline" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  </BlurView>
);

// Function to get header styles based on theme
const getHeaderStyles = (colors: typeof Colors.light) => StyleSheet.create({
  headerContainer: { // Positioning and base padding for blur
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: Platform.OS === 'ios' ? 55 : 30, 
    paddingBottom: 10, // Reduced bottom padding for tighter look
  },
  headerContent: { // Content layout within the blur container
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Align items edge-to-edge
    paddingHorizontal: 15, // Horizontal padding for content
  },
  headerTitle: {
    // Title takes available space and centers (implicitly due to space-between)
    fontSize: 20, // Keep size
    fontWeight: 'bold',
    color: colors.text, // Themed
    textAlign: 'center',
    flex: 1, // Allow text to take space for centering
    // Add margin to compensate for button if needed, but space-between might handle it
    // marginLeft: 40, 
  },
  settingsButton: {
    // Button sits at the end due to space-between
    padding: 8,
    // Removed absolute positioning, relying on flexbox
  },
});

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
    currentRankThreshold?: number;
    nextRankThreshold?: number;
    sessionsCount?: number; // Add placeholder stats fields
    totalWavesCount?: number;
}

// Update ProfileCard props and content
interface ProfileCardProps {
    userProfile: UserProfileData | null;
    colors: typeof Colors.light; // Pass colors
}

// Pass colors down
const ProfileCard = ({ userProfile, colors }: ProfileCardProps) => {
    if (!userProfile) {
        return null; // Or a placeholder/loading state
    }

    const { 
        name, 
        email, 
        xp = 0, 
        currentRankName = "Rookie", 
        currentRankThreshold = 0,
        nextRankThreshold = 100 
    } = userProfile;

    // Correct progress calculation (mirroring HomeScreen RankCard)
    const xpInCurrentRank = Math.max(0, xp - currentRankThreshold);
    const xpRangeForRank = Math.max(1, nextRankThreshold - currentRankThreshold); // Avoid division by zero
    const isMaxRank = xp === nextRankThreshold; // Check if user might be at max rank (where next = current)

    const progress = isMaxRank ? 1 : Math.min(xpInCurrentRank / xpRangeForRank, 1);
    const progressPercent = isMaxRank ? 100 : Math.round(progress * 100);
    const xpNeeded = isMaxRank ? 0 : Math.max(0, nextRankThreshold - xp);

    const styles = getProfileCardStyles(colors); // Get themed styles

    return (
        <View style={styles.profileCardContainer}>
            <Image
                source={require('../../assets/placeholder-profilephoto.png')}
                style={styles.profilePicture}
            />
            <Text style={styles.profileName}>{name || email || 'SurfTrak User'}</Text>
            <Text style={styles.profileRank}>{currentRankName}</Text>

            {/* XP Progress Bar - Use correct width */}
            <View style={styles.xpBarContainer}>
                 <LinearGradient
                     colors={colors.xpGradient} // Use themed gradient
                     style={[styles.xpBarForeground, { width: `${progressPercent}%` }]}
                     start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                 />
             </View>
            <View style={styles.xpTextContainer}>
                 <Text style={styles.xpText}>{xp.toLocaleString()} XP</Text>
                 {/* Show correct XP needed text or Max Rank */}
                 {isMaxRank ? (
                    <Text style={styles.xpNextText}>(Max Rank Achieved)</Text>
                 ) : (
                    <Text style={styles.xpNextText}>({xpNeeded.toLocaleString()} XP to next rank)</Text>
                 )}
             </View>
        </View>
    );
};

// Function to get profile card styles based on theme
const getProfileCardStyles = (colors: typeof Colors.light) => StyleSheet.create({
    profileCardContainer: {
        alignItems: 'center',
        paddingHorizontal: 20, // Original padding
        paddingVertical: 25,
        marginHorizontal: 15, // Original margin
        backgroundColor: colors.cardBackground, // Themed
        borderRadius: 20, // Original radius
        marginTop: Platform.OS === 'ios' ? 50 : 30, // Add some top margin
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, // Original shadow
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    profilePicture: {
        width: 128, // Original size
        height: 128,
        borderRadius: 64,
        borderWidth: 4, // Original border
        borderColor: colors.cardBackground, // Border color same as card background
        marginBottom: 15,
        shadowColor: '#000', // Original picture shadow
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        backgroundColor: colors.border, // Placeholder background
    },
    profileName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    profileRank: { // Original styling
        fontSize: 16,
        fontWeight: '500',
        color: colors.primary, // Use themed primary color
        marginBottom: 15, // Original margin
    },
    xpBarContainer: { // Original styling
        width: '80%',
        height: 10,
        backgroundColor: colors.border, // Use themed border/background
        borderRadius: 5,
        overflow: 'hidden',
        marginBottom: 8,
    },
    xpBarForeground: {
        height: '100%',
        borderRadius: 5,
    },
    xpTextContainer: { // Original styling
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '80%',
    },
    xpText: { // Original styling
        fontSize: 13,
        color: colors.text,
        fontWeight: '500',
    },
    xpNextText: { // Original styling
        fontSize: 13,
        color: colors.textSecondary,
        marginLeft: 5,
    },
});

// NEW: Menu Item Row Component
interface MenuItemRowProps {
  iconName: string;
  iconColor: string;
  iconBackgroundColor: string;
  text: string;
  onPress: () => void;
  colors: typeof Colors.light;
  isLogout?: boolean; // Optional flag for distinct logout styling
}

const MenuItemRow: React.FC<MenuItemRowProps> = ({ 
  iconName, 
  iconColor, 
  iconBackgroundColor, 
  text, 
  onPress, 
  colors, 
  isLogout = false 
}) => {
  const styles = getMenuItemRowStyles(colors, isLogout);
  return (
    <TouchableOpacity onPress={onPress} style={styles.menuItemContainer} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: iconBackgroundColor }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
                </View>
      <Text style={styles.menuItemText}>{text}</Text>
      <Ionicons name="chevron-forward-outline" size={22} color={colors.textSecondary} />
    </TouchableOpacity>
);
};

// Function to get menu item row styles based on theme
const getMenuItemRowStyles = (colors: typeof Colors.light, isLogout: boolean) => StyleSheet.create({
  menuItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: colors.cardBackground, // Use card background for rows
    // Add border logic later if needed (e.g., for grouping)
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18, // Make it circular
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: isLogout ? colors.logoutButtonBackground : colors.text, // Red for logout
    // fontWeight: '500', // Optional: adjust weight
  },
});

// --- ProfileScreen Implementation ---

// Define navigation prop type for the screen itself
type ProfileScreenNavigationProp = NativeStackNavigationProp<AppStackParamList, 'AppTabs'>;

const ProfileScreen = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>(); // Get navigation object
  const { theme, isThemeLoading } = useTheme(); // Get theme state
  const colors = Colors[theme]; // Get color palette for current theme

  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

   // Styles need to be created inside the component to access theme
  const styles = getProfileScreenStyles(colors);

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

         const currentRankRef = doc(db, 'ranks', String(currentRankLevel));
         const nextRankRef = doc(db, 'ranks', String(currentRankLevel + 1));

         try {
             const [currentRankSnap, nextRankSnap] = await Promise.all([
                 getDoc(currentRankRef),
                 getDoc(nextRankRef),
             ]);

             let rankName = 'Rookie';
             let currentThreshold = 0;
             let nextThreshold = currentXp;

             if (currentRankSnap.exists()) {
                 const currentRankData = currentRankSnap.data() as RankData;
                 rankName = currentRankData.name;
                 currentThreshold = currentRankData.xpThreshold;
             }
             if (nextRankSnap.exists()) {
                 nextThreshold = (nextRankSnap.data() as RankData).xpThreshold;
             } // else nextThreshold remains currentXp (max rank case)

             // Combine fetched data
             setUserProfile({
                 uid: profileData.uid ?? currentUser.uid,
                 name: profileData.name ?? 'User',
                 email: profileData.email ?? 'No email',
                 xp: currentXp,
                 rankLevel: currentRankLevel,
                 activeGoals: profileData.activeGoals ?? {},
                 currentRankName: rankName,
                 currentRankThreshold: currentThreshold,
                 nextRankThreshold: nextThreshold,
                 sessionsCount: 0, 
                 totalWavesCount: 0, 
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
                    currentRankName: 'Rookie', 
                    currentRankThreshold: 0, // Default threshold on error
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

  // Menu navigation handlers
  const handleGoals = () => navigation.navigate('Goals');
  const handleSettings = () => navigation.navigate('Settings');
  const handleDeviceManager = () => Alert.alert("Device Manager", "Device Manager not implemented yet.");
  const handleHelp = () => Alert.alert("Help & Support", "Help & Support not implemented yet.");

  // Show loading indicator while theme OR profile is loading
  if (isThemeLoading || loadingProfile) {
    return (
        <View style={[styles.loadingContainer, {backgroundColor: colors.background}]}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
  }

  if (!currentUser) {
    // This case might not be reached if RootNavigator handles auth correctly,
    // but good for robustness
     return (
         <View style={styles.loadingContainer}>
            <Text style={styles.errorText}>Please log in to view your profile.</Text>
         </View>
     );
  }

  return (
    <View style={styles.screenContainer}>
      {/* <ProfileHeader navigation={navigation} colors={colors} /> */}
      <ScrollView 
        contentContainerStyle={styles.scrollContentContainer}
      >
        <ProfileCard userProfile={userProfile} colors={colors} />

        {/* New Menu Section */}
        <View style={styles.menuContainer}>
            {/* Grouping items visually - can enhance later */}
            <MenuItemRow
                iconName="settings-outline"
                iconColor={colors.primary} // Example themed color
                iconBackgroundColor={colors.iconBackgroundBlue}
                text="Settings"
                onPress={handleSettings}
                colors={colors}
            />
            <MenuItemRow
                iconName="hardware-chip-outline"
                iconColor={colors.iconDevices} // Use themed icon color
                iconBackgroundColor={colors.iconBackgroundBlue} // Can theme this separately if needed
                text="Device Manager"
                onPress={handleDeviceManager}
                colors={colors}
            />
            <MenuItemRow
                iconName="help-circle-outline"
                iconColor={colors.iconHelp} // Use themed icon color
                iconBackgroundColor={colors.iconBackgroundOrange}
                text="Help & Support"
                onPress={handleHelp}
                colors={colors}
            />
            <MenuItemRow
                iconName="log-out-outline"
                iconColor={colors.iconLogout} // Use themed icon color (often red)
                iconBackgroundColor={colors.iconBackgroundRed}
                text="Logout"
                onPress={handleLogout}
                colors={colors}
                isLogout={true} // Flag for red text
            />
        </View>
      </ScrollView>
    </View>
  );
};

// Function to get main screen styles based on theme
const getProfileScreenStyles = (colors: typeof Colors.light) => StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background, // Themed background
  },
  scrollContentContainer: {
      paddingBottom: 30,
      // No specific paddingTop, ProfileCard margin handles it
  },
  menuContainer: { // Container for the new menu items
    marginTop: 20, // Space above the menu
    marginHorizontal: 15,
    backgroundColor: colors.cardBackground, // Background for the group
    borderRadius: 10, // Rounded corners for the group
    overflow: 'hidden', // Ensures children conform to border radius
    // Add shadow/elevation if desired for the whole block
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background, // Themed background
  },
  errorText: {
      color: colors.textSecondary, // Themed secondary text
    fontSize: 16,
  },
});

export default ProfileScreen; 