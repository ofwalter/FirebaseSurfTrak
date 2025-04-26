import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SettingsScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
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
  placeholderText: {
    fontSize: 16,
    marginBottom: 15,
    color: '#6b7280',
  },
});

export default SettingsScreen; 