import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:healthcare_crm/core/widgets/floating_nav_shell.dart';
import 'package:healthcare_crm/features/analytics/presentation/analytics_screen.dart';
import 'package:healthcare_crm/features/appointments/presentation/appointments_screen.dart';
import 'package:healthcare_crm/features/dashboard/presentation/dashboard_screen.dart';
import 'package:healthcare_crm/features/patients/presentation/patients_screen.dart';
import 'package:healthcare_crm/features/notifications/presentation/notifications_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = const [
      DashboardScreen(),
      PatientsScreen(),
      AppointmentsScreen(),
      AnalyticsScreen(),
      NotificationsScreen(),
    ];
    return FloatingNavShell(
      currentIndex: _index,
      onTap: (value) => setState(() => _index = value),
      child: pages[_index],
    );
  }
}

class SplashGate extends StatelessWidget {
  const SplashGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 250),
      child: child,
    );
  }
}

class PlaceholderPage extends StatelessWidget {
  const PlaceholderPage({super.key, required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(subtitle, textAlign: TextAlign.center),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.pop(),
        child: const Icon(Icons.arrow_back),
      ),
    );
  }
}
