import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
// TODO: Import Firebase functions later to persist preference

// Key for storing the theme in AsyncStorage
const THEME_STORAGE_KEY = '@SurfApp:theme';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isThemeLoading: boolean; // Add loading state
  // TODO: Add function later to set theme explicitly, e.g., setTheme(newTheme: Theme)
}

// Create the context with a default value
export const ThemeContext = createContext<ThemeContextType>({
    theme: 'light', // Default theme
    toggleTheme: () => { console.warn('ThemeProvider not used!'); },
    isThemeLoading: true, // Add loading state
    // TODO: Add function later to set theme explicitly, e.g., setTheme(newTheme: Theme)
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // State to hold the current theme. Default to system preference or light.
  // We'll connect this to Firebase/AsyncStorage later.
  const [theme, setTheme] = useState<Theme>('light');
  const [isThemeLoading, setIsThemeLoading] = useState(true); // State to track loading

  // Load theme from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme) {
          setTheme(savedTheme as Theme);
        } else {
          // If no saved theme, use system preference
          const systemTheme = Appearance.getColorScheme() ?? 'light';
          setTheme(systemTheme);
        }
      } catch (error) {
        console.error('Failed to load theme from storage:', error);
        // Fallback to default if error
        setTheme(Appearance.getColorScheme() ?? 'light');
      } finally {
        setIsThemeLoading(false); // Loading finished
      }
    };
    loadTheme();
  }, []);

  // Function to toggle the theme AND save to storage
  const toggleTheme = async () => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      console.log(`Toggling theme to: ${newTheme}`);
      // Save the new theme preference to AsyncStorage
      AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme)
        .catch(error => console.error('Failed to save theme:', error));
      return newTheme;
    });
  };
  
  // TODO: Add useEffect later to load initial theme preference from storage/Firebase

  const value = { theme, toggleTheme, isThemeLoading };

  // Optional: Render children only after theme is loaded to prevent flash
  // if (isThemeLoading) { 
  //   return null; // Or a loading indicator 
  // }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 