import 'package:flutter/material.dart';
import 'package:healthcare_crm/core/theme/app_theme.dart';
import 'package:healthcare_crm/core/theme/spacing.dart';

class GlassCard extends StatelessWidget {
  const GlassCard({
    required this.child,
    super.key,
    this.padding = const EdgeInsets.all(AppSpacing.md),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return AppTheme.glassBlur(
      child: Container(
        padding: padding,
        decoration: AppTheme.glassDecoration(context),
        child: child,
      ),
    );
  }
}
