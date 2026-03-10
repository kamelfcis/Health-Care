import 'package:intl/intl.dart';

class AppDateUtils {
  const AppDateUtils._();

  static String short(DateTime date) => DateFormat('dd MMM yyyy').format(date);
  static String withTime(DateTime date) => DateFormat('dd MMM yyyy, hh:mm a').format(date);
}
