import 'package:hive_flutter/hive_flutter.dart';

class CacheService {
  CacheService(this._box);

  final Box<dynamic> _box;

  T? get<T>(String key) => _box.get(key) as T?;
  Future<void> put(String key, dynamic value) => _box.put(key, value);
  Future<void> delete(String key) => _box.delete(key);
  Future<void> clear() => _box.clear();
}
