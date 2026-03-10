class AppUser {
  const AppUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.role,
    required this.permissions,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String role;
  final List<String> permissions;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id']?.toString() ?? '',
      firstName: json['firstName']?.toString() ?? '',
      lastName: json['lastName']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
      permissions: (json['permissions'] as List? ?? const []).map((e) => e.toString()).toList(),
    );
  }
}
