import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:healthcare_crm/core/config/app_providers.dart';
import 'package:healthcare_crm/core/localization/app_localizations.dart';
import 'package:reactive_forms/reactive_forms.dart';

class PatientFormScreen extends ConsumerWidget {
  const PatientFormScreen({super.key, this.patientId});

  final String? patientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final form = FormGroup({
      'name': FormControl<String>(validators: [Validators.required]),
      'phone': FormControl<String>(validators: [Validators.required]),
      'email': FormControl<String>(),
      'notes': FormControl<String>(),
    });
    return Scaffold(
      appBar: AppBar(title: Text(patientId == null ? context.tr('addPatient') : context.tr('editPatient'))),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: ReactiveForm(
          formGroup: form,
          child: ListView(
            children: [
              ReactiveTextField<String>(formControlName: 'name', decoration: InputDecoration(labelText: context.tr('name'))),
              const SizedBox(height: 12),
              ReactiveTextField<String>(formControlName: 'phone', decoration: InputDecoration(labelText: context.tr('phone'))),
              const SizedBox(height: 12),
              ReactiveTextField<String>(formControlName: 'email', decoration: InputDecoration(labelText: context.tr('email'))),
              const SizedBox(height: 12),
              ReactiveTextField<String>(
                formControlName: 'notes',
                decoration: InputDecoration(labelText: context.tr('medicalHistoryNotes')),
                maxLines: 4,
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () async {
                  if (!form.valid) {
                    form.markAllAsTouched();
                    return;
                  }
                  final body = {
                    'name': form.control('name').value,
                    'phone': form.control('phone').value,
                    'email': form.control('email').value,
                    'notes': form.control('notes').value,
                  };
                  final repo = ref.read(crmRepositoryProvider);
                  if (patientId == null) {
                    await repo.create('/patients', body.cast<String, dynamic>());
                  } else {
                    await repo.update('/patients/$patientId', body.cast<String, dynamic>());
                  }
                  if (context.mounted) {
                    context.pop();
                  }
                },
                child: Text(context.tr('save')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
