import 'package:healthcare_crm/shared/models/app_user.dart';

class AuthState {
  const AuthState({
    this.user,
    this.loading = false,
    this.errorMessage,
    this.isAuthenticated = false,
  });

  final AppUser? user;
  final bool loading;
  final String? errorMessage;
  final bool isAuthenticated;

  AuthState copyWith({
    AppUser? user,
    bool? loading,
    String? errorMessage,
    bool? isAuthenticated,
    bool clearError = false,
  }) {
    return AuthState(
      user: user ?? this.user,
      loading: loading ?? this.loading,
      errorMessage: clearError ? null : errorMessage ?? this.errorMessage,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
    );
  }
}
