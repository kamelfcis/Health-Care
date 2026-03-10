import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:healthcare_crm/core/constants/app_constants.dart';
import 'package:healthcare_crm/shared/services/providers.dart';

final onboardingDoneProvider = FutureProvider<bool>((ref) async {
  final cached = ref.read(cacheServiceProvider).get<bool>(AppConstants.onboardingDoneKey);
  return cached ?? false;
});

final onboardingControllerProvider = Provider<OnboardingController>((ref) {
  return OnboardingController(ref);
});

class OnboardingController {
  OnboardingController(this._ref);

  final Ref _ref;

  Future<bool> isDone() async {
    return _ref.read(cacheServiceProvider).get<bool>(AppConstants.onboardingDoneKey) ?? false;
  }

  Future<void> complete() async {
    await _ref.read(cacheServiceProvider).put(AppConstants.onboardingDoneKey, true);
  }
}
