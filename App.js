/**
 * App.js — Anonymous Chat App Entry Point
 *
 * ANONYMITY GUARANTEE:
 * - No user accounts, no persistent storage, no analytics.
 * - Navigation state is in-memory only.
 * - The entire app is stateless across launches.
 */

import React, { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from './src/screens/SplashScreen';
import HomeScreen from './src/screens/HomeScreen';
import WaitingScreen from './src/screens/WaitingScreen';
import ChatScreen from './src/screens/ChatScreen';
import ChatEndedScreen from './src/screens/ChatEndedScreen';
import { light, dark, brand } from './src/theme';

const Stack = createNativeStackNavigator();

function buildNavTheme(isDark) {
  const palette = isDark ? dark : light;
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: brand.accent,
      background: palette.surface,
      card: palette.surface1,
      text: palette.text,
      border: palette.border,
      notification: brand.accent,
    },
  };
}

export default function App() {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  const theme = useMemo(() => buildNavTheme(isDark), [isDark]);
  const contentBg = isDark ? dark.surface : light.surface;

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={theme}>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            gestureEnabled: false,
            contentStyle: { backgroundColor: contentBg },
          }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Waiting" component={WaitingScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="ChatEnded" component={ChatEndedScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
