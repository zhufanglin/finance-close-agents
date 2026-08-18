import {
  LayoutDashboard,
  Landmark,
  FileText,
  ReceiptText,
  Database,
  ShieldCheck,
  ClipboardCheck,
  Settings,
  Terminal,
  type LucideIcon,
} from "lucide-react";

export type MenuItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type MenuSection = {
  section?: string;
  items: MenuItem[];
};

export const MENU: MenuSection[] = [
  {
    items: [
      { label: "月结指挥中心", href: "/", icon: LayoutDashboard },
      { label: "银企对账", href: "/reconciliation", icon: Landmark },
      { label: "发票中心", href: "/invoices", icon: FileText },
      { label: "费用报销", href: "/expenses", icon: ReceiptText },
    ],
  },
  {
    section: "管理",
    items: [
      { label: "主数据", href: "/masterdata", icon: Database },
      { label: "数据质量", href: "/dataquality", icon: ShieldCheck },
      { label: "审计中心", href: "/audit", icon: ClipboardCheck },
      { label: "系统设置", href: "/settings", icon: Settings },
      { label: "技术演示", href: "/tech", icon: Terminal },
    ],
  },
];

/** 根据路径取当前菜单名，用于面包屑 */
export function currentMenuLabel(pathname: string): string {
  for (const sec of MENU) {
    for (const item of sec.items) {
      if (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) {
        return item.label;
      }
    }
  }
  return "月结指挥中心";
}
