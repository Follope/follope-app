import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { BrandLogo } from './BrandLogo';

interface BrandHeroProps {
  compact?: boolean;
}

/** Lightweight native animation that adds personality without delaying use. */
export function BrandHero({ compact = false }: BrandHeroProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 48, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <View className={`overflow-hidden rounded-3xl bg-neutral-50 dark:bg-card border border-neutral-200 dark:border-border ${compact ? 'px-5 py-4' : 'px-6 py-7'}`}>
      <View className="absolute -right-12 -top-12 w-44 h-44 rounded-full border border-primary/30" />
      <View className="absolute -right-3 -top-3 w-24 h-24 rounded-full bg-primary/10" />
      <View className="absolute -left-8 -bottom-12 w-28 h-28 rounded-full border border-primary/20" />
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <BrandLogo width={compact ? 132 : 190} height={compact ? 44 : 64} />
        {!compact ? (
          <>
            <Text className="text-neutral-900 dark:text-white text-2xl font-bold tracking-tight mt-5">Invoices that feel effortless.</Text>
            <Text className="text-neutral-600 dark:text-neutral-400 text-base leading-6 mt-2 max-w-72">
              Create, share, and track every payment from one calm workspace.
            </Text>
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}
