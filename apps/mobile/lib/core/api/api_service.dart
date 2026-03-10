import 'package:dio/dio.dart';
import 'package:healthcare_crm/core/errors/app_exception.dart';

class ApiService {
  ApiService(this._dio);

  final Dio _dio;

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) async {
    final response = await _dio.get<Map<String, dynamic>>(path, queryParameters: query);
    return _unwrap(response.data);
  }

  Future<Map<String, dynamic>> post(String path, {dynamic body}) async {
    final response = await _dio.post<Map<String, dynamic>>(path, data: body);
    return _unwrap(response.data);
  }

  Future<Map<String, dynamic>> patch(String path, {dynamic body}) async {
    final response = await _dio.patch<Map<String, dynamic>>(path, data: body);
    return _unwrap(response.data);
  }

  Future<Map<String, dynamic>> delete(String path, {dynamic body}) async {
    final response = await _dio.delete<Map<String, dynamic>>(path, data: body);
    return _unwrap(response.data);
  }

  Map<String, dynamic> _unwrap(Map<String, dynamic>? body) {
    if (body == null) {
      throw const AppException('Empty response from server');
    }
    if (body['success'] == false) {
      throw AppException(
        body['message']?.toString() ?? 'Request failed',
      );
    }

    final data = body['data'];
    if (data is Map<String, dynamic>) {
      return data;
    }
    return {'value': data};
  }
}
