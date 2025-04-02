import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { auth } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth';

const ProfileScreen = () => {

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Navigation handled by AuthNavigator
      console.log('User logged out from Profile');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Profile</Text>
      <Text>User settings and information will go here.</Text>
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

export default ProfileScreen; 