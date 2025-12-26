import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function SelectBase({ className, ...props }, ref) {
  return <select {...props} ref={ref} className={["input", className ?? ""].join(" ").trim()} />;
});

export default Select;
