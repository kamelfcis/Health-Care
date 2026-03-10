enum AppFlavor { dev, staging, production }

class FlavorConfig {
  const FlavorConfig._();

  static AppFlavor current = AppFlavor.dev;

  static bool get isProduction => current == AppFlavor.production;
  static bool get isDebugLike => current != AppFlavor.production;
}
