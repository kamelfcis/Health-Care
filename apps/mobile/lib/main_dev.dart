import 'package:healthcare_crm/core/config/bootstrap.dart';
import 'package:healthcare_crm/core/config/flavor_config.dart';

Future<void> main() async {
  await bootstrap(flavor: AppFlavor.dev);
}
