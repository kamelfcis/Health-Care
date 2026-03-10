import 'package:healthcare_crm/features/appointments/domain/appointments_repository.dart';
import 'package:healthcare_crm/shared/services/crm_repository.dart';

class AppointmentsRepositoryImpl implements AppointmentsRepository {
  AppointmentsRepositoryImpl(this._repo);
  final CrmRepository _repo;

  @override
  Future<List<Map<String, dynamic>>> getAppointments({int page = 1}) =>
      _repo.fetchList('/appointments', page: page);
}
