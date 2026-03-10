import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:healthcare_crm/core/constants/app_constants.dart';
import 'package:healthcare_crm/shared/services/providers.dart';

final localeControllerProvider = StateNotifierProvider<LocaleController, LocaleState>((ref) {
  return LocaleController(ref);
});

class LocaleState {
  const LocaleState({
    required this.locale,
    required this.isSelected,
  });

  final Locale locale;
  final bool isSelected;

  LocaleState copyWith({Locale? locale, bool? isSelected}) {
    return LocaleState(
      locale: locale ?? this.locale,
      isSelected: isSelected ?? this.isSelected,
    );
  }
}

class LocaleController extends StateNotifier<LocaleState> {
  LocaleController(this._ref)
      : super(
          const LocaleState(
            locale: Locale('en'),
            isSelected: false,
          ),
        ) {
    _load();
  }

  final Ref _ref;

  void _load() {
    final code = _ref.read(cacheServiceProvider).get<String>(AppConstants.localeCodeKey);
    if (code == null || code.isEmpty) return;
    state = state.copyWith(locale: Locale(code), isSelected: true);
  }

  Future<void> selectLocale(String languageCode) async {
    await _ref.read(cacheServiceProvider).put(AppConstants.localeCodeKey, languageCode);
    state = state.copyWith(locale: Locale(languageCode), isSelected: true);
  }
}
