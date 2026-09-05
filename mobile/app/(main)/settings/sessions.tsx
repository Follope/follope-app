import { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { confirmAction } from '../../../lib/alert';

interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export default function SessionsScreen() {
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<SessionInfo[]>('/me/sessions'),
  });

  const onRevoke = (session: SessionInfo) => {
    confirmAction(
      'Log out this device?',
      'This will end that session immediately.',
      async () => {
        setRevokingId(session.id);
        try {
          await api.delete(`/me/sessions/${session.id}`);
          queryClient.invalidateQueries({ queryKey: ['sessions'] });
        } finally {
          setRevokingId(null);
        }
      },
      'Log out'
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-background items-center justify-center">
        <ActivityIndicator color="#FF7A00" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <FlatList
        data={sessions ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-6 pt-4 pb-8"
        renderItem={({ item }) => (
          <View className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-3 flex-row justify-between items-center">
            <View className="flex-1 pr-3">
              <Text className="text-neutral-900 dark:text-white font-medium" numberOfLines={1}>
                {item.userAgent ?? 'Unknown device'}
              </Text>
              <Text className="text-neutral-500 text-xs mt-1">
                Signed in {new Date(item.createdAt).toLocaleDateString('en-IN')}
              </Text>
            </View>
            <Pressable
              onPress={() => onRevoke(item)}
              disabled={revokingId === item.id}
              className="px-3 py-2 rounded-lg bg-white dark:bg-background border border-neutral-200 dark:border-border"
            >
              <Text className="text-red-500 text-sm">{revokingId === item.id ? '…' : 'Log out'}</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-neutral-600 dark:text-neutral-400 text-center mt-8">No other active sessions.</Text>
        }
      />
    </SafeAreaView>
  );
}
