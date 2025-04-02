import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { auth } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth';

const HomeScreen = () => {

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Navigation back to Login will be handled by the AuthNavigator
      console.log('User logged out');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to SurfTrackr!</Text>
      <Text>This is the main application screen.</Text>
      {/* Add surf tracking features here later */}
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
});

export default HomeScreen; 