import type { ReactNode } from "react";

export type ConnectCardItem = {
  key: string;
  name: string;
  description?: string;
  icon?: ReactNode;
  connected: boolean;
  onAction?: () => void;
};

/** §3.2 `connect` block — integration cards with a Connected/Not-connected chip. */
export default function ConnectCards({ items }: { items: ConnectCardItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.key} className="fw-card flex items-center gap-3 px-3.5 py-3">
          {item.icon && <span className="shrink-0 text-[20px]">{item.icon}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-[#20201d]">{item.name}</p>
            {item.description && (
              <p className="mt-0.5 truncate text-[11px] text-[#726e60]">{item.description}</p>
            )}
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-[3px] text-[11px] font-semibold"
            style={
              item.connected
                ? { color: "#3f7d4c", backgroundColor: "#e9f3ea" }
                : { color: "#a19d90", backgroundColor: "#f1efe9" }
            }
          >
            {item.connected ? "Connected" : "Not connected"}
          </span>
          {item.onAction && (
            <button
              type="button"
              onClick={item.onAction}
              className="shrink-0 text-[11.5px] font-semibold text-[#b7452f] hover:underline"
            >
              {item.connected ? "Manage" : "Connect"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
