import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Key for storing the unit system preference
const UNIT_SYSTEM_STORAGE_KEY = '@SurfApp:unitSystem';

// Define the shape of the context data
type UnitSystem = 'metric' | 'imperial';

interface UnitContextType {
  units: UnitSystem;
  toggleUnits: () => void;
  isUnitLoading: boolean; // Added loading state
}

// Create the context
export const UnitContext = createContext<UnitContextType>({
    units: 'metric', // Default value
    toggleUnits: () => { console.warn('UnitProvider not used!'); },
    isUnitLoading: true,
});

interface UnitProviderProps {
  children: ReactNode;
}

export const UnitProvider: React.FC<UnitProviderProps> = ({ children }) => {
  // Default to metric, load from storage
  const [unitSystem, _setUnitSystem] = useState<UnitSystem>('metric'); 
  const [isUnitLoading, setIsUnitLoading] = useState(true);

  // Load unit system preference on mount
  useEffect(() => {
    const loadUnitSystem = async () => {
      setIsUnitLoading(true);
      try {
        const savedUnitSystem = await AsyncStorage.getItem(UNIT_SYSTEM_STORAGE_KEY);
        if (savedUnitSystem) {
          _setUnitSystem(savedUnitSystem as UnitSystem);
        } else {
          _setUnitSystem('metric'); // Default if nothing saved
        }
      } catch (error) {
        console.error('Failed to load unit system from storage:', error);
        _setUnitSystem('metric'); // Fallback to default
      } finally {
        setIsUnitLoading(false);
      }
    };
    loadUnitSystem();
  }, []);

  // Function to set the unit system AND save to storage
  const setUnitSystem = async (system: UnitSystem) => {
    try {
        await AsyncStorage.setItem(UNIT_SYSTEM_STORAGE_KEY, system);
        _setUnitSystem(system);
        console.log(`Unit system set to: ${system}`);
    } catch (error) {
        console.error('Failed to save unit system:', error);
        // Optionally alert the user or handle the error
    }
  };

  const toggleUnitSystem = () => {
    const newSystem = unitSystem === 'metric' ? 'imperial' : 'metric';
    setUnitSystem(newSystem);
  };

  // The value that will be provided to consuming components
  const value = useMemo(() => ({
    units: unitSystem, // Match the interface name
    toggleUnits: toggleUnitSystem, // Match the interface name
    isUnitLoading,
  }), [unitSystem, isUnitLoading, toggleUnitSystem]);

  return (
    <UnitContext.Provider value={value}>
      {children}
    </UnitContext.Provider>
  );
};

// Custom hook to use the unit context
export const useUnits = () => {
  const context = useContext(UnitContext);
  if (context === undefined) {
    throw new Error('useUnits must be used within a UnitProvider');
  }
  // If loading, maybe return loading state or default values?
  // For now, let components handle the loading state if needed.
  return context;
}; 