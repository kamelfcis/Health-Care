import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:healthcare_crm/core/api/api_service.dart';
import 'package:healthcare_crm/core/api/dio_client.dart';
import 'package:healthcare_crm/shared/services/crm_repository.dart';
import 'package:healthcare_crm/shared/services/providers.dart';

final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService(ref.watch(dioProvider));
});

final crmRepositoryProvider = Provider<CrmRepository>((ref) {
  return CrmRepository(
    ref.watch(apiServiceProvider),
    ref.watch(cacheServiceProvider),
  );
});
