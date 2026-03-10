import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:healthcare_crm/core/localization/app_localizations.dart';
import 'package:healthcare_crm/core/localization/locale_controller.dart';
import 'package:healthcare_crm/core/theme/spacing.dart';
import 'package:healthcare_crm/core/widgets/animated_logo_circle.dart';
import 'package:healthcare_crm/core/widgets/glass_card.dart';
import 'package:healthcare_crm/core/widgets/medical_background.dart';
import 'package:healthcare_crm/features/auth/presentation/auth_controller.dart';
import 'package:healthcare_crm/features/auth/presentation/onboarding_controller.dart';
import 'package:lottie/lottie.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigateNext();
  }

  Future<void> _navigateNext() async {
    await Future<void>.delayed(const Duration(milliseconds: 1800));
    for (var i = 0; i < 15; i++) {
      final auth = ref.read(authControllerProvider);
      if (!auth.loading) break;
      await Future<void>.delayed(const Duration(milliseconds: 130));
    }

    if (!mounted) return;
    // Always start the experience with language selection on each app open.
    context.go('/language-select');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: MedicalBackground(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const AnimatedLogoCircle(
                size: 138,
                showOuterGlow: true,
                animationIntensity: 1.2,
              ),
              const SizedBox(height: AppSpacing.lg),
              SizedBox(
                width: 210,
                height: 210,
                child: const _SafeLottieAsset(
                  assetPath: 'assets/animations/splash.json',
                  fit: BoxFit.contain,
                  repeat: true,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                context.tr('appName'),
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                context.tr('designedForModernClinics'),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ).animate().fadeIn(duration: 650.ms),
        ),
      ),
    );
  }
}

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pageController = PageController();
  var _index = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _complete() async {
    await ref.read(onboardingControllerProvider).complete();
    if (!mounted) return;
    final authed = ref.read(authControllerProvider).isAuthenticated;
    context.go(authed ? '/dashboard' : '/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: MedicalBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                child: Row(
                  children: [
                    TextButton(
                      onPressed: _complete,
                      child: Text(context.tr('skip')),
                    ),
                    const Spacer(),
                    ...List.generate(
                      3,
                      (dotIndex) => AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: _index == dotIndex ? 22 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _index == dotIndex
                              ? Theme.of(context).colorScheme.primary
                              : Theme.of(context).colorScheme.outline,
                          borderRadius: BorderRadius.circular(22),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: 3,
                  onPageChanged: (value) => setState(() => _index = value),
                  itemBuilder: (context, idx) {
                    final slide = _slideFor(context, idx);
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                      child: Column(
                        children: [
                          const SizedBox(height: 8),
                          if (idx == 1)
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(24),
                                boxShadow: [
                                  BoxShadow(
                                    color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.10),
                                    blurRadius: 18,
                                    offset: const Offset(0, 8),
                                  ),
                                ],
                              ),
                              child: SizedBox(
                                height: 250,
                                child: _SafeLottieAsset(
                                  assetPath: slide.animationPath,
                                  fit: BoxFit.contain,
                                  repeat: true,
                                ),
                              ),
                            )
                          else
                            SizedBox(
                              height: 270,
                              child: _SafeLottieAsset(
                                assetPath: slide.animationPath,
                                fit: BoxFit.contain,
                                repeat: true,
                              ),
                            ),
                          const SizedBox(height: 22),
                          Text(
                            slide.title,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 12),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            child: Text(
                              slide.body,
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                                    height: 1.35,
                                  ),
                            ),
                          ),
                        ],
                      ).animate().fadeIn(duration: 320.ms).slideY(begin: 0.05),
                    );
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: ElevatedButton(
                  onPressed: () async {
                    if (_index == 2) {
                      await _complete();
                      return;
                    }
                    await _pageController.nextPage(
                      duration: const Duration(milliseconds: 280),
                      curve: Curves.easeOutCubic,
                    );
                  },
                  child: Text(_index == 2 ? context.tr('getStarted') : context.tr('next')),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  ({String title, String body, String animationPath}) _slideFor(BuildContext context, int index) {
    switch (index) {
      case 0:
        return (
          title: context.tr('smartPatientManagement'),
          body: context.tr('smartPatientManagementBody'),
          animationPath: 'assets/animations/onboarding_1.json'
        );
      case 1:
        return (
          title: context.tr('appointmentsThatFlow'),
          body: context.tr('appointmentsThatFlowBody'),
          animationPath: 'assets/animations/onboarding_2.json'
        );
      default:
        return (
          title: context.tr('clinicAnalyticsInsights'),
          body: context.tr('clinicAnalyticsInsightsBody'),
          animationPath: 'assets/animations/onboarding_3.json'
        );
    }
  }
}

class LanguageSelectionScreen extends ConsumerWidget {
  const LanguageSelectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final localeState = ref.watch(localeControllerProvider);
    return Scaffold(
      body: MedicalBackground(
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: GlassCard(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        context.tr('selectLanguageTitle'),
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        context.tr('selectLanguageSubtitle'),
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 20),
                      _LangTile(
                        flag: '🇬🇧',
                        label: context.tr('english'),
                        selected: localeState.locale.languageCode == 'en',
                        onTap: () => ref.read(localeControllerProvider.notifier).selectLocale('en'),
                      ),
                      const SizedBox(height: 10),
                      _LangTile(
                        flag: '🇪🇬',
                        label: context.tr('arabic'),
                        selected: localeState.locale.languageCode == 'ar',
                        onTap: () => ref.read(localeControllerProvider.notifier).selectLocale('ar'),
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: localeState.isSelected
                            ? () {
                                context.go('/onboarding');
                              }
                            : null,
                        child: Text(context.tr('continue')),
                      ),
                    ],
                  ),
                ).animate().fadeIn(duration: 350.ms).slideY(begin: 0.05),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LangTile extends StatelessWidget {
  const _LangTile({
    required this.flag,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String flag;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? Theme.of(context).colorScheme.primaryContainer : Colors.white.withValues(alpha: 0.8),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Text(flag, style: const TextStyle(fontSize: 28)),
              const SizedBox(width: 10),
              Expanded(child: Text(label, style: Theme.of(context).textTheme.titleMedium)),
              if (selected) Icon(Icons.check_circle, color: Theme.of(context).colorScheme.primary),
            ],
          ),
        ),
      ),
    );
  }
}

class _SafeLottieAsset extends StatelessWidget {
  const _SafeLottieAsset({
    required this.assetPath,
    required this.fit,
    required this.repeat,
  });

  final String assetPath;
  final BoxFit fit;
  final bool repeat;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: _validateAsset(assetPath),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          );
        }
        if (snapshot.data != true) {
          return const Center(
            child: Icon(
              Icons.animation_outlined,
              size: 72,
              color: Color(0xFFF97316),
            ),
          );
        }
        return Lottie.asset(
          assetPath,
          fit: fit,
          repeat: repeat,
        );
      },
    );
  }

  Future<bool> _validateAsset(String path) async {
    try {
      final raw = await rootBundle.loadString(path);
      final content = raw.trim();
      if (content.isEmpty || content == '{}') return false;
      final parsed = jsonDecode(content);
      if (parsed is! Map<String, dynamic>) return false;
      final layers = parsed['layers'];
      if (layers is! List || layers.isEmpty) return false;
      final ip = (parsed['ip'] as num?)?.toDouble();
      final op = (parsed['op'] as num?)?.toDouble();
      if (ip != null && op != null && op <= ip) return false;
      return true;
    } catch (_) {
      return false;
    }
  }
}
