import { hexToRgb } from "@/helpers/colors";
import { fromEntries, getEntries } from "@/helpers/object";
import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { vars } from "nativewind";

export type Theme = 'light' | 'dark';

// Make sure to update tailwind.config.js when updating this
export const ColorThemesHex = {
  light: {
    primary: '#0000FF',
  },
  dark: {
    primary: '#6161F5',
  },
} as const

export const ColorThemesCssVariables = fromEntries(
  getEntries(ColorThemesHex).map(([theme, colors]) => [
    theme,
    vars(
    fromEntries(
      getEntries(colors).map(([key, value]) => [
        `--color-${key}`,
        hexToRgb(value),
      ])
    )),
  ])
);

export const RNNThemes = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
    },
  },
} as const;