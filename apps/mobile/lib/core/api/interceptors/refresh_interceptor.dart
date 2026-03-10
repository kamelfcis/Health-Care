import 'dart:async';

import 'package:dio/dio.dart';
import 'package:healthcare_crm/core/constants/app_constants.dart';
import 'package:healthcare_crm/shared/services/secure_storage_service.dart';

typedef RefreshTokenCallback = Future<String?> Function();

class RefreshInterceptor extends Interceptor {
  RefreshInterceptor({
    required this.dio,
    required this.secureStorage,
    required this.onRefreshToken,
  });

  final Dio dio;
  final SecureStorageService secureStorage;
  final RefreshTokenCallback onRefreshToken;
  bool _isRefreshing = false;
  final List<Completer<void>> _waiters = [];

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final statusCode = err.response?.statusCode;
    if (statusCode != 401 || err.requestOptions.path.contains('/auth/refresh')) {
      handler.next(err);
      return;
    }

    if (_isRefreshing) {
      final completer = Completer<void>();
      _waiters.add(completer);
      await completer.future;
    } else {
      _isRefreshing = true;
      await onRefreshToken();
      _isRefreshing = false;
      for (final waiter in _waiters) {
        waiter.complete();
      }
      _waiters.clear();
    }

    final newToken = await secureStorage.read(AppConstants.accessTokenKey);
    if (newToken == null || newToken.isEmpty) {
      handler.next(err);
      return;
    }

    final requestOptions = err.requestOptions;
    requestOptions.headers['Authorization'] = 'Bearer $newToken';

    final response = await dio.fetch<dynamic>(requestOptions);
    handler.resolve(response);
  }
}
