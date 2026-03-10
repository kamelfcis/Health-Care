import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:healthcare_crm/core/constants/app_constants.dart';
import 'package:healthcare_crm/shared/services/cache_service.dart';
import 'package:healthcare_crm/shared/services/secure_storage_service.dart';

final secureStorageServiceProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService(const FlutterSecureStorage());
});

final cacheServiceProvider = Provider<CacheService>((ref) {
  final box = Hive.box<dynamic>(AppConstants.cacheBox);
  return CacheService(box);
});
