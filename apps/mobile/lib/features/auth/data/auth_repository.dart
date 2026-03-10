import 'package:healthcare_crm/core/api/api_service.dart';
import 'package:healthcare_crm/core/constants/app_constants.dart';
import 'package:healthcare_crm/shared/models/app_user.dart';
import 'package:healthcare_crm/shared/services/secure_storage_service.dart';

class AuthRepository {
  AuthRepository({
    required ApiService apiService,
    required SecureStorageService secureStorage,
  })  : _apiService = apiService,
        _secureStorage = secureStorage;

  final ApiService _apiService;
  final SecureStorageService _secureStorage;

  Future<AppUser> login({
    required String email,
    required String password,
  }) async {
    final data = await _apiService.post('/auth/login', body: {'email': email, 'password': password});
    final accessToken = data['accessToken']?.toString() ?? '';
    final refreshToken = data['refreshToken']?.toString() ?? '';
    if (accessToken.isNotEmpty) {
      await _secureStorage.write(AppConstants.accessTokenKey, accessToken);
    }
    if (refreshToken.isNotEmpty) {
      await _secureStorage.write(AppConstants.refreshTokenKey, refreshToken);
    }
    final userJson = (data['user'] as Map?)?.cast<String, dynamic>() ?? {};
    return AppUser.fromJson(userJson);
  }

  Future<AppUser> register({
    required String clinicName,
    required String firstName,
    required String lastName,
    required String email,
    required String password,
  }) async {
    final data = await _apiService.post(
      '/auth/register',
      body: {
        'clinicName': clinicName,
        'firstName': firstName,
        'lastName': lastName,
        'email': email,
        'password': password,
        'specialtyCodes': ['general'],
      },
    );
    final accessToken = data['accessToken']?.toString() ?? '';
    final refreshToken = data['refreshToken']?.toString() ?? '';
    if (accessToken.isNotEmpty) {
      await _secureStorage.write(AppConstants.accessTokenKey, accessToken);
    }
    if (refreshToken.isNotEmpty) {
      await _secureStorage.write(AppConstants.refreshTokenKey, refreshToken);
    }
    final userJson = (data['user'] as Map?)?.cast<String, dynamic>() ?? {};
    return AppUser.fromJson(userJson);
  }

  Future<AppUser> me() async {
    final data = await _apiService.get('/auth/me');
    final userJson = (data['user'] as Map?)?.cast<String, dynamic>() ?? data;
    return AppUser.fromJson(userJson);
  }

  Future<void> logout() async {
    await _apiService.post('/auth/logout');
    await _secureStorage.delete(AppConstants.accessTokenKey);
    await _secureStorage.delete(AppConstants.refreshTokenKey);
  }
}
