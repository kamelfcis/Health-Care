import 'package:healthcare_crm/core/api/api_service.dart';
import 'package:healthcare_crm/core/constants/app_constants.dart';
import 'package:healthcare_crm/shared/services/cache_service.dart';

class CrmRepository {
  CrmRepository(this._apiService, this._cacheService);

  final ApiService _apiService;
  final CacheService _cacheService;

  Future<List<Map<String, dynamic>>> fetchList(
    String endpoint, {
    int page = 1,
    String? search,
  }) async {
    final cacheKey = '$endpoint::$page::${search ?? ''}';
    try {
      final data = await _apiService.get(
        endpoint,
        query: {
          'page': page,
          'pageSize': AppConstants.pageSize,
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final list = (data['data'] as List?) ?? (data['value'] as List?) ?? const [];
      final normalized = list.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
      await _cacheService.put(cacheKey, normalized);
      return normalized;
    } catch (_) {
      final cached = _cacheService.get<List<dynamic>>(cacheKey);
      if (cached == null) rethrow;
      return cached.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList();
    }
  }

  Future<Map<String, dynamic>> fetchOne(String endpoint) async {
    return _apiService.get(endpoint);
  }

  Future<void> create(String endpoint, Map<String, dynamic> body) async {
    await _apiService.post(endpoint, body: body);
  }

  Future<void> update(String endpoint, Map<String, dynamic> body) async {
    await _apiService.patch(endpoint, body: body);
  }
}
