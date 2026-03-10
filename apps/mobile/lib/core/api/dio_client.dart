import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:healthcare_crm/core/api/interceptors/auth_interceptor.dart';
import 'package:healthcare_crm/core/api/interceptors/logging_interceptor.dart';
import 'package:healthcare_crm/core/api/interceptors/refresh_interceptor.dart';
import 'package:healthcare_crm/core/config/env_config.dart';
import 'package:healthcare_crm/core/constants/app_constants.dart';
import 'package:healthcare_crm/shared/services/providers.dart';

final dioProvider = Provider<Dio>((ref) {
  final secureStorage = ref.watch(secureStorageServiceProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: EnvConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
    ),
  );

  dio.interceptors.addAll([
    AuthInterceptor(secureStorage),
    // Refresh interceptor retries 401 requests after obtaining a new access token.
    RefreshInterceptor(
      dio: dio,
      secureStorage: secureStorage,
      onRefreshToken: () async {
        final refreshToken = await secureStorage.read(AppConstants.refreshTokenKey);
        if (refreshToken == null || refreshToken.isEmpty) {
          return null;
        }
        final tempDio = Dio(BaseOptions(baseUrl: EnvConfig.apiBaseUrl));
        final response = await tempDio.post<Map<String, dynamic>>(
          '/auth/refresh',
          data: {'refreshToken': refreshToken},
        );
        final data = (response.data?['data'] as Map?)?.cast<String, dynamic>();
        if (data == null) {
          return null;
        }
        await secureStorage.write(AppConstants.accessTokenKey, data['accessToken'].toString());
        await secureStorage.write(AppConstants.refreshTokenKey, data['refreshToken'].toString());
        return data['accessToken'].toString();
      },
    ),
    LoggingInterceptor(),
  ]);
  return dio;
});

