import path from "path";
import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_CATALOG, SYSTEM_ROLE_NAMES } from "../src/constants/permissions";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();
const asJson = (value: unknown) => (value === undefined ? undefined : (value as Prisma.InputJsonValue));

const DEFAULT_SPECIALTIES = [
  { code: "ANDROLOGY", name: "Andrology", nameAr: "التناسلية", description: "Male infertility and reproductive health" },
  { code: "GYNECOLOGY", name: "Gynecology", nameAr: "نساء وتوليد", description: "Female reproductive health" },
  { code: "CARDIOLOGY", name: "Cardiology", nameAr: "القلب", description: "Heart and vascular care" },
  { code: "DERMATOLOGY", name: "Dermatology", nameAr: "الجلدية", description: "Skin and hair diseases" },
  { code: "PEDIATRICS", name: "Pediatrics", nameAr: "الأطفال", description: "Child healthcare" },
  { code: "ENT", name: "ENT", nameAr: "أنف وأذن وحنجرة", description: "Ear, nose and throat" },
  { code: "OPHTHALMOLOGY", name: "Ophthalmology", nameAr: "العيون", description: "Eye care" },
  { code: "ORTHOPEDICS", name: "Orthopedics", nameAr: "العظام", description: "Bones and joints" },
  { code: "UROLOGY", name: "Urology", nameAr: "المسالك البولية", description: "Urinary tract care" },
  { code: "NEUROLOGY", name: "Neurology", nameAr: "المخ والأعصاب", description: "Nervous system care" },
  { code: "ENDOCRINOLOGY", name: "Endocrinology", nameAr: "الغدد الصماء", description: "Hormonal disorders" },
  { code: "GENERAL_MEDICINE", name: "General Medicine", nameAr: "باطنة عامة", description: "Primary and internal care" }
] as const;

type FieldDef = {
  key: string;
  label: string;
  labelAr: string;
  section: string;
  sectionAr: string;
  fieldType: "TEXT" | "TEXT_AREA" | "NUMBER" | "YES_NO" | "DATE" | "DROPDOWN" | "MULTI_SELECT" | "AUTO" | "GRID";
  displayOrder: number;
  isRequired?: boolean;
  helpText?: string;
  helpTextAr?: string;
  visibleWhen?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

const ANDROLOGY_FIELDS: FieldDef[] = [
  { key: "married", label: "Married", labelAr: "متزوج", section: "Marital History", sectionAr: "شاشة التاريخ الزوجي", fieldType: "YES_NO", displayOrder: 1 },
  { key: "marriageDurationYears", label: "Marriage Duration (years)", labelAr: "مدة الزواج (سنوات)", section: "Marital History", sectionAr: "شاشة التاريخ الزوجي", fieldType: "NUMBER", displayOrder: 2 },
  { key: "delayedPregnancyYears", label: "Delayed Pregnancy Years", labelAr: "عدد سنوات تأخر الإنجاب", section: "Marital History", sectionAr: "شاشة التاريخ الزوجي", fieldType: "NUMBER", displayOrder: 3 },
  { key: "hasPreviousChildren", label: "Previous Children", labelAr: "أطفال سابقين", section: "Marital History", sectionAr: "شاشة التاريخ الزوجي", fieldType: "YES_NO", displayOrder: 4 },
  { key: "previousChildrenCount", label: "Children Count", labelAr: "عدد الأطفال", section: "Marital History", sectionAr: "شاشة التاريخ الزوجي", fieldType: "NUMBER", displayOrder: 5, visibleWhen: { field: "hasPreviousChildren", equals: "YES" } },
  { key: "abortionsCount", label: "Abortions", labelAr: "إجهاضات", section: "Marital History", sectionAr: "شاشة التاريخ الزوجي", fieldType: "NUMBER", displayOrder: 6 },
  { key: "previousNaturalPregnancy", label: "Previous Natural Pregnancy", labelAr: "حمل طبيعي سابق", section: "Marital History", sectionAr: "شاشة التاريخ الزوجي", fieldType: "YES_NO", displayOrder: 7 },
  { key: "previousIVF", label: "Previous IVF", labelAr: "IVF سابق", section: "Marital History", sectionAr: "شاشة التاريخ الزوجي", fieldType: "YES_NO", displayOrder: 8 },
  { key: "ivfAttemptsCount", label: "IVF Attempts", labelAr: "عدد محاولات IVF", section: "Marital History", sectionAr: "شاشة التاريخ الزوجي", fieldType: "NUMBER", displayOrder: 9, visibleWhen: { field: "previousIVF", equals: "YES" } },

  { key: "intercoursePerWeek", label: "Intercourse / Week", labelAr: "عدد مرات الجماع أسبوعيا", section: "Sexual History", sectionAr: "شاشة التاريخ الجنسي", fieldType: "NUMBER", displayOrder: 20 },
  { key: "morningErection", label: "Morning Erection", labelAr: "انتصاب صباحي", section: "Sexual History", sectionAr: "شاشة التاريخ الجنسي", fieldType: "YES_NO", displayOrder: 21 },
  { key: "erectionScore", label: "Erection Score (1-5)", labelAr: "درجة الانتصاب (1-5)", section: "Sexual History", sectionAr: "شاشة التاريخ الجنسي", fieldType: "NUMBER", displayOrder: 22 },
  { key: "ejaculationTimeMinutes", label: "Ejaculation Time (minutes)", labelAr: "زمن القذف (دقائق)", section: "Sexual History", sectionAr: "شاشة التاريخ الجنسي", fieldType: "NUMBER", displayOrder: 23 },
  { key: "iiefScore", label: "IIEF Score", labelAr: "IIEF Score", section: "Sexual History", sectionAr: "شاشة التاريخ الجنسي", fieldType: "NUMBER", displayOrder: 24 },
  { key: "prematureEjaculationScore", label: "Premature Ejaculation Score", labelAr: "Premature Ejaculation Score", section: "Sexual History", sectionAr: "شاشة التاريخ الجنسي", fieldType: "NUMBER", displayOrder: 25 },

  { key: "heightCm", label: "Height (cm)", labelAr: "الطول (سم)", section: "General Medical History", sectionAr: "شاشة التاريخ المرضي العام", fieldType: "NUMBER", displayOrder: 30 },
  { key: "weightKg", label: "Weight (kg)", labelAr: "الوزن (كجم)", section: "General Medical History", sectionAr: "شاشة التاريخ المرضي العام", fieldType: "NUMBER", displayOrder: 31 },
  { key: "bmi", label: "BMI", labelAr: "BMI", section: "General Medical History", sectionAr: "شاشة التاريخ المرضي العام", fieldType: "AUTO", displayOrder: 32, metadata: { format: "number:2" } },
  { key: "smoker", label: "Smoker", labelAr: "مدخن", section: "General Medical History", sectionAr: "شاشة التاريخ المرضي العام", fieldType: "YES_NO", displayOrder: 33 },
  { key: "cigarettesPerDay", label: "Cigarettes / Day", labelAr: "عدد السجائر", section: "General Medical History", sectionAr: "شاشة التاريخ المرضي العام", fieldType: "NUMBER", displayOrder: 34, visibleWhen: { field: "smoker", equals: "YES" } },
  { key: "alcoholUse", label: "Alcohol", labelAr: "كحول", section: "General Medical History", sectionAr: "شاشة التاريخ المرضي العام", fieldType: "YES_NO", displayOrder: 35 },
  { key: "exercise", label: "Exercise", labelAr: "ممارسة رياضة", section: "General Medical History", sectionAr: "شاشة التاريخ المرضي العام", fieldType: "YES_NO", displayOrder: 36 },
  { key: "testosteroneUse", label: "Testosterone Use", labelAr: "تعاطي Testosterone", section: "General Medical History", sectionAr: "شاشة التاريخ المرضي العام", fieldType: "YES_NO", displayOrder: 37 },
  { key: "chronicDiseases", label: "Chronic Diseases", labelAr: "أمراض مزمنة", section: "General Medical History", sectionAr: "شاشة التاريخ المرضي العام", fieldType: "MULTI_SELECT", displayOrder: 38 },
  { key: "previousSurgeries", label: "Previous Surgeries", labelAr: "جراحات سابقة", section: "General Medical History", sectionAr: "شاشة التاريخ المرضي العام", fieldType: "MULTI_SELECT", displayOrder: 39 },
  { key: "delayedPuberty", label: "Delayed Puberty", labelAr: "تأخر بعد البلوغ", section: "General Medical History", sectionAr: "شاشة التاريخ المرضي العام", fieldType: "YES_NO", displayOrder: 40 },

  { key: "bloodPressure", label: "Blood Pressure", labelAr: "ضغط الدم", section: "Clinical Examination", sectionAr: "شاشة الفحص الإكلينيكي", fieldType: "NUMBER", displayOrder: 50 },
  { key: "randomGlucose", label: "Random Glucose", labelAr: "سكر عشوائي", section: "Clinical Examination", sectionAr: "شاشة الفحص الإكلينيكي", fieldType: "NUMBER", displayOrder: 51 },
  { key: "bodyHairDistribution", label: "Body Hair Distribution", labelAr: "توزيع شعر الجسم", section: "Clinical Examination", sectionAr: "شاشة الفحص الإكلينيكي", fieldType: "DROPDOWN", displayOrder: 52 },
  { key: "gynecomastia", label: "Gynecomastia", labelAr: "تثدي", section: "Clinical Examination", sectionAr: "شاشة الفحص الإكلينيكي", fieldType: "YES_NO", displayOrder: 53 },
  { key: "muscleWasting", label: "Muscle Wasting", labelAr: "ضمور عضلات", section: "Clinical Examination", sectionAr: "شاشة الفحص الإكلينيكي", fieldType: "YES_NO", displayOrder: 54 },
  { key: "rightTestisVolumeMl", label: "Right Testis Volume (ml)", labelAr: "حجم الخصية يمين (ml)", section: "Testicular Examination", sectionAr: "فحص الخصية (Grid)", fieldType: "NUMBER", displayOrder: 55, metadata: { row: "volume", side: "right" } },
  { key: "leftTestisVolumeMl", label: "Left Testis Volume (ml)", labelAr: "حجم الخصية شمال (ml)", section: "Testicular Examination", sectionAr: "فحص الخصية (Grid)", fieldType: "NUMBER", displayOrder: 56, metadata: { row: "volume", side: "left" } },
  { key: "rightConsistency", label: "Right Consistency", labelAr: "القوام يمين", section: "Testicular Examination", sectionAr: "فحص الخصية (Grid)", fieldType: "DROPDOWN", displayOrder: 57, metadata: { row: "consistency", side: "right" } },
  { key: "leftConsistency", label: "Left Consistency", labelAr: "القوام شمال", section: "Testicular Examination", sectionAr: "فحص الخصية (Grid)", fieldType: "DROPDOWN", displayOrder: 58, metadata: { row: "consistency", side: "left" } },
  { key: "rightPain", label: "Right Pain", labelAr: "ألم يمين", section: "Testicular Examination", sectionAr: "فحص الخصية (Grid)", fieldType: "YES_NO", displayOrder: 59, metadata: { row: "pain", side: "right" } },
  { key: "leftPain", label: "Left Pain", labelAr: "ألم شمال", section: "Testicular Examination", sectionAr: "فحص الخصية (Grid)", fieldType: "YES_NO", displayOrder: 60, metadata: { row: "pain", side: "left" } },
  { key: "rightVaricoceleGrade", label: "Right Varicocele", labelAr: "دوالي يمين", section: "Testicular Examination", sectionAr: "فحص الخصية (Grid)", fieldType: "DROPDOWN", displayOrder: 61, metadata: { row: "varicocele", side: "right" } },
  { key: "leftVaricoceleGrade", label: "Left Varicocele", labelAr: "دوالي شمال", section: "Testicular Examination", sectionAr: "فحص الخصية (Grid)", fieldType: "DROPDOWN", displayOrder: 62, metadata: { row: "varicocele", side: "left" } },
  { key: "rightMass", label: "Right Mass", labelAr: "كتلة يمين", section: "Testicular Examination", sectionAr: "فحص الخصية (Grid)", fieldType: "YES_NO", displayOrder: 63, metadata: { row: "mass", side: "right" } },
  { key: "leftMass", label: "Left Mass", labelAr: "كتلة شمال", section: "Testicular Examination", sectionAr: "فحص الخصية (Grid)", fieldType: "YES_NO", displayOrder: 64, metadata: { row: "mass", side: "left" } },

  { key: "analysisDate", label: "Analysis Date", labelAr: "التاريخ", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "DATE", displayOrder: 70 },
  { key: "abstinenceDays", label: "Abstinence (days)", labelAr: "الامتناع (أيام)", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "NUMBER", displayOrder: 71 },
  { key: "semenVolumeMl", label: "Volume (ml)", labelAr: "الحجم (ml)", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "NUMBER", displayOrder: 72 },
  { key: "viscosity", label: "Viscosity", labelAr: "اللزوجة", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "DROPDOWN", displayOrder: 73 },
  { key: "liquefactionMinutes", label: "Liquefaction (minutes)", labelAr: "السيولة (دقائق)", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "NUMBER", displayOrder: 74 },
  { key: "spermCountMillionPerMl", label: "Count (M/ml)", labelAr: "العدد (M/ml)", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "NUMBER", displayOrder: 75 },
  { key: "totalSpermCount", label: "Total Count", labelAr: "العدد الكلي", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "AUTO", displayOrder: 76, metadata: { format: "number:2" } },
  { key: "progressiveMotility", label: "Progressive Motility", labelAr: "الحركة التقدمية", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "NUMBER", displayOrder: 77 },
  { key: "nonProgressiveMotility", label: "Non-progressive Motility", labelAr: "الحركة غير التقدمية", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "NUMBER", displayOrder: 78 },
  { key: "totalMotility", label: "Total Motility", labelAr: "الحركة الكلية", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "AUTO", displayOrder: 79, metadata: { format: "number:2" } },
  { key: "vitality", label: "Vitality", labelAr: "الحيوية", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "NUMBER", displayOrder: 80 },
  { key: "morphology", label: "Morphology (%)", labelAr: "التشوهات (%)", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "NUMBER", displayOrder: 81 },
  { key: "pusCells", label: "Pus Cells", labelAr: "خلايا صديد", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "NUMBER", displayOrder: 82 },
  { key: "rbc", label: "RBC", labelAr: "RBC", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "NUMBER", displayOrder: 83 },
  { key: "systemDiagnosisAuto", label: "System Diagnosis", labelAr: "التشخيص", section: "Semen Analysis (WHO 2021)", sectionAr: "شاشة تحليل السائل المنوي (WHO 2021)", fieldType: "AUTO", displayOrder: 84 },

  { key: "fsh", label: "FSH", labelAr: "FSH", section: "Hormones", sectionAr: "شاشة الهرمونات", fieldType: "NUMBER", displayOrder: 90 },
  { key: "lh", label: "LH", labelAr: "LH", section: "Hormones", sectionAr: "شاشة الهرمونات", fieldType: "NUMBER", displayOrder: 91 },
  { key: "testosteroneTotal", label: "Testosterone Total", labelAr: "Testosterone Total", section: "Hormones", sectionAr: "شاشة الهرمونات", fieldType: "NUMBER", displayOrder: 92 },
  { key: "freeTestosterone", label: "Free Testosterone", labelAr: "Free Testosterone", section: "Hormones", sectionAr: "شاشة الهرمونات", fieldType: "NUMBER", displayOrder: 93 },
  { key: "shbg", label: "SHBG", labelAr: "SHBG", section: "Hormones", sectionAr: "شاشة الهرمونات", fieldType: "NUMBER", displayOrder: 94 },
  { key: "prolactin", label: "Prolactin", labelAr: "Prolactin", section: "Hormones", sectionAr: "شاشة الهرمونات", fieldType: "NUMBER", displayOrder: 95 },
  { key: "e2", label: "E2", labelAr: "E2", section: "Hormones", sectionAr: "شاشة الهرمونات", fieldType: "NUMBER", displayOrder: 96 },
  { key: "tsh", label: "TSH", labelAr: "TSH", section: "Hormones", sectionAr: "شاشة الهرمونات", fieldType: "NUMBER", displayOrder: 97 },
  { key: "hba1c", label: "HbA1C", labelAr: "HbA1C", section: "Hormones", sectionAr: "شاشة الهرمونات", fieldType: "NUMBER", displayOrder: 98 },

  { key: "karyotype", label: "Karyotype", labelAr: "Karyotype", section: "Genetic Tests", sectionAr: "شاشة الفحوصات الجينية", fieldType: "DROPDOWN", displayOrder: 105 },
  { key: "yMicrodeletion", label: "Y Microdeletion", labelAr: "Y Microdeletion", section: "Genetic Tests", sectionAr: "شاشة الفحوصات الجينية", fieldType: "DROPDOWN", displayOrder: 106 },
  { key: "cftr", label: "CFTR", labelAr: "CFTR", section: "Genetic Tests", sectionAr: "شاشة الفحوصات الجينية", fieldType: "DROPDOWN", displayOrder: 107 },

  { key: "finalDiagnosis", label: "Final Diagnosis", labelAr: "شاشة التشخيص", section: "Diagnosis", sectionAr: "شاشة التشخيص", fieldType: "MULTI_SELECT", displayOrder: 115 }
];

const ANDROLOGY_OPTIONS: Record<string, Array<{ value: string; label: string; labelAr: string }>> = {
  chronicDiseases: [
    { value: "DIABETES", label: "Diabetes", labelAr: "سكر" },
    { value: "HYPERTENSION", label: "Hypertension", labelAr: "ضغط" },
    { value: "CARDIAC", label: "Cardiac", labelAr: "قلب" },
    { value: "LIVER", label: "Liver", labelAr: "كبد" },
    { value: "KIDNEY", label: "Kidney", labelAr: "كلى" },
    { value: "NONE", label: "None", labelAr: "لا يوجد" }
  ],
  previousSurgeries: [
    { value: "INGUINAL_HERNIA", label: "Inguinal Hernia", labelAr: "فتق إربي" },
    { value: "TESTICULAR_SURGERY", label: "Testicular Surgery", labelAr: "جراحة خصية" },
    { value: "TESTICULAR_TORSION", label: "Testicular Torsion", labelAr: "التواء خصية" },
    { value: "VARICOCELE_SURGERY", label: "Varicocele Surgery", labelAr: "دوالي سابقة" },
    { value: "NONE", label: "None", labelAr: "لا يوجد" }
  ],
  bodyHairDistribution: [
    { value: "NORMAL", label: "Normal", labelAr: "طبيعي" },
    { value: "REDUCED", label: "Reduced", labelAr: "قليل" },
    { value: "ABSENT", label: "Absent", labelAr: "غائب" }
  ],
  rightConsistency: [
    { value: "NORMAL", label: "Normal", labelAr: "طبيعي" },
    { value: "SOFT", label: "Soft", labelAr: "لين" },
    { value: "HARD", label: "Hard", labelAr: "صلب" }
  ],
  leftConsistency: [
    { value: "NORMAL", label: "Normal", labelAr: "طبيعي" },
    { value: "SOFT", label: "Soft", labelAr: "لين" },
    { value: "HARD", label: "Hard", labelAr: "صلب" }
  ],
  rightVaricoceleGrade: [
    { value: "NONE", label: "None", labelAr: "لا يوجد" },
    { value: "GRADE_1", label: "Grade 1", labelAr: "درجة 1" },
    { value: "GRADE_2", label: "Grade 2", labelAr: "درجة 2" },
    { value: "GRADE_3", label: "Grade 3", labelAr: "درجة 3" }
  ],
  leftVaricoceleGrade: [
    { value: "NONE", label: "None", labelAr: "لا يوجد" },
    { value: "GRADE_1", label: "Grade 1", labelAr: "درجة 1" },
    { value: "GRADE_2", label: "Grade 2", labelAr: "درجة 2" },
    { value: "GRADE_3", label: "Grade 3", labelAr: "درجة 3" }
  ],
  viscosity: [
    { value: "NORMAL", label: "Normal", labelAr: "طبيعي" },
    { value: "HIGH", label: "High", labelAr: "مرتفع" }
  ],
  karyotype: [
    { value: "NORMAL", label: "Normal", labelAr: "طبيعي" },
    { value: "KLINEFELTER", label: "Klinefelter", labelAr: "Klinefelter" },
    { value: "ABNORMAL", label: "Abnormal", labelAr: "غير طبيعي" }
  ],
  yMicrodeletion: [
    { value: "NONE", label: "None", labelAr: "لا يوجد" },
    { value: "AZFA", label: "AZFa", labelAr: "AZFa" },
    { value: "AZFB", label: "AZFb", labelAr: "AZFb" },
    { value: "AZFC", label: "AZFc", labelAr: "AZFc" }
  ],
  cftr: [
    { value: "NO_MUTATION", label: "No Mutation", labelAr: "لا طفرة" },
    { value: "HETEROZYGOUS", label: "Heterozygous", labelAr: "طفرة أحادية" },
    { value: "HOMOZYGOUS", label: "Homozygous", labelAr: "طفرة مزدوجة" },
    { value: "UNKNOWN", label: "Unknown", labelAr: "غير معروف" }
  ],
  finalDiagnosis: [
    { value: "PRIMARY_INFERTILITY", label: "Primary Infertility", labelAr: "Primary Infertility" },
    { value: "SECONDARY_INFERTILITY", label: "Secondary Infertility", labelAr: "Secondary Infertility" },
    { value: "VARICOCELE", label: "Varicocele", labelAr: "Varicocele" },
    { value: "ERECTILE_DYSFUNCTION", label: "Erectile Dysfunction", labelAr: "Erectile Dysfunction" },
    { value: "HYPOGONADISM", label: "Hypogonadism", labelAr: "Hypogonadism" },
    { value: "OBSTRUCTIVE_AZOOSPERMIA", label: "Obstructive Azoospermia", labelAr: "Obstructive Azoospermia" },
    { value: "NON_OBSTRUCTIVE_AZOOSPERMIA", label: "Non-Obstructive Azoospermia", labelAr: "Non-Obstructive Azoospermia" }
  ]
};

const ANDROLOGY_RULES = [
  {
    key: "compute_bmi",
    name: "Compute BMI",
    nameAr: "حساب BMI",
    type: "COMPUTE",
    displayOrder: 1,
    expression: { formula: "bmi", target: "bmi", heightField: "heightCm", weightField: "weightKg" }
  },
  {
    key: "compute_total_sperm_count",
    name: "Compute Total Sperm Count",
    nameAr: "حساب العدد الكلي",
    type: "COMPUTE",
    displayOrder: 2,
    expression: { formula: "multiply", target: "totalSpermCount", fields: ["semenVolumeMl", "spermCountMillionPerMl"] }
  },
  {
    key: "compute_total_motility",
    name: "Compute Total Motility",
    nameAr: "حساب الحركة الكلية",
    type: "COMPUTE",
    displayOrder: 3,
    expression: { formula: "sum", target: "totalMotility", fields: ["progressiveMotility", "nonProgressiveMotility"] }
  },
  {
    key: "alert_delayed_pregnancy",
    name: "Delayed Pregnancy Alert",
    nameAr: "تنبيه تأخر الإنجاب",
    type: "ALERT",
    displayOrder: 10,
    severity: "HIGH",
    expression: { all: [{ field: "delayedPregnancyYears", op: "gt", value: 3 }], message: "Delayed pregnancy > 3 years", messageAr: "تأخر أكثر من 3 سنوات" }
  },
  {
    key: "alert_iief",
    name: "Low IIEF",
    nameAr: "انخفاض IIEF",
    type: "ALERT",
    displayOrder: 11,
    severity: "MEDIUM",
    expression: { all: [{ field: "iiefScore", op: "lt", value: 21 }], message: "IIEF < 21 (Erectile Dysfunction risk)", messageAr: "IIEF < 21 خطر ضعف الانتصاب" }
  },
  {
    key: "alert_pe",
    name: "Severe PE",
    nameAr: "قذف مبكر شديد",
    type: "ALERT",
    displayOrder: 12,
    severity: "HIGH",
    expression: { all: [{ field: "ejaculationTimeMinutes", op: "lt", value: 1 }], message: "Ejaculation < 1 minute", messageAr: "زمن قذف أقل من دقيقة" }
  },
  {
    key: "alert_obesity",
    name: "Obesity Risk",
    nameAr: "خطر السمنة",
    type: "ALERT",
    displayOrder: 13,
    severity: "MEDIUM",
    expression: { all: [{ field: "bmi", source: "computed", op: "gt", value: 30 }], message: "BMI > 30", messageAr: "BMI أكبر من 30" }
  },
  {
    key: "alert_heavy_smoker",
    name: "Heavy Smoking Risk",
    nameAr: "خطر التدخين الشديد",
    type: "ALERT",
    displayOrder: 14,
    severity: "HIGH",
    expression: { all: [{ field: "smoker", op: "eq", value: "YES" }, { field: "cigarettesPerDay", op: "gt", value: 20 }], message: "Heavy smoker > 20/day", messageAr: "مدخن أكثر من 20 سيجارة" }
  },
  {
    key: "alert_small_testis",
    name: "Small Testis",
    nameAr: "صغر الخصية",
    type: "ALERT",
    displayOrder: 15,
    severity: "HIGH",
    expression: {
      any: [
        { field: "rightTestisVolumeMl", op: "lt", value: 12 },
        { field: "leftTestisVolumeMl", op: "lt", value: 12 }
      ],
      message: "Testis volume < 12 ml",
      messageAr: "حجم الخصية أقل من 12 مل"
    }
  },
  {
    key: "alert_varicocele_grade3",
    name: "Varicocele Grade 3",
    nameAr: "دوالي درجة 3",
    type: "ALERT",
    displayOrder: 16,
    severity: "HIGH",
    expression: {
      any: [
        { field: "rightVaricoceleGrade", op: "eq", value: "GRADE_3" },
        { field: "leftVaricoceleGrade", op: "eq", value: "GRADE_3" }
      ],
      message: "Grade 3 varicocele (surgery candidate)",
      messageAr: "دوالي درجة 3 (مرشح جراحة)"
    }
  },
  {
    key: "alert_azoospermia",
    name: "Azoospermia Alert",
    nameAr: "تنبيه انعدام الحيوانات المنوية",
    type: "ALERT",
    displayOrder: 17,
    severity: "HIGH",
    expression: { all: [{ field: "spermCountMillionPerMl", op: "eq", value: 0 }], message: "Count = 0", messageAr: "العدد = 0" }
  },
  {
    key: "alert_low_motility",
    name: "Low Progressive Motility",
    nameAr: "انخفاض الحركة التقدمية",
    type: "ALERT",
    displayOrder: 18,
    severity: "MEDIUM",
    expression: { all: [{ field: "progressiveMotility", op: "lt", value: 30 }], message: "Progressive motility < 30%", messageAr: "الحركة التقدمية أقل من 30%" }
  },
  {
    key: "alert_terato",
    name: "Terato Alert",
    nameAr: "تنبيه التشوهات",
    type: "ALERT",
    displayOrder: 19,
    severity: "MEDIUM",
    expression: { all: [{ field: "morphology", op: "lt", value: 4 }], message: "Morphology < 4%", messageAr: "التشوهات أقل من 4%" }
  },
  {
    key: "alert_primary_failure",
    name: "Primary Testicular Failure",
    nameAr: "فشل خصوي أولي",
    type: "ALERT",
    displayOrder: 20,
    severity: "HIGH",
    expression: {
      all: [
        { field: "fsh", op: "gt", value: 12 },
        {
          any: [
            { field: "rightTestisVolumeMl", op: "lt", value: 12 },
            { field: "leftTestisVolumeMl", op: "lt", value: 12 }
          ]
        }
      ],
      message: "High FSH with small testis",
      messageAr: "FSH مرتفع مع خصية صغيرة"
    }
  },
  {
    key: "alert_secondary_hypogonadism",
    name: "Secondary Hypogonadism",
    nameAr: "قصور غدد تناسلية ثانوي",
    type: "ALERT",
    displayOrder: 21,
    severity: "HIGH",
    expression: {
      all: [
        { field: "testosteroneTotal", op: "lt", value: 300 },
        { field: "lh", op: "lt", value: 1.5 }
      ],
      message: "Low testosterone with low LH",
      messageAr: "Testosterone منخفض مع LH منخفض"
    }
  },
  {
    key: "alert_pituitary",
    name: "Pituitary Alert",
    nameAr: "تنبيه الغدة النخامية",
    type: "ALERT",
    displayOrder: 22,
    severity: "HIGH",
    expression: { all: [{ field: "prolactin", op: "gt", value: 25 }], message: "High prolactin", messageAr: "Prolactin عالي" }
  },
  {
    key: "diag_azoospermia",
    name: "Azoospermia",
    nameAr: "Azoospermia",
    type: "DIAGNOSIS",
    displayOrder: 30,
    expression: { all: [{ field: "spermCountMillionPerMl", op: "eq", value: 0 }] }
  },
  {
    key: "diag_oligozoospermia",
    name: "Oligozoospermia",
    nameAr: "Oligozoospermia",
    type: "DIAGNOSIS",
    displayOrder: 31,
    expression: { all: [{ field: "spermCountMillionPerMl", op: "gt", value: 0 }, { field: "spermCountMillionPerMl", op: "lt", value: 15 }] }
  },
  {
    key: "diag_asthenozoospermia",
    name: "Asthenozoospermia",
    nameAr: "Asthenozoospermia",
    type: "DIAGNOSIS",
    displayOrder: 32,
    expression: { all: [{ field: "progressiveMotility", op: "lt", value: 30 }] }
  },
  {
    key: "diag_teratozoospermia",
    name: "Teratozoospermia",
    nameAr: "Teratozoospermia",
    type: "DIAGNOSIS",
    displayOrder: 33,
    expression: { all: [{ field: "morphology", op: "lt", value: 4 }] }
  },
  {
    key: "diag_oat",
    name: "OAT",
    nameAr: "OAT",
    type: "DIAGNOSIS",
    displayOrder: 34,
    expression: {
      all: [
        { field: "spermCountMillionPerMl", op: "lt", value: 15 },
        { field: "progressiveMotility", op: "lt", value: 30 },
        { field: "morphology", op: "lt", value: 4 }
      ]
    }
  }
] as const;

const seedSpecialtiesAndAndrology = async () => {
  for (const specialty of DEFAULT_SPECIALTIES) {
    await prisma.specialtyCatalog.upsert({
      where: { code: specialty.code },
      update: {
        name: specialty.name,
        nameAr: specialty.nameAr,
        description: specialty.description,
        isActive: true,
        deletedAt: null
      },
      create: {
        code: specialty.code,
        name: specialty.name,
        nameAr: specialty.nameAr,
        description: specialty.description
      }
    });
  }

  const andrology = await prisma.specialtyCatalog.findUniqueOrThrow({
    where: { code: "ANDROLOGY" }
  });

  const template = await prisma.specialtyTemplate.upsert({
    where: { specialtyId_version: { specialtyId: andrology.id, version: 1 } },
    update: {
      title: "Andrology Assessment",
      titleAr: "تقييم التناسلية",
      isActive: true
    },
    create: {
      specialtyId: andrology.id,
      version: 1,
      title: "Andrology Assessment",
      titleAr: "تقييم التناسلية"
    }
  });

  await prisma.specialtyTemplateOption.deleteMany({
    where: {
      field: {
        templateId: template.id
      }
    }
  });
  await prisma.specialtyRule.deleteMany({
    where: { templateId: template.id }
  });
  await prisma.specialtyTemplateField.deleteMany({
    where: { templateId: template.id }
  });

  await prisma.specialtyTemplateField.createMany({
    data: ANDROLOGY_FIELDS.map((field) => ({
      templateId: template.id,
      key: field.key,
      label: field.label,
      labelAr: field.labelAr,
      section: field.section,
      sectionAr: field.sectionAr,
      fieldType: field.fieldType,
      isRequired: field.isRequired ?? false,
      displayOrder: field.displayOrder,
      helpText: field.helpText,
      helpTextAr: field.helpTextAr,
      visibleWhen: asJson(field.visibleWhen),
      metadata: asJson(field.metadata)
    }))
  });

  const templateFields = await prisma.specialtyTemplateField.findMany({
    where: { templateId: template.id },
    select: { id: true, key: true }
  });
  const fieldIdByKey = new Map(templateFields.map((item) => [item.key, item.id]));

  const optionRows = Object.entries(ANDROLOGY_OPTIONS).flatMap(([fieldKey, options]) => {
    const fieldId = fieldIdByKey.get(fieldKey);
    if (!fieldId) {
      return [];
    }

    return options.map((option, index) => ({
      fieldId,
      value: option.value,
      label: option.label,
      labelAr: option.labelAr,
      displayOrder: index + 1
    }));
  });

  if (optionRows.length) {
    await prisma.specialtyTemplateOption.createMany({
      data: optionRows
    });
  }

  await prisma.specialtyRule.createMany({
    data: ANDROLOGY_RULES.map((rule) => ({
      templateId: template.id,
      key: rule.key,
      name: rule.name,
      nameAr: rule.nameAr,
      type: rule.type,
      expression: rule.expression,
      severity: "severity" in rule ? rule.severity ?? null : null,
      displayOrder: rule.displayOrder
    }))
  });
};

const main = async () => {
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        label: permission.label,
        category: permission.category
      },
      create: permission
    });
  }

  const clinic = await prisma.clinic.upsert({
    where: { slug: "default-clinic" },
    update: {},
    create: {
      name: "Default Healthcare Clinic",
      slug: "default-clinic",
      email: "admin@healthcarecrm.local",
      timezone: "UTC"
    }
  });

  for (const [roleName, permissionKeys] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: {
        clinicId_name: {
          clinicId: clinic.id,
          name: roleName
        }
      },
      update: {
        isSystem: SYSTEM_ROLE_NAMES.includes(roleName as (typeof SYSTEM_ROLE_NAMES)[number]),
        deletedAt: null
      },
      create: {
        clinicId: clinic.id,
        name: roleName,
        isSystem: SYSTEM_ROLE_NAMES.includes(roleName as (typeof SYSTEM_ROLE_NAMES)[number])
      }
    });

    const permissions = await prisma.permission.findMany({
      where: {
        key: { in: permissionKeys }
      },
      select: { id: true }
    });

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id }))
      })
    ]);
  }

  const superAdminRole = await prisma.role.findFirstOrThrow({
    where: { clinicId: clinic.id, name: "SuperAdmin" }
  });

  const passwordHash = await bcrypt.hash("Admin@12345", 12);

  await prisma.user.upsert({
    where: {
      clinicId_email: {
        clinicId: clinic.id,
        email: "admin@healthcarecrm.local"
      }
    },
    update: {
      firstName: "Clinic",
      lastName: "Admin",
      roleId: superAdminRole.id,
      passwordHash
    },
    create: {
      clinicId: clinic.id,
      roleId: superAdminRole.id,
      firstName: "Clinic",
      lastName: "Admin",
      email: "admin@healthcarecrm.local",
      passwordHash
    }
  });

  await seedSpecialtiesAndAndrology();

  const andrology = await prisma.specialtyCatalog.findUniqueOrThrow({
    where: { code: "ANDROLOGY" }
  });

  await prisma.clinicSpecialty.upsert({
    where: {
      clinicId_specialtyId: {
        clinicId: clinic.id,
        specialtyId: andrology.id
      }
    },
    update: { deletedAt: null },
    create: {
      clinicId: clinic.id,
      specialtyId: andrology.id
    }
  });
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
