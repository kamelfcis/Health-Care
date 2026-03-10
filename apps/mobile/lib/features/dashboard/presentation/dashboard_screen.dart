import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:healthcare_crm/core/config/app_providers.dart';
import 'package:healthcare_crm/core/localization/app_localizations.dart';
import 'package:healthcare_crm/core/theme/spacing.dart';
import 'package:healthcare_crm/core/widgets/glass_card.dart';

final dashboardMetricsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final repo = ref.watch(crmRepositoryProvider);
  return repo.fetchOne('/dashboard/metrics');
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metrics = ref.watch(dashboardMetricsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('dashboard'))),
      body: metrics.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => Center(child: Text(context.tr('failedToLoadDashboard'))),
        data: (data) {
          final cards = <MapEntry<String, String>>[
            MapEntry(context.tr('patients'), '${data['patients'] ?? 0}'),
            MapEntry(context.tr('doctors'), '${data['doctors'] ?? 0}'),
            MapEntry(context.tr('appointmentsToday'), '${data['appointmentsToday'] ?? 0}'),
            MapEntry(context.tr('revenue'), '${data['revenue'] ?? data['invoiceTotal'] ?? 0}'),
          ];
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(dashboardMetricsProvider),
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: cards
                      .map(
                        (card) => SizedBox(
                          width: MediaQuery.sizeOf(context).width > 600
                              ? (MediaQuery.sizeOf(context).width / 2) - 24
                              : double.infinity,
                          child: GlassCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(card.key, style: Theme.of(context).textTheme.bodyMedium),
                                const SizedBox(height: AppSpacing.xs),
                                Text(card.value, style: Theme.of(context).textTheme.headlineSmall),
                              ],
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: AppSpacing.lg),
                GlassCard(
                  child: SizedBox(
                    height: 230,
                    child: LineChart(
                      LineChartData(
                        gridData: const FlGridData(show: false),
                        titlesData: const FlTitlesData(show: false),
                        borderData: FlBorderData(show: false),
                        lineBarsData: [
                          LineChartBarData(
                            isCurved: true,
                            spots: const [
                              FlSpot(0, 1),
                              FlSpot(1, 2),
                              FlSpot(2, 1.5),
                              FlSpot(3, 3),
                              FlSpot(4, 2.3),
                              FlSpot(5, 4),
                            ],
                            barWidth: 4,
                            dotData: const FlDotData(show: false),
                          ),
                        ],
                      ),
                    ),
                  ),
                ).animate().fadeIn(duration: 380.ms),
                const SizedBox(height: AppSpacing.md),
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(context.tr('recentActivity'), style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 10),
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.check_circle_outline),
                        title: Text(context.tr('appointmentCompleted')),
                      ),
                      ListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.person_add_alt_1),
                        title: Text(context.tr('newPatientAdded')),
                      ),
                      Wrap(
                        spacing: 10,
                        children: [
                          Hero(
                            tag: 'doctors_module',
                            child: ActionChip(
                              label: Text(context.tr('doctors')),
                              onPressed: () => context.push('/doctors'),
                            ),
                          ),
                          Hero(
                            tag: 'prescriptions_module',
                            child: ActionChip(
                              label: Text(context.tr('prescriptions')),
                              onPressed: () => context.push('/prescriptions'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
