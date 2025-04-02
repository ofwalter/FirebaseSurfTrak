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
  Image,
} from 'react-native';
import { auth } from '../services/firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';

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

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
        setError("Please enter both email and password.");
        return;
    }
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation handled by AuthNavigator listener
      console.log('User logged in');
    } catch (err: any) {
      // Provide more user-friendly error messages
      let message = "An unknown error occurred.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          message = "Invalid email or password.";
      } else if (err.code === 'auth/invalid-email') {
          message = "Please enter a valid email address.";
      }
      setError(message);
      console.error("Login Error:", err.code, err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.screenContainer}
    >
      <View style={styles.container}>
        <Image
            source={require('../../assets/SurfTrak-FullLogo.png')}
            style={styles.logoImage}
        />

        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>Log in to your SurfTrak account</Text>

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
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Signup')}
            disabled={loading}
        >
            <Text style={styles.linkButtonText}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>

         {/* Optional: Add Forgot Password link later */}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
      flex: 1,
      backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  logoImage: {
    width: 200,
    height: 50,
    resizeMode: 'contain',
    marginBottom: 40,
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

export default LoginScreen; 