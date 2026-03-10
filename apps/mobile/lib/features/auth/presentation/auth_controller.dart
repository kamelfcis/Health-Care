import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:healthcare_crm/core/config/app_providers.dart';
import 'package:healthcare_crm/core/constants/app_constants.dart';
import 'package:healthcare_crm/features/auth/data/auth_repository.dart';
import 'package:healthcare_crm/features/auth/domain/auth_state.dart';
import 'package:healthcare_crm/shared/services/providers.dart';
import 'package:local_auth/local_auth.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    apiService: ref.watch(apiServiceProvider),
    secureStorage: ref.watch(secureStorageServiceProvider),
  );
});

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(
    repository: ref.watch(authRepositoryProvider),
    ref: ref,
  )..restoreSession();
});

class AuthController extends StateNotifier<AuthState> {
  AuthController({
    required AuthRepository repository,
    required Ref ref,
  })  : _repository = repository,
        _ref = ref,
        super(const AuthState());

  final AuthRepository _repository;
  final Ref _ref;

  Future<void> restoreSession() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final token = await _ref.read(secureStorageServiceProvider).read(AppConstants.accessTokenKey);
      if (token == null || token.isEmpty) {
        state = state.copyWith(loading: false, isAuthenticated: false);
        return;
      }
      final user = await _repository.me();
      state = state.copyWith(loading: false, isAuthenticated: true, user: user);
    } catch (_) {
      state = state.copyWith(loading: false, isAuthenticated: false);
    }
  }

  Future<bool> biometricUnlock() async {
    final auth = LocalAuthentication();
    final canCheck = await auth.canCheckBiometrics;
    if (!canCheck) return false;
    return auth.authenticate(localizedReason: 'Unlock your Healthcare CRM session');
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final user = await _repository.login(email: email, password: password);
      state = state.copyWith(loading: false, isAuthenticated: true, user: user);
    } catch (e) {
      state = state.copyWith(
        loading: false,
        isAuthenticated: false,
        errorMessage: e.toString(),
      );
    }
  }

  Future<void> register({
    required String clinicName,
    required String firstName,
    required String lastName,
    required String email,
    required String password,
  }) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final user = await _repository.register(
        clinicName: clinicName,
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password,
      );
      state = state.copyWith(loading: false, isAuthenticated: true, user: user);
    } catch (e) {
      state = state.copyWith(loading: false, errorMessage: e.toString());
    }
  }

  Future<void> forgotPassword(String email) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      await _ref.read(apiServiceProvider).post('/auth/forgot-password', body: {'email': email});
    } catch (_) {
      // Backend endpoint might not be available yet; keep UX flow ready.
    } finally {
      state = state.copyWith(loading: false);
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthState();
  }
}
