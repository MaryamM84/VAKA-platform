import { redirect } from "next/navigation";
import { ADMIN_PATH } from "@/lib/admin-api";
export default function Page() { redirect(ADMIN_PATH); }
