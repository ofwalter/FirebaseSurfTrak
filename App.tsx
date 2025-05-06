import 'react-native-gesture-handler';
import React from 'react';
import RootNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/context/ThemeContext';
import { UnitProvider } from './src/context/UnitContext';

export default function App() {
  return (
    <ThemeProvider>
      <UnitProvider>
    <RootNavigator />
      </UnitProvider>
    </ThemeProvider>
  );
}
