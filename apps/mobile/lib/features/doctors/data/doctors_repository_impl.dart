import 'package:healthcare_crm/features/doctors/domain/doctors_repository.dart';
import 'package:healthcare_crm/shared/services/crm_repository.dart';

class DoctorsRepositoryImpl implements DoctorsRepository {
  DoctorsRepositoryImpl(this._repo);
  final CrmRepository _repo;

  @override
  Future<List<Map<String, dynamic>>> getDoctors() => _repo.fetchList('/doctors');
}
