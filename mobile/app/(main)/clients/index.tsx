import { useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Search, UsersRound } from 'lucide-react-native';
import { useClients } from '../../../lib/queries';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenHeader } from '../../../components/ScreenHeader';

export default function ClientsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data: clients, isLoading } = useClients(search || undefined);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <ScreenHeader
        title="Clients"
        subtitle="People and businesses you invoice"
        action={{ label: 'Add', icon: <Plus color="white" size={18} />, onPress: () => router.push('/(main)/clients/add'), accessibilityLabel: 'Add client' }}
      />

      <View className="px-6 mb-2">
        <View className="flex-row items-center bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-xl px-3 h-11">
          <Search color="#6B6B6B" size={18} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search clients"
            placeholderTextColor="#6B6B6B"
            className="flex-1 ml-2 text-neutral-900 dark:text-white"
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#FF7A00" /></View>
      ) : <FlatList
        data={clients ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-6 pb-8"
        ListEmptyComponent={
          !isLoading ? (
            <View className="mt-4"><EmptyState title={search ? 'No matching clients' : 'Add your first client'} description={search ? 'Try a different name or company.' : 'Save client details once, then create invoices in seconds.'} icon={<UsersRound color="#FF7A00" size={22} />} action={search ? undefined : { label: 'Add Client', onPress: () => router.push('/(main)/clients/add') }} /></View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(main)/clients/${item.id}`)}
            className="bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border rounded-2xl p-4 mb-3 active:bg-border"
          >
            <Text className="text-neutral-900 dark:text-white font-medium" numberOfLines={1}>{item.name}</Text>
            {item.company ? <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-0.5">{item.company}</Text> : null}
          </Pressable>
        )}
      />}
    </SafeAreaView>
  );
}
