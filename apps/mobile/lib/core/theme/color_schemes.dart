import 'package:flutter/material.dart';

class AppColorSchemes {
  const AppColorSchemes._();

  static const brandOrange = Color(0xFFF27A1A);
  static const primaryOrange = Color(0xFFF97316);
  static const primaryOrangeDark = Color(0xFFEA580C);
  static const orangeSurface = Color(0xFFFFF7ED);
  static const orangeBorder = Color(0xFFFED7AA);
  static const orangeTextStrong = Color(0xFFC2410C);

  static const light = ColorScheme(
    brightness: Brightness.light,
    primary: primaryOrange,
    onPrimary: Colors.white,
    primaryContainer: Color(0xFFFFEDD5),
    onPrimaryContainer: orangeTextStrong,
    secondary: Color(0xFFFB923C),
    onSecondary: Colors.white,
    secondaryContainer: Color(0xFFFFEDD5),
    onSecondaryContainer: orangeTextStrong,
    tertiary: Color(0xFFF59E0B),
    onTertiary: Colors.white,
    tertiaryContainer: Color(0xFFFEF3C7),
    onTertiaryContainer: Color(0xFF78350F),
    error: Color(0xFFB91C1C),
    onError: Colors.white,
    errorContainer: Color(0xFFFEE2E2),
    onErrorContainer: Color(0xFF7F1D1D),
    surface: Color(0xFFFFFBF8),
    onSurface: Color(0xFF2A1708),
    surfaceContainerHighest: Color(0xFFFFE7D1),
    onSurfaceVariant: Color(0xFF8A5A33),
    outline: orangeBorder,
    outlineVariant: Color(0xFFFFE3C8),
    shadow: Color(0x332A1708),
    scrim: Color(0x662A1708),
    inverseSurface: Color(0xFF3E2410),
    onInverseSurface: Color(0xFFFFEBDD),
    inversePrimary: Color(0xFFFFB680),
  );
}
