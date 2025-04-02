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
} from 'react-native';
import { auth } from '../services/firebaseConfig';
import { signOut, User } from 'firebase/auth'; // Import User
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

interface ProfileCardProps {
    user: User | null;
    sessionsCount: number;
    totalWavesCount: number;
}

const ProfileCard = ({ user, sessionsCount, totalWavesCount }: ProfileCardProps) => {
    // Get today's date
    const today = new Date();
    const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const todaysDateFormatted = today.toLocaleDateString('en-US', dateOptions);

    return (
        <View style={styles.profileCardContainer}>
            <Image
                source={require('../../assets/placeholder-profilephoto.png')}
                style={styles.profilePicture}
            />
            <Text style={styles.profileName}>{user?.displayName || user?.email || 'SurfTrak User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'No email provided'}</Text>

            {/* Stats Summary - Updated */}
            <View style={styles.statsSummaryRow}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{sessionsCount}</Text>
                    <Text style={styles.statLabel}>Sessions</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{todaysDateFormatted}</Text>
                    <Text style={styles.statLabel}>Today</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{totalWavesCount}</Text>
                    <Text style={styles.statLabel}>Total Waves</Text>
                </View>
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

   // Update user info if auth state changes (optional but good practice)
   useEffect(() => {
     const unsubscribe = auth.onAuthStateChanged(user => {
       setCurrentUser(user);
     });
     return unsubscribe; // Unsubscribe on unmount
   }, []);

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

  // Placeholder data for stats - Updated
  const placeholderStats = {
      sessionsCount: 36,
      totalWavesCount: 245,
  };

  return (
    <View style={styles.screenContainer}>
      <ProfileHeader />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContentContainer}>
        <ProfileCard user={currentUser} {...placeholderStats} />

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
  profileEmail: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb', // Light separator line
    paddingTop: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
   statUnit: {
       fontSize: 14,
       fontWeight: 'normal',
       color: colors.textSecondary,
       marginLeft: 2,
   },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
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
});

export default ProfileScreen; 