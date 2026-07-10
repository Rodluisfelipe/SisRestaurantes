/**
 * IMPORTANT: locationTask.js must be imported at the top level here so
 * TaskManager.defineTask() is called before any component mounts.
 */
import './src/tasks/locationTask';

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { getSession } from './src/services/api';
import AuthScreen  from './src/screens/AuthScreen';
import HomeScreen  from './src/screens/HomeScreen';
import OrderScreen from './src/screens/OrderScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession]   = useState(null);  // null = loading, false = not logged in, object = logged in
  const [domiInfo, setDomiInfo] = useState(null);

  /* ── Restore session on launch ── */
  useEffect(() => {
    (async () => {
      const { token, slug } = await getSession();
      if (token && slug) {
        setSession({ token, slug });
      } else {
        setSession(false);
      }
    })();
  }, []);

  const handleLogin = (data) => {
    setDomiInfo(data);
    setSession({ token: data.token, slug: data.slug });
  };

  const handleLogout = () => {
    setDomiInfo(null);
    setSession(false);
  };

  /* Loading splash */
  if (session === null) {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <ActivityIndicator color="#ef4444" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        {!session ? (
          /* Not authenticated */
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Auth">
              {props => <AuthScreen {...props} onLogin={handleLogin} />}
            </Stack.Screen>
          </Stack.Navigator>
        ) : (
          /* Authenticated */
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home">
              {props => (
                <HomeScreen
                  {...props}
                  domiInfo={domiInfo}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Order" component={OrderScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
