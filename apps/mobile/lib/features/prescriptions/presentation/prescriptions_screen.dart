import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:healthcare_crm/core/localization/app_localizations.dart';
import 'package:healthcare_crm/core/widgets/empty_state.dart';
import 'package:healthcare_crm/core/widgets/glass_card.dart';

final prescriptionsProvider = StateProvider<List<Map<String, dynamic>>>(
  (ref) => const [],
);

class PrescriptionsScreen extends ConsumerWidget {
  const PrescriptionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prescriptions = ref.watch(prescriptionsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Hero(tag: 'prescriptions_module', child: Material(child: Text(context.tr('prescriptions')))),
      ),
      body: prescriptions.isEmpty
          ? EmptyState(
              title: context.tr('noPrescriptionsYet'),
              subtitle: context.tr('noPrescriptionsSubtitle'),
              icon: Icons.medication_outlined,
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: prescriptions.length,
              itemBuilder: (context, index) {
                final p = prescriptions[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: GlassCard(
                    child: ListTile(
                      title: Text(p['medicine']?.toString() ?? context.tr('medicine')),
                      subtitle: Text('${context.tr('dose')}: ${p['dose'] ?? context.tr('na')} • ${p['instructions'] ?? ''}'),
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          final list = [...ref.read(prescriptionsProvider)];
          list.add({
            'medicine': 'Amoxicillin',
            'dose': '500mg',
            'instructions': 'Twice daily after meals',
          });
          ref.read(prescriptionsProvider.notifier).state = list;
        },
        label: Text(context.tr('create')),
        icon: const Icon(Icons.add),
      ),
    );
  }
}
