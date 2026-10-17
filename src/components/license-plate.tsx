import { Platform, StyleSheet, Text, View } from 'react-native';

// Real plates are white with a dark rim and the blue EU band on the left —
// they stay that way in dark mode too, which is what makes them pop. No
// country letters on the band: the plate string doesn't carry the country.
const PLATE_BG = '#FFFFFF';
const PLATE_FG = '#1B1F26';
const EU_BLUE = '#1E4BA8';

/**
 * A truck's registration drawn as an EU number plate, so it reads as "the
 * truck" at a glance in a list full of names, phones and statuses.
 */
export function LicensePlate({ plate }: { plate: string }) {
  return (
    <View style={styles.plate}>
      <View style={styles.band} />
      <Text style={styles.text} numberOfLines={1}>
        {plate}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: PLATE_BG,
    borderColor: PLATE_FG,
    borderWidth: 1.5,
    borderRadius: 5,
    overflow: 'hidden',
    flexShrink: 1,
  },
  band: { width: 9, backgroundColor: EU_BLUE },
  text: {
    color: PLATE_FG,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
