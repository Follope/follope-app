import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '../../components/Button';

const ROLES = [
  { value: 'developer', label: 'Developer' },
  { value: 'designer', label: 'Designer' },
  { value: 'video_editor', label: 'Video Editor' },
  { value: 'writer', label: 'Writer' },
  { value: 'marketer', label: 'Marketer' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'student_freelancer', label: 'Student Freelancer' },
  { value: 'other', label: 'Other' },
] as const;

export default function RoleScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background px-6">
      <View className="mt-6 mb-8">
        <Text className="text-sm text-primary mb-2">Step 1 of 3</Text>
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">What do you do?</Text>
      </View>

      <View className="flex-row flex-wrap gap-3">
        {ROLES.map((role) => {
          const isSelected = selected === role.value;
          return (
            <Pressable
              key={role.value}
              onPress={() => setSelected(role.value)}
              className={`px-4 py-3 rounded-xl border ${
                isSelected ? 'bg-primary border-primary' : 'bg-neutral-50 dark:bg-card border-neutral-200 dark:border-border'
              }`}
            >
              <Text className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}`}>
                {role.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-1" />

      <View className="mb-8">
        <Button
          label="Continue"
          disabled={!selected}
          onPress={() =>
            router.push({ pathname: '/(onboarding)/business-info', params: { role: selected ?? '' } })
          }
        />
      </View>
    </SafeAreaView>
  );
}
