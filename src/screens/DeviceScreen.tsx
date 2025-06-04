import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { Colors } from '../constants/Colors'; // Your Colors file
import { useAuth } from '../navigation/AppNavigator'; // Import useAuth

// Placeholder for device image - replace with actual image from assets
// For now, using one of the mockups as a placeholder path
const DEVICE_IMAGE_PLACEHOLDER = require('../../assets/surftrakdeviceMOCKUP.png');

const DeviceScreen = () => {
  const { theme } = useTheme();
  const currentColors = Colors[theme];
  const { user } = useAuth(); // Get user from AuthContext

  const [isConnected, setIsConnected] = useState(false);
  const [isCollectingData, setIsCollectingData] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(85); // Mock battery level
  const [deviceName, setDeviceName] = useState("Your Device"); // Default device name
  const [firmwareVersion, setFirmwareVersion] = useState("1.0.3"); // Mock firmware
  const [showFaqModal, setShowFaqModal] = useState(false);

  useEffect(() => {
    if (user && user.displayName) {
      setDeviceName(`${user.displayName}'s Device`);
    } else if (user) {
      setDeviceName("Your Device"); // Fallback if displayName is not set
    }
  }, [user]);

  const toggleConnection = () => setIsConnected(prev => !prev);
  const toggleDataCollection = () => {
    if (isConnected) {
      setIsCollectingData(prev => !prev);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: currentColors.background,
      paddingTop: Platform.OS === 'ios' ? 50 : 20, // Platform is now defined
    },
    scrollViewContent: {
      paddingBottom: 30, // Space at the bottom
    },
    connectionToggleButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 55 : 25, // Platform is now defined
      left: 15,
      zIndex: 10,
      padding: 8,
      backgroundColor: currentColors.cardBackground,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 3,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: currentColors.text,
      textAlign: 'center',
      marginBottom: 20,
      marginTop: 10, // Space below toggle button if it's very high
    },
    // --- Device Status Area ---
    deviceStatusContainer: {
      alignItems: 'center',
      marginBottom: 30,
      paddingHorizontal: 20,
    },
    deviceImage: {
      width: 280, // Increased width
      height: 210, // Increased height
      resizeMode: 'contain',
      marginBottom: 15,
    },
    deviceNameText: {
      fontSize: 22, // Slightly larger font for the new name format
      fontWeight: '600',
      color: currentColors.text,
      marginTop: 10, // Add some margin above the device name
    },
    deviceInfoText: {
      fontSize: 14,
      color: currentColors.textSecondary,
      marginTop: 4,
    },
    batteryContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      padding: 8,
      backgroundColor: currentColors.cardBackground,
      borderRadius: 10,
    },
    batteryText: {
      fontSize: 16,
      color: currentColors.text,
      marginLeft: 8,
    },
    statusIndicator: {
      marginTop: 10,
      fontSize: 16,
      fontWeight: '500',
    },
    collectingPulse: { // Simple pulsing effect
      // For a real pulse, you'd use Animated API
      color: currentColors.primary,
      fontWeight: 'bold',
    },
    notConnectedText: {
      fontSize: 18,
      color: currentColors.textSecondary,
      textAlign: 'center',
      marginTop: 50,
      marginBottom: 20,
    },
    // --- Button Area ---
    buttonContainer: {
      paddingHorizontal: 20,
      marginTop: 20,
    },
    button: {
      backgroundColor: currentColors.primary,
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 4,
    },
    buttonText: {
      color: currentColors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: currentColors.cardBackground,
      borderColor: currentColors.primary,
      borderWidth: 1,
    },
    secondaryButtonText: {
      color: currentColors.primary,
    },
    disabledButton: {
      backgroundColor: currentColors.border, // A more muted color
    },
    // --- FAQ Modal ---
    modalOverlay: {
      flex: 1,
      backgroundColor: currentColors.modalOverlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: currentColors.cardBackground,
      padding: 25,
      borderRadius: 15,
      width: '90%',
      maxHeight: '80%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: currentColors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    faqItem: {
      marginBottom: 15,
    },
    faqQuestion: {
      fontSize: 16,
      fontWeight: '600',
      color: currentColors.text,
      marginBottom: 5,
    },
    faqAnswer: {
      fontSize: 14,
      color: currentColors.textSecondary,
      lineHeight: 20,
    },
    closeButton: {
      marginTop: 20,
      backgroundColor: currentColors.primary,
    },
    closeButtonText: {
      color: currentColors.white,
    },
  });

  // Placeholder FAQ Content
  const faqData = [
    { q: "How do I pair my SurfTrak device?", a: "Ensure your device is in pairing mode (usually by holding the power button). Then, use the 'Connect to Device' option in this app to scan and connect via Wi-Fi Direct or Bluetooth (final method TBD)." },
    { q: "How often should I sync data?", a: "It's recommended to sync data after each session to ensure your stats are up-to-date and to free up memory on the device." },
    { q: "What do the different LED colors mean on the device?", a: "Blue blinking: Ready to pair. Solid Blue: Connected. Green blinking: Recording data. Red blinking: Low battery." },
    { q: "My device won't connect, what should I do?", a: "Try restarting both your phone and the SurfTrak device. Ensure your phone's Bluetooth/Wi-Fi is enabled and that the device is within range. Check the device's battery level." }
  ];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.connectionToggleButton} onPress={toggleConnection}>
        <Ionicons name={isConnected ? "link" : "link-outline"} size={24} color={currentColors.primary} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <Text style={styles.headerTitle}>Device Manager</Text>

        {/* Device Status Area */}
        <View style={styles.deviceStatusContainer}>
          {isConnected ? (
            <>
              <Image source={DEVICE_IMAGE_PLACEHOLDER} style={styles.deviceImage} />
              <Text style={styles.deviceNameText}>{deviceName}</Text>
              <View style={styles.batteryContainer}>
                <Ionicons 
                  name={batteryLevel > 75 ? "battery-full" : batteryLevel > 25 ? "battery-half" : "battery-low"} 
                  size={24} 
                  color={batteryLevel > 25 ? currentColors.iconGoals : currentColors.red} // Green for good, Red for low
                />
                <Text style={styles.batteryText}>{batteryLevel}%</Text>
              </View>
              <Text style={styles.deviceInfoText}>Firmware: {firmwareVersion}</Text>
              {isCollectingData ? (
                <Text style={[styles.statusIndicator, styles.collectingPulse]}>Status: Recording Data...</Text>
              ) : (
                <Text style={[styles.statusIndicator, {color: currentColors.textSecondary}]}>Status: Idle</Text>
              )}
            </>
          ) : (
            <>
              <Image source={DEVICE_IMAGE_PLACEHOLDER} style={[styles.deviceImage, { opacity: 0.5 }]} />
              <Text style={styles.notConnectedText}>No device connected.</Text>
              <Text style={styles.deviceInfoText}>Press the link icon to simulate connection.</Text>
            </>
          )}
        </View>

        {/* Button Area */}
        <View style={styles.buttonContainer}>
          {isConnected ? (
            <>
              <TouchableOpacity 
                style={[styles.button, isCollectingData && {backgroundColor: currentColors.red} ]} // Changed to currentColors.red
                onPress={toggleDataCollection}
              >
                <Text style={styles.buttonText}>
                  {isCollectingData ? "Stop Collection" : "Start Collection"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]} 
                onPress={() => console.log("Sync Data Pressed (Not Implemented)")}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Sync Data</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => console.log("Connect to Device Pressed (Not Implemented)")}
            >
              <Text style={styles.buttonText}>Connect to Device</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton, { marginTop: isConnected ? 0 : 15 }]}
            onPress={() => setShowFaqModal(true)}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>FAQ & Support</Text>
          </TouchableOpacity>
        </View>
        
        {/* Device Information Section (Placeholder) */}
        {isConnected && (
            <View style={{paddingHorizontal: 20, marginTop: 30, opacity: 0.6}}>
                <Text style={{fontSize: 18, fontWeight: '600', color: currentColors.text, marginBottom: 10}}>Device Details</Text>
                <Text style={{fontSize: 14, color: currentColors.textSecondary, marginBottom: 5}}>Serial Number: STV1-XXXXXXXX</Text>
                <Text style={{fontSize: 14, color: currentColors.textSecondary, marginBottom: 5}}>Storage: 64MB (XX% used)</Text>
                <Text style={{fontSize: 14, color: currentColors.textSecondary, marginBottom: 5}}>Last Synced: Never</Text>
            </View>
        )}

      </ScrollView>

      {/* FAQ Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showFaqModal}
        onRequestClose={() => setShowFaqModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>FAQ & Support</Text>
            <ScrollView>
              {faqData.map((item, index) => (
                <View key={index} style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  <Text style={styles.faqAnswer}>{item.a}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.button, styles.closeButton]} 
              onPress={() => setShowFaqModal(false)}
            >
              <Text style={[styles.buttonText, styles.closeButtonText]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default DeviceScreen; 