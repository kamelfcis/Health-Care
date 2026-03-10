class NotificationService {
  const NotificationService();

  Future<void> initialize() async {
    // Placeholder for Firebase/APNS setup.
  }

  Future<void> scheduleAppointmentReminder({
    required String appointmentId,
    required DateTime triggerAt,
  }) async {
    // Wire local/push scheduling here.
  }
}
