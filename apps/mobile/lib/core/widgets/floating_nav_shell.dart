import 'package:flutter/material.dart';
import 'package:healthcare_crm/core/localization/app_localizations.dart';

class FloatingNavShell extends StatelessWidget {
  const FloatingNavShell({
    required this.child,
    required this.currentIndex,
    required this.onTap,
    super.key,
  });

  final Widget child;
  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: NavigationBar(
            height: 72,
            selectedIndex: currentIndex,
            onDestinationSelected: onTap,
            destinations: [
              NavigationDestination(icon: const Icon(Icons.dashboard_outlined), label: context.tr('home')),
              NavigationDestination(icon: const Icon(Icons.people_alt_outlined), label: context.tr('patients')),
              NavigationDestination(icon: const Icon(Icons.calendar_month_outlined), label: context.tr('appointments')),
              NavigationDestination(icon: const Icon(Icons.analytics_outlined), label: context.tr('analytics')),
              NavigationDestination(icon: const Icon(Icons.person_outline), label: context.tr('profile')),
            ],
          ),
        ),
      ),
    );
  }
}
