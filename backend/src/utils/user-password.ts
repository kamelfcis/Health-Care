import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";

/** Sets bcrypt hash and Super Admin recoverable plaintext (demo/admin use only). */
export async function setUserPassword(userId: string, plainPassword: string) {
  const passwordHash = await bcrypt.hash(plainPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, recoverablePassword: plainPassword }
  });
  return passwordHash;
}

export function hashPasswordWithRecoverable(plainPassword: string) {
  return bcrypt.hash(plainPassword, 12).then((passwordHash) => ({
    passwordHash,
    recoverablePassword: plainPassword
  }));
}
