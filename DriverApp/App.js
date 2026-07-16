// locationTask MUST be the first import so TaskManager.defineTask() runs
// before any component mounts. Wrapped so a native-module gap doesn't crash launch.
try {
  require('./src/tasks/locationTask');
} catch (e) {
  console.warn('[App] locationTask not loaded:', e.message);
}

import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { getSession } from './src/services/api';
import { registerForPush, listenForegroundMessages, listenTokenRefresh } from './src/services/fcm';
import { C } from './src/theme';
import AuthScreen    from './src/screens/AuthScreen';
import HomeScreen    from './src/screens/HomeScreen';
import OrderScreen   from './src/screens/OrderScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: C.bg, card: C.card, text: C.text, primary: C.brand },
};

export default function App() {
  const [session, setSession]   = useState(null);
  const [domiInfo, setDomiInfo] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { token, slug } = await getSession();
        setSession(token && slug ? { token, slug } : false);
        // Re-register push token on app launch when a session already exists
        if (token && slug) registerForPush(slug);
      } catch {
        setSession(false);
      }
    })();
  }, []);

  // FCM foreground messages + token rotation (active whenever there's a session)
  useEffect(() => {
    if (!session || !session.slug) return;
    const unsubMsg = listenForegroundMessages();
    const unsubRefresh = listenTokenRefresh(session.slug);
    return () => { unsubMsg(); unsubRefresh(); };
  }, [session]);

  const handleLogin = (data) => {
    setDomiInfo(data);
    setSession({ token: data.token, slug: data.slug });
    // Register for native push right after login (permission prompt + token)
    if (data?.slug) registerForPush(data.slug);
  };

  const handleLogout = () => {
    setDomiInfo(null);
    setSession(false);
  };

  if (session === null) {
    return (
      <View style={styles.splash}>
        <StatusBar style="dark" />
        <ActivityIndicator color={C.brand} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer theme={navTheme}>
        {!session ? (
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
            <Stack.Screen name="Auth">
              {props => <AuthScreen {...props} onLogin={handleLogin} />}
            </Stack.Screen>
          </Stack.Navigator>
        ) : (
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
            <Stack.Screen name="Home">
              {props => <HomeScreen {...props} domiInfo={domiInfo} onLogout={handleLogout} />}
            </Stack.Screen>
            <Stack.Screen name="Order" component={OrderScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Profile" options={{ animation: 'slide_from_right' }}>
              {props => <ProfileScreen {...props} onLogout={handleLogout} />}
            </Stack.Screen>
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
});
