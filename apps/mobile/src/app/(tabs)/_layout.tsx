import { Tabs } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0CA678',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="magnify" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Escanear',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="barcode-scan" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventario',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="pill" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cog" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
