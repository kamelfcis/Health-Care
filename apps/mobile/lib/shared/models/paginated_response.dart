class PaginatedResponse<T> {
  const PaginatedResponse({
    required this.data,
    required this.total,
    required this.page,
    required this.pageSize,
    required this.totalPages,
  });

  final List<T> data;
  final int total;
  final int page;
  final int pageSize;
  final int totalPages;
}
