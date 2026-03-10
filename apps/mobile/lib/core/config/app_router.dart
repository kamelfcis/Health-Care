import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:healthcare_crm/core/config/app_shell.dart';
import 'package:healthcare_crm/core/localization/locale_controller.dart';
import 'package:healthcare_crm/features/auth/presentation/auth_controller.dart';
import 'package:healthcare_crm/features/auth/domain/auth_state.dart';
import 'package:healthcare_crm/features/auth/presentation/auth_screens.dart';
import 'package:healthcare_crm/features/auth/presentation/startup_screens.dart';
import 'package:healthcare_crm/features/appointments/presentation/appointments_screen.dart';
import 'package:healthcare_crm/features/doctors/presentation/doctors_screen.dart';
import 'package:healthcare_crm/features/patients/presentation/patient_form_screen.dart';
import 'package:healthcare_crm/features/prescriptions/presentation/prescriptions_screen.dart';

GoRouter buildRouter(Ref ref) {
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: RouterRefreshNotifier(ref),
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final onSplash = state.matchedLocation == '/splash';
      final onLanguageSelect = state.matchedLocation == '/language-select';
      final onOnboarding = state.matchedLocation == '/onboarding';
      final inAuth = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register' ||
          state.matchedLocation == '/forgot-password';

      if (auth.loading && !onSplash) return '/splash';
      if (!auth.isAuthenticated && !inAuth && !onSplash && !onOnboarding && !onLanguageSelect) return '/login';
      if (auth.isAuthenticated && inAuth) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),
      GoRoute(path: '/language-select', builder: (context, state) => const LanguageSelectionScreen()),
      GoRoute(path: '/onboarding', builder: (context, state) => const OnboardingScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
      GoRoute(path: '/forgot-password', builder: (context, state) => const ForgotPasswordScreen()),
      GoRoute(path: '/dashboard', builder: (context, state) => const AppShell()),
      GoRoute(path: '/appointments/create', builder: (context, state) => const AppointmentFormScreen()),
      GoRoute(path: '/patients/add', builder: (context, state) => const PatientFormScreen()),
      GoRoute(
        path: '/patients/:id/edit',
        builder: (context, state) => PatientFormScreen(patientId: state.pathParameters['id']),
      ),
      GoRoute(path: '/doctors', builder: (context, state) => const DoctorsScreen()),
      GoRoute(path: '/prescriptions', builder: (context, state) => const PrescriptionsScreen()),
    ],
  );
}

class RouterRefreshNotifier extends ChangeNotifier {
  RouterRefreshNotifier(this.ref) {
    ref.listen<AuthState>(authControllerProvider, (previous, next) => notifyListeners());
    ref.listen<LocaleState>(localeControllerProvider, (previous, next) => notifyListeners());
  }
  final Ref ref;
}
