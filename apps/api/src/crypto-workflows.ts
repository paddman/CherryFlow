import type { WorkflowInput, WorkflowOutput } from "@cherryflow/ui-schema";
import type { WorkflowDefinition } from "./types.js";

const marketTypeOptions = [
  { label: "Spot", value: "spot" },
  { label: "Margin", value: "margin" },
  { label: "Perpetual Swap", value: "swap" },
  { label: "Futures", value: "future" },
  { label: "Options", value: "option" },
];

const orderSideOptions = [
  { label: "Buy", value: "buy" },
  { label: "Sell", value: "sell" },
];

const orderTypeOptions = [
  { label: "Market", value: "market" },
  { label: "Limit", value: "limit" },
];

const timeframeOptions = [
  { label: "1 minute", value: "1m" },
  { label: "5 minutes", value: "5m" },
  { label: "15 minutes", value: "15m" },
  { label: "1 hour", value: "1h" },
  { label: "4 hours", value: "4h" },
  { label: "1 day", value: "1d" },
  { label: "1 week", value: "1w" },
];

const timeInForceOptions = [
  { label: "Exchange default", value: "" },
  { label: "GTC", value: "GTC" },
  { label: "IOC", value: "IOC" },
  { label: "FOK", value: "FOK" },
  { label: "PO / Post Only", value: "PO" },
];

const outputs: WorkflowOutput[] = [
  { name: "result", label: "ผลลัพธ์", type: "markdown" },
  { name: "summary", label: "สรุป", type: "markdown" },
  { name: "data", label: "ข้อมูล", type: "table" },
  { name: "riskChecks", label: "Risk Checks", type: "table" },
  { name: "status", label: "สถานะ", type: "text" },
];

function text(name: string, label: string, required = false, placeholder?: string, description?: string): WorkflowInput {
  return {
    name,
    label,
    type: "text",
    required,
    ...(placeholder ? { placeholder } : {}),
    ...(description ? { description } : {}),
  };
}

function area(name: string, label: string, placeholder?: string, description?: string): WorkflowInput {
  return {
    name,
    label,
    type: "textarea",
    ...(placeholder ? { placeholder } : {}),
    ...(description ? { description } : {}),
  };
}

function numberInput(name: string, label: string, required = false, placeholder?: string, description?: string): WorkflowInput {
  return {
    name,
    label,
    type: "number",
    required,
    ...(placeholder ? { placeholder } : {}),
    ...(description ? { description } : {}),
  };
}

function booleanInput(name: string, label: string, description?: string): WorkflowInput {
  return {
    name,
    label,
    type: "boolean",
    ...(description ? { description } : {}),
  };
}

function select(name: string, label: string, options: Array<{ label: string; value: string }>, required = false, description?: string): WorkflowInput {
  return {
    name,
    label,
    type: "select",
    options,
    required,
    ...(description ? { description } : {}),
  };
}

function baseExchangeInputs(privateApi = false): WorkflowInput[] {
  return [
    text("exchangeId", "Exchange ID", true, "เช่น binance, okx, bybit, bitget", "ใช้ ID ตาม CCXT Exchange Catalog"),
    select("marketType", "Market Type", marketTypeOptions, true),
    booleanInput("sandbox", "ใช้ Testnet / Sandbox", "ควรเปิดสำหรับการทดสอบคำสั่งซื้อขาย"),
    ...(privateApi ? [text("credentialProfile", "Credential Profile", false, "ค่าเริ่มต้นใช้ exchangeId", "อ้างถึง Secret ฝั่ง Serverเท่านั้น ไม่รับ API Key จากฟอร์ม")] : []),
  ];
}

function paramsInput(): WorkflowInput {
  return area(
    "paramsJson",
    "Exchange-specific Params (JSON)",
    "เช่น {\"tdMode\":\"cross\",\"positionSide\":\"long\"}",
    "ส่งต่อไป CCXT สำหรับพารามิเตอร์เฉพาะ Exchange โดยระบบจะบล็อก Secret และคำที่เกี่ยวกับ Withdrawal",
  );
}

function orderInputs(privateApi: boolean): WorkflowInput[] {
  return [
    ...baseExchangeInputs(privateApi),
    text("symbol", "Symbol", true, "BTC/USDT:USDT หรือ BTC/USDT"),
    select("side", "Side", orderSideOptions, true),
    select("orderType", "Order Type", orderTypeOptions, true),
    numberInput("amount", "Amount / Contracts", true, "0.001"),
    numberInput("price", "Limit Price", false, "60000", "จำเป็นเมื่อ Order Type เป็น Limit"),
    numberInput("leverage", "Leverage", false, "1", "มากกว่า 1 ต้องเปิด Allow Leverage และไม่เกินค่าที่ Server กำหนด"),
    booleanInput("reduceOnly", "Reduce Only"),
    select("timeInForce", "Time in Force", timeInForceOptions),
    text("clientOrderId", "Client Order ID", false, "cherryflow-order-001"),
    paramsInput(),
  ];
}

function definition(
  id: string,
  name: string,
  description: string,
  moduleType: string,
  inputs: WorkflowInput[],
  icon: string,
  tags: string[],
  estimatedMinutes: number,
  featured: boolean,
  starterPrompt: string,
): WorkflowDefinition {
  return {
    contract: { id, name, description, inputs, outputs },
    graph: {
      version: "1.0",
      nodes: [
        { id: "input", moduleType: "core.input" },
        { id: "crypto", moduleType, config: { inputNode: "input" } },
        { id: "output", moduleType: "core.output", config: { sourceNode: "crypto" } },
      ],
      edges: [
        { from: "input", to: "crypto" },
        { from: "crypto", to: "output" },
      ],
      outputNodeId: "output",
    },
    template: {
      category: "crypto-trading",
      icon,
      tags,
      featured,
      estimatedMinutes,
      requiresFile: false,
      starterPrompt,
    },
  };
}

export const cryptoWorkflowDefinitions: WorkflowDefinition[] = [
  definition(
    "crypto-exchange-catalog",
    "Crypto Exchange Catalog",
    "ค้นหา Exchange ที่ Adapter CCXT รองรับและผ่าน Allowlist ของ CherryFlow",
    "crypto.exchange.catalog",
    [text("query", "ค้นหา Exchange", false, "binance, thai, dex")],
    "EX",
    ["Crypto", "CCXT", "Exchange", "Catalog"],
    1,
    true,
    "สร้างหน้า Exchange Catalog สำหรับค้นหา Exchange ที่ระบบรองรับ พร้อมสถานะ Adapter และ Allowlist",
  ),
  definition(
    "crypto-exchange-capability-inspector",
    "Exchange Capability Inspector",
    "โหลด Markets และตรวจว่า Exchange รองรับ Ticker, OHLCV, Balance, Orders, Cancel และ Leverage ผ่าน Unified API หรือไม่",
    "crypto.exchange.inspect",
    baseExchangeInputs(false),
    "CAP",
    ["Crypto", "Capability", "Spot", "Futures"],
    2,
    true,
    "สร้างหน้าเช็ก Capability ของ Crypto Exchange รองรับ Spot, Futures, Balance, Order และ Sandbox พร้อมตารางผล",
  ),
  definition(
    "crypto-market-ticker",
    "Crypto Market Snapshot",
    "ดูราคา Bid, Ask, Last, High, Low และ Volume จาก Exchange ที่เลือก",
    "crypto.market.ticker",
    [...baseExchangeInputs(false), text("symbol", "Symbol", true, "BTC/USDT"), paramsInput()],
    "TICK",
    ["Crypto", "Ticker", "Market Data", "Price"],
    2,
    true,
    "สร้างหน้า Market Snapshot เลือก Exchange และ Symbol แล้วแสดง Bid Ask Last High Low Volume",
  ),
  definition(
    "crypto-ohlcv-history",
    "Crypto OHLCV History",
    "ดึงข้อมูลแท่งราคาแบบ Unified OHLCV สำหรับ Chart, Indicator และ Backtest",
    "crypto.market.ohlcv",
    [
      ...baseExchangeInputs(false),
      text("symbol", "Symbol", true, "BTC/USDT"),
      select("timeframe", "Timeframe", timeframeOptions, true),
      { name: "since", label: "เริ่มตั้งแต่วันที่", type: "date" },
      numberInput("limit", "จำนวนแท่ง", false, "100", "สูงสุด 500 แท่งต่อ Run"),
      paramsInput(),
    ],
    "OHLC",
    ["Crypto", "OHLCV", "Candles", "Backtest"],
    3,
    false,
    "สร้างหน้าโหลด OHLCV เลือก Exchange Symbol Timeframe วันที่เริ่มต้น และแสดงตารางแท่งราคา",
  ),
  definition(
    "crypto-portfolio-balance",
    "Crypto Portfolio Balance",
    "อ่านยอด Free, Used และ Total จาก Private API โดยใช้ Credential Profile ฝั่ง Server",
    "crypto.account.balance",
    [...baseExchangeInputs(true), booleanInput("includeZeroBalances", "แสดงยอดเป็นศูนย์"), paramsInput()],
    "BAL",
    ["Crypto", "Portfolio", "Balance", "Private API"],
    3,
    false,
    "สร้างหน้า Portfolio Balance ที่ไม่รับ API Key จาก Browser ใช้ Credential Profile ฝั่ง Server และแสดงยอดสินทรัพย์",
  ),
  definition(
    "crypto-open-orders",
    "Crypto Open Orders",
    "อ่านคำสั่งซื้อขายที่ยังเปิดอยู่โดยไม่แก้ไขบัญชี",
    "crypto.order.open",
    [
      ...baseExchangeInputs(true),
      text("symbol", "Symbol (ไม่บังคับ)", false, "BTC/USDT"),
      numberInput("limit", "จำนวนรายการสูงสุด", false, "100"),
      paramsInput(),
    ],
    "OPEN",
    ["Crypto", "Orders", "Read Only", "Private API"],
    3,
    false,
    "สร้างหน้า Open Orders แบบ Read Only เลือก Exchange และ Symbol พร้อมตารางสถานะคำสั่ง",
  ),
  definition(
    "crypto-paper-order",
    "Crypto Paper Trade",
    "จำลอง Market หรือ Limit Order คำนวณ Precision, Notional และค่าธรรมเนียมโดยไม่ส่งคำสั่งไป Exchange",
    "crypto.order.paper",
    [...orderInputs(false), numberInput("feeBps", "ค่าธรรมเนียมโดยประมาณ (bps)", false, "10")],
    "PAPER",
    ["Crypto", "Paper Trading", "Risk", "Order"],
    4,
    true,
    "สร้างหน้า Paper Trading รองรับ Spot Futures Buy Sell Market Limit คำนวณ Notional Fee และ Risk Checks โดยไม่ส่งเงินจริง",
  ),
  definition(
    "crypto-live-order",
    "Crypto Live / Sandbox Order",
    "ส่งคำสั่งซื้อขายผ่าน Private API เมื่อ Feature Flag, Sandbox Policy, Approval, Confirmation, Allowlist และ Risk Limit ผ่านทั้งหมด",
    "crypto.order.create",
    [
      ...orderInputs(true),
      text("approvalReference", "Approval Reference", true, "APPROVAL-2026-001", "เลขอ้างอิงการอนุมัติหรือ Change Ticket"),
      booleanInput("confirmLiveTrade", "ยืนยันการส่งคำสั่งจริง", "ต้องเปิด พร้อมตั้ง CHERRYFLOW_CRYPTO_LIVE_TRADING=true ฝั่ง Server"),
    ],
    "LIVE",
    ["Crypto", "Live Trading", "Sandbox", "Approval"],
    5,
    false,
    "สร้างหน้า Live Crypto Order ที่มี Approval Reference, Sandbox, Confirm, Notional Limit, Leverage Limit และ Risk Checks",
  ),
  definition(
    "crypto-cancel-order",
    "Crypto Cancel Order",
    "ยกเลิกคำสั่งซื้อขายโดยใช้ Approval และ Confirmation Gate เดียวกับ Account-changing Operation",
    "crypto.order.cancel",
    [
      ...baseExchangeInputs(true),
      text("orderId", "Order ID", true, "123456789"),
      text("symbol", "Symbol (บาง Exchange บังคับ)", false, "BTC/USDT"),
      paramsInput(),
      text("approvalReference", "Approval Reference", true, "APPROVAL-2026-002"),
      booleanInput("confirmCancel", "ยืนยันการยกเลิกคำสั่ง"),
    ],
    "CXL",
    ["Crypto", "Cancel Order", "Approval", "Risk"],
    3,
    false,
    "สร้างหน้า Cancel Crypto Order พร้อม Approval Reference, Confirmation, Sandbox Policy และผลตอบกลับจาก Exchange",
  ),
];
