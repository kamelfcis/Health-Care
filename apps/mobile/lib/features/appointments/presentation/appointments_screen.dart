import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:healthcare_crm/core/config/app_providers.dart';
import 'package:healthcare_crm/core/localization/app_localizations.dart';
import 'package:healthcare_crm/shared/widgets/async_feature_list.dart';

final appointmentsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return ref.watch(crmRepositoryProvider).fetchList('/appointments');
});

class AppointmentsScreen extends ConsumerWidget {
  const AppointmentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appointments = ref.watch(appointmentsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('appointments')),
        actions: [
          IconButton(onPressed: () => context.push('/appointments/create'), icon: const Icon(Icons.add_circle_outline)),
        ],
      ),
      body: appointments.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => Center(child: Text(context.tr('unableToLoadAppointments'))),
        data: (data) => AsyncFeatureList(
          loading: false,
          items: data,
          onRefresh: () async => ref.invalidate(appointmentsProvider),
          titleResolver: (item) => item['title']?.toString() ?? item['status']?.toString() ?? context.tr('appointment'),
          subtitleResolver: (item) =>
              '${item['scheduledAt'] ?? item['date'] ?? ''}  •  ${item['status'] ?? context.tr('pending')}',
          emptyTitle: context.tr('noAppointments'),
          emptySubtitle: context.tr('noAppointmentsSubtitle'),
        ),
      ),
    );
  }
}

class AppointmentFormScreen extends ConsumerWidget {
  const AppointmentFormScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ValueNotifier<String>('Scheduled');
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('createAppointment'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ListTile(
            tileColor: Theme.of(context).colorScheme.surfaceContainer,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            title: Text(context.tr('calendarView')),
            subtitle: Text(context.tr('calendarViewSubtitle')),
            trailing: const Icon(Icons.calendar_month_outlined),
            onTap: () {},
          ),
          const SizedBox(height: 16),
          ValueListenableBuilder<String>(
            valueListenable: status,
            builder: (context, current, child) => DropdownButtonFormField<String>(
              initialValue: current,
              items: [
                DropdownMenuItem(value: 'Scheduled', child: Text(context.tr('scheduled'))),
                DropdownMenuItem(value: 'CheckedIn', child: Text(context.tr('checkedIn'))),
                DropdownMenuItem(value: 'Completed', child: Text(context.tr('completed'))),
                DropdownMenuItem(value: 'Cancelled', child: Text(context.tr('cancelled'))),
              ],
              onChanged: (value) => status.value = value ?? 'Scheduled',
              decoration: InputDecoration(labelText: context.tr('appointmentStatus')),
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () async {
              await ref.read(crmRepositoryProvider).create('/appointments', {'status': status.value});
              if (context.mounted) context.pop();
            },
            child: Text(context.tr('saveAppointment')),
          ),
        ],
      ),
    );
  }
}
