// src/constants/Colors.ts

// Define base colors for reuse and consistency
const primaryBlue = '#1A73E8';
const secondaryBlue = '#0056B3';
const lightBlue = '#4AB1FF';
const green = '#16A34A';
const orange = '#EA580C';
const orangeRGBA = 'rgba(234, 88, 12, 0.7)';
const red = '#DC2626';
const cancelRed = '#ef4444';

const white = '#ffffff';
const black = '#000000';

// Helper type for non-empty gradient arrays
type GradientColors = readonly [string, string, ...string[]];

// Light Theme Colors
const light = {
  // Core
  text: '#1f2937', // Dark text for light backgrounds
  textSecondary: '#6b7280',
  background: '#f8f9fa', // Slightly off-white background
  cardBackground: white,
  border: '#e5e7eb',
  inputBorder: '#d1d5db',
  modalHandle: '#d1d5db',
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
  // Specific Components
  primary: primaryBlue,
  secondary: secondaryBlue,
  accent: lightBlue,
  tint: primaryBlue, // Often used for active elements, icons
  tabIconDefault: '#ccc',
  tabIconSelected: primaryBlue,
  logoutButtonBackground: red,
  logoutButtonText: white,
  cancelButtonText: cancelRed,
  switchThumb: '#f4f3f4',
  switchTrackFalse: '#767577',
  switchTrackTrue: '#81b0ff',
  // Wave Polylines
  waveSelected: orange,
  waveUnselected: orangeRGBA,
  // Session Card Specific (uses dark text on light map)
  sessionCardBackground: 'rgba(255, 255, 255, 0.7)', // Keep light blur
  sessionCardText: white, // Text still needs to be visible on map
  sessionCardTextSecondary: '#cbd5e1', // Lighter grey for map text
  sessionCardSeparator: 'rgba(255, 255, 255, 0.2)',
  sessionCardPolyline: orangeRGBA,
  // Icon Backgrounds (Profile)
  iconBackgroundBlue: '#e0f2fe',
  iconBackgroundGreen: '#dcfce7',
  iconBackgroundOrange: '#fff7ed',
  iconBackgroundRed: '#fee2e2',
  // Icon Colors (Profile Menu)
  iconGoals: green,
  iconDevices: secondaryBlue,
  iconHelp: orange,
  iconLogout: red,
  // Gradients (Profile)
  gradientGoals: ['#6EE7B7', '#3B82F6'] as GradientColors, 
  gradientDevices: ['#FBCFE8', '#9333EA'] as GradientColors,
  gradientHelp: ['#FDE68A', '#F97316'] as GradientColors,
  gradientLogout: ['#FDA4AF', '#F43F5E'] as GradientColors,
  xpGradient: [secondaryBlue, primaryBlue, lightBlue] as GradientColors,
};

// Dark Theme Colors
const dark = {
  // Core
  text: '#e5e7eb', // Light text for dark backgrounds
  textSecondary: '#9ca3af',
  background: '#121212', // Use very dark grey instead of pure black
  cardBackground: '#1f2937', // Keep this dark grey for cards/modals
  border: '#374151',
  inputBorder: '#4b5563',
  modalHandle: '#4b5563',
  modalOverlay: 'rgba(0, 0, 0, 0.7)', // Slightly darker overlay
  // Specific Components
  primary: lightBlue, // Use lighter blue for primary actions
  secondary: primaryBlue, // Darker blue as secondary
  accent: secondaryBlue,
  tint: white, // Use white for active elements, icons
  tabIconDefault: '#ccc',
  tabIconSelected: white,
  logoutButtonBackground: cancelRed, // Keep red distinct
  logoutButtonText: white,
  cancelButtonText: cancelRed,
  switchThumb: white,
  switchTrackFalse: '#4b5563',
  switchTrackTrue: primaryBlue,
  // Wave Polylines (Keep bright for visibility on dark map)
  waveSelected: orange,
  waveUnselected: orangeRGBA,
  // Session Card Specific (uses light text on light map - no change needed?)
  sessionCardBackground: 'rgba(0, 0, 0, 0.6)', // Darker blur
  sessionCardText: white,
  sessionCardTextSecondary: '#cbd5e1',
  sessionCardSeparator: 'rgba(255, 255, 255, 0.2)',
  sessionCardPolyline: orangeRGBA,
  // Icon Backgrounds (Profile)
  iconBackgroundBlue: '#374151',
  iconBackgroundGreen: '#1f2937',
  iconBackgroundOrange: '#4b5563',
  iconBackgroundRed: '#374151',
  // Icon Colors (Profile Menu - Use lighter/brighter for dark mode)
  iconGoals: '#6EE7B7', // Lighter Green
  iconDevices: lightBlue,
  iconHelp: '#FDE68A', // Lighter Orange/Yellow
  iconLogout: cancelRed, // Use the lighter cancel red
  // Gradients (Profile) - Keep vibrant?
  gradientGoals: ['#6EE7B7', '#3B82F6'] as GradientColors, 
  gradientDevices: ['#FBCFE8', '#9333EA'] as GradientColors,
  gradientHelp: ['#FDE68A', '#F97316'] as GradientColors,
  gradientLogout: ['#FDA4AF', '#F43F5E'] as GradientColors,
  xpGradient: [secondaryBlue, primaryBlue, lightBlue] as GradientColors,
};

export const Colors = {
  light,
  dark,
};

// --- React Navigation Themes ---
import { Theme as NavigationTheme, DefaultTheme, DarkTheme } from '@react-navigation/native';

export const AppNavigationThemeLight: NavigationTheme = {
  ...DefaultTheme, // Start with React Navigation defaults
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.cardBackground,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.primary,
  },
};

export const AppNavigationThemeDark: NavigationTheme = {
  ...DarkTheme, // Start with React Navigation dark defaults
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background, // Use the new dark background
    card: Colors.dark.cardBackground, // Use the dark card background
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.primary,
  },
}; 