import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useUnits } from '../context/UnitContext';
import { Colors } from '../constants/Colors';

const getSettingsScreenStyles = (colors: typeof Colors.light) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: colors.text,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 10,
  },
  settingLabel: {
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    fontSize: 16,
    marginTop: 20,
    color: colors.textSecondary,
  },
});

const SettingsScreen = () => {
  const { theme, toggleTheme } = useTheme();
  const { units, toggleUnits, isUnitLoading } = useUnits();
  const colors = Colors[theme];
  const styles = getSettingsScreenStyles(colors);

  const isDarkMode = theme === 'dark';
  const isImperial = units === 'imperial';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {/* Dark Mode Row */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Dark Mode</Text>
        <Switch
          trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
          thumbColor={isDarkMode ? colors.primary : colors.switchThumb}
          ios_backgroundColor={colors.border}
          onValueChange={toggleTheme}
          value={isDarkMode}
        />
      </View>
      {/* Unit System Row */}
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Use Imperial Units (mph, ft)</Text>
        <Switch
          trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
          thumbColor={isImperial ? colors.primary : colors.switchThumb}
          ios_backgroundColor={colors.border}
          onValueChange={toggleUnits}
          value={isImperial}
          disabled={isUnitLoading}
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

export default SettingsScreen; 