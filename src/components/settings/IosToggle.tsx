"use client";

type Props = {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
};

/** iOS設定アプリに近いトグルスイッチ */
export function IosToggle({ checked, onChange, disabled, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 ease-out disabled:opacity-50 ${
        checked ? "bg-[#34C759]" : "bg-[#E5E5EA] dark:bg-[#39393d]"
      }`}
    >
      <span
        aria-hidden
        className={`pointer-events-none h-[27px] w-[27px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.28)] transition-transform duration-200 ease-out ${
          checked ? "translate-x-[20px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}
