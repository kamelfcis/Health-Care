import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:healthcare_crm/core/localization/app_localizations.dart';
import 'package:healthcare_crm/core/widgets/glass_card.dart';

final notificationsProvider = StateProvider<List<String>>((ref) {
  return const [
    'notifReminderSarah',
    'notifNewPatientPortal',
    'notifDoctorScheduleUpdated',
  ];
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('notifications'))),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        itemBuilder: (context, index) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: GlassCard(
              child: ListTile(
                leading: const Icon(Icons.notifications_active_outlined),
                title: Text(context.tr(items[index])),
                subtitle: Text(context.tr('pushReadyReminder')),
                onTap: () => HapticFeedback.selectionClick(),
              ),
            ),
          );
        },
      ),
    );
  }
}
