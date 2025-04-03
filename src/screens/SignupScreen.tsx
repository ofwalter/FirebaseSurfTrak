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
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AppNavigator';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { doc, setDoc } from "firebase/firestore";
import { db } from '../services/firebaseConfig';

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

const SignInDudeOverlay = () => (
    <Image
        source={require('../../assets/signindude-overlay.png')} 
        style={styles.topImage}
        resizeMode="contain"
    />
);

type SignupScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

interface Props {
  navigation: SignupScreenNavigationProp;
}

const SignupScreen = ({ navigation }: Props) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthDate, setBirthDate] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
     if (password.length < 6) {
         Alert.alert("Error", "Password must be at least 6 characters long.");
         return;
     }

    setLoading(true);
    const auth = getAuth(); 
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
         await updateProfile(user, { displayName: name });
         console.log("Auth profile updated with display name.");

         try {
             const userDocRef = doc(db, "users", user.uid);
             await setDoc(userDocRef, {
                 uid: user.uid,
                 name: name,
                 email: email,
                 birthday: birthday,
                 createdAt: new Date(),
             });
             console.log("Firestore user profile created successfully!");
         } catch (firestoreError) {
             console.error("Error creating Firestore user profile: ", firestoreError);
             Alert.alert("Signup Issue", "Account created, but profile could not be saved. Please contact support.");
         }

      } else {
          throw new Error("User object not found after creation.");
      }

      console.log("Signup successful for:", user.email);

    } catch (error: any) {
        let message = "An unknown error occurred.";
        if (error.code === 'auth/email-already-in-use') {
            message = "This email address is already in use.";
        } else if (error.code === 'auth/invalid-email') {
            message = "Please enter a valid email address.";
        } else if (error.code === 'auth/weak-password') {
            message = "Password is too weak. Please choose a stronger one.";
        }
        Alert.alert("Sign Up Failed", message);
        console.error("Signup Error:", error.code, error.message);
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      const currentDate = selectedDate;
      setBirthDate(currentDate);
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const day = currentDate.getDate().toString().padStart(2, '0');
      const year = currentDate.getFullYear();
      setBirthday(`${month}/${day}/${year}`);
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

            <View style={styles.cardContainer}>
                <Text style={styles.title}>Sign-up to SurfTrak</Text>

                <View style={styles.profilePicPlaceholderContainer}>
                     <TouchableOpacity style={styles.profilePicPlaceholder} onPress={() => Alert.alert("Future Feature", "Profile picture upload coming soon!")}>
                         <Ionicons name="camera-outline" size={30} color={colors.textSecondary} />
                     </TouchableOpacity>
                </View>

                <TextInput
                    style={styles.input}
                    placeholder="Name"
                    value={name}
                    onChangeText={setName}
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="words"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity 
                    style={styles.input} 
                    onPress={() => setShowDatePicker(true)}
                >
                    <Text style={[styles.inputText, !birthday && styles.placeholderText]}>
                        {birthday || "Birthday (MM/DD/YYYY)"}
                    </Text>
                </TouchableOpacity>
                {showDatePicker && (
                     <DateTimePicker
                         testID="dateTimePicker"
                         value={birthDate}
                         mode="date"
                         display={Platform.OS === 'ios' ? "spinner" : "default"}
                         onChange={onDateChange}
                         maximumDate={new Date()}
                     />
                 )}
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
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.inputPassword}
                        placeholder="Confirm Password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        placeholderTextColor={colors.textSecondary}
                    />
                     <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                         <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={24} color={colors.textSecondary} />
                     </TouchableOpacity>
                 </View>

                <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={styles.buttonText}>Sign Up</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.switchLinkContainer}>
                    <Text style={styles.switchLinkText}>Already have an account? <Text style={styles.switchLinkBold}>Log-in</Text></Text>
                </TouchableOpacity>

            </View>
         </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20, 
  },
  imageContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: -38.5,
      zIndex: 1,
  },
  topImage: {
      width: 180, 
      height: 180, 
  },
  cardContainer: {
      backgroundColor: colors.white,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      paddingHorizontal: 30,
      paddingTop: 50,
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
    marginBottom: 25,
  },
  profilePicPlaceholderContainer: {
      alignItems: 'center',
      marginBottom: 25,
  },
  profilePicPlaceholder: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: colors.inputBackground,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    minHeight: 48,
  },
  inputText: {
      fontSize: 15,
      color: colors.textPrimary,
  },
  placeholderText: {
       color: colors.textSecondary,
  },
  passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      marginBottom: 15,
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
  button: {
    backgroundColor: colors.primaryBlue,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
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
  },
  switchLinkText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  switchLinkBold: {
    fontWeight: 'bold',
    color: colors.primaryBlue,
  },
});

export default SignupScreen; 