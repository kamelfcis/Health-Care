import 'package:healthcare_crm/features/dashboard/domain/dashboard_repository.dart';
import 'package:healthcare_crm/shared/services/crm_repository.dart';

class DashboardRepositoryImpl implements DashboardRepository {
  DashboardRepositoryImpl(this._repo);
  final CrmRepository _repo;

  @override
  Future<Map<String, dynamic>> getMetrics() => _repo.fetchOne('/dashboard/metrics');
}
