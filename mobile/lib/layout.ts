import { useWindowDimensions } from 'react-native';

/** Keeps phone layouts comfortable while preventing overly wide forms and
 * invoices on tablets and Expo web. */
export function useReadableContentWidth(maxWidth = 720) {
  const { width } = useWindowDimensions();
  return width > maxWidth + 48 ? { width: '100%' as const, maxWidth, alignSelf: 'center' as const } : undefined;
}
