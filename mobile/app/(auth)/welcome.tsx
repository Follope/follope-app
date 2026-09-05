import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckCircle2, Zap } from 'lucide-react-native';
import { Button } from '../../components/Button';
import { BrandHero } from '../../components/BrandHero';
import { useReadableContentWidth } from '../../lib/layout';

const BENEFITS = ['Professional invoices in minutes', 'UPI-ready payment links', 'A clear view of every payment'];

export default function WelcomeScreen() {
  const router = useRouter();
  const contentStyle = useReadableContentWidth(560);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <View className="flex-1 px-6" style={contentStyle}>
        <View className="flex-1 justify-center py-8">
          <View className="flex-row self-start bg-primary/10 rounded-full px-3 py-1.5 mb-5 items-center">
            <Zap color="#FF9933" size={15} fill="#FF9933" />
            <Text className="text-primary text-xs font-semibold ml-1.5">MADE FOR INDEPENDENT WORK</Text>
          </View>
          <BrandHero />

          <View className="mt-7 gap-3">
            {BENEFITS.map((benefit) => (
              <View key={benefit} className="flex-row items-center">
                <CheckCircle2 color="#FF9933" size={18} />
                <Text className="text-neutral-700 dark:text-neutral-300 text-sm ml-3">{benefit}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="pb-6 gap-3">
          <Button label="Create your account" onPress={() => router.push('/(auth)/signup')} />
          <Button label="I already have an account" variant="secondary" onPress={() => router.push('/(auth)/login')} />
          <Text className="text-neutral-500 text-xs text-center mt-1">No accounting jargon. Just clear invoices and faster payments.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
