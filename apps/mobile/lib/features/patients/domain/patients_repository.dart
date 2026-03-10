abstract class PatientsRepository {
  Future<List<Map<String, dynamic>>> getPatients({int page = 1, String? search});
}
