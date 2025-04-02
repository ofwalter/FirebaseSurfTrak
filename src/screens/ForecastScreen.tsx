import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ForecastScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Surf Forecast</Text>
      {/* Content for displaying surf forecast will go here */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
  },
});

export default ForecastScreen; 