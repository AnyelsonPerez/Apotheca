import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import type { AlertsResponse } from '@/api/types';
import { BrandColors } from '@/constants/theme';

function AlertBadge() {
  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => apiFetch<AlertsResponse>('/alerts'),
    refetchInterval: 60_000,
  });
  const count = (alerts?.expiry?.length ?? 0) + (alerts?.depletion?.length ?? 0);
  if (count === 0) return null;
  return (
    <View style={badgeStyles.container}>
      <Text style={badgeStyles.text}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

const badgeStyles = {
  container: {
    position: 'absolute',
    top: -2,
    right: -6,
    backgroundColor: BrandColors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  } as const,
  text: { color: '#fff', fontSize: 10, fontWeight: 'bold' as const },
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BrandColors.primary,
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => (
            <View>
              <AlertBadge />
              <MaterialCommunityIcons name="home" size={24} color={color} />
            </View>
          ),
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
