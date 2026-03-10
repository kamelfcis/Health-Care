import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:healthcare_crm/core/theme/color_schemes.dart';

class AnimatedLogoCircle extends StatelessWidget {
  const AnimatedLogoCircle({
    super.key,
    this.size = 132,
    this.animationIntensity = 1,
    this.showOuterGlow = true,
  });

  final double size;
  final double animationIntensity;
  final bool showOuterGlow;

  @override
  Widget build(BuildContext context) {
    final safeIntensity = animationIntensity.clamp(0.5, 2.0);
    final glowSize = size + (20 * safeIntensity);
    final shadowBlur = 20 * safeIntensity;

    return Stack(
      alignment: Alignment.center,
      children: [
        if (showOuterGlow)
          Container(
            width: glowSize,
            height: glowSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  AppColorSchemes.primaryOrange.withValues(alpha: 0.22),
                  AppColorSchemes.primaryOrangeDark.withValues(alpha: 0.07),
                  Colors.transparent,
                ],
              ),
            ),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .scaleXY(begin: 0.92, end: 1.04, duration: 1800.ms, curve: Curves.easeInOut),
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFF97316), Color(0xFFEA580C)],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColorSchemes.primaryOrangeDark.withValues(alpha: 0.25),
                blurRadius: shadowBlur,
                spreadRadius: 1.5,
                offset: const Offset(0, 9),
              ),
            ],
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.55),
              width: 2,
            ),
          ),
          padding: const EdgeInsets.all(4),
          child: ClipOval(
            child: Image.asset(
              'assets/images/healthcare.jpeg',
              fit: BoxFit.cover,
            ),
          ),
        )
            .animate()
            .fadeIn(duration: 420.ms)
            .scaleXY(begin: 0.86, end: 1, duration: 520.ms, curve: Curves.easeOutBack)
            .rotate(begin: -0.012 * safeIntensity, end: 0, duration: 420.ms)
            .then()
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .moveY(begin: 0, end: -6 * safeIntensity, duration: 1700.ms, curve: Curves.easeInOut)
            .scaleXY(begin: 1, end: 1.03, duration: 1700.ms, curve: Curves.easeInOut),
        if (showOuterGlow)
          Positioned(
            top: size * 0.09,
            left: size * 0.21,
            child: Transform.rotate(
              angle: -math.pi / 8,
              child: Container(
                width: size * 0.26,
                height: size * 0.08,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(30),
                  color: Colors.white.withValues(alpha: 0.35),
                ),
              ),
            ),
          ).animate().fadeIn(duration: 500.ms),
      ],
    );
  }
}
