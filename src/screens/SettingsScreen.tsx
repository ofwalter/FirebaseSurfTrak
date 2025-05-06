import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const SettingsScreen = () => {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {/* Dark Mode Row */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Dark Mode</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={isDarkMode ? "#f5dd4b" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={toggleTheme}
          value={isDarkMode}
        />
      </View>
      {/* Placeholder for settings options */}
      <Text style={styles.placeholderText}>Account Settings</Text>
      <Text style={styles.placeholderText}>Notification Settings</Text>
      <Text style={styles.placeholderText}>Display Preferences</Text>
      <Text style={styles.placeholderText}>Privacy Policy</Text>
      <Text style={styles.placeholderText}>Terms of Service</Text>
      <Text style={styles.placeholderText}>Log Out (already on Profile)</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f0f4f8', // Use consistent background
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1f2937', // Use consistent text color
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb', // Placeholder light border
    marginBottom: 10,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1f2937', // Placeholder light text
  },
  placeholderText: {
    fontSize: 16,
    marginBottom: 15,
    color: '#6b7280',
  },
});

export default SettingsScreen; 