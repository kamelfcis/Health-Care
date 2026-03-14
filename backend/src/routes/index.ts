import { Router } from "express";
import authRoutes from "./auth.routes";
import clinicRoutes from "./clinic.routes";
import doctorRoutes from "./doctor.routes";
import patientRoutes from "./patient.routes";
import appointmentRoutes from "./appointment.routes";
import medicalRecordRoutes from "./medical-record.routes";
import billingRoutes from "./billing.routes";
import paymentRoutes from "./payment.routes";
import adminRoutes from "./admin.routes";
import dashboardRoutes from "./dashboard.routes";
import leadRoutes from "./lead.routes";
import specialtyRoutes from "./specialty.routes";
import medicineRoutes from "./medicine.routes";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok" }));
router.use("/auth", authRoutes);
router.use("/clinics", clinicRoutes);
router.use("/doctors", doctorRoutes);
router.use("/patients", patientRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/medical-records", medicalRecordRoutes);
router.use("/billing", billingRoutes);
router.use("/payments", paymentRoutes);
router.use("/admin", adminRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/leads", leadRoutes);
router.use("/specialties", specialtyRoutes);
router.use("/medicines", medicineRoutes);

export default router;
