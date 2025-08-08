import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../state/auth_notifier.dart';

class LoginPage extends HookConsumerWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final authNotifier = ref.read(authNotifierProvider.notifier);
    
    final googleAvailable = useState<bool?>(null);
    final appleAvailable = useState<bool?>(null);

    useEffect(() {
      // Check provider availability
      Future.microtask(() async {
        googleAvailable.value = await authNotifier.isGoogleSignInAvailable;
        appleAvailable.value = await authNotifier.isAppleSignInAvailable;
      });
      return null;
    }, []);

    // Clear error when widget rebuilds
    useEffect(() {
      if (authState.error != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(authState.error!),
                backgroundColor: Colors.red,
                behavior: SnackBarBehavior.floating,
              ),
            );
            authNotifier.clearError();
          }
        });
      }
      return null;
    }, [authState.error]);

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF667eea),
              Color(0xFF764ba2),
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Spacer(flex: 2),
                
                // App Icon and Title
                Column(
                  children: [
                    Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(
                        Icons.mail_outline,
                        size: 50,
                        color: Colors.white,
                      ),
                    ).animate().scale(
                      duration: 600.ms,
                      curve: Curves.elasticOut,
                    ),
                    
                    const SizedBox(height: 24),
                    
                    const Text(
                      'Unsent Letters',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ).animate().fadeIn(delay: 200.ms).slideY(
                      begin: 0.3,
                      duration: 600.ms,
                      curve: Curves.easeOut,
                    ),
                    
                    const SizedBox(height: 12),
                    
                    Text(
                      'Write letters to anyone, receive thoughtful AI responses',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        color: Colors.white.withOpacity(0.9),
                      ),
                    ).animate().fadeIn(delay: 400.ms).slideY(
                      begin: 0.3,
                      duration: 600.ms,
                      curve: Curves.easeOut,
                    ),
                  ],
                ),
                
                const Spacer(flex: 1),
                
                // Sign-in buttons
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (googleAvailable.value == true)
                      _SignInButton(
                        onPressed: authState.isLoading ? null : () {
                          authNotifier.signInWithGoogle();
                        },
                        icon: Icons.g_mobiledata,
                        label: 'Continue with Google',
                        backgroundColor: Colors.white,
                        textColor: Colors.black87,
                        isLoading: authState.isLoading,
                      ).animate().fadeIn(delay: 600.ms).slideX(
                        begin: -0.3,
                        duration: 600.ms,
                        curve: Curves.easeOut,
                      ),
                    
                    if (googleAvailable.value == true && appleAvailable.value == true)
                      const SizedBox(height: 16),
                    
                    if (appleAvailable.value == true)
                      _SignInButton(
                        onPressed: authState.isLoading ? null : () {
                          authNotifier.signInWithApple();
                        },
                        icon: Icons.apple,
                        label: 'Continue with Apple',
                        backgroundColor: Colors.black,
                        textColor: Colors.white,
                        isLoading: authState.isLoading,
                      ).animate().fadeIn(delay: 700.ms).slideX(
                        begin: 0.3,
                        duration: 600.ms,
                        curve: Curves.easeOut,
                      ),
                    
                    if (googleAvailable.value == false && appleAvailable.value == false)
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: Colors.orange.withOpacity(0.3),
                          ),
                        ),
                        child: const Text(
                          'No sign-in providers are available on this platform. Please check your configuration.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                          ),
                        ),
                      ).animate().fadeIn(delay: 600.ms),
                  ],
                ),
                
                const SizedBox(height: 32),
                
                // Privacy notice
                Text(
                  'Your letters are stored locally and encrypted.\nWe never see or store your personal content.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withOpacity(0.7),
                  ),
                ).animate().fadeIn(delay: 800.ms),
                
                const Spacer(flex: 2),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SignInButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final IconData icon;
  final String label;
  final Color backgroundColor;
  final Color textColor;
  final bool isLoading;

  const _SignInButton({
    required this.onPressed,
    required this.icon,
    required this.label,
    required this.backgroundColor,
    required this.textColor,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor,
          foregroundColor: textColor,
          elevation: 2,
          shadowColor: Colors.black.withOpacity(0.1),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: isLoading
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(textColor),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 24),
                  const SizedBox(width: 12),
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}