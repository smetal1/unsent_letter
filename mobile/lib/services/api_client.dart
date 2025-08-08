import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:eventsource/eventsource.dart';

class ApiClient {
  static const String _baseUrlKey = 'api_base_url';
  static const String _tokenKey = 'server_jwt';
  static const String _defaultBaseUrl = 'http://localhost:8080';
  
  late final Dio _dio;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  
  String _baseUrl = _defaultBaseUrl;
  String? _token;

  ApiClient() {
    _initializeDio();
    _loadConfiguration();
  }

  void _initializeDio() {
    _dio = Dio();
    
    // Add interceptors
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Add auth token if available
          if (_token != null) {
            options.headers['Authorization'] = 'Bearer $_token';
          }
          
          // Set content type
          options.headers['Content-Type'] = 'application/json';
          
          handler.next(options);
        },
        onError: (error, handler) async {
          // Handle 401 errors by clearing token
          if (error.response?.statusCode == 401) {
            await clearToken();
          }
          handler.next(error);
        },
      ),
    );

    // Configure timeout
    _dio.options.connectTimeout = const Duration(seconds: 10);
    _dio.options.receiveTimeout = const Duration(seconds: 30);
  }

  Future<void> _loadConfiguration() async {
    // Load base URL
    final savedBaseUrl = await _secureStorage.read(key: _baseUrlKey);
    if (savedBaseUrl != null) {
      _baseUrl = savedBaseUrl;
    } else {
      // Auto-detect environment
      _baseUrl = _detectBaseUrl();
      await _secureStorage.write(key: _baseUrlKey, value: _baseUrl);
    }

    // Load saved token
    _token = await _secureStorage.read(key: _tokenKey);
    
    // Update Dio base URL
    _dio.options.baseUrl = _baseUrl;
  }

  String _detectBaseUrl() {
    // Auto-detect based on platform and environment
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:8080'; // Android emulator
    } else if (Platform.isIOS) {
      return 'http://localhost:8080'; // iOS simulator
    }
    return _defaultBaseUrl;
  }

  // Configuration methods
  Future<void> setBaseUrl(String url) async {
    _baseUrl = url;
    _dio.options.baseUrl = url;
    await _secureStorage.write(key: _baseUrlKey, value: url);
  }

  String get baseUrl => _baseUrl;

  Future<void> setToken(String token) async {
    _token = token;
    await _secureStorage.write(key: _tokenKey, value: token);
  }

  Future<void> clearToken() async {
    _token = null;
    await _secureStorage.delete(key: _tokenKey);
  }

  String? get token => _token;
  bool get isAuthenticated => _token != null;

  // Authentication endpoints
  Future<AuthResponse> exchangeToken({
    required String provider,
    required String idToken,
  }) async {
    try {
      final response = await _dio.post(
        '/v1/auth/exchange',
        data: {
          'provider': provider,
          'idToken': idToken,
        },
      );

      final authResponse = AuthResponse.fromJson(response.data);
      await setToken(authResponse.token);
      
      return authResponse;
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> getAuthProviders() async {
    try {
      final response = await _dio.get('/v1/auth/providers');
      return response.data;
    } catch (e) {
      throw _handleError(e);
    }
  }

  // AI endpoints
  Future<AiResponse> getAiReply({
    required List<Message> messages,
    String? provider,
  }) async {
    try {
      final response = await _dio.post(
        '/v1/ai/reply',
        data: {
          'messages': messages.map((m) => m.toJson()).toList(),
          if (provider != null) 'provider': provider,
        },
      );

      return AiResponse.fromJson(response.data);
    } catch (e) {
      throw _handleError(e);
    }
  }

  Stream<String> getAiReplyStream({
    required List<Message> messages,
    String? provider,
  }) async* {
    try {
      final url = '$_baseUrl/v1/ai/reply/stream';
      final headers = <String, String>{
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

      final body = jsonEncode({
        'messages': messages.map((m) => m.toJson()).toList(),
        if (provider != null) 'provider': provider,
      });

      final eventSource = await EventSource.connect(
        url,
        method: 'POST',
        headers: headers,
        body: body,
      );

      await for (final event in eventSource) {
        if (event.event == 'chunk') {
          final data = jsonDecode(event.data ?? '{}');
          final content = data['content'] as String?;
          if (content != null && content.isNotEmpty) {
            yield content;
          }
        } else if (event.event == 'done') {
          break;
        } else if (event.event == 'error') {
          final data = jsonDecode(event.data ?? '{}');
          throw ApiException(
            message: data['error'] ?? 'Stream error',
            code: 'STREAM_ERROR',
          );
        }
      }
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> getAiProviders() async {
    try {
      final response = await _dio.get('/v1/ai/providers');
      return response.data;
    } catch (e) {
      throw _handleError(e);
    }
  }

  // Health and configuration
  Future<Map<String, dynamic>> getHealth() async {
    try {
      final response = await _dio.get('/v1/health');
      return response.data;
    } catch (e) {
      throw _handleError(e);
    }
  }

  Future<Map<String, dynamic>> getPublicConfig() async {
    try {
      final response = await _dio.get('/v1/config/public');
      return response.data;
    } catch (e) {
      throw _handleError(e);
    }
  }

  // Error handling
  ApiException _handleError(dynamic error) {
    if (error is DioException) {
      final response = error.response;
      if (response != null && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        return ApiException(
          message: data['error'] ?? 'Unknown error',
          code: data['code'] ?? 'UNKNOWN_ERROR',
          statusCode: response.statusCode,
          details: data['details'],
        );
      }
      
      return ApiException(
        message: error.message ?? 'Network error',
        code: 'NETWORK_ERROR',
        statusCode: error.response?.statusCode,
      );
    }
    
    return ApiException(
      message: error.toString(),
      code: 'UNKNOWN_ERROR',
    );
  }
}

// Data models
class AuthResponse {
  final String token;
  final int expiresIn;
  final String provider;

  AuthResponse({
    required this.token,
    required this.expiresIn,
    required this.provider,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      token: json['token'],
      expiresIn: json['expiresIn'],
      provider: json['provider'],
    );
  }
}

class AiResponse {
  final String reply;
  final String provider;

  AiResponse({
    required this.reply,
    required this.provider,
  });

  factory AiResponse.fromJson(Map<String, dynamic> json) {
    return AiResponse(
      reply: json['reply'],
      provider: json['provider'],
    );
  }
}

class Message {
  final String role;
  final String content;

  Message({
    required this.role,
    required this.content,
  });

  Map<String, dynamic> toJson() {
    return {
      'role': role,
      'content': content,
    };
  }

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      role: json['role'],
      content: json['content'],
    );
  }
}

class ApiException implements Exception {
  final String message;
  final String code;
  final int? statusCode;
  final dynamic details;

  ApiException({
    required this.message,
    required this.code,
    this.statusCode,
    this.details,
  });

  @override
  String toString() {
    return 'ApiException: $message (code: $code, status: $statusCode)';
  }

  bool get isNetworkError => code == 'NETWORK_ERROR';
  bool get isAuthError => statusCode == 401;
  bool get isRateLimited => code == 'RATE_LIMIT_EXCEEDED';
}