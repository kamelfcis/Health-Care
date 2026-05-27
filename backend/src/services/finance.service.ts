import { ExpenseCategory, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";

const EXPENSE_CATEGORIES = Object.values(ExpenseCategory);

export function parseDateRange(from?: string, to?: string) {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : defaultFrom;
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : defaultTo;
  return { from: fromDate, to: toDate };
}

function paymentInRangeWhere(clinicId: string | undefined, from: Date, to: Date): Prisma.PaymentWhereInput {
  const clinicFilter = clinicId ? { clinicId } : {};
  return {
    ...clinicFilter,
    deletedAt: null,
    status: "SUCCESS",
    OR: [
      { paidAt: { gte: from, lte: to } },
      { paidAt: null, createdAt: { gte: from, lte: to } }
    ]
  };
}

function expenseInRangeWhere(clinicId: string | undefined, from: Date, to: Date): Prisma.ClinicExpenseWhereInput {
  return {
    ...(clinicId ? { clinicId } : {}),
    deletedAt: null,
    expenseDate: { gte: from, lte: to }
  };
}

interface ListRevenuesInput {
  clinicId?: string;
  page: number;
  pageSize: number;
  search?: string;
  from?: string;
  to?: string;
}

interface ListExpensesInput {
  clinicId?: string;
  page: number;
  pageSize: number;
  search?: string;
  category?: ExpenseCategory;
  from?: string;
  to?: string;
}

export const financeService = {
  async summary(clinicId: string | undefined, from?: string, to?: string) {
    const { from: fromDate, to: toDate } = parseDateRange(from, to);
    const paymentWhere = paymentInRangeWhere(clinicId, fromDate, toDate);
    const expenseWhere = expenseInRangeWhere(clinicId, fromDate, toDate);

    const [revenueAgg, revenueCount, expenseAgg, expenseCount, expensesByCategory] = await Promise.all([
      prisma.payment.aggregate({ where: paymentWhere, _sum: { amount: true } }),
      prisma.payment.count({ where: paymentWhere }),
      prisma.clinicExpense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
      prisma.clinicExpense.count({ where: expenseWhere }),
      prisma.clinicExpense.groupBy({
        by: ["category"],
        where: expenseWhere,
        _sum: { amount: true }
      })
    ]);

    const revenueTotal = revenueAgg._sum.amount ?? 0;
    const expenseTotal = expenseAgg._sum.amount ?? 0;
    const expensesByCategoryMap: Record<ExpenseCategory, number> = Object.fromEntries(
      EXPENSE_CATEGORIES.map((cat) => [cat, 0])
    ) as Record<ExpenseCategory, number>;
    for (const row of expensesByCategory) {
      expensesByCategoryMap[row.category] = row._sum.amount ?? 0;
    }

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      revenueTotal,
      expenseTotal,
      netProfit: revenueTotal - expenseTotal,
      expensesByCategory: expensesByCategoryMap,
      revenueCount,
      expenseCount
    };
  },

  async listRevenues(input: ListRevenuesInput) {
    const { from: fromDate, to: toDate } = parseDateRange(input.from, input.to);
    const normalizedSearch = input.search?.trim();
    const baseWhere = paymentInRangeWhere(input.clinicId, fromDate, toDate);
    const where: Prisma.PaymentWhereInput = {
      ...baseWhere,
      ...(normalizedSearch
        ? {
            OR: [
              { transactionRef: { contains: normalizedSearch, mode: "insensitive" } },
              { invoice: { invoiceNumber: { contains: normalizedSearch, mode: "insensitive" } } },
              {
                invoice: {
                  is: {
                    patient: { fullName: { contains: normalizedSearch, mode: "insensitive" } }
                  }
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: {
            include: {
              patient: { select: { id: true, fullName: true } }
            }
          }
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }]
      }),
      prisma.payment.count({ where })
    ]);

    const data = items.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      paidAt: p.paidAt ?? p.createdAt,
      transactionRef: p.transactionRef,
      invoiceId: p.invoiceId,
      invoiceNumber: p.invoice.invoiceNumber,
      patientId: p.invoice.patientId,
      patientName: p.invoice.patient.fullName
    }));

    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  async listExpenses(input: ListExpensesInput) {
    const { from: fromDate, to: toDate } = parseDateRange(input.from, input.to);
    const normalizedSearch = input.search?.trim();
    const where: Prisma.ClinicExpenseWhereInput = {
      ...expenseInRangeWhere(input.clinicId, fromDate, toDate),
      ...(input.category ? { category: input.category } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { title: { contains: normalizedSearch, mode: "insensitive" } },
              { notes: { contains: normalizedSearch, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      prisma.clinicExpense.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } }
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { expenseDate: "desc" }
      }),
      prisma.clinicExpense.count({ where })
    ]);

    const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
    return { data: items, total, page: input.page, pageSize: input.pageSize, totalPages };
  },

  async expenseStats(clinicId: string | undefined, from?: string, to?: string) {
    const { from: fromDate, to: toDate } = parseDateRange(from, to);
    const where = expenseInRangeWhere(clinicId, fromDate, toDate);
    const grouped = await prisma.clinicExpense.groupBy({
      by: ["category"],
      where,
      _sum: { amount: true },
      _count: true
    });
    const total = grouped.reduce((s: number, g) => s + (g._sum.amount ?? 0), 0);
    return {
      total,
      byCategory: grouped.map((g: (typeof grouped)[number]) => ({
        category: g.category,
        amount: g._sum.amount ?? 0,
        count: g._count
      }))
    };
  },

  async createExpense(
    clinicId: string,
    userId: string | undefined,
    data: {
      title: string;
      category: ExpenseCategory;
      amount: number;
      expenseDate: string;
      notes?: string;
    }
  ) {
    return prisma.clinicExpense.create({
      data: {
        clinicId,
        title: data.title.trim(),
        category: data.category,
        amount: data.amount,
        expenseDate: new Date(data.expenseDate),
        notes: data.notes?.trim() || null,
        createdById: userId ?? null
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  },

  async updateExpense(
    id: string,
    clinicId: string | undefined,
    data: {
      title?: string;
      category?: ExpenseCategory;
      amount?: number;
      expenseDate?: string;
      notes?: string | null;
    }
  ) {
    const existing = await prisma.clinicExpense.findFirst({
      where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null }
    });
    if (!existing) {
      throw new AppError("Expense not found", 404);
    }

    return prisma.clinicExpense.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.expenseDate !== undefined ? { expenseDate: new Date(data.expenseDate) } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {})
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  },

  async removeExpense(id: string, clinicId: string | undefined) {
    const existing = await prisma.clinicExpense.findFirst({
      where: { id, ...(clinicId ? { clinicId } : {}), deletedAt: null }
    });
    if (!existing) {
      throw new AppError("Expense not found", 404);
    }
    await prisma.clinicExpense.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() }
    });
    return { ok: true };
  }
};
