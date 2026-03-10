import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:healthcare_crm/core/config/app_providers.dart';
import 'package:healthcare_crm/core/localization/app_localizations.dart';
import 'package:healthcare_crm/core/theme/spacing.dart';
import 'package:healthcare_crm/shared/services/crm_repository.dart';
import 'package:healthcare_crm/shared/widgets/async_feature_list.dart';

final patientsControllerProvider = StateNotifierProvider<PatientsController, PatientsState>((ref) {
  return PatientsController(ref.read(crmRepositoryProvider))..loadInitial();
});

class PatientsState {
  const PatientsState({
    this.items = const [],
    this.page = 1,
    this.loading = false,
    this.hasMore = true,
  });

  final List<Map<String, dynamic>> items;
  final int page;
  final bool loading;
  final bool hasMore;

  PatientsState copyWith({
    List<Map<String, dynamic>>? items,
    int? page,
    bool? loading,
    bool? hasMore,
  }) {
    return PatientsState(
      items: items ?? this.items,
      page: page ?? this.page,
      loading: loading ?? this.loading,
      hasMore: hasMore ?? this.hasMore,
    );
  }
}

class PatientsController extends StateNotifier<PatientsState> {
  PatientsController(this._repo) : super(const PatientsState());

  final CrmRepository _repo;

  Future<void> loadInitial() async {
    state = state.copyWith(loading: true, page: 1);
    final list = await _repo.fetchList('/patients', page: 1);
    state = state.copyWith(items: list, page: 1, hasMore: list.isNotEmpty, loading: false);
  }

  Future<void> loadMore() async {
    if (state.loading || !state.hasMore) return;
    state = state.copyWith(loading: true);
    final nextPage = state.page + 1;
    final list = await _repo.fetchList('/patients', page: nextPage);
    final merged = [...state.items, ...list];
    state = state.copyWith(items: merged, page: nextPage, hasMore: list.isNotEmpty, loading: false);
  }
}

class PatientsScreen extends ConsumerStatefulWidget {
  const PatientsScreen({super.key});

  @override
  ConsumerState<PatientsScreen> createState() => _PatientsScreenState();
}

class _PatientsScreenState extends ConsumerState<PatientsScreen> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(() {
      if (_scrollController.position.pixels > _scrollController.position.maxScrollExtent - 240) {
        ref.read(patientsControllerProvider.notifier).loadMore();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(patientsControllerProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('patients')),
        actions: [
          IconButton(
            onPressed: () {
              HapticFeedback.lightImpact();
              context.push('/patients/add');
            },
            icon: const Icon(Icons.person_add_alt_1),
          ),
        ],
      ),
      body: AsyncFeatureList(
        loading: state.loading && state.items.isEmpty,
        items: state.items,
        onRefresh: () => ref.read(patientsControllerProvider.notifier).loadInitial(),
        titleResolver: (item) => item['name']?.toString() ?? item['fullName']?.toString() ?? context.tr('patient'),
        subtitleResolver: (item) => item['phone']?.toString() ?? item['email']?.toString() ?? '',
        emptyTitle: context.tr('noPatientsYet'),
        emptySubtitle: context.tr('noPatientsSubtitle'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/patients/add'),
        label: Text(context.tr('addPatient')),
        icon: const Icon(Icons.add),
      ),
      bottomNavigationBar: state.loading && state.items.isNotEmpty
          ? const Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: LinearProgressIndicator(),
            )
          : null,
    );
  }
}
