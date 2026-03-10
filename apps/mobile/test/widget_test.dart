import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:healthcare_crm/core/widgets/glass_card.dart';

void main() {
  testWidgets('GlassCard renders child', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: GlassCard(child: Text('Healthcare')),
        ),
      ),
    );

    expect(find.text('Healthcare'), findsOneWidget);
  });
}
