/** Text input on a glass/translucent field, matching the Aurora form look. */
import { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { colors, fontFamily, radii, spacing } from "@/theme";

export const Input = forwardRef<TextInput, TextInputProps>(function Input(
  { style, ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.dimForeground}
      style={[styles.input, style]}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    height: 46,
    paddingHorizontal: spacing[4],
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.white05,
    color: colors.foreground,
    fontFamily: fontFamily.sans,
    fontSize: 15,
  },
});
