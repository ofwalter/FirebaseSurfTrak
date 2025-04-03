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
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import Ionicons from 'react-native-vector-icons/Ionicons'; // Import icons
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AppNavigator';

// --- Define Colors Locally --- 
const colors = {
    primaryBlue: '#1A73E8',
    secondaryBlue: '#0056B3',
    white: '#ffffff',
    textPrimary: '#1f2937',
    textSecondary: '#6b7280',
    backgroundLight: '#f8f9fa',
    inputBackground: '#f1f3f5',
    borderLight: '#dee2e6',
    red: '#ef4444',
};

// Placeholder image component (reuse or import)
const SignInDudeOverlay = () => (
    <Image
        source={require('../../assets/signindude-overlay.png')} // Adjust path if needed
        style={styles.topImage}
        resizeMode="contain"
    />
);

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }
    setLoading(true);
    const auth = getAuth();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation is handled by the listener in AppNavigator
      console.log("Login successful");
    } catch (error: any) {
        let message = "An unknown error occurred.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = "Invalid email or password.";
        } else if (error.code === 'auth/invalid-email') {
            message = "Please enter a valid email address.";
        }
        Alert.alert("Login Failed", message);
        console.error("Login Error:", error.code, error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.screenContainer}
    >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.imageContainer}>
                <SignInDudeOverlay />
            </View>

            {/* Card Container for Form */}
            <View style={styles.cardContainer}>
                <Text style={styles.title}>Log-in to SurfTrak</Text>

                {/* Input Fields */} 
                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={colors.textSecondary}
                />
                {/* Password Input */} 
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.inputPassword}
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        placeholderTextColor={colors.textSecondary}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
                
                {/* Forgot Password Link (optional) */}
                 <TouchableOpacity onPress={() => Alert.alert("Forgot Password?", "Functionality not implemented yet.")} style={styles.forgotPasswordContainer}>
                    <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                 </TouchableOpacity>

                {/* Login Button */} 
                <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={styles.buttonText}>Login</Text>
                    )}
                </TouchableOpacity>

                {/* Sign Up Link */} 
                <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.switchLinkContainer}>
                    <Text style={styles.switchLinkText}>Don't have an account? <Text style={styles.switchLinkBold}>Sign-up</Text></Text>
                </TouchableOpacity>
                
                 {/* Optional: Social Login Buttons Placeholder */}
                 {/* 
                 <View style={styles.socialLoginContainer}>
                     <Text style={styles.socialLoginText}>Or login with</Text>
                     <View style={styles.socialIconsRow}>
                         <TouchableOpacity style={styles.socialIcon}><Ionicons name="logo-google" size={24} color="#DB4437" /></TouchableOpacity>
                         <TouchableOpacity style={styles.socialIcon}><Ionicons name="logo-facebook" size={24} color="#4267B2" /></TouchableOpacity>
                     </View>
                 </View>
                 */} 

            </View>{/* End cardContainer */}
         </ScrollView>
    </KeyboardAvoidingView>
  );
};

// --- Styles (Mostly reused from SignupScreen, adjust as needed) ---
const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    paddingTop: Platform.OS === 'ios' ? 50 : 20, // Add padding at the top
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20, // Ensure space at the bottom if scrolling
  },
  imageContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: -38.5, // Increased negative margin
      zIndex: 1, // Ensure image potentially sits above card edge visually
  },
  topImage: {
      width: 180, // Fixed width for image
      height: 180, // Fixed height for image
  },
  cardContainer: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 30,
      paddingTop: 50, // Increased top padding to account for potential image overlap
      paddingBottom: Platform.OS === 'ios' ? 40 : 30,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -5 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 30, // More space after login title
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 15,
    marginBottom: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      marginBottom: 10, // Less space before forgot password
      borderWidth: 1, 
      borderColor: colors.borderLight,
  },
  inputPassword: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 15,
      fontSize: 15,
      color: colors.textPrimary,
  },
  eyeIcon: {
      padding: 10,
  },
  forgotPasswordContainer: {
      alignSelf: 'flex-end',
      marginBottom: 20,
      paddingVertical: 5, // Tappable area
  },
  forgotPasswordText: {
      fontSize: 13,
      color: colors.textSecondary,
  },
  button: {
    backgroundColor: colors.primaryBlue,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchLinkContainer: {
      alignItems: 'center',
      paddingVertical: 10,
      marginBottom: 10, // Space before potential social logins
  },
  switchLinkText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  switchLinkBold: {
    fontWeight: 'bold',
    color: colors.primaryBlue,
  },
  // Optional Social Login Styles
  socialLoginContainer: {
    alignItems: 'center',
    marginTop: 15,
  },
  socialLoginText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 15,
  },
  socialIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialIcon: {
    marginHorizontal: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 25, 
  },
});

export default LoginScreen;
