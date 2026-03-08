"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RoleName } from "@/types";
import { storage } from "@/lib/storage";
import { hasAllPermissions } from "@/lib/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: RoleName[];
  requiredPermissions?: string[];
}

export default function ProtectedRoute({ children, allowedRoles, requiredPermissions }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const user = storage.getUser();
    if (!user) {
      setIsAuthorized(false);
      setIsCheckingAuth(false);
      router.replace("/login");
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      setIsAuthorized(false);
      setIsCheckingAuth(false);
      router.replace("/dashboard");
      return;
    }

    if (requiredPermissions && !hasAllPermissions(user, requiredPermissions)) {
      setIsAuthorized(false);
      setIsCheckingAuth(false);
      router.replace("/dashboard");
      return;
    }

    setIsAuthorized(true);
    setIsCheckingAuth(false);
  }, [allowedRoles, requiredPermissions, pathname, router]);

  if (isCheckingAuth || !isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
