import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../services/api_client.dart';

enum AuthProvider { google, apple }

class AuthState {
  final bool isAuthenticated;
  final bool isLoading;
  final String? error;
  final String? userId;
  final String? provider;

  const AuthState({
    this.isAuthenticated = false,
    this.isLoading = false,
    this.error,
    this.userId,
    this.provider,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isLoading,
    String? error,
    String? userId,
    String? provider,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      userId: userId ?? this.userId,
      provider: provider ?? this.provider,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _apiClient;
  late final GoogleSignIn _googleSignIn;

  AuthNotifier(this._apiClient) : super(const AuthState()) {
    _initializeGoogleSignIn();
    _checkAuthStatus();
  }

  void _initializeGoogleSignIn() {
    _googleSignIn = GoogleSignIn(
      scopes: ['email', 'profile'],
      // Add your client IDs here - these should match your server configuration
      // serverClientId: 'your-server-client-id.apps.googleusercontent.com',
    );
  }

  Future<void> _checkAuthStatus() async {
    if (_apiClient.isAuthenticated) {
      try {
        // Verify token is still valid by making a test API call
        await _apiClient.getHealth();
        state = state.copyWith(isAuthenticated: true);
      } catch (e) {
        // Token is invalid, clear it
        await _apiClient.clearToken();
        state = state.copyWith(isAuthenticated: false);
      }
    }
  }

  Future<void> signInWithGoogle() async {
    if (!await _isGoogleSignInAvailable()) {
      state = state.copyWith(
        error: 'Google Sign-In is not available on this platform',
      );
      return;
    }

    state = state.copyWith(isLoading: true, error: null);

    try {
      // Sign in with Google
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        // User cancelled the sign-in
        state = state.copyWith(isLoading: false);
        return;
      }

      // Get authentication details
      final GoogleSignInAuthentication googleAuth = 
          await googleUser.authentication;

      final String? idToken = googleAuth.idToken;
      if (idToken == null) {
        throw Exception('Failed to get ID token from Google');
      }

      // Exchange ID token for server JWT
      final authResponse = await _apiClient.exchangeToken(
        provider: 'google',
        idToken: idToken,
      );

      state = state.copyWith(
        isAuthenticated: true,
        isLoading: false,
        userId: googleUser.id,
        provider: 'google',
      );

      debugPrint('Google Sign-In successful: ${googleUser.email}');
    } catch (e) {
      debugPrint('Google Sign-In failed: $e');
      state = state.copyWith(
        isLoading: false,
        error: _getErrorMessage(e),
      );
      
      // Clean up Google sign-in state on error
      await _googleSignIn.signOut();
    }
  }

  Future<void> signInWithApple() async {
    if (!await _isAppleSignInAvailable()) {
      state = state.copyWith(
        error: 'Sign in with Apple is not available on this platform',
      );
      return;
    }

    state = state.copyWith(isLoading: true, error: null);

    try {
      // Sign in with Apple
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        // Add your service ID here if using web
        // webAuthenticationOptions: WebAuthenticationOptions(
        //   clientId: 'com.example.unsentletters.service',
        //   redirectUri: Uri.parse('https://your-domain.com/auth/callback'),
        // ),
      );

      final String? identityToken = credential.identityToken;
      if (identityToken == null) {
        throw Exception('Failed to get identity token from Apple');
      }

      // Exchange identity token for server JWT
      final authResponse = await _apiClient.exchangeToken(
        provider: 'apple',
        idToken: identityToken,
      );

      state = state.copyWith(
        isAuthenticated: true,
        isLoading: false,
        userId: credential.userIdentifier,
        provider: 'apple',
      );

      debugPrint('Apple Sign-In successful: ${credential.email ?? 'No email'}');
    } catch (e) {
      debugPrint('Apple Sign-In failed: $e');
      state = state.copyWith(
        isLoading: false,
        error: _getErrorMessage(e),
      );
    }
  }

  Future<void> signOut() async {
    state = state.copyWith(isLoading: true);

    try {
      // Clear server token
      await _apiClient.clearToken();

      // Sign out from providers
      if (state.provider == 'google') {
        await _googleSignIn.signOut();
      }
      // Note: Apple doesn't provide a sign-out method

      state = const AuthState();
      debugPrint('Sign out successful');
    } catch (e) {
      debugPrint('Sign out error: $e');
      // Force sign out even if there's an error
      state = const AuthState();
    }
  }

  void clearError() {
    state = state.copyWith(error: null);
  }

  Future<bool> _isGoogleSignInAvailable() async {
    // Google Sign-In is available on Android and iOS
    return Platform.isAndroid || Platform.isIOS;
  }

  Future<bool> _isAppleSignInAvailable() async {
    if (!Platform.isIOS && !Platform.isMacOS) {
      return false;
    }

    try {
      return await SignInWithApple.isAvailable();
    } catch (e) {
      debugPrint('Error checking Apple Sign-In availability: $e');
      return false;
    }
  }

  String _getErrorMessage(dynamic error) {
    if (error is ApiException) {
      switch (error.code) {
        case 'GOOGLE_NOT_CONFIGURED':
          return 'Google Sign-In is not configured on the server';
        case 'APPLE_NOT_CONFIGURED':
          return 'Apple Sign-In is not configured on the server';
        case 'AUTH_FAILED':
          return 'Authentication failed. Please try again.';
        case 'NETWORK_ERROR':
          return 'Network error. Please check your connection.';
        default:
          return error.message;
      }
    }

    if (error.toString().contains('network_error')) {
      return 'Network error. Please check your connection.';
    }

    if (error.toString().contains('sign_in_canceled')) {
      return 'Sign-in was cancelled';
    }

    return 'Authentication failed. Please try again.';
  }

  // Check if specific providers are available
  Future<bool> get isGoogleSignInAvailable => _isGoogleSignInAvailable();
  Future<bool> get isAppleSignInAvailable => _isAppleSignInAvailable();
}

// Provider
final authNotifierProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final apiClient = ref.read(apiClientProvider);
  return AuthNotifier(apiClient);
});

// API Client provider (to be defined in providers.dart)
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient();
});