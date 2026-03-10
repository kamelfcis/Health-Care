abstract class AppointmentsRepository {
  Future<List<Map<String, dynamic>>> getAppointments({int page = 1});
}
