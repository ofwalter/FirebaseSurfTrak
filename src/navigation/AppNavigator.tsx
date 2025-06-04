import React, { useState, useEffect, useContext, createContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons'; // Import icon library
import { useTheme } from '../context/ThemeContext'; // Import useTheme
import { Colors, AppNavigationThemeLight, AppNavigationThemeDark } from '../constants/Colors'; // Import themes
import { ActivityIndicator, View } from 'react-native';
import { Appearance } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import HomeScreen from '../screens/HomeScreen';

// Import new screens
import SessionsScreen from '../screens/SessionsScreen';
import ForecastScreen from '../screens/ForecastScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SessionDetailScreen from '../screens/SessionDetailScreen'; // Import the new detail screen
import GoalsScreen from '../screens/GoalsScreen'; // Import Goals Screen
import SettingsScreen from '../screens/SettingsScreen'; // Import Settings Screen
import DeviceScreen from '../screens/DeviceScreen'; // Import Device Screen

// Define Stack types
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

// Define Tab types (used within the App Stack)
type AppTabParamList = {
  Home: undefined;
  Sessions: undefined; // This now refers to the initial Sessions screen in the tab
  Device: undefined; // Added Device Tab
  Forecast: undefined;
  Profile: undefined;
};

// Define the main App Stack, including Tabs and Detail screens
export type AppStackParamList = {
  AppTabs: undefined; // Represents the entire Bottom Tab Navigator
  SessionDetail: { sessionId: string; sessionLocation: string }; // Screen for session details
  Goals: undefined; // Add Goals screen to the stack parameters
  Settings: undefined; // Add Settings screen
  // Add other non-tab screens here (e.g., Edit Profile)
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTabs = createBottomTabNavigator<AppTabParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>(); // The main stack for the authenticated app

// Create an Auth Context
interface AuthContextType {
  user: User | null;
}

const AuthContext = createContext<AuthContextType>({ user: null });

export const useAuth = () => {
  return useContext(AuthContext);
};

// Auth Provider Component
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (loading) {
    // Show a loading indicator while checking auth state
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
};

// Tab Navigator Component - Apply Theming
const AppTabNavigator = () => {
  const { theme } = useTheme(); // Get theme
  const currentColors = Colors[theme]; // Get specific color palette

  return (
    <AppTabs.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = '';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Sessions') iconName = focused ? 'water' : 'water-outline';
          else if (route.name === 'Device') iconName = focused ? 'hardware-chip' : 'hardware-chip-outline'; // Added Device Icon
          else if (route.name === 'Forecast') iconName = focused ? 'sunny' : 'sunny-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person-circle' : 'person-circle-outline';
          // Use themed color for icon? React Navigation theme might handle this via tabBarActive/InactiveTintColor
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        // Apply themed colors to tab bar
        tabBarActiveTintColor: currentColors.tint, // Use themed tint color
        tabBarInactiveTintColor: currentColors.tabIconDefault, // Use themed inactive color
        tabBarStyle: {
          backgroundColor: currentColors.cardBackground, // Use themed background for tab bar
          borderTopColor: currentColors.border, // Use themed border color
        },
        headerShown: false, 
      })}
    >
      {/* Tab Screens */}
      <AppTabs.Screen name="Home" component={HomeScreen} />
      <AppTabs.Screen name="Sessions" component={SessionsScreen} />
      <AppTabs.Screen name="Device" component={DeviceScreen} />{/* Added Device Screen */}
      <AppTabs.Screen name="Forecast" component={ForecastScreen} />
      <AppTabs.Screen name="Profile" component={ProfileScreen} />
    </AppTabs.Navigator>
  );
};

// New: Main App Stack Navigator Component (can use theme for header styling)
const AppStackNavigator = () => {
  const { theme } = useTheme();
  const currentColors = Colors[theme];
  return (
    <AppStack.Navigator
        screenOptions={{
            // Apply theme to Stack Navigator headers
            headerStyle: {
                backgroundColor: currentColors.cardBackground,
            },
            headerTintColor: currentColors.text, // Color for title and back button
            headerTitleStyle: {
                // fontWeight: 'bold', // Optional: customize font weight
            },
        }}
    >
      <AppStack.Screen
        name="AppTabs"
        component={AppTabNavigator}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={({ route }) => ({
          headerShown: false,
        })}
      />
       <AppStack.Screen
         name="Goals"
         component={GoalsScreen}
         options={{ 
             title: "Your Goals",
             headerBackTitle: "Back",
             // Header styles inherited from screenOptions
          }}
       />
       <AppStack.Screen
         name="Settings"
         component={SettingsScreen}
         options={{ 
             title: "Settings", 
             headerBackTitle: "Back",
             // Header styles inherited from screenOptions
          }}
       />
    </AppStack.Navigator>
  );
};

// Main Navigator Logic - Apply theme to NavigationContainer
const AppNavigator = () => {
  const { user } = useAuth();
  const { theme, isThemeLoading } = useTheme(); // Get theme and loading state

  // Don't render container until theme is loaded to prevent flashing
  if (isThemeLoading) {
     // Optionally return a themed loading view
     const loadingThemeColors = Colors[Appearance.getColorScheme() ?? 'light'];
     return (
       <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: loadingThemeColors.background }}>
         <ActivityIndicator size="large" color={loadingThemeColors.primary} />
       </View>
     );
  }

  return (
    <NavigationContainer theme={theme === 'dark' ? AppNavigationThemeDark : AppNavigationThemeLight}>
      {user ? (
        <AppStackNavigator />
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Signup" component={SignupScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
};

// Wrap AppNavigator with AuthProvider
const RootNavigator = () => {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

export default RootNavigator; 