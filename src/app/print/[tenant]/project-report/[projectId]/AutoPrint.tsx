"use client";
import { useEffect } from "react";
export default function AutoPrint() {
  useEffect(() => {
    setTimeout(() => { window.print(); window.close(); }, 800);
  }, []);
  return null;
}
