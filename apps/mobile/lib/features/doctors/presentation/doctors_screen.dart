import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:healthcare_crm/core/config/app_providers.dart';
import 'package:healthcare_crm/core/localization/app_localizations.dart';
import 'package:healthcare_crm/shared/widgets/async_feature_list.dart';

final doctorsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return ref.watch(crmRepositoryProvider).fetchList('/doctors');
});

class DoctorsScreen extends ConsumerWidget {
  const DoctorsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doctors = ref.watch(doctorsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Hero(tag: 'doctors_module', child: Material(child: Text(context.tr('doctors')))),
      ),
      body: doctors.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stackTrace) => Center(child: Text(context.tr('unableToLoadDoctors'))),
        data: (data) => AsyncFeatureList(
          loading: false,
          items: data,
          onRefresh: () async => ref.invalidate(doctorsProvider),
          titleResolver: (item) =>
              item['name']?.toString() ?? '${item['firstName'] ?? ''} ${item['lastName'] ?? ''}'.trim(),
          subtitleResolver: (item) =>
              '${context.tr('specialty')}: ${item['specialty'] ?? item['specialtyCode'] ?? context.tr('general')} • ${context.tr('scheduleReady')}',
          emptyTitle: context.tr('noDoctors'),
          emptySubtitle: context.tr('noDoctorsSubtitle'),
        ),
      ),
    );
  }
}
