import { View, Image, type ImageStyle, type StyleProp } from 'react-native';

const logo = require('../assets/brand/logo-original.png');

interface BrandLogoProps {
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
}

/** Supplied Follope wordmark, styled seamlessly across light and dark product surfaces. */
export function BrandLogo({ width = 140, height = 42, style }: BrandLogoProps) {
  return (
    <View className="bg-neutral-950 self-start rounded-xl px-3 py-1.5 border border-neutral-800 shadow-sm">
      <Image
        source={logo}
        resizeMode="contain"
        style={[{ width, height }, style]}
        accessibilityLabel="Follope"
      />
    </View>
  );
}
