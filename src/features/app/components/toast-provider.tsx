"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";

export function ToastProvider() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const notice = searchParams.get("notice");
    if (!notice) return;

    toast.success(notice);
    const next = new URLSearchParams(searchParams);
    next.delete("notice");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return <ToastContainer newestOnTop position="top-right" />;
}
