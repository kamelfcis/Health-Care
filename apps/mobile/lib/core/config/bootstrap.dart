import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:healthcare_crm/core/config/env_config.dart';
import 'package:healthcare_crm/core/config/flavor_config.dart';
import 'package:healthcare_crm/core/constants/app_constants.dart';
import 'package:healthcare_crm/core/config/healthcare_app.dart';

Future<void> bootstrap({required AppFlavor flavor}) async {
  WidgetsFlutterBinding.ensureInitialized();
  // Centralized runtime setup so each flavor entrypoint stays minimal.
  FlavorConfig.current = flavor;
  await EnvConfig.loadForFlavor(flavor);
  await Hive.initFlutter();
  await Hive.openBox<dynamic>(AppConstants.cacheBox);

  runApp(const ProviderScope(child: HealthcareApp()));
}
