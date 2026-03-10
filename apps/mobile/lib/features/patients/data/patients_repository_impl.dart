import 'package:healthcare_crm/features/patients/domain/patients_repository.dart';
import 'package:healthcare_crm/shared/services/crm_repository.dart';

class PatientsRepositoryImpl implements PatientsRepository {
  PatientsRepositoryImpl(this._repo);
  final CrmRepository _repo;

  @override
  Future<List<Map<String, dynamic>>> getPatients({int page = 1, String? search}) =>
      _repo.fetchList('/patients', page: page, search: search);
}
