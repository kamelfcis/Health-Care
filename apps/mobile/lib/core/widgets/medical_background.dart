import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:healthcare_crm/core/theme/color_schemes.dart';

class MedicalBackground extends StatelessWidget {
  const MedicalBackground({
    required this.child,
    super.key,
    this.showGradient = true,
  });

  final Widget child;
  final bool showGradient;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        if (showGradient)
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFFFF7ED),
                  Color(0xFFFFEDD5),
                  Color(0xFFFFFBF8),
                ],
              ),
            ),
          ),
        const Positioned(top: 48, left: 20, child: _PlusShape(size: 34)),
        const Positioned(top: 130, right: 24, child: _CapsuleShape()),
        const Positioned(bottom: 170, left: 10, child: _DotsShape()),
        const Positioned(bottom: 90, right: 18, child: _HeartWaveShape()),
        child,
      ],
    );
  }
}

class _PlusShape extends StatelessWidget {
  const _PlusShape({required this.size});
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _PlusPainter()),
    ).animate(onPlay: (controller) => controller.repeat(reverse: true)).fadeIn(duration: 600.ms).scaleXY(begin: 0.9, end: 1.05);
  }
}

class _PlusPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColorSchemes.primaryOrange.withValues(alpha: 0.35)
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(size.width / 2, 4), Offset(size.width / 2, size.height - 4), paint);
    canvas.drawLine(Offset(4, size.height / 2), Offset(size.width - 4, size.height / 2), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _CapsuleShape extends StatelessWidget {
  const _CapsuleShape();

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: 0.35,
      child: Container(
        width: 88,
        height: 30,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: const LinearGradient(
            colors: [Color(0xFFF97316), Color(0xFFEA580C)],
          ),
        ),
        child: Row(
          children: [
            Expanded(child: Container(color: Colors.white.withValues(alpha: 0.25))),
            const VerticalDivider(width: 1, thickness: 1, color: Colors.white38),
            Expanded(child: Container(color: Colors.transparent)),
          ],
        ),
      ).animate().fadeIn(delay: 200.ms, duration: 650.ms).moveY(begin: -6, end: 0),
    );
  }
}

class _DotsShape extends StatelessWidget {
  const _DotsShape();

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: 0.35,
      child: Wrap(
        spacing: 5,
        runSpacing: 5,
        children: List.generate(
          18,
          (index) => Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: Color(0xFFEA580C),
              shape: BoxShape.circle,
            ),
          ),
        ),
      ),
    ).animate().fadeIn(duration: 750.ms);
  }
}

class _HeartWaveShape extends StatelessWidget {
  const _HeartWaveShape();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 120,
      height: 44,
      child: CustomPaint(painter: _WavePainter()),
    ).animate(onPlay: (controller) => controller.repeat()).fadeIn(duration: 550.ms);
  }
}

class _WavePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColorSchemes.primaryOrangeDark.withValues(alpha: 0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    final path = Path()
      ..moveTo(0, size.height * 0.6)
      ..lineTo(size.width * 0.2, size.height * 0.6)
      ..lineTo(size.width * 0.35, size.height * 0.25)
      ..lineTo(size.width * 0.47, size.height * 0.85)
      ..lineTo(size.width * 0.62, size.height * 0.45)
      ..lineTo(size.width, size.height * 0.45);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
