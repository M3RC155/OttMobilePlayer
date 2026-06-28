import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import HomeScreen from './screens/HomeScreen';
import ChannelListScreen from './screens/ChannelListScreen';
import PlayerScreen from './screens/PlayerScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f0f13' } }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Channels" component={ChannelListScreen} />
            <Stack.Screen name="Player" component={PlayerScreen} />
        </Stack.Navigator>
        </NavigationContainer>
    </GestureHandlerRootView>
  );
}
