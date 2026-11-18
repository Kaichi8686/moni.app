export type EmployeePassive =
  | { type: "cost_reduce"; amount: number }
  | { type: "tag_boost"; tag: string; factor: number }
  | { type: "mult_bonus"; amount: number };

export type EmployeeDef = {
  id: string;
  name: string;
  role: string;
  passive: EmployeePassive;
  price: number;
};

export const OFFICE_EMPLOYEES: EmployeeDef[] = [
  {
    id: "emp_cashier",
    name: "レジ上手の先輩",
    role: "ops",
    passive: { type: "cost_reduce", amount: 1 },
    price: 400,
  },
  {
    id: "emp_sns",
    name: "SNS好きの後輩",
    role: "promo",
    passive: { type: "tag_boost", tag: "sns", factor: 1.2 },
    price: 500,
  },
  {
    id: "emp_chef",
    name: "こだわりキッチン",
    role: "quality",
    passive: { type: "tag_boost", tag: "price", factor: 1.15 },
    price: 600,
  },
  {
    id: "emp_greeter",
    name: "笑顔の受付",
    role: "service",
    passive: { type: "tag_boost", tag: "service", factor: 1.2 },
    price: 450,
  },
  {
    id: "emp_analyst",
    name: "数字好きの経理",
    role: "ops",
    passive: { type: "mult_bonus", amount: 0.05 },
    price: 550,
  },
  {
    id: "emp_runner",
    name: "動き回るホール",
    role: "ops",
    passive: { type: "tag_boost", tag: "queue", factor: 1.25 },
    price: 500,
  },
  {
    id: "emp_buyer",
    name: "仕入れ上手",
    role: "cost",
    passive: { type: "tag_boost", tag: "cost", factor: 1.2 },
    price: 520,
  },
  {
    id: "emp_mc",
    name: "盛り上げ役",
    role: "promo",
    passive: { type: "tag_boost", tag: "promo", factor: 1.15 },
    price: 480,
  },
];
