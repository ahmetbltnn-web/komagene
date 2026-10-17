export type Page =
  | "dashboard"
  | "orders"
  | "products"
  | "stock"
  | "expenses"
  | "employees"
  | "reports"
  | "settings";
export type Status = "Hazırlanıyor" | "Hazır" | "Tamamlandı" | "İptal";
export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  unit: string;
  active: boolean;
};
export type Order = {
  id: string;
  number: number;
  customer: string;
  channel: string;
  payment: string;
  status: Status;
  items: {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
  }[];
  total: number;
  createdAt: string;
};
export type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
};
export type Employee = {
  id: string;
  name: string;
  role: string;
  phone: string;
  salary: number;
  active: boolean;
};
export type Movement = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  createdAt: string;
};
export type AppState = {
  settings: { branchName: string; ownerName: string; demoData: boolean };
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  employees: Employee[];
  movements: Movement[];
  generatedAt: string;
};
export const money = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
export const count = (value: number) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
export const localDate = (value: string | Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const dateLabel = (value: string) =>
  new Date(
    value.length === 10 ? value + "T12:00:00+03:00" : value,
  ).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Istanbul",
  });
export const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
export const sum = <T>(values: T[], fn: (value: T) => number) =>
  values.reduce((acc, value) => acc + fn(value), 0);
