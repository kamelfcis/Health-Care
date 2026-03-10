import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:healthcare_crm/core/config/flavor_config.dart';

class EnvConfig {
  const EnvConfig._();

  static Future<void> loadForFlavor(AppFlavor flavor) async {
    final fileName = switch (flavor) {
      AppFlavor.dev => '.env.dev',
      AppFlavor.staging => '.env.staging',
      AppFlavor.production => '.env.production',
    };
    await dotenv.load(fileName: fileName);
  }

  static String get apiBaseUrl => dotenv.get('API_BASE_URL');
  static String get appName => dotenv.get('APP_NAME', fallback: 'Healthcare CRM');
}
