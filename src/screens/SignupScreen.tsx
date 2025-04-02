import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { auth } from '../services/firebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';

// Define colors (reuse or centralize later)
const colors = {
  primaryBlue: '#1A73E8',
  secondaryBlue: '#0056B3',
  background: '#f0f4f8',
  cardBackground: '#ffffff',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  white: '#ffffff',
  red: '#DC2626',
  inputBorder: '#d1d5db',
  inputBackground: '#f9fafb',
};

const SignupScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError(null);
    if (!email || !password || !confirmPassword) {
        setError("Please fill in all fields.");
        return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Navigation handled by AuthNavigator listener
      console.log('User signed up');
    } catch (err: any) {
        let message = "An unknown error occurred.";
        if (err.code === 'auth/email-already-in-use') {
            message = "This email address is already in use.";
        } else if (err.code === 'auth/invalid-email') {
            message = "Please enter a valid email address.";
        } else if (err.code === 'auth/weak-password') {
            message = "Password is too weak. Please choose a stronger one.";
        }
        setError(message);
        console.error("Signup Error:", err.code, err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.screenContainer}
    >
       {/* Use ScrollView to prevent content being cut off on smaller screens */}
       <ScrollView contentContainerStyle={styles.scrollContainer}>
            {/* Add Logo */}
            <Image
                source={require('../../assets/SurfTrak-FullLogo.png')}
                style={styles.logoImage}
            />

            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join SurfTrak today!</Text>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            />
            <TextInput
            style={styles.input}
            placeholder="Password (min. 6 characters)"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password" // Hint for password managers
            />
            <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            />

            <TouchableOpacity
            style={styles.button}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.7}
            >
            {loading ? (
                <ActivityIndicator size="small" color={colors.white} />
            ) : (
                <Text style={styles.buttonText}>Sign Up</Text>
            )}
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.linkButton}
                onPress={() => navigation.navigate('Login')}
                disabled={loading}
            >
                <Text style={styles.linkButtonText}>Already have an account? Login</Text>
            </TouchableOpacity>
        </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Use similar styles to LoginScreen, adjusting where needed
const styles = StyleSheet.create({
  screenContainer: {
      flex: 1,
      backgroundColor: colors.background,
  },
   scrollContainer: {
    flexGrow: 1, // Ensures content can scroll if needed
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 20, // Add vertical padding for scroll view
  },
  logoImage: { // Style for Logo
    width: 200,
    height: 50,
    resizeMode: 'contain',
    marginBottom: 40, // Add space below logo
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 30,
      textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: colors.inputBackground,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    color: colors.textPrimary,
  },
  button: {
    width: '100%',
    backgroundColor: colors.primaryBlue,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
      marginTop: 20,
      padding: 10,
  },
  linkButtonText: {
      color: colors.primaryBlue,
      fontSize: 14,
      fontWeight: '500',
  },
  errorText: {
    color: colors.red,
    marginBottom: 15,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default SignupScreen; 