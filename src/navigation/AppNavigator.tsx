import React, { useState, useEffect, useContext, createContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons'; // Import icon library

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import HomeScreen from '../screens/HomeScreen';
import { ActivityIndicator, View } from 'react-native';

// Import new screens
import SessionsScreen from '../screens/SessionsScreen';
import ForecastScreen from '../screens/ForecastScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SessionDetailScreen from '../screens/SessionDetailScreen'; // Import the new detail screen

// Define Stack types
type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

// Define Tab types (used within the App Stack)
type AppTabParamList = {
  Home: undefined;
  Sessions: undefined; // This now refers to the initial Sessions screen in the tab
  Forecast: undefined;
  Profile: undefined;
};

// Define the main App Stack, including Tabs and Detail screens
export type AppStackParamList = {
  AppTabs: undefined; // Represents the entire Bottom Tab Navigator
  SessionDetail: { sessionId: string; sessionLocation: string }; // Screen for session details
  // Add other non-tab screens here (e.g., Settings, Edit Profile)
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

// Tab Navigator Component - Stays mostly the same
const AppTabNavigator = () => {
  return (
    <AppTabs.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = '';
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Sessions') iconName = focused ? 'water' : 'water-outline';
          else if (route.name === 'Forecast') iconName = focused ? 'sunny' : 'sunny-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person-circle' : 'person-circle-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: 'tomato',
        tabBarInactiveTintColor: 'gray',
        // Header should be shown by the parent Stack Navigator now
        headerShown: false, // <- Important: Hide headers within Tabs
      })}
    >
      {/* Tab Screens - Note: Titles set here might be overridden by Stack Navigator */}
      <AppTabs.Screen name="Home" component={HomeScreen} />
      <AppTabs.Screen name="Sessions" component={SessionsScreen} />
      <AppTabs.Screen name="Forecast" component={ForecastScreen} />
      <AppTabs.Screen name="Profile" component={ProfileScreen} />
    </AppTabs.Navigator>
  );
};

// New: Main App Stack Navigator Component
const AppStackNavigator = () => {
  return (
    <AppStack.Navigator>
      {/* The entire Tab navigator is nested as a single screen */}
      <AppStack.Screen
        name="AppTabs"
        component={AppTabNavigator} // Use the Tab navigator component
        options={{ headerShown: false }} // Hide the stack header for the tab screen itself
      />
      {/* The Session Detail screen is a separate screen in the stack */}
      <AppStack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        // Options can set the header title dynamically based on route params
        options={({ route }) => ({
          title: `${route.params.sessionLocation} Details`,
          headerBackTitle: "Back", // Set custom back button text
          // Or use headerBackTitleVisible: false to hide text completely
        })}
      />
      {/* Add other stack screens here if needed */}
    </AppStack.Navigator>
  );
};

// Main Navigator Logic - Update to use AppStackNavigator
const AppNavigator = () => {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      {user ? (
        // User is logged in - show the MAIN App Stack Navigator
        <AppStackNavigator />
      ) : (
        // User is not logged in
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