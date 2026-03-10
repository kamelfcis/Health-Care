import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:healthcare_crm/core/localization/app_localizations.dart';
import 'package:healthcare_crm/core/theme/spacing.dart';
import 'package:healthcare_crm/core/widgets/animated_logo_circle.dart';
import 'package:healthcare_crm/core/widgets/glass_card.dart';
import 'package:healthcare_crm/core/widgets/medical_background.dart';
import 'package:healthcare_crm/features/auth/presentation/auth_controller.dart';
import 'package:reactive_forms/reactive_forms.dart';

class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final form = FormGroup({
      'email': FormControl<String>(validators: [Validators.required, Validators.email]),
      'password': FormControl<String>(validators: [Validators.required, Validators.minLength(8)]),
    });

    return Scaffold(
      body: MedicalBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 500),
                child: ReactiveForm(
                  formGroup: form,
                  child: GlassCard(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Center(
                          child: AnimatedLogoCircle(
                            size: 138,
                            showOuterGlow: true,
                            animationIntensity: 1.2,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          context.tr('loginTitle'),
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          context.tr('loginSubtitle'),
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        ReactiveTextField<String>(
                          formControlName: 'email',
                          keyboardType: TextInputType.emailAddress,
                          decoration: InputDecoration(
                            labelText: context.tr('email'),
                            prefixIcon: Icon(Icons.mail_outline),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        ReactiveTextField<String>(
                          formControlName: 'password',
                          obscureText: true,
                          decoration: InputDecoration(
                            labelText: context.tr('password'),
                            prefixIcon: Icon(Icons.lock_outline),
                          ),
                        ),
                        if (authState.errorMessage != null) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Text(authState.errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                        ],
                        const SizedBox(height: AppSpacing.lg),
                        ElevatedButton.icon(
                          onPressed: authState.loading
                              ? null
                              : () async {
                                  if (!form.valid) {
                                    form.markAllAsTouched();
                                    return;
                                  }
                                  await ref.read(authControllerProvider.notifier).login(
                                        form.control('email').value.toString(),
                                        form.control('password').value.toString(),
                                      );
                                },
                          icon: const Icon(Icons.login),
                          label: Text(authState.loading ? context.tr('signingIn') : context.tr('login')),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            TextButton(
                              onPressed: () => context.push('/forgot-password'),
                              child: Text(context.tr('forgotPassword')),
                            ),
                            TextButton(
                              onPressed: () => context.push('/register'),
                              child: Text(context.tr('createClinicAccount')),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        OutlinedButton.icon(
                          onPressed: () async {
                            final ok = await ref.read(authControllerProvider.notifier).biometricUnlock();
                            if (ok && context.mounted) {
                              await ref.read(authControllerProvider.notifier).restoreSession();
                            }
                          },
                          icon: const Icon(Icons.fingerprint),
                          label: Text(context.tr('unlockWithBiometrics')),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: const [
                            _FeaturePill(icon: Icons.verified_user_outlined, textKey: 'hipaaMinded'),
                            _FeaturePill(icon: Icons.health_and_safety_outlined, textKey: 'medicalFirstUx'),
                            _FeaturePill(icon: Icons.bolt_outlined, textKey: 'realtimeWorkflows'),
                          ],
                        ),
                      ],
                    ),
                  ),
                ).animate().fadeIn(duration: 350.ms).slideY(begin: 0.08),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class RegisterScreen extends ConsumerWidget {
  const RegisterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final form = FormGroup({
      'clinicName': FormControl<String>(validators: [Validators.required]),
      'firstName': FormControl<String>(validators: [Validators.required]),
      'lastName': FormControl<String>(validators: [Validators.required]),
      'email': FormControl<String>(validators: [Validators.required, Validators.email]),
      'password': FormControl<String>(validators: [Validators.required, Validators.minLength(8)]),
    });

    return Scaffold(
      appBar: AppBar(title: Text(context.tr('createClinicAccountTitle'))),
      body: MedicalBackground(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: ReactiveForm(
            formGroup: form,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: ListView(
                  children: [
                    GlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Center(
                            child: AnimatedLogoCircle(
                              size: 144,
                              showOuterGlow: true,
                              animationIntensity: 1.2,
                            ),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            context.tr('setupClinicWorkspace'),
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            context.tr('setupClinicWorkspaceSubtitle'),
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          ReactiveTextField<String>(
                            formControlName: 'clinicName',
                            decoration: InputDecoration(
                              labelText: context.tr('clinicName'),
                              prefixIcon: Icon(Icons.local_hospital_outlined),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            children: [
                              Expanded(
                                child: ReactiveTextField<String>(
                                  formControlName: 'firstName',
                                  decoration: InputDecoration(
                                    labelText: context.tr('firstName'),
                                    prefixIcon: Icon(Icons.person_outline),
                                  ),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: ReactiveTextField<String>(
                                  formControlName: 'lastName',
                                  decoration: InputDecoration(
                                    labelText: context.tr('lastName'),
                                    prefixIcon: Icon(Icons.badge_outlined),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          ReactiveTextField<String>(
                            formControlName: 'email',
                            decoration: InputDecoration(
                              labelText: context.tr('adminEmail'),
                              prefixIcon: Icon(Icons.mail_outline),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          ReactiveTextField<String>(
                            formControlName: 'password',
                            decoration: InputDecoration(
                              labelText: context.tr('password'),
                              prefixIcon: Icon(Icons.lock_outline),
                            ),
                            obscureText: true,
                          ),
                          if (authState.errorMessage != null) ...[
                            const SizedBox(height: AppSpacing.sm),
                            Text(authState.errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                          ],
                          const SizedBox(height: AppSpacing.lg),
                          ElevatedButton.icon(
                            onPressed: authState.loading
                                ? null
                                : () async {
                                    if (!form.valid) {
                                      form.markAllAsTouched();
                                      return;
                                    }
                                    await ref.read(authControllerProvider.notifier).register(
                                          clinicName: form.control('clinicName').value.toString(),
                                          firstName: form.control('firstName').value.toString(),
                                          lastName: form.control('lastName').value.toString(),
                                          email: form.control('email').value.toString(),
                                          password: form.control('password').value.toString(),
                                        );
                                    if (context.mounted) {
                                      context.go('/dashboard');
                                    }
                                  },
                            icon: const Icon(Icons.auto_awesome),
                            label: Text(authState.loading ? context.tr('creating') : context.tr('createPremiumWorkspace')),
                          ),
                          TextButton(
                            onPressed: () => context.pop(),
                            child: Text(context.tr('alreadyHaveAccount')),
                          ),
                        ],
                      ),
                    ).animate().fadeIn(duration: 320.ms).slideY(begin: 0.05),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ForgotPasswordScreen extends ConsumerWidget {
  const ForgotPasswordScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final form = FormGroup({
      'email': FormControl<String>(validators: [Validators.required, Validators.email]),
    });

    return Scaffold(
      appBar: AppBar(title: Text(context.tr('forgotPasswordTitle'))),
      body: MedicalBackground(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: ReactiveForm(
            formGroup: form,
            child: GlassCard(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ReactiveTextField<String>(
                    formControlName: 'email',
                    decoration: InputDecoration(
                      labelText: context.tr('email'),
                      prefixIcon: Icon(Icons.alternate_email),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  ElevatedButton(
                    onPressed: authState.loading
                        ? null
                        : () async {
                            if (!form.valid) {
                              form.markAllAsTouched();
                              return;
                            }
                            await ref.read(authControllerProvider.notifier).forgotPassword(
                                  form.control('email').value.toString(),
                                );
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(context.tr('resetInstructionsSent'))),
                              );
                              context.pop();
                            }
                          },
                    child: Text(authState.loading ? context.tr('sending') : context.tr('sendResetLink')),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FeaturePill extends StatelessWidget {
  const _FeaturePill({required this.icon, required this.textKey});

  final IconData icon;
  final String textKey;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: scheme.primaryContainer.withValues(alpha: 0.75),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: scheme.outline),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: scheme.primary),
          const SizedBox(width: 6),
          Text(context.tr(textKey)),
        ],
      ),
    );
  }
}
