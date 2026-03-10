import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:healthcare_crm/core/theme/spacing.dart';
import 'package:healthcare_crm/core/widgets/empty_state.dart';
import 'package:healthcare_crm/core/widgets/glass_card.dart';
import 'package:healthcare_crm/core/widgets/skeleton_loader.dart';

class AsyncFeatureList extends StatelessWidget {
  const AsyncFeatureList({
    required this.items,
    required this.loading,
    required this.onRefresh,
    required this.titleResolver,
    super.key,
    this.subtitleResolver,
    this.emptyTitle = 'No data yet',
    this.emptySubtitle = 'Try refreshing or add your first item.',
  });

  final List<Map<String, dynamic>> items;
  final bool loading;
  final Future<void> Function() onRefresh;
  final String Function(Map<String, dynamic>) titleResolver;
  final String Function(Map<String, dynamic>)? subtitleResolver;
  final String emptyTitle;
  final String emptySubtitle;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemBuilder: (context, index) => const SkeletonLoader(),
        separatorBuilder: (context, index) => const SizedBox(height: AppSpacing.sm),
        itemCount: 8,
      );
    }
    if (items.isEmpty) {
      return EmptyState(title: emptyTitle, subtitle: emptySubtitle);
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: items.length,
        separatorBuilder: (context, index) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, index) {
          final item = items[index];
          return Dismissible(
            key: ValueKey('${titleResolver(item)}_$index'),
            background: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                color: Theme.of(context).colorScheme.errorContainer,
              ),
              alignment: Alignment.centerLeft,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: const Icon(Icons.delete_outline),
            ),
            secondaryBackground: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                color: Theme.of(context).colorScheme.primaryContainer,
              ),
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: const Icon(Icons.edit_outlined),
            ),
            confirmDismiss: (_) async {
              HapticFeedback.mediumImpact();
              return false;
            },
            child: GlassCard(
              child: ListTile(
                title: Text(titleResolver(item)),
                subtitle: subtitleResolver == null ? null : Text(subtitleResolver!(item)),
                trailing: const Icon(Icons.chevron_right),
              ),
            ),
          ).animate().fadeIn(duration: 240.ms, delay: (index * 40).ms).slideX(begin: 0.08);
        },
      ),
    );
  }
}
